import React, { useState, useEffect } from 'react';
import { UserProfile, Referral } from '@/types';
import { db } from '@/firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError } from '@/lib/firestore';
import { OperationType } from '@/types';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Copy, 
  DollarSign, 
  TrendingUp, 
  Star, 
  AlertCircle 
} from 'lucide-react';
import { format } from 'date-fns';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';

export default function ReferralView({ profile, referrals }: { profile: UserProfile | null, referrals: Referral[] }) {
  const [copied, setCopied] = useState(false);
  const [leaderboard, setLeaderboard] = useState<UserProfile[]>([]);
  const referralLink = `${window.location.origin}?ref=${profile?.referralCode}`;

  useEffect(() => {
    if (!db) return;
    const q = query(collection(db, 'users'), orderBy('referralCount', 'desc'), limit(5));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLeaderboard(snapshot.docs.map(doc => doc.data() as UserProfile));
    }, (err) => {
      // We don't want to crash the whole page if leaderboard fails (e.g. not logged in)
      console.warn('Leaderboard fetch error:', err);
    });
    return () => unsubscribe();
  }, []);

  const copyToClipboard = () => {
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const totalEarned = referrals.reduce((acc, curr) => acc + curr.amount, 0);

  const tiers = [
    { name: 'Bronze', range: '1-5 referrals', bonus: '$50', benefits: 'Standard referral bonus', color: 'text-amber-700 bg-amber-100', min: 0, next: 6 },
    { name: 'Silver', range: '6-15 referrals', bonus: '$75', benefits: 'Increased bonus + 5% fee discount', color: 'text-on-surface-variant bg-surface-container-high', min: 6, next: 16 },
    { name: 'Gold', range: '16+ referrals', bonus: '$100', benefits: 'Max bonus + 15% fee discount + Early Access', color: 'text-yellow-700 bg-yellow-100', min: 16, next: Infinity },
  ];

  const currentTierIndex = tiers.findIndex(t => t.name.toLowerCase() === profile?.tier);
  const nextTier = tiers[currentTierIndex + 1];
  const progress = profile && nextTier ? (profile.referralCount / nextTier.min) * 100 : 100;

  return (
    <div className="space-y-8">
      <header className="space-y-1">
        <h1 className="text-3xl font-bold tracking-tight">Referral Program</h1>
        <p className="text-on-surface-variant">Invite friends and earn rewards for every successful booking.</p>
      </header>

      {/* Tier Progress */}
      <div className="space-y-4">
        <div className="flex justify-between items-end">
          <h2 className="text-xl font-bold">Your Tier Progress</h2>
          {nextTier && (
            <p className="text-sm text-on-surface-variant">
              {nextTier.min - (profile?.referralCount || 0)} more referrals to reach <span className="font-bold text-on-surface">{nextTier.name}</span>
            </p>
          )}
        </div>
        <div className="h-4 bg-surface-container-high rounded-full overflow-hidden border border-outline-variant">
          <motion.div 
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(progress, 100)}%` }}
            className="h-full bg-gradient-to-r from-primary to-primary-container"
          />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {tiers.map((t) => (
            <Card key={t.name} className={cn(
              "relative overflow-hidden border-2 transition-all",
              profile?.tier === t.name.toLowerCase() ? "border-primary scale-105 z-10 shadow-[0_10px_40px_rgba(18,28,42,0.06)]" : "border-transparent opacity-70"
            )}>
              {profile?.tier === t.name.toLowerCase() && (
                <div className="absolute top-0 right-0 p-2">
                  <CheckCircle2 className="w-5 h-5 text-on-surface" />
                </div>
              )}
              <div className={cn("w-10 h-10 rounded-full flex items-center justify-center mb-4 font-bold", t.color)}>
                {t.name[0]}
              </div>
              <h3 className="font-bold text-lg">{t.name} Tier</h3>
              <p className="text-xs font-medium text-on-surface-variant mb-2">{t.range}</p>
              <div className="space-y-2 mt-4">
                <div className="flex justify-between text-sm">
                  <span className="text-on-surface-variant">Bonus</span>
                  <span className="font-bold">{t.bonus}</span>
                </div>
                <p className="text-xs text-outline-variant leading-relaxed">{t.benefits}</p>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Referral Stats */}
        <div className="lg:col-span-2 space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Card className="bg-gradient-to-r from-primary to-primary-container text-white border-none">
              <p className="text-outline-variant text-sm mb-1">Total Balance</p>
              <h3 className="text-3xl font-bold flex items-center">
                <DollarSign className="w-6 h-6" /> {profile?.balance || 0}
              </h3>
            </Card>
            <Card>
              <p className="text-on-surface-variant text-sm mb-1">Total Earned</p>
              <h3 className="text-3xl font-bold">${totalEarned}</h3>
            </Card>
            <Card>
              <p className="text-on-surface-variant text-sm mb-1">Successful Referrals</p>
              <h3 className="text-3xl font-bold">{profile?.referralCount || 0}</h3>
            </Card>
          </div>

          <Card className="p-8 space-y-6">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Your Referral Link</h2>
              <p className="text-on-surface-variant">Share this link with your friends. When they sign up and book their first stay, you'll earn $50!</p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-surface-container-low border border-outline-variant rounded-xl px-4 py-3 font-mono text-sm truncate">
                {referralLink}
              </div>
              <Button onClick={copyToClipboard} variant={copied ? 'secondary' : 'default'}>
                {copied ? <CheckCircle2 className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                <span className="ml-2 hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
              </Button>
            </div>
          </Card>

          <div className="space-y-4">
            <h2 className="text-xl font-bold">Referral History</h2>
            <div className="space-y-2">
              {referrals.map(ref => (
                <div key={ref.id} className="flex justify-between items-center p-4 bg-surface-container-lowest rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-emerald-100 rounded-full flex items-center justify-center">
                      <TrendingUp className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="font-bold">Reward for {ref.type === 'signup' ? 'New User Signup' : 'Booking'}</p>
                      <p className="text-xs text-on-surface-variant">{format(new Date(ref.createdAt), 'MMM d, yyyy')}</p>
                    </div>
                  </div>
                  <span className="font-bold text-emerald-600">+${ref.amount}</span>
                </div>
              ))}
              {referrals.length === 0 && <p className="text-center text-outline-variant py-10">No referral history yet.</p>}
            </div>
          </div>
        </div>

        {/* Leaderboard & How it works */}
        <div className="space-y-8">
          <div className="space-y-4">
            <h2 className="text-xl font-bold flex items-center gap-2">
              <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
              Top Referrers
            </h2>
            <Card className="p-0 overflow-hidden">
              {leaderboard.map((user, index) => (
                <div key={user.uid} className={cn(
                  "flex items-center justify-between p-4 border-b border-outline-variant last:border-none",
                  user.uid === profile?.uid ? "bg-surface-container-low" : ""
                )}>
                  <div className="flex items-center gap-3">
                    <span className="w-5 text-sm font-bold text-outline-variant">#{index + 1}</span>
                    <img src={user.photoURL} className="w-8 h-8 rounded-full border border-outline-variant" alt="" referrerPolicy="no-referrer" />
                    <div>
                      <p className="text-sm font-bold truncate max-w-[120px]">{user.displayName}</p>
                      <p className="text-[10px] text-on-surface-variant uppercase font-bold tracking-wider">{user.tier}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{user.referralCount}</p>
                    <p className="text-[10px] text-outline-variant uppercase">Referrals</p>
                  </div>
                </div>
              ))}
            </Card>
          </div>

          <div className="space-y-6">
            <h2 className="text-xl font-bold">How it works</h2>
            <div className="space-y-6">
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-surface-container-high rounded-full flex items-center justify-center shrink-0 font-bold">1</div>
                <div className="space-y-1">
                  <p className="font-bold">Share your link</p>
                  <p className="text-sm text-on-surface-variant">Send your unique referral link to friends and family.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-surface-container-high rounded-full flex items-center justify-center shrink-0 font-bold">2</div>
                <div className="space-y-1">
                  <p className="font-bold">They sign up</p>
                  <p className="text-sm text-on-surface-variant">Your friend creates an account using your link.</p>
                </div>
              </div>
              <div className="flex gap-4">
                <div className="w-8 h-8 bg-surface-container-high rounded-full flex items-center justify-center shrink-0 font-bold">3</div>
                <div className="space-y-1">
                  <p className="font-bold">Earn rewards</p>
                  <p className="text-sm text-on-surface-variant">You get $50 credit when they complete their first booking.</p>
                </div>
              </div>
            </div>
            <Card className="bg-surface-dim text-white border-none p-6">
              <div className="flex items-center gap-3 mb-4">
                <AlertCircle className="w-5 h-5 text-outline-variant" />
                <p className="font-bold">Pro Tip</p>
              </div>
              <p className="text-sm text-outline-variant">Hosts who share their listings on social media using our AI tool see 3x more referrals!</p>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
