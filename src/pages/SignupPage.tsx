import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Home, Users, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { loginWithGoogle, db } from '@/firebase';
import { doc, getDoc, setDoc, updateDoc, collection, query, where, getDocs, addDoc } from 'firebase/firestore';
import { UserProfile, UserRole, OperationType } from '@/types';
import { handleFirestoreError } from '@/lib/firestore';
import { processReferralReward, getReferrerByCode } from '@/lib/referrals';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSignup = async () => {
    if (!selectedRole) return;
    
    setIsSubmitting(true);
    try {
      const result = await loginWithGoogle();
      const u = result.user;
      const refCode = searchParams.get('ref');
      
      const userRef = doc(db, 'users', u.uid);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        const newProfile: UserProfile = {
          uid: u.uid,
          displayName: u.displayName || 'Anonymous User',
          email: u.email || '',
          photoURL: u.photoURL || '',
          role: selectedRole,
          referralCode: Math.random().toString(36).substring(2, 8).toUpperCase(),
          referredBy: refCode || null,
          balance: 0,
          referralCount: 0,
          tier: 'bronze',
          host_plan: 'free',
          kycStatus: 'none',
          createdAt: new Date().toISOString(),
        };
        await setDoc(userRef, newProfile);

        // Handle referral logic if applicable
        if (refCode) {
          const referrerUid = await getReferrerByCode(refCode);
          if (referrerUid) {
            await processReferralReward(referrerUid, u.uid, 'signup');
          }
        }
      } else {
        // If user already exists but role is different (e.g. App.tsx created it as guest)
        const existingData = userSnap.data() as UserProfile;
        if (existingData.role !== selectedRole) {
          await updateDoc(userRef, { role: selectedRole });
        }
      }

      navigate(selectedRole === 'host' ? '/host' : '/');
    } catch (error) {
      console.error("Signup error:", error);
      handleFirestoreError(error, OperationType.WRITE, `users/${selectedRole}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">Join Ideal Stay</h1>
          <p className="text-on-surface-variant text-lg">Choose how you want to use the platform to get started.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-8">
          {/* Guest Option */}
          <Card 
            className={cn(
              "p-8 cursor-pointer transition-all duration-300 border-2 flex flex-col items-center text-center space-y-4 group relative overflow-hidden",
              selectedRole === 'guest' 
                ? "border-primary bg-primary/5 shadow-lg scale-105" 
                : "border-outline-variant hover:border-primary/50 hover:bg-surface-container-lowest"
            )}
            onClick={() => setSelectedRole('guest')}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              selectedRole === 'guest' ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary"
            )}>
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">I'm a Guest</h3>
              <p className="text-sm text-on-surface-variant">I want to find and book unique holiday accommodations.</p>
            </div>
            {selectedRole === 'guest' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </motion.div>
            )}
          </Card>

          {/* Host Option */}
          <Card 
            className={cn(
              "p-8 cursor-pointer transition-all duration-300 border-2 flex flex-col items-center text-center space-y-4 group relative overflow-hidden",
              selectedRole === 'host' 
                ? "border-primary bg-primary/5 shadow-lg scale-105" 
                : "border-outline-variant hover:border-primary/50 hover:bg-surface-container-lowest"
            )}
            onClick={() => setSelectedRole('host')}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              selectedRole === 'host' ? "bg-primary text-white" : "bg-surface-container-high text-on-surface-variant group-hover:bg-primary/10 group-hover:text-primary"
            )}>
              <Home className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">I'm a Host</h3>
              <p className="text-sm text-on-surface-variant">I want to list my property and manage bookings.</p>
            </div>
            {selectedRole === 'host' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4">
                <CheckCircle2 className="w-6 h-6 text-primary" />
              </motion.div>
            )}
          </Card>
        </div>

        <div className="pt-8 flex flex-col items-center space-y-4">
          <Button 
            size="lg" 
            className="w-full max-w-sm h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20"
            disabled={!selectedRole || isSubmitting}
            onClick={handleSignup}
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
            ) : (
              <>Continue with Google <ChevronRight className="w-5 h-5 ml-2" /></>
            )}
          </Button>
          <p className="text-sm text-on-surface-variant">
            Already have an account? <button onClick={() => loginWithGoogle()} className="text-primary font-bold hover:underline">Sign In</button>
          </p>
        </div>
      </div>
    </div>
  );
}
