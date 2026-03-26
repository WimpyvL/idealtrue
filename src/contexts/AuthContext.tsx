import React, { createContext, useContext, useEffect, useState } from 'react';
import { clearEncoreSession, hasEncoreSessionToken } from '@/lib/encore-client';
import { ensureEncoreProfile, getEncoreSessionProfile } from '@/lib/identity-client';
import { UserProfile, UserRole } from '@/types';

export interface AuthSessionUser {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
}

interface LoginParams {
  email: string;
  displayName: string;
  role?: UserRole;
  photoUrl?: string | null;
  referredByCode?: string | null;
}

interface AuthContextType {
  user: AuthSessionUser | null;
  profile: UserProfile | null;
  loading: boolean;
  refreshProfile: () => Promise<void>;
  login: (params: LoginParams) => Promise<UserProfile>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  profile: null,
  loading: true,
  refreshProfile: async () => {},
  login: async () => {
    throw new Error('Auth context not ready.');
  },
  logout: () => {},
});

function toSessionUser(profile: UserProfile): AuthSessionUser {
  return {
    uid: profile.uid,
    email: profile.email,
    displayName: profile.displayName,
    photoURL: profile.photoURL || '',
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const logout = () => {
    clearEncoreSession();
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    if (!hasEncoreSessionToken()) {
      logout();
      return;
    }

    try {
      const nextProfile = await getEncoreSessionProfile();
      setProfile(nextProfile);
      setUser(toSessionUser(nextProfile));
    } catch (error) {
      console.error('Error refreshing Encore profile:', error);
      logout();
    }
  };

  const login = async ({ email, displayName, role = 'guest', photoUrl = null, referredByCode }: LoginParams) => {
    const nextProfile = await ensureEncoreProfile({
      email,
      displayName,
      photoUrl,
      role,
      referredByCode,
    });
    setProfile(nextProfile);
    setUser(toSessionUser(nextProfile));
    return nextProfile;
  };

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      if (!hasEncoreSessionToken()) {
        if (!cancelled) {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
        return;
      }

      try {
        const nextProfile = await getEncoreSessionProfile();
        if (cancelled) return;
        setProfile(nextProfile);
        setUser(toSessionUser(nextProfile));
      } catch (error) {
        console.error('Error restoring Encore session:', error);
        if (!cancelled) {
          logout();
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
    <AuthContext.Provider value={{ user, profile, loading, refreshProfile, login, logout }}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
