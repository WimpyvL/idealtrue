import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import BrandLogo from '@/components/BrandLogo';
import { Home, Users, ChevronRight, Loader2, CheckCircle2, MailCheck, KeyRound } from 'lucide-react';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { requestPasswordReset, resetPasswordWithToken, verifyEmailToken } from '@/lib/identity-client';
import { getSafeAuthReturnPath } from '@/lib/booking-auth-intent';
import { getGoogleClientId, loadGoogleIdentityScript } from '@/lib/google-identity';

interface SignupFormValues {
  email: string;
  displayName: string;
  password: string;
  confirmPassword: string;
}

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signInWithGoogle, signUp } = useAuth();
  const urlMode = searchParams.get('mode');
  const actionToken = searchParams.get('token') || '';
  const requestedRole = searchParams.get('role');
  const requestedManagement = searchParams.get('management');
  const safeReturnPath = getSafeAuthReturnPath(searchParams.get('returnTo'));
  const authIntent = searchParams.get('intent');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isGoogleSubmitting, setIsGoogleSubmitting] = useState(false);
  const [isVerifyingEmail, setIsVerifyingEmail] = useState(false);
  const [verificationState, setVerificationState] = useState<'idle' | 'success' | 'error'>('idle');
  const [voucherEmailState, setVoucherEmailState] = useState<'idle' | 'sent' | 'failed' | 'not_applicable'>('idle');
  const googleButtonRef = useRef<HTMLDivElement | null>(null);
  const googleClientId = getGoogleClientId();
  const googleAuthConfigured = Boolean(googleClientId);
  const { handleSubmit: handleFormSubmit, register, watch } = useForm<SignupFormValues>({
    defaultValues: {
      email: '',
      displayName: '',
      password: '',
      confirmPassword: '',
    },
  });
  const email = watch('email');
  const displayName = watch('displayName');
  const password = watch('password');
  const confirmPassword = watch('confirmPassword');

  const authMode: 'signup' | 'signin' = urlMode === 'signin' ? 'signin' : 'signup';
  const isSignupMode = authMode === 'signup';
  const isResetPasswordMode = urlMode === 'reset-password' && !!actionToken;
  const isVerifyEmailMode = urlMode === 'verify-email' && !!actionToken;
  const isManagedOnboarding = isSignupMode && requestedManagement === 'managed' && selectedRole === 'host';
  const selectedManagementMode = isManagedOnboarding ? 'managed' : undefined;

  const passwordActionTitle = useMemo(() => {
    if (isVerifyEmailMode) return 'Verify your email';
    if (isResetPasswordMode) return 'Set a new password';
    return isSignupMode ? 'Join Ideal Stay' : 'Sign in to Ideal Stay';
  }, [isResetPasswordMode, isSignupMode, isVerifyEmailMode]);

  const getAuthModePath = (nextMode: 'signup' | 'signin') => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('token');
    if (nextMode === 'signin') {
      nextParams.set('mode', 'signin');
    } else {
      nextParams.delete('mode');
    }
    const query = nextParams.toString();
    return query ? `/signup?${query}` : '/signup';
  };

  const handleGoogleAuth = useCallback(async (credential: string) => {
    if (!credential) {
      toast.error('Google sign-in did not return a usable credential.');
      return;
    }

    if (isSignupMode && !selectedRole) {
      toast.error('Choose Guest or Host before continuing with Google.');
      return;
    }

    setIsGoogleSubmitting(true);
    try {
      const profile = await signInWithGoogle({
        credential,
        role: isSignupMode ? selectedRole ?? undefined : undefined,
        managementMode: isSignupMode ? selectedManagementMode : undefined,
        referredByCode: isSignupMode ? searchParams.get('ref') : undefined,
      });

      toast.success(isSignupMode ? 'Google account connected. You are signed in.' : 'Signed in with Google.');
      navigate(safeReturnPath ?? (profile.role === 'host' ? '/host' : '/'));
    } catch (error) {
      console.error('Google auth error:', error);
      toast.error(error instanceof Error ? error.message : 'Google sign-in failed.');
    } finally {
      setIsGoogleSubmitting(false);
    }
  }, [isSignupMode, navigate, safeReturnPath, searchParams, selectedManagementMode, selectedRole, signInWithGoogle]);

  useEffect(() => {
    if (!isVerifyEmailMode || verificationState !== 'idle') return;

    let cancelled = false;
    setIsVerifyingEmail(true);
    verifyEmailToken(actionToken)
      .then((result) => {
        if (!cancelled) {
          setVerificationState('success');
          setVoucherEmailState(result.voucherEmailStatus ?? 'not_applicable');
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

  useEffect(() => {
    if (isResetPasswordMode || isVerifyEmailMode || !googleButtonRef.current || !googleClientId) {
      if (googleButtonRef.current) {
        googleButtonRef.current.innerHTML = '';
      }
      return;
    }

    if (isSignupMode && !selectedRole) {
      googleButtonRef.current.innerHTML = '';
      return;
    }

    let cancelled = false;

    void loadGoogleIdentityScript()
      .then(() => {
        if (cancelled || !googleButtonRef.current || !window.google?.accounts?.id) {
          return;
        }

        googleButtonRef.current.innerHTML = '';
        window.google.accounts.id.initialize({
          client_id: googleClientId,
          callback: ({ credential }) => {
            void handleGoogleAuth(`${credential || ''}`);
          },
          cancel_on_tap_outside: true,
        });
        window.google.accounts.id.renderButton(googleButtonRef.current, {
          type: 'standard',
          theme: 'outline',
          text: isSignupMode ? 'continue_with' : 'signin_with',
          size: 'large',
          shape: 'pill',
          width: 320,
          logo_alignment: 'left',
        });
      })
      .catch((error) => {
        console.error('Failed to load Google Identity Services:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [googleClientId, handleGoogleAuth, isResetPasswordMode, isSignupMode, isVerifyEmailMode, selectedRole]);

  useEffect(() => {
    if (!isSignupMode || isResetPasswordMode || isVerifyEmailMode || selectedRole) {
      return;
    }

    if (requestedRole === 'guest' || requestedRole === 'host') {
      setSelectedRole(requestedRole);
    }
  }, [isResetPasswordMode, isSignupMode, isVerifyEmailMode, requestedRole, selectedRole]);

  const handlePasswordResetRequest = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) return;
    setIsSubmitting(true);
    try {
      await requestPasswordReset(trimmedEmail);
      toast.success('If that account exists, a reset link has been sent.');
    } catch (error) {
      console.error('Password reset request error:', error);
      toast.error('Failed to request password reset.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (values: SignupFormValues) => {
    const trimmedEmail = values.email.trim();
    const trimmedDisplayName = values.displayName.trim();
    if (isResetPasswordMode) {
      if (!values.password.trim() || values.password !== values.confirmPassword) {
        toast.error('Passwords do not match.');
        return;
      }
      setIsSubmitting(true);
      try {
        await resetPasswordWithToken({ token: actionToken, password: values.password });
        toast.success('Password updated. You can sign in now.');
        navigate('/signup?mode=signin');
      } catch (error) {
        console.error('Reset password error:', error);
        toast.error(error instanceof Error ? error.message : 'Password reset failed.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    if (!trimmedEmail || !values.password.trim()) return;
    if (isSignupMode && (!selectedRole || !trimmedDisplayName)) return;
    if (isSignupMode && values.password !== values.confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (isSignupMode) {
        const refCode = searchParams.get('ref');
        const { profile, verificationEmailStatus } = await signUp({
          email: trimmedEmail,
          displayName: trimmedDisplayName,
          password: values.password,
          role: selectedRole!,
          managementMode: selectedManagementMode,
          referredByCode: refCode,
        });
        if (verificationEmailStatus === 'failed') {
          toast.warning('Account created, but the verification email did not send. You can sign in now and request another verification email from inside the account flow.');
        } else {
          toast.success('Account created. Check your email to verify your address.');
        }
        navigate(safeReturnPath ?? (profile.role === 'host' ? '/host' : '/'));
      } else {
        const profile = await signIn({
          email: trimmedEmail,
          password: values.password,
        });
        navigate(safeReturnPath ?? (profile.role === 'host' ? '/host' : '/'));
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
          <BrandLogo variant="inline" size="lg" className="mx-auto h-20" priority />
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
            {!isVerifyingEmail && verificationState === 'success' && voucherEmailState === 'sent' && (
              <p className="text-sm text-emerald-700">
                If you qualified as one of the first 100 hosts, your voucher PIN has been emailed to you.
              </p>
            )}
            {!isVerifyingEmail && verificationState === 'success' && voucherEmailState === 'failed' && (
              <p className="text-sm text-amber-700">
                Your email is verified, but the founding host voucher email could not be sent right now.
              </p>
            )}
          </div>
          <Button onClick={() => navigate('/signup?mode=signin')} className="w-full h-12 rounded-2xl font-bold">
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
          <BrandLogo variant="inline" size="xl" className="mx-auto h-24" priority />
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">{passwordActionTitle}</h1>
          <p className="text-on-surface-variant text-lg">
            {isResetPasswordMode
              ? 'Choose a new password for your account.'
              : isSignupMode
                ? 'Create a real account with a password. No more caveman auth.'
                : 'Use your email and password to get back into the platform.'}
          </p>
          {!isResetPasswordMode && authIntent === 'planner' && (
            <p className="text-sm font-medium text-[#08a8c8]">
              Sign in to use the AI trip planner.
            </p>
          )}
          {isManagedOnboarding && (
            <p className="mx-auto max-w-2xl rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
              Managed Hosting selected. Create your host account and the Ideal Stay team can onboard the R650 / month managed package and handle the listing work for you.
            </p>
          )}
        </div>

        {!isResetPasswordMode && (
        <div className="inline-flex rounded-2xl border border-outline-variant bg-surface-container-low p-1">
          <button
            type="button"
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
              isSignupMode ? 'bg-[#08a8c8] text-white' : 'text-on-surface-variant hover:text-on-surface',
            )}
            onClick={() => navigate(getAuthModePath('signup'))}
          >
            Create account
          </button>
          <button
            type="button"
            className={cn(
              'px-5 py-2 rounded-xl text-sm font-semibold transition-colors',
              !isSignupMode ? 'bg-[#08a8c8] text-white' : 'text-on-surface-variant hover:text-on-surface',
            )}
            onClick={() => navigate(getAuthModePath('signin'))}
          >
            Sign in
          </button>
        </div>
        )}

        <form className="space-y-8" onSubmit={handleFormSubmit(handleSubmit)}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-left">
          {isSignupMode && !isResetPasswordMode && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface">Full name</label>
              <Input
                {...register('displayName')}
                placeholder="Your full name"
                autoComplete="name"
              />
            </div>
          )}
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface">Email address</label>
            <Input
              type="email"
              {...register('email')}
              placeholder="you@example.com"
              autoComplete="email"
            />
          </div>
          <div className="space-y-2">
            <label className="text-sm font-semibold text-on-surface">Password</label>
            <Input
              type="password"
              {...register('password')}
              placeholder={isResetPasswordMode || isSignupMode ? 'Create a password' : 'Enter your password'}
              autoComplete={isResetPasswordMode || isSignupMode ? 'new-password' : 'current-password'}
            />
          </div>
          {(isSignupMode || isResetPasswordMode) && (
            <div className="space-y-2">
              <label className="text-sm font-semibold text-on-surface">Confirm password</label>
              <Input
                type="password"
                {...register('confirmPassword')}
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
                ? "border-[#08a8c8] bg-[#08a8c8]/5 shadow-lg scale-105" 
                : "border-outline-variant hover:border-[#08a8c8]/50 hover:bg-surface-container-lowest"
            )}
            onClick={() => setSelectedRole('guest')}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              selectedRole === 'guest' ? "bg-[#08a8c8] text-white" : "bg-surface-container-high text-on-surface-variant group-hover:bg-[#08a8c8]/10 group-hover:text-[#08a8c8]"
            )}>
              <Users className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">I'm a Guest</h3>
              <p className="text-sm text-on-surface-variant">I want to find and book unique holiday accommodations.</p>
            </div>
            {selectedRole === 'guest' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4">
                <CheckCircle2 className="w-6 h-6 text-[#08a8c8]" />
              </motion.div>
            )}
          </Card>

          {/* Host Option */}
          <Card 
            className={cn(
              "p-8 cursor-pointer transition-all duration-300 border-2 flex flex-col items-center text-center space-y-4 group relative overflow-hidden",
              selectedRole === 'host' 
                ? "border-[#08a8c8] bg-[#08a8c8]/5 shadow-lg scale-105" 
                : "border-outline-variant hover:border-[#08a8c8]/50 hover:bg-surface-container-lowest"
            )}
            onClick={() => setSelectedRole('host')}
          >
            <div className={cn(
              "w-16 h-16 rounded-2xl flex items-center justify-center transition-colors",
              selectedRole === 'host' ? "bg-[#08a8c8] text-white" : "bg-surface-container-high text-on-surface-variant group-hover:bg-[#08a8c8]/10 group-hover:text-[#08a8c8]"
            )}>
              <Home className="w-8 h-8" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xl font-bold">I'm a Host</h3>
              <p className="text-sm text-on-surface-variant">I want to list my property and manage bookings.</p>
            </div>
            {selectedRole === 'host' && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="absolute top-4 right-4">
                <CheckCircle2 className="w-6 h-6 text-[#08a8c8]" />
              </motion.div>
            )}
          </Card>
        </div>
        )}

        <div className="pt-8 flex flex-col items-center space-y-4">
          <Button 
            type="submit"
            size="lg" 
            className="w-full max-w-sm h-14 text-lg font-bold rounded-2xl bg-[#08a8c8] hover:bg-[#08a8c8]/90 shadow-xl shadow-[#08a8c8]/20"
            disabled={
              ((isResetPasswordMode || isSignupMode) && !password.trim()) ||
              (!isResetPasswordMode && !email.trim()) ||
              (isSignupMode && !isResetPasswordMode && (!selectedRole || !displayName.trim() || !confirmPassword.trim())) ||
              (isResetPasswordMode && !confirmPassword.trim()) ||
              isSubmitting ||
              isGoogleSubmitting
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
          {!isResetPasswordMode && !isVerifyEmailMode && (
            <div className="w-full max-w-sm space-y-3">
              <div className="flex items-center gap-3 text-xs uppercase tracking-[0.22em] text-on-surface-variant">
                <div className="h-px flex-1 bg-outline-variant" />
                <span>or</span>
                <div className="h-px flex-1 bg-outline-variant" />
              </div>
              {!googleAuthConfigured ? (
                <p className="text-center text-sm text-on-surface-variant" data-testid="google-auth-unavailable">
                  Google sign-in is unavailable in this environment. Use email and password for now.
                </p>
              ) : isSignupMode && !selectedRole ? (
                <p className="text-center text-sm text-on-surface-variant">
                  Choose Guest or Host first, then continue with Google.
                </p>
              ) : (
                <div className={cn('flex justify-center', isGoogleSubmitting && 'opacity-60 pointer-events-none')}>
                  <div ref={googleButtonRef} />
                </div>
              )}
            </div>
          )}
          {!isResetPasswordMode && (
            <>
              {authMode === 'signin' ? (
                <button
                  type="button"
                  className="text-sm text-[#08a8c8] font-medium inline-flex items-center gap-2"
                  onClick={handlePasswordResetRequest}
                  disabled={isSubmitting || !email.trim()}
                >
                  <KeyRound className="w-4 h-4" />
                  Email me a password reset link
                </button>
              ) : null}
              <p className="text-sm text-on-surface-variant">
                {isSignupMode ? (
                  <>
                    Already have an account?{' '}
                    <button type="button" className="font-semibold text-[#08a8c8]" onClick={() => navigate(getAuthModePath('signin'))}>
                      Open the login form.
                    </button>
                  </>
                ) : (
                  <>
                    Need an account?{' '}
                    <button type="button" className="font-semibold text-[#08a8c8]" onClick={() => navigate(getAuthModePath('signup'))}>
                      Open the signup form.
                    </button>
                  </>
                )}
              </p>
            </>
          )}
        </div>
        </form>
      </div>
    </div>
  );
}
