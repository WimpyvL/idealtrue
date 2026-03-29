import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Home, Users, ChevronRight, Loader2, CheckCircle2 } from 'lucide-react';
import { UserRole } from '@/types';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

export default function SignupPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isSignupMode = mode === 'signup';

  const handleSubmit = async () => {
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

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full space-y-8 text-center">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight text-on-surface">
            {isSignupMode ? 'Join Ideal Stay' : 'Sign in to Ideal Stay'}
          </h1>
          <p className="text-on-surface-variant text-lg">
            {isSignupMode
              ? 'Create a real account with a password. No more caveman auth.'
              : 'Use your email and password to get back into the platform.'}
          </p>
        </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 text-left">
          {isSignupMode && (
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
              placeholder={isSignupMode ? 'Create a password' : 'Enter your password'}
              autoComplete={isSignupMode ? 'new-password' : 'current-password'}
            />
          </div>
          {isSignupMode && (
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

        {isSignupMode && (
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
            size="lg" 
            className="w-full max-w-sm h-14 text-lg font-bold rounded-2xl shadow-xl shadow-primary/20"
            disabled={
              !email.trim() ||
              !password.trim() ||
              (isSignupMode && (!selectedRole || !displayName.trim() || !confirmPassword.trim())) ||
              isSubmitting
            }
            onClick={handleSubmit}
          >
            {isSubmitting ? (
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
            ) : (
              <>
                {isSignupMode ? 'Create account' : 'Sign in'}
                <ChevronRight className="w-5 h-5 ml-2" />
              </>
            )}
          </Button>
          <p className="text-sm text-on-surface-variant">
            {isSignupMode
              ? 'Already have an account? Switch to sign in.'
              : 'Need an account? Switch to create account.'}
          </p>
        </div>
      </div>
    </div>
  );
}
