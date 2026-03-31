import React, { FormEvent, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Home, Users, ChevronRight, Loader2, CheckCircle2, MailCheck, KeyRound } from 'lucide-react';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { requestPasswordReset, resetPasswordWithToken, verifyEmailToken } from '@/lib/identity-client';

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const urlMode = searchParams.get('mode');
  const actionToken = searchParams.get('token') || '';
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationState, setVerificationState] = useState<'idle' | 'success' | 'error'>('idle');

  const isSignupMode = mode === 'signup';
  const isResetPasswordMode = urlMode === 'reset-password' && !!actionToken;
  const isVerifyEmailMode = urlMode === 'verify-email' && !!actionToken;
  const isForgotPasswordMode = mode === 'signin' && !isResetPasswordMode && !isVerifyEmailMode;

  const passwordActionTitle = useMemo(() => {
    if (isVerifyEmailMode) return 'Verify your email';
    if (isResetPasswordMode) return 'Set a new password';
    return isSignupMode ? 'Join Ideal Stay' : 'Sign in to Ideal Stay';
  }, [isResetPasswordMode, isSignupMode, isVerifyEmailMode]);

  useEffect(() => {
    if (!isVerifyEmailMode || verificationState !== 'idle') return;

    let cancelled = false;
    setIsVerifyingEmail(true);
    verifyEmailToken(actionToken)
      .then(() => {
        if (!cancelled) {
          setVerificationState('success');
        }
      })
      .catch((error) => {
        console.error('Email verification failed:', error);
        if (!cancelled) {
          setVerificationState('error');
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsVerifyingEmail(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [actionToken, isVerifyEmailMode, verificationState]);

  const handlePasswordResetRequest = async () => {
    if (!email.trim()) return;
    setIsSubmitting(true);
    try {
      await requestPasswordReset(email.trim());
      toast.success('If that account exists, a reset link has been sent.');
    } catch (error) {
      console.error('Password reset request error:', error);
      toast.error('Failed to request password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();

    if (isResetPasswordMode) {
      if (!password.trim() || password !== confirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }
      setIsSubmitting(true);
      try {
        await resetPasswordWithToken({ token: actionToken, password });
        toast.success('Password updated. You can sign in now.');
        navigate('/signup');
      } catch (error) {
        console.error('Reset password error:', error);
        toast.error(error instanceof Error ? error.message : 'Password reset failed.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!email.trim() || !password.trim()) return;
    if (isSignupMode && (!selectedRole || !displayName.trim())) return;
    if (isSignupMode && password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignupMode) {
        const refCode = searchParams.get('ref');
        const profile = await signUp({
          email: email.trim(),
          displayName: displayName.trim(),
          password,
          role: selectedRole!,
          referredByCode: refCode,
        });
        toast.success('Account created. Check your email to verify your address.');
        navigate(profile.role === 'host' ? '/host' : '/');
      } else {
        const profile = await signIn({
          email: email.trim(),
          password,
        });
        navigate(profile.role === 'host' ? '/host' : '/');
      }
    } catch (error) {
      console.error('Auth error:', error);
      toast.error(error instanceof Error ? error.message : 'Authentication failed.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isVerifyEmailMode) {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12">
        <Card className="max-w-lg w-full p-10 text-center space-y-6">
          <div className="mx-auto w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
            {isVerifyingEmail ? <Loader2 className="w-8 h-8 animate-spin text-primary" /> : <MailCheck className="w-8 h-8 text-primary" />}
          </div>
          <div className="space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">{passwordActionTitle}</h1>
            <p className="text-on-surface-variant">
              {isVerifyingEmail
                ? 'Confirming your email now.'
                : verificationState === 'success'
                  ? 'Your email is verified. You can sign in normally.'
                  : 'That verification link is invalid or expired.'}
            </p>
          </div>
          <Button onClick={() => navigate('/signup')} className="w-full h-12 rounded-2xl font-bold">
            Back to sign in
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">{passwordActionTitle}</h1>
          <p className="text-on-surface-variant text-lg">
            {isResetPasswordMode
              ? 'Choose a new password for your account.'
              : isSignupMode
                ? 'Create a real account with a password. No more caveman auth.'
                : 'Use your email and password to get back into the platform.'}
          </p>
        </div>

        {!isResetPasswordMode && (
        <div className="inline-flex rounded-2xl border border-outline-variant bg-surface-container-low p-1">
          <button
            type="button"
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
              isSignupMode ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface',
            )}
            onClick={() => setMode('signup')}
          >
            Create account
          </button>
          <button
            type="button"
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
              !isSignupMode ? 'bg-primary text-white' : 'text-on-surface-variant hover:text-on-surface',
            )}
            onClick={() => setMode('signin')}
          >
            Sign in
          </button>
        </div>
        )}

        <form className="space-y-8" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-left">
          {isSignupMode && !isResetPasswordMode && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface">Full name</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface">Email address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface">Password</label>
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isResetPasswordMode || isSignupMode ? 'Create a password' : 'Enter your password'}
              autoComplete={isResetPasswordMode || isSignupMode ? 'new-password' : 'current-password'}
            />
          </div>
          {(isSignupMode || isResetPasswordMode) && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface">Confirm password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat your password"
                autoComplete="new-password"
              />
            </div>
          )}
        </div>

        {isSignupMode && !isResetPasswordMode && (
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
        )}

        <div className="pt-8 flex flex-col items-center space-y-4">
          <Button 
            type="submit"
            size="lg" 
            className="w-full max-w-sm h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20"
            disabled={
              ((isResetPasswordMode || isSignupMode) && !password.trim()) ||
              (!isResetPasswordMode && !email.trim()) ||
              (isSignupMode && (!selectedRole || !displayName.trim() || !confirmPassword.trim())) ||
              (isResetPasswordMode && !confirmPassword.trim()) ||
              isSubmitting
            }
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
            ) : (
              <>
                {isResetPasswordMode ? 'Update password' : isSignupMode ? 'Create account' : 'Sign in'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
          {!isResetPasswordMode && (
            <>
              {mode === 'signin' ? (
                <button
                  type="button"
                  className="text-sm text-primary font-medium inline-flex items-center gap-2"
                  onClick={handlePasswordResetRequest}
                  disabled={isSubmitting || !email.trim()}
                >
                  <KeyRound className="w-4 h-4" />
                  Email me a password reset link
                </button>
              ) : null}
              <p className="text-sm text-on-surface-variant">
                {isSignupMode
                  ? 'Already have an account? Switch to sign in.'
                  : 'Need an account? Switch to create account.'}
              </p>
            </>
          )}
        </div>
        </form>
      </div>
    </div>
  );
}
