import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearEncoreSession } from '@/lib/encore-client';
import { getEncoreSessionProfile, signInWithPassword, signUpWithPassword } from '@/lib/identity-client';
import { UserProfile, UserRole } from '@/types';

export interface AuthSessionUser {
  id: string;
  email: string;
  displayName: string;
  photoUrl: string;
}

interface LoginParams {
  email: string;
  password: string;
}

interface SignupParams {
  email: string;
  displayName: string;
  password: string;
  role?: UserRole;
  photoUrl?: string | null;
  referredByCode?: string | null;
}

interface AuthContextType {
  user: AuthSessionUser | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<UserProfile | null>;
  signIn: (params: LoginParams) => Promise<UserProfile>;
  signUp: (params: SignupParams) => Promise<UserProfile>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => null,
  signIn: async () => {
    throw new Error('Auth context not ready.');
  },
  signUp: async () => {
    throw new Error('Auth context not ready.');
  },
  logout: async () => {},
});

function toSessionUser(profile: UserProfile): AuthSessionUser {
  return {
    id: profile.id,
    email: profile.email,
    displayName: profile.displayName,
    photoUrl: profile.photoUrl || '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = async () => {
    await clearEncoreSession();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    try {
      const nextProfile = await getEncoreSessionProfile();
      setProfile(nextProfile);
      setUser(toSessionUser(nextProfile));
      return nextProfile;
    } catch (error) {
      console.error('Error refreshing Encore profile:', error);
      await logout();
      return null;
    }
  };

  const signUp = async ({ email, displayName, password, role = 'guest', photoUrl = null, referredByCode }: SignupParams) => {
    const nextProfile = await signUpWithPassword({
      email,
      displayName,
      password,
      photoUrl,
      role,
      referredByCode,
    });
    setProfile(nextProfile);
    setUser(toSessionUser(nextProfile));
    return nextProfile;
  };

  const signIn = async ({ email, password }: LoginParams) => {
    const nextProfile = await signInWithPassword({ email, password });
    setProfile(nextProfile);
    setUser(toSessionUser(nextProfile));
    return nextProfile;
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const nextProfile = await getEncoreSessionProfile();
        if (cancelled) return;
        setProfile(nextProfile);
        setUser(toSessionUser(nextProfile));
      } catch (error) {
        const isUnauthenticated = error instanceof Error && error.message.includes('unauthenticated');
        if (!isUnauthenticated) {
          console.error('Error restoring Encore session:', error);
        }
        if (!cancelled) {
          await logout();
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    bootstrap();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, signIn, signUp, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
