import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { referralsDB } from "./db";
import { identityDB } from "../identity/db";
import { requireAuth, requireRole } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import type { ReferralProgram, ReferralRewardRecord, ReferralTier, UserRole } from "../shared/domain";

interface RewardReferralParams {
  referredUserId: string;
  trigger: "signup" | "booking" | "subscription";
  amount: number;
  program?: ReferralProgram;
  sourceSubscriptionId?: string | null;
  note?: string | null;
}

type RewardRow = {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  trigger: "signup" | "booking" | "subscription";
  program: ReferralProgram;
  amount: number;
  status: "pending" | "earned" | "paid" | "rejected";
  source_subscription_id: string | null;
  note: string | null;
  created_at: string;
};

type IdentityUserRow = {
  id: string;
  role: UserRole;
  balance: number;
  referral_count: number;
  tier: ReferralTier;
  referral_code: string | null;
  referred_by_code: string | null;
};

const HOST_SUBSCRIPTION_REWARD: Record<ReferralTier, number> = {
  bronze: 75,
  silver: 125,
  gold: 175,
};

const GUEST_SUBSCRIPTION_REWARD: Record<ReferralTier, number> = {
  bronze: 40,
  silver: 65,
  gold: 90,
};

function mapReward(row: RewardRow): ReferralRewardRecord {
  return {
    id: row.id,
    referrerId: row.referrer_id,
    referredUserId: row.referred_user_id,
    trigger: row.trigger,
    program: row.program,
    amount: row.amount,
    status: row.status,
    createdAt: row.created_at,
  };
}

function getTierFromCount(count: number): ReferralTier {
  if (count >= 16) {
    return "gold";
  }
  if (count >= 6) {
    return "silver";
  }
  return "bronze";
}

function getSubscriptionRewardAmount(role: UserRole, tier: ReferralTier) {
  return role === "host" ? HOST_SUBSCRIPTION_REWARD[tier] : GUEST_SUBSCRIPTION_REWARD[tier];
}

async function getUserByReferralCode(referralCode: string) {
  return identityDB.queryRow<IdentityUserRow>`
    SELECT id, role, balance, referral_count, tier, referral_code, referred_by_code
    FROM users
    WHERE referral_code = ${referralCode}
  `;
}

async function getUserById(userId: string) {
  return identityDB.queryRow<IdentityUserRow>`
    SELECT id, role, balance, referral_count, tier, referral_code, referred_by_code
    FROM users
    WHERE id = ${userId}
  `;
}

async function creditReferrer(referrer: IdentityUserRow, rewardAmount: number) {
  const nextCount = referrer.referral_count + 1;
  const nextTier = getTierFromCount(nextCount);

  await identityDB.exec`
    UPDATE users
    SET balance = balance + ${rewardAmount},
        referral_count = ${nextCount},
        tier = ${nextTier},
        updated_at = ${new Date().toISOString()}
    WHERE id = ${referrer.id}
  `;
}

export async function rewardSubscriptionReferralConversion(params: {
  referredUserId: string;
  sourceSubscriptionId: string;
}) {
  const referredUser = await getUserById(params.referredUserId);
  if (!referredUser?.referred_by_code) {
    return null;
  }

  const referrer = await getUserByReferralCode(referredUser.referred_by_code);
  if (!referrer || referrer.id === referredUser.id) {
    return null;
  }

  const duplicate = await referralsDB.queryRow<RewardRow>`
    SELECT *
    FROM referral_rewards
    WHERE referred_user_id = ${referredUser.id}
      AND trigger = ${"subscription"}
      AND source_subscription_id = ${params.sourceSubscriptionId}
    LIMIT 1
  `;

  if (duplicate) {
    return mapReward(duplicate);
  }

  const rewardAmount = getSubscriptionRewardAmount(referrer.role, referrer.tier);
  const rewardId = randomUUID();
  const now = new Date().toISOString();
  const program: ReferralProgram = referrer.role === "host" ? "host" : "guest";

  await referralsDB.exec`
    INSERT INTO referral_rewards (
      id, referrer_id, referred_user_id, trigger, program, amount, status, source_subscription_id, note, created_at
    )
    VALUES (
      ${rewardId}, ${referrer.id}, ${referredUser.id}, ${"subscription"}, ${program}, ${rewardAmount},
      ${"earned"}, ${params.sourceSubscriptionId}, ${"First paid subscription conversion"}, ${now}
    )
  `;

  await creditReferrer(referrer, rewardAmount);

  await platformEvents.publish({
    type: "referral.reward_earned",
    aggregateId: rewardId,
    actorId: referrer.id,
    occurredAt: now,
    payload: JSON.stringify({ referrerId: referrer.id, referredUserId: referredUser.id, amount: rewardAmount }),
  });

  return {
    id: rewardId,
    referrerId: referrer.id,
    referredUserId: referredUser.id,
    trigger: "subscription" as const,
    program,
    amount: rewardAmount,
    status: "earned" as const,
    createdAt: now,
  };
}

