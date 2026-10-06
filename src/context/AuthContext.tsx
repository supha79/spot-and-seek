import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { User } from '@supabase/supabase-js';
import { supabase, supabaseConfigError } from '../supabaseClient';

export type AuthUser = {
  id: string;
  email: string;
  username: string;
  emailConfirmedAt: string | null;
  isAdmin: boolean;
};

type AuthContextValue = {
  user: AuthUser | null;
  isLoading: boolean;
  isRecoverySession: boolean;
  authError: string | null;
  configError: string | null;
  login: (email: string, password: string) => Promise<AuthUser>;
  register: (email: string, username: string, password: string, confirmPassword: string) => Promise<void>;
  logout: () => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  updatePassword: (password: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  updateUsername: (username: string) => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getClient() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  }

  return supabase;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'Authentication request failed.';
}

function toAuthUser(user: User): AuthUser {
  const username = user.user_metadata.username;

  return {
    id: user.id,
    email: user.email ?? '',
    username: typeof username === 'string' ? username : '',
    emailConfirmedAt: user.email_confirmed_at ?? null,
    isAdmin: user.app_metadata.role === 'admin',
  };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRecoverySession, setIsRecoverySession] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    if (!supabase) {
      setIsLoading(false);
      return;
    }

    let isMounted = true;
    let receivedInitialSession = false;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!isMounted) return;
      setUser(session?.user ? toAuthUser(session.user) : null);
      if (event === 'PASSWORD_RECOVERY') setIsRecoverySession(true);
      if (event === 'SIGNED_OUT') setIsRecoverySession(false);
      if (event === 'INITIAL_SESSION') {
        receivedInitialSession = true;
        setIsLoading(false);
      }
    });

    void supabase.auth.getSession()
      .then(({ data, error }) => {
        if (!isMounted || receivedInitialSession) return;
        setUser(data.session?.user ? toAuthUser(data.session.user) : null);
        if (error) setAuthError(error.message);
        setIsLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted || receivedInitialSession) return;
        setAuthError(getErrorMessage(error));
        setIsLoading(false);
      });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const login = async (email: string, password: string) => {
    if (!email.trim() || !password) throw new Error('Email and password are required.');
    const client = getClient();
    setAuthError(null);
    setIsLoading(true);
    try {
      const { data, error } = await client.auth.signInWithPassword({ email: email.trim(), password });
      if (error) throw error;
      if (!data.user?.email_confirmed_at) {
        await client.auth.signOut();
        throw new Error('Please confirm your email address before signing in.');
      }
      const authUser = toAuthUser(data.user);
      setUser(authUser);
      setIsRecoverySession(false);
      return authUser;
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (email: string, username: string, password: string, confirmPassword: string) => {
    if (!email.trim()) throw new Error('Email is required.');
    if (!username.trim()) throw new Error('Username is required.');
    if (!password) throw new Error('Password is required.');
    if (password !== confirmPassword) throw new Error('Passwords do not match.');
    const client = getClient();
    setAuthError(null);
    setIsLoading(true);
    try {
      const { data, error } = await client.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { username: username.trim() },
          emailRedirectTo: `${window.location.origin}/login?verified=1`,
        },
      });
      if (error) throw error;
      if (!data.user) throw new Error('Account registration did not return a user.');
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    const client = getClient();
    setAuthError(null);
    setIsLoading(true);
    try {
      const { error } = await client.auth.signOut();
      if (error) throw error;
      setUser(null);
      setIsRecoverySession(false);
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const requestPasswordReset = async (email: string) => {
    if (!email.trim()) throw new Error('Email is required.');
    const client = getClient();
    setAuthError(null);
    setIsLoading(true);
    try {
      const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updatePassword = async (password: string) => {
    if (!password) throw new Error('Password is required.');
    if (!isRecoverySession) throw new Error('This password reset link is invalid or has expired.');
    const client = getClient();
    setAuthError(null);
    setIsLoading(true);
    try {
      const { data, error } = await client.auth.updateUser({ password });
      if (error) throw error;
      if (data.user) setUser(toAuthUser(data.user));
      setIsRecoverySession(false);
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const changePassword = async (currentPassword: string, newPassword: string) => {
    if (!currentPassword) throw new Error('Current password is required.');
    if (!newPassword) throw new Error('New password is required.');
    if (!user?.email) throw new Error('No signed-in email is available.');
    if (currentPassword === newPassword) throw new Error('Choose a password different from the current one.');
    if (!/^(?=.*[A-Za-z])(?=.*\d).{8,}$/.test(newPassword)) {
      throw new Error('Use at least 8 characters, including an English letter and a number.');
    }

    const client = getClient();
    setAuthError(null);
    setIsLoading(true);
    try {
      const { error: reauthenticationError } = await client.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (reauthenticationError) throw new Error('Current password is incorrect.');

      const { data, error } = await client.auth.updateUser({ password: newPassword });
      if (error) throw error;
      if (data.user) setUser(toAuthUser(data.user));
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const updateUsername = async (username: string) => {
    if (!username.trim()) throw new Error('Username is required.');
    const client = getClient();
    setAuthError(null);
    setIsLoading(true);
    try {
      const { data, error } = await client.auth.updateUser({ data: { username: username.trim() } });
      if (error) throw error;
      if (data.user) setUser(toAuthUser(data.user));
    } catch (error) {
      const message = getErrorMessage(error);
      setAuthError(message);
      throw new Error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthContext.Provider value={{
      user,
      isLoading,
      isRecoverySession,
      authError,
      configError: supabaseConfigError,
      login,
      register,
      logout,
      requestPasswordReset,
      updatePassword,
      changePassword,
      updateUsername,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider.');
  }

  return context;
}

export default AuthContext;
