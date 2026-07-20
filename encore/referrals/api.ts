import { api, APIError } from "encore.dev/api";
import { randomUUID } from "node:crypto";
import { referralsDB } from "./db";
import { identityDB } from "../identity/db";
import { requireAuth, requireRole } from "../shared/auth";
import { platformEvents } from "../analytics/events";
import { notifyReferralRewardEarned } from "../ops/notifications";
import type { ReferralProgram, ReferralRewardRecord, ReferralTier, UserRole } from "../shared/domain";

interface RewardReferralParams {
  referredUserId: string;
  trigger: "signup" | "booking" | "subscription";
  amount: number;
  program?: ReferralProgram;
  sourceSubscriptionId?: string | null;
  note?: string | null;
}

type RewardStatus = "pending" | "earned" | "paid" | "rejected";

type RewardRow = {
  id: string;
  referrer_id: string;
  referred_user_id: string;
  trigger: "signup" | "booking" | "subscription";
  program: ReferralProgram;
  amount: number;
  status: RewardStatus;
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

type IdentityExecutor = Pick<typeof identityDB, "queryRow" | "exec">;

const HOST_SUBSCRIPTION_REWARD: Record<ReferralTier, number> = {
  bronze: 25,
  silver: 40,
  gold: 60,
};

const GUEST_SUBSCRIPTION_REWARD: Record<ReferralTier, number> = {
  bronze: 1,
  silver: 2,
  gold: 3,
};

const REFERRAL_TRIGGERS = new Set<RewardRow["trigger"]>(["signup", "booking", "subscription"]);
const REFERRAL_PROGRAMS = new Set<ReferralProgram>(["guest", "host"]);
const REFERRAL_STATUSES = new Set<RewardStatus>(["pending", "earned", "paid", "rejected"]);

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

function normalizeRewardNote(note: string | null | undefined) {
  const trimmed = note?.trim();
  return trimmed ? trimmed.slice(0, 500) : null;
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

async function assertManualRewardAllowed(params: {
  referrerId: string;
  referredUserId: string;
  trigger: RewardRow["trigger"];
  program: ReferralProgram;
  amount: number;
  status: RewardStatus;
  sourceSubscriptionId?: string | null;
}) {
  if (!REFERRAL_TRIGGERS.has(params.trigger)) {
    throw APIError.invalidArgument("Invalid referral reward trigger.");
  }
  if (!REFERRAL_PROGRAMS.has(params.program)) {
    throw APIError.invalidArgument("Invalid referral reward program.");
  }
  if (!REFERRAL_STATUSES.has(params.status)) {
    throw APIError.invalidArgument("Invalid referral reward status.");
  }
  if (!Number.isFinite(params.amount) || params.amount <= 0) {
    throw APIError.invalidArgument("Reward amount must be positive.");
  }
  if (params.referrerId === params.referredUserId) {
    throw APIError.failedPrecondition("A user cannot refer themselves.");
  }

  const [referrer, referredUser, duplicate] = await Promise.all([
    getUserById(params.referrerId),
    getUserById(params.referredUserId),
    referralsDB.queryRow<{ id: string }>`
      SELECT id
      FROM referral_rewards
      WHERE referrer_id = ${params.referrerId}
        AND referred_user_id = ${params.referredUserId}
        AND trigger = ${params.trigger}
        AND program = ${params.program}
        AND COALESCE(source_subscription_id, '') = ${params.sourceSubscriptionId ?? ""}
      LIMIT 1
    `,
  ]);

  if (!referrer) {
    throw APIError.notFound("Referrer not found.");
  }
  if (!referredUser) {
    throw APIError.notFound("Referred user not found.");
  }
  if (duplicate) {
    throw APIError.failedPrecondition("A matching referral reward already exists.");
  }
}

async function creditReferrer(db: IdentityExecutor, referrer: IdentityUserRow) {
  const now = new Date().toISOString();
  const nextCount = referrer.referral_count + 1;
  const nextTier = getTierFromCount(nextCount);

  await db.exec`
    UPDATE users
    SET referral_count = ${nextCount},
        tier = ${nextTier},
        updated_at = ${now}
    WHERE id = ${referrer.id}
  `;

  return { nextCount, nextTier };
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

  const referralsTx = await referralsDB.begin();
  const identityTx = await identityDB.begin();

  try {
    const duplicate = await referralsTx.queryRow<RewardRow>`
      SELECT *
      FROM referral_rewards
      WHERE referred_user_id = ${referredUser.id}
        AND trigger = ${"subscription"}
        AND source_subscription_id = ${params.sourceSubscriptionId}
      LIMIT 1
      FOR UPDATE
    `;

    if (duplicate) {
      await identityTx.rollback();
      await referralsTx.rollback();
      return mapReward(duplicate);
    }

    const lockedReferrer = await identityTx.queryRow<IdentityUserRow>`
      SELECT id, role, balance, referral_count, tier, referral_code, referred_by_code
      FROM users
      WHERE id = ${referrer.id}
      FOR UPDATE
    `;

    if (!lockedReferrer) {
      await identityTx.rollback();
      await referralsTx.rollback();
      return null;
    }

    const rewardAmount = getSubscriptionRewardAmount(lockedReferrer.role, lockedReferrer.tier);
    const rewardId = randomUUID();
    const now = new Date().toISOString();
    const program: ReferralProgram = lockedReferrer.role === "host" ? "host" : "guest";

    await referralsTx.exec`
      INSERT INTO referral_rewards (
        id, referrer_id, referred_user_id, trigger, program, amount, status, source_subscription_id, note, created_at
      )
      VALUES (
        ${rewardId}, ${lockedReferrer.id}, ${referredUser.id}, ${"subscription"}, ${program}, ${rewardAmount},
        ${"earned"}, ${params.sourceSubscriptionId}, ${program === "host" ? "Ad credits + promo benefits unlocked from paid host conversion" : "Holiday draw entries unlocked from paid guest conversion"}, ${now}
      )
    `;

    await creditReferrer(identityTx, lockedReferrer);
    await identityTx.commit();
    try {
      await referralsTx.commit();
    } catch (error) {
      await identityDB.exec`
        UPDATE users
        SET referral_count = ${lockedReferrer.referral_count},
            tier = ${lockedReferrer.tier},
            updated_at = ${now}
        WHERE id = ${lockedReferrer.id}
      `;
      throw error;
    }

    await platformEvents.publish({
      type: "referral.reward_earned",
      aggregateId: rewardId,
      actorId: lockedReferrer.id,
      occurredAt: now,
      payload: JSON.stringify({ referrerId: lockedReferrer.id, referredUserId: referredUser.id, amount: rewardAmount }),
    });

    try {
      await notifyReferralRewardEarned({
        referrerId: lockedReferrer.id,
        amount: rewardAmount,
        program,
      });
    } catch (error) {
      console.error("Failed to create referral notification:", error);
    }

    return {
      id: rewardId,
      referrerId: lockedReferrer.id,
      referredUserId: referredUser.id,
      trigger: "subscription" as const,
      program,
      amount: rewardAmount,
      status: "earned" as const,
      createdAt: now,
    };
  } catch (error) {
    await identityTx.rollback().catch(() => undefined);
    await referralsTx.rollback().catch(() => undefined);
    throw error;
  }
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
    const auth = requireRole("admin", "support");
    const rewardProgram = program ?? "guest";
    const rewardStatus: RewardStatus = "earned";
    await assertManualRewardAllowed({
      referrerId: auth.userID,
      referredUserId,
      trigger,
      program: rewardProgram,
      amount,
      status: rewardStatus,
      sourceSubscriptionId,
    });

    const rewardId = randomUUID();
    const now = new Date().toISOString();
    const rewardNote = normalizeRewardNote(note);

    await referralsDB.exec`
      INSERT INTO referral_rewards (
        id, referrer_id, referred_user_id, trigger, program, amount, status, source_subscription_id, note, created_at
      )
      VALUES (
        ${rewardId}, ${auth.userID}, ${referredUserId}, ${trigger}, ${rewardProgram}, ${amount},
        ${rewardStatus}, ${sourceSubscriptionId ?? null}, ${rewardNote}, ${now}
      )
    `;

    await platformEvents.publish({
      type: "referral.reward_earned",
      aggregateId: rewardId,
      actorId: auth.userID,
      occurredAt: now,
      payload: JSON.stringify({ referrerId: auth.userID, referredUserId, amount }),
    });

    try {
      await notifyReferralRewardEarned({
        referrerId: auth.userID,
        amount,
      });
    } catch (error) {
      console.error("Failed to create referral notification:", error);
    }

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
  status?: RewardStatus;
  sourceSubscriptionId?: string | null;
  note?: string | null;
}, { reward: ReferralRewardRecord }>(
  { expose: true, method: "POST", path: "/admin/referrals", auth: true },
  async ({ referrerId, referredUserId, trigger, program, amount, status, sourceSubscriptionId, note }) => {
    requireRole("admin", "support");
    const rewardStatus = status ?? "earned";
    const rewardProgram = program ?? "guest";
    await assertManualRewardAllowed({
      referrerId,
      referredUserId,
      trigger,
      program: rewardProgram,
      amount,
      status: rewardStatus,
      sourceSubscriptionId,
    });

    const id = randomUUID();
    const createdAt = new Date().toISOString();
    const rewardNote = normalizeRewardNote(note);

    await referralsDB.exec`
      INSERT INTO referral_rewards (
        id, referrer_id, referred_user_id, trigger, program, amount, status, source_subscription_id, note, created_at
      )
      VALUES (
        ${id}, ${referrerId}, ${referredUserId}, ${trigger}, ${rewardProgram}, ${amount}, ${rewardStatus},
        ${sourceSubscriptionId ?? null}, ${rewardNote}, ${createdAt}
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
    const deleted = await referralsDB.queryRow<{ id: string }>`
      DELETE FROM referral_rewards
      WHERE id = ${rewardId}
      RETURNING id
    `;
    if (!deleted) {
      throw APIError.notFound("Referral reward not found.");
    }
    return { deleted: true };
  },
);