export const listMyReferralRewards = api<void, { rewards: ReferralRewardRecord[] }>(
  { expose: true, method: "GET", path: "/referrals/rewards", auth: true },
  async () => {
    const auth = requireAuth();
    const rewards = await referralsDB.queryAll<RewardRow>`
      SELECT *
      FROM referral_rewards
      WHERE referrer_id = ${auth.userID}
      ORDER BY created_at DESC
    `;
    return { rewards: rewards.map(mapReward) };
  },
);

export const rewardReferral = api<RewardReferralParams, { rewardId: string }>(
  { expose: true, method: "POST", path: "/referrals/rewards", auth: true },
  async ({ referredUserId, trigger, amount, program, sourceSubscriptionId, note }) => {
    const auth = requireAuth();
    const rewardId = randomUUID();
    const now = new Date().toISOString();

    await referralsDB.exec`
      INSERT INTO referral_rewards (
        id, referrer_id, referred_user_id, trigger, program, amount, status, source_subscription_id, note, created_at
      )
      VALUES (
        ${rewardId}, ${auth.userID}, ${referredUserId}, ${trigger}, ${program ?? "guest"}, ${amount},
        ${"earned"}, ${sourceSubscriptionId ?? null}, ${note ?? null}, ${now}
      )
    `;

    await platformEvents.publish({
      type: "referral.reward_earned",
      aggregateId: rewardId,
      actorId: auth.userID,
      occurredAt: now,
      payload: JSON.stringify({ referrerId: auth.userID, referredUserId, amount }),
    });

    return { rewardId };
  },
);

export const listAdminReferralRewards = api<void, { rewards: ReferralRewardRecord[] }>(
  { expose: true, method: "GET", path: "/admin/referrals", auth: true },
  async () => {
    requireRole("admin", "support");
    const rewards = await referralsDB.queryAll<RewardRow>`
      SELECT *
      FROM referral_rewards
      ORDER BY created_at DESC
    `;
    return { rewards: rewards.map(mapReward) };
  },
);

export const createAdminReferralReward = api<{
  referrerId: string;
  referredUserId: string;
  trigger: "signup" | "booking" | "subscription";
  program?: ReferralProgram;
  amount: number;
  status?: "pending" | "earned" | "paid" | "rejected";
  sourceSubscriptionId?: string | null;
  note?: string | null;
}, { reward: ReferralRewardRecord }>(
  { expose: true, method: "POST", path: "/admin/referrals", auth: true },
  async ({ referrerId, referredUserId, trigger, program, amount, status, sourceSubscriptionId, note }) => {
    requireRole("admin", "support");
    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const rewardStatus = status ?? "earned";
    const rewardProgram = program ?? "guest";

    await referralsDB.exec`
      INSERT INTO referral_rewards (
        id, referrer_id, referred_user_id, trigger, program, amount, status, source_subscription_id, note, created_at
      )
      VALUES (
        ${id}, ${referrerId}, ${referredUserId}, ${trigger}, ${rewardProgram}, ${amount}, ${rewardStatus},
        ${sourceSubscriptionId ?? null}, ${note ?? null}, ${createdAt}
      )
    `;

    return {
      reward: {
        id,
        referrerId,
        referredUserId,
        trigger,
        program: rewardProgram,
        amount,
        status: rewardStatus,
        createdAt,
      },
    };
  },
);

export const deleteAdminReferralReward = api<{ rewardId: string }, { deleted: true }>(
  { expose: true, method: "DELETE", path: "/admin/referrals/:rewardId", auth: true },
  async ({ rewardId }) => {
    requireRole("admin", "support");
    await referralsDB.exec`
      DELETE FROM referral_rewards
      WHERE id = ${rewardId}
    `;
    return { deleted: true };
  },
);
