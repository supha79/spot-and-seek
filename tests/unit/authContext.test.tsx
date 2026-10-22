import { act, cleanup, render, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthProvider, useAuth } from '../../src/context/AuthContext';

const { supabaseMock } = vi.hoisted(() => ({
  supabaseMock: {
    auth: {
      onAuthStateChange: vi.fn(),
      getSession: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      signUp: vi.fn(),
      resetPasswordForEmail: vi.fn(),
      updateUser: vi.fn(),
    },
  },
}));

vi.mock('../../src/supabaseClient', () => ({
  supabase: supabaseMock,
  supabaseConfigError: null,
}));

type MockUser = {
  id: string;
  email: string;
  email_confirmed_at: string | null;
  user_metadata: { username: string };
  app_metadata: { role?: string };
};

let authValue: ReturnType<typeof useAuth>;
let authStateListener: ((event: string, session: { user: MockUser } | null) => void) | undefined;

const confirmedUser: MockUser = {
  id: 'user-id',
  email: 'player@example.test',
  email_confirmed_at: '2026-10-13T00:00:00.000Z',
  user_metadata: { username: 'Player' },
  app_metadata: {},
};

function AuthProbe() {
  authValue = useAuth();
  return null;
}

function renderAuthProvider() {
  render(<AuthProvider><AuthProbe /></AuthProvider>);
  return waitFor(() => expect(authValue.isLoading).toBe(false));
}

beforeEach(() => {
  authStateListener = undefined;
  supabaseMock.auth.onAuthStateChange.mockImplementation((listener) => {
    authStateListener = listener;
    return { data: { subscription: { unsubscribe: vi.fn() } } };
  });
  supabaseMock.auth.getSession.mockResolvedValue({ data: { session: null }, error: null });
  supabaseMock.auth.signInWithPassword.mockResolvedValue({ data: { user: confirmedUser }, error: null });
  supabaseMock.auth.signOut.mockResolvedValue({ error: null });
  supabaseMock.auth.signUp.mockResolvedValue({ data: { user: confirmedUser }, error: null });
  supabaseMock.auth.resetPasswordForEmail.mockResolvedValue({ error: null });
  supabaseMock.auth.updateUser.mockResolvedValue({ data: { user: confirmedUser }, error: null });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AuthProvider local contract', () => {
  it('restores a confirmed user from the persisted session', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: confirmedUser } },
      error: null,
    });
    await renderAuthProvider();

    expect(authValue.user).toMatchObject({
      id: 'user-id',
      email: 'player@example.test',
      username: 'Player',
      emailConfirmedAt: confirmedUser.email_confirmed_at,
      isAdmin: false,
    });
  });

  it('logs in a confirmed user and trims the email address', async () => {
    await renderAuthProvider();

    await act(async () => {
      await authValue.login(' player@example.test ', 'test-password');
    });

    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.test',
      password: 'test-password',
    });
    expect(authValue.user).toMatchObject({ id: 'user-id', username: 'Player', isAdmin: false });
  });

  it('registers with normalized email and username', async () => {
    await renderAuthProvider();

    await act(async () => {
      await authValue.register(' player@example.test ', ' Player ', 'test-password', 'test-password');
    });

    expect(supabaseMock.auth.signUp).toHaveBeenCalledWith({
      email: 'player@example.test',
      password: 'test-password',
      options: {
        data: { username: 'Player' },
        emailRedirectTo: `${window.location.origin}/login?verified=1`,
      },
    });
  });

  it('rejects registration passwords shorter than six characters', async () => {
    await renderAuthProvider();

    await expect(authValue.register('player@example.test', 'Player', 'short', 'short'))
      .rejects.toThrow(/at least 6 characters/i);
    expect(supabaseMock.auth.signUp).not.toHaveBeenCalled();
  });

  it('trims login email and rejects an unconfirmed account after signing it out', async () => {
    await renderAuthProvider();
    supabaseMock.auth.signInWithPassword.mockResolvedValueOnce({
      data: { user: { ...confirmedUser, email_confirmed_at: null } },
      error: null,
    });

    await expect(authValue.login(' player@example.test ', 'test-password')).rejects.toThrow(/confirm your email/i);
    expect(supabaseMock.auth.signInWithPassword).toHaveBeenCalledWith({
      email: 'player@example.test',
      password: 'test-password',
    });
    expect(supabaseMock.auth.signOut).toHaveBeenCalledOnce();
    expect(authValue.user).toBeNull();
  });

  it('blocks password updates without a recovery session and allows one after recovery event', async () => {
    await renderAuthProvider();

    await expect(authValue.updatePassword('test-password')).rejects.toThrow(/invalid or has expired/i);
    expect(supabaseMock.auth.updateUser).not.toHaveBeenCalled();

    await act(async () => {
      authStateListener?.('PASSWORD_RECOVERY', { user: confirmedUser });
    });
    expect(authValue.isRecoverySession).toBe(true);

    await act(async () => {
      await authValue.updatePassword('test-password');
    });
    expect(supabaseMock.auth.updateUser).toHaveBeenCalledWith({ password: 'test-password' });
    expect(authValue.isRecoverySession).toBe(false);
  });

  it('clears the local user and recovery state after successful logout', async () => {
    supabaseMock.auth.getSession.mockResolvedValue({
      data: { session: { user: confirmedUser } },
      error: null,
    });
    await renderAuthProvider();

    await act(async () => {
      await authValue.logout();
    });
    expect(supabaseMock.auth.signOut).toHaveBeenCalledWith({ scope: 'local' });
    expect(authValue.user).toBeNull();
    expect(authValue.isRecoverySession).toBe(false);
  });
});