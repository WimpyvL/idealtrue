import React, { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import {
  ArrowRight,
  CheckCircle2,
  Copy,
  Crown,
  Gift,
  Medal,
  Sparkles,
  Star,
  Target,
  TrendingUp,
  Users,
} from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { formatRand } from '@/lib/currency';
import { listReferralLeaderboard, type LeaderboardUser } from '@/lib/identity-client';
import { cn } from '@/lib/utils';
import type { Referral, UserProfile } from '@/types';

type TierDefinition = {
  name: 'Bronze' | 'Silver' | 'Gold';
  range: string;
  bonus: number;
  minReferrals: number;
  nextThreshold: number | null;
  accent: string;
  ring: string;
  surface: string;
  note: string;
};

const HOST_TIERS: TierDefinition[] = [
  {
    name: 'Bronze',
    range: '1-5 referrals',
    bonus: 75,
    minReferrals: 0,
    nextThreshold: 6,
    accent: 'text-amber-700',
    ring: 'border-amber-200',
    surface: 'bg-amber-50',
    note: 'Earn cashback when a referred host activates a paid subscription.',
  },
  {
    name: 'Silver',
    range: '6-15 referrals',
    bonus: 125,
    minReferrals: 6,
    nextThreshold: 16,
    accent: 'text-slate-700',
    ring: 'border-slate-200',
    surface: 'bg-slate-100',
    note: 'Higher cashback once your referral engine starts compounding.',
  },
  {
    name: 'Gold',
    range: '16+ referrals',
    bonus: 175,
    minReferrals: 16,
    nextThreshold: null,
    accent: 'text-yellow-700',
    ring: 'border-yellow-200',
    surface: 'bg-yellow-50',
    note: 'Highest cashback for hosts who consistently bring in converting supply.',
  },
];

const GUEST_TIERS: TierDefinition[] = [
  {
    name: 'Bronze',
    range: '1-5 referrals',
    bonus: 40,
    minReferrals: 0,
    nextThreshold: 6,
    accent: 'text-amber-700',
    ring: 'border-amber-200',
    surface: 'bg-amber-50',
    note: 'Cashback when a referred guest becomes a paying platform customer.',
  },
  {
    name: 'Silver',
    range: '6-15 referrals',
    bonus: 65,
    minReferrals: 6,
    nextThreshold: 16,
    accent: 'text-slate-700',
    ring: 'border-slate-200',
    surface: 'bg-slate-100',
    note: 'Better conversion rewards as your network starts to scale.',
  },
  {
    name: 'Gold',
    range: '16+ referrals',
    bonus: 90,
    minReferrals: 16,
    nextThreshold: null,
    accent: 'text-yellow-700',
    ring: 'border-yellow-200',
    surface: 'bg-yellow-50',
    note: 'Top cashback for consistently sending high-value demand.',
  },
];

function getTierBadgeStyles(tier?: string | null) {
  switch (`${tier || ''}`.toLowerCase()) {
    case 'gold':
      return 'border-yellow-200 bg-yellow-50 text-yellow-700';
    case 'silver':
      return 'border-slate-200 bg-slate-100 text-slate-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

function getReferralStatusStyles(status: Referral['status']) {
  switch (status) {
    case 'confirmed':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'rewarded':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'rejected':
      return 'border-rose-200 bg-rose-50 text-rose-700';
    default:
      return 'border-amber-200 bg-amber-50 text-amber-700';
  }
}

function getReferralStatusLabel(status: Referral['status']) {
  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'rewarded':
      return 'Rewarded';
    case 'rejected':
      return 'Rejected';
    default:
      return 'Pending';
  }
}

function getReferralTriggerLabel(referral: Referral, isHost: boolean) {
  if (referral.trigger === 'subscription') {
    return isHost ? 'Paid host subscription' : 'Paid platform conversion';
  }
  if (referral.trigger === 'booking') {
    return 'Completed booking';
  }
  return 'New signup';
}

export default function ReferralView({
  profile,
  referrals,
}: {
  profile: UserProfile | null;
  referrals: Referral[];
}) {
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<LeaderboardUser[]>([]);

  const isHost = profile?.role === 'host';
  const tiers = isHost ? HOST_TIERS : GUEST_TIERS;
  const referralCode = profile?.referralCode?.trim() || '';
  const referralLink = referralCode ? `${window.location.origin}?ref=${referralCode}` : '';
  const totalEarned = referrals
    .filter((referral) => referral.status === 'rewarded' || referral.status === 'confirmed')
    .reduce((sum, referral) => sum + referral.amount, 0);
  const pendingValue = referrals
    .filter((referral) => referral.status === 'pending')
    .reduce((sum, referral) => sum + referral.amount, 0);
  const rewardedCount = referrals.filter((referral) => referral.status === 'rewarded' || referral.status === 'confirmed').length;
  const currentTier = tiers.find((tier) => tier.name.toLowerCase() === profile?.tier) || tiers[0];
  const nextTier = tiers.find((tier) => tier.minReferrals > (profile?.referralCount || 0)) || null;
  const progressBase = nextTier?.nextThreshold ? nextTier.nextThreshold - currentTier.minReferrals : 1;
  const progressValue = nextTier
    ? (((profile?.referralCount || 0) - currentTier.minReferrals) / progressBase) * 100
    : 100;

  useEffect(() => {
    let cancelled = false;

    listReferralLeaderboard()
      .then((users) => {
        if (!cancelled) {
          setLeaderboard(users);
        }
      })
      .catch((error) => {
        console.warn('Leaderboard fetch error:', error);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  function copyToClipboard() {
    if (!referralLink) {
      return;
    }
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="space-y-8 pb-10">
      <section className="relative overflow-hidden rounded-[2rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.9),_rgba(255,255,255,0.72)_35%,_rgba(196,233,255,0.78)_100%)] p-8 shadow-[0_24px_80px_rgba(15,23,42,0.08)] md:p-10">
        <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-cyan-200/50 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-48 w-48 rounded-full bg-amber-200/40 blur-3xl" />

        <div className="relative grid gap-8 lg:grid-cols-[1.4fr_0.9fr]">
          <div className="space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-600">
              <Sparkles className="h-3.5 w-3.5 text-cyan-600" />
              Referral Engine
            </div>

            <div className="space-y-3">
              <h1 className="max-w-2xl text-4xl font-bold tracking-tight text-slate-950 md:text-5xl">
                {isHost ? 'Turn host introductions into recurring cashback.' : 'Turn your network into rewarded demand.'}
              </h1>
              <p className="max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                {isHost
                  ? 'Share your link with serious hosts. When one activates a paid subscription, you collect cashback and climb the partner ladder.'
                  : 'Share your link with guests. When they become paying customers, you earn cashback and move up the rewards tiers.'}
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Current Tier</p>
                <div className="mt-3 flex items-center gap-3">
                  <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', getTierBadgeStyles(profile?.tier))}>
                    <Crown className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-950 capitalize">{profile?.tier || 'bronze'}</p>
                    <p className="text-sm text-slate-500">{currentTier.range}</p>
                  </div>
                </div>
              </div>

              <div className="rounded-2xl border border-white/80 bg-white/80 p-4 backdrop-blur">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Successful Referrals</p>
                <p className="mt-3 text-3xl font-bold text-slate-950">{profile?.referralCount || 0}</p>
                <p className="mt-1 text-sm text-slate-500">{rewardedCount} converted into paid or confirmed value</p>
              </div>

              <div className="rounded-2xl border border-white/80 bg-slate-950 p-4 text-white shadow-lg shadow-slate-950/15">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Earned So Far</p>
                <p className="mt-3 text-3xl font-bold">{formatRand(totalEarned)}</p>
                <p className="mt-1 text-sm text-slate-300">
                  {pendingValue > 0 ? `${formatRand(pendingValue)} still pending approval` : 'No pending cashback right now'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 rounded-[1.75rem] border border-slate-200 bg-white/85 p-6 backdrop-blur">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Share Link</p>
                <h2 className="mt-2 text-2xl font-bold text-slate-950">Your referral asset</h2>
              </div>
              <div className="rounded-2xl bg-cyan-50 p-3 text-cyan-700">
                <Gift className="h-5 w-5" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Referral Code</p>
              <p className="mt-2 font-mono text-lg font-bold text-slate-950">{referralCode}</p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Link</p>
              <p className="mt-2 break-all font-mono text-sm text-slate-700">{referralLink}</p>
            </div>

            <Button onClick={copyToClipboard} className="h-12 w-full rounded-xl bg-slate-950 text-white hover:bg-slate-800">
              {copied ? <CheckCircle2 className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
              {copied ? 'Copied to clipboard' : 'Copy referral link'}
            </Button>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">Best for</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isHost ? 'Hosts who need listing growth, better promotion, or more scale.' : 'Guests who already trust your recommendations.'}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 p-4">
                <p className="text-sm font-semibold text-slate-950">Reward trigger</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isHost ? 'Their first paid host subscription activates your cashback.' : 'Their first paid platform conversion activates your cashback.'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-8 xl:grid-cols-[1.3fr_0.9fr]">
        <div className="space-y-8">
          <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm">
            <div className="border-b border-slate-200 bg-slate-950 px-6 py-5 text-white">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Progression</p>
                  <h2 className="mt-1 text-2xl font-bold">Tier ladder</h2>
                </div>
                <div className="text-sm text-slate-300">
                  {nextTier
                    ? `${Math.max(nextTier.minReferrals - (profile?.referralCount || 0), 0)} more referrals to reach ${nextTier.name}`
                    : 'You are already at the top tier'}
                </div>
              </div>
            </div>

            <div className="space-y-6 p-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Current momentum</span>
                  <span className="font-semibold text-slate-900">{Math.max(0, Math.min(progressValue, 100)).toFixed(0)}%</span>
                </div>
                <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(8, Math.min(progressValue, 100))}%` }}
                    className="h-full rounded-full bg-[linear-gradient(90deg,#0f172a_0%,#0891b2_50%,#f59e0b_100%)]"
                  />
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-3">
                {tiers.map((tier) => {
                  const active = currentTier.name === tier.name;
                  return (
                    <div
                      key={tier.name}
                      className={cn(
                        'rounded-[1.5rem] border p-5 transition-all',
                        active ? 'border-slate-900 bg-slate-950 text-white shadow-xl shadow-slate-950/10' : `${tier.ring} ${tier.surface}`,
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <div className={cn('flex h-11 w-11 items-center justify-center rounded-2xl border', active ? 'border-white/15 bg-white/10 text-white' : `${tier.ring} bg-white ${tier.accent}`)}>
                          <Medal className="h-5 w-5" />
                        </div>
                        <span className={cn('rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em]', active ? 'bg-white/10 text-white' : 'bg-white text-slate-600')}>
                          {tier.range}
                        </span>
                      </div>
                      <h3 className="mt-5 text-xl font-bold">{tier.name}</h3>
                      <p className={cn('mt-2 text-sm leading-6', active ? 'text-slate-300' : 'text-slate-600')}>{tier.note}</p>
                      <div className="mt-6 flex items-end justify-between">
                        <div>
                          <p className={cn('text-xs font-semibold uppercase tracking-[0.18em]', active ? 'text-slate-400' : 'text-slate-500')}>Cashback</p>
                          <p className="mt-1 text-3xl font-bold">{formatRand(tier.bonus)}</p>
                        </div>
                        {active ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold">
                            Active
                          </span>
                        ) : tier.nextThreshold ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500">
                            Reach {tier.minReferrals} <ArrowRight className="h-3.5 w-3.5" />
                          </span>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <Card className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">History</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">Reward timeline</h2>
              </div>
              <div className="text-sm text-slate-500">
                {referrals.length > 0 ? `${referrals.length} recorded referral events` : 'No referral events yet'}
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {referrals.length > 0 ? (
                referrals.map((referral) => (
                  <div
                    key={referral.id}
                    className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:flex-row md:items-center md:justify-between"
                  >
                    <div className="flex items-start gap-4">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-slate-700 shadow-sm">
                        <TrendingUp className="h-5 w-5" />
                      </div>
                      <div className="space-y-1">
                        <p className="font-semibold text-slate-950">{getReferralTriggerLabel(referral, isHost)}</p>
                        <p className="text-sm text-slate-500">
                          {format(new Date(referral.createdAt), 'MMM d, yyyy')} at {format(new Date(referral.createdAt), 'HH:mm')}
                        </p>
                        <div className={cn('inline-flex rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em]', getReferralStatusStyles(referral.status))}>
                          {getReferralStatusLabel(referral.status)}
                        </div>
                      </div>
                    </div>

                    <div className="text-left md:text-right">
                      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Reward Value</p>
                      <p className={cn('mt-1 text-2xl font-bold', referral.status === 'rejected' ? 'text-rose-600' : 'text-emerald-600')}>
                        {referral.status === 'rejected' ? `-${formatRand(referral.amount)}` : `+${formatRand(referral.amount)}`}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50 px-6 py-12 text-center">
                  <Target className="mx-auto h-10 w-10 text-slate-300" />
                  <h3 className="mt-4 text-lg font-bold text-slate-950">No referral history yet</h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">
                    Start with the share link above. Once someone converts through your referral, the reward timeline starts filling out automatically.
                  </p>
                </div>
              )}
            </div>
          </Card>
        </div>

        <div className="space-y-8">
          <Card className="border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="rounded-2xl bg-yellow-50 p-3 text-yellow-600">
                <Star className="h-5 w-5 fill-yellow-500" />
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Leaderboard</p>
                <h2 className="mt-1 text-2xl font-bold text-slate-950">Top referrers</h2>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {leaderboard.length > 0 ? (
                leaderboard.slice(0, 6).map((user, index) => (
                  <div
                    key={user.id}
                    className={cn(
                      'flex items-center justify-between rounded-2xl border p-3',
                      user.id === profile?.id ? 'border-cyan-200 bg-cyan-50' : 'border-slate-200 bg-slate-50',
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-xl text-sm font-bold',
                        index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-slate-200 text-slate-700' : index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-white text-slate-500',
                      )}>
                        #{index + 1}
                      </div>
                      <img
                        src={user.photoUrl || `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.displayName)}`}
                        alt=""
                        className="h-10 w-10 rounded-xl border border-slate-200 object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <p className="max-w-[150px] truncate text-sm font-semibold text-slate-950">{user.displayName}</p>
                        <p className="text-xs uppercase tracking-[0.16em] text-slate-500">{user.tier}</p>
                      </div>
                    </div>

                    <div className="text-right">
                      <p className="text-lg font-bold text-slate-950">{user.referralCount}</p>
                      <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">Referrals</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 px-5 py-8 text-center text-sm text-slate-500">
                  Leaderboard data is still loading or currently unavailable.
                </div>
              )}
            </div>
          </Card>

          <Card className="overflow-hidden border border-slate-200 bg-white p-0 shadow-sm">
            <div className="bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_55%,#0f766e_100%)] px-6 py-6 text-white">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Playbook</p>
              <h2 className="mt-2 text-2xl font-bold">How to make this work</h2>
            </div>

            <div className="space-y-5 p-6">
              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">1</div>
                <div>
                  <p className="font-semibold text-slate-950">Send the link to qualified people</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {isHost ? 'Target serious hosts who actually need better listing growth and paid tools.' : 'Share with guests who already trust your recommendations.'}
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">2</div>
                <div>
                  <p className="font-semibold text-slate-950">Let attribution do its job</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Their signup carries your referral code automatically, so you do not need manual follow-up to claim the connection.
                  </p>
                </div>
              </div>

              <div className="flex gap-4">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-sm font-bold text-white">3</div>
                <div>
                  <p className="font-semibold text-slate-950">Cashback lands when value lands</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    {isHost
                      ? 'You only get paid when the referred host activates a paid subscription. That keeps the program tied to real revenue.'
                      : 'You only get paid when the referred user becomes a real paying customer. That keeps rewards grounded in conversion.'}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-cyan-100 bg-cyan-50 p-4">
                <div className="flex items-center gap-2 text-cyan-800">
                  <Users className="h-4 w-4" />
                  <p className="text-sm font-semibold">Best practice</p>
                </div>
                <p className="mt-2 text-sm leading-6 text-cyan-900/80">
                  The strongest referral loops come from credibility. Send the link with context, not spam: who the platform is for, what they gain, and why now.
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}
