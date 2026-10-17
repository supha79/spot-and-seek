import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { AdminDataProvider, useAdminData } from '../../src/context/AdminDataContext';
import { GameDataProvider, useGameData } from '../../src/context/GameDataContext';

const {
  fetchContentCatalogMock,
  getPublishedGamesMock,
  getPublishedLevelsMock,
  supabaseMock,
  useAuthMock,
} = vi.hoisted(() => ({
  fetchContentCatalogMock: vi.fn(),
  getPublishedGamesMock: vi.fn(),
  getPublishedLevelsMock: vi.fn(),
  supabaseMock: { from: vi.fn(), rpc: vi.fn() },
  useAuthMock: vi.fn(),
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('../../src/supabaseClient', () => ({
  supabase: supabaseMock,
  supabaseConfigError: 'Supabase is not configured.',
}));

vi.mock('../../src/services/playerContent', () => ({
  getPublishedGames: getPublishedGamesMock,
  getPublishedLevels: getPublishedLevelsMock,
}));

vi.mock('../../src/services/content', () => ({
  archiveGame: vi.fn(),
  archiveLevel: vi.fn(),
  createGame: vi.fn(),
  createLevel: vi.fn(),
  createLevelSpot: vi.fn(),
  deactivateLevelSpot: vi.fn(),
  deleteGameById: vi.fn(),
  deleteLevelById: vi.fn(),
  deleteLevelSpotById: vi.fn(),
  fetchContentCatalog: fetchContentCatalogMock,
  publishGame: vi.fn(),
  publishLevel: vi.fn(),
  reactivateLevelSpot: vi.fn(),
  resolveLevelIdentity: vi.fn(),
  unpublishGame: vi.fn(),
  unpublishLevel: vi.fn(),
  updateGameById: vi.fn(),
  updateLevelById: vi.fn(),
  updateLevelSpotById: vi.fn(),
}));

function PlayerCatalogProbe() {
  const { games, gamesLoading, gamesError, levelsLoading, levelsError } = useGameData();
  return (
    <>
      <div data-testid="player-loading">{`${gamesLoading}|${levelsLoading}`}</div>
      <div data-testid="player-games">{games.map((game) => game.name).join(',')}</div>
      <div data-testid="player-games-error">{gamesError}</div>
      <div data-testid="player-levels-error">{levelsError}</div>
    </>
  );
}

function AdminCatalogProbe() {
  const { games, isLoading, error } = useAdminData();
  return (
    <>
      <div data-testid="admin-loading">{String(isLoading)}</div>
      <div data-testid="admin-games">{games.map((game) => game.name).join(',')}</div>
      <div data-testid="admin-error">{error}</div>
    </>
  );
}

beforeEach(() => {
  useAuthMock.mockReturnValue({ user: null });
  getPublishedGamesMock.mockResolvedValue([]);
  getPublishedLevelsMock.mockResolvedValue([]);
  fetchContentCatalogMock.mockResolvedValue({ games: [], levels: [], spots: [] });
  supabaseMock.from.mockImplementation((table: string) => {
    const result = table === 'profiles'
      ? { data: { username: 'Player', selected_buddy: 'Bunny', best_score: 0, total_plays: 0 }, error: null }
      : { data: [], error: null };
    const query = {
      select: () => query,
      eq: () => query,
      in: async () => result,
      order: async () => result,
      maybeSingle: async () => result,
    };
    return query;
  });
  supabaseMock.rpc.mockResolvedValue({
    data: { gate_name: 'dynamic_gameplay', is_enabled: false },
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('catalog requests require an authenticated user', () => {
  it('does not request player games or levels before a user session exists', async () => {
    render(<GameDataProvider><PlayerCatalogProbe /></GameDataProvider>);

    await waitFor(() => expect(screen.getByTestId('player-loading').textContent).toBe('false|false'));
    expect(getPublishedGamesMock).not.toHaveBeenCalled();
    expect(getPublishedLevelsMock).not.toHaveBeenCalled();
  });

  it('loads player games only after a confirmed user session exists', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'player-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: false },
    });
    render(<GameDataProvider><PlayerCatalogProbe /></GameDataProvider>);

    await waitFor(() => expect(getPublishedGamesMock).toHaveBeenCalledOnce());
    expect(getPublishedLevelsMock).not.toHaveBeenCalled();
  });

  it('keeps a missing-games schema-cache error visible without inventing games', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'player-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: false },
    });
    const schemaCacheError = "Could not load published games: Could not find the table 'public.games' in the schema cache";
    getPublishedGamesMock.mockRejectedValueOnce(new Error(schemaCacheError));
    render(<GameDataProvider><PlayerCatalogProbe /></GameDataProvider>);

    await waitFor(() => expect(screen.getByTestId('player-games-error').textContent).toBe(schemaCacheError));
    expect(screen.getByTestId('player-games').textContent).toBe('');
    expect(screen.getByTestId('player-loading').textContent).toBe('false|false');
    expect(getPublishedLevelsMock).not.toHaveBeenCalled();
  });

  it('finishes loading and exposes a level error when the selected game request fails', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'player-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: false },
    });
    getPublishedGamesMock.mockResolvedValueOnce([{
      id: 'game-id',
      slug: 'garden',
      name: 'Garden',
      description: '',
    }]);
    getPublishedLevelsMock.mockRejectedValueOnce(new Error('Level catalog unavailable'));
    render(<GameDataProvider><PlayerCatalogProbe /></GameDataProvider>);

    await waitFor(() => expect(screen.getByTestId('player-levels-error').textContent).toContain('Level catalog unavailable'));
    expect(screen.getByTestId('player-loading').textContent).toBe('false|false');
  });

  it('does not apply a pending player catalog response after logout', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'player-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: false },
    });
    let resolveGames!: (games: Array<{ id: string; slug: string; name: string; description: string }>) => void;
    getPublishedGamesMock.mockReturnValueOnce(new Promise((resolve) => { resolveGames = resolve; }));
    const view = render(<GameDataProvider><PlayerCatalogProbe /></GameDataProvider>);
    await waitFor(() => expect(getPublishedGamesMock).toHaveBeenCalledOnce());

    useAuthMock.mockReturnValue({ user: null });
    view.rerender(<GameDataProvider><PlayerCatalogProbe /></GameDataProvider>);
    await waitFor(() => expect(screen.getByTestId('player-loading').textContent).toBe('false|false'));

    await act(async () => {
      resolveGames([{ id: 'private-state', slug: 'stale', name: 'Stale response', description: '' }]);
    });
    expect(screen.getByTestId('player-games').textContent).toBe('');
  });

  it('does not request the admin catalog before an admin session exists', async () => {
    render(<AdminDataProvider><AdminCatalogProbe /></AdminDataProvider>);

    await waitFor(() => expect(screen.getByTestId('admin-loading').textContent).toBe('false'));
    expect(fetchContentCatalogMock).not.toHaveBeenCalled();
  });

  it('does not request the admin catalog for a confirmed non-admin user', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'player-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: false },
    });
    render(<AdminDataProvider><AdminCatalogProbe /></AdminDataProvider>);

    await waitFor(() => expect(screen.getByTestId('admin-loading').textContent).toBe('false'));
    expect(fetchContentCatalogMock).not.toHaveBeenCalled();
  });

  it('loads the admin catalog for a confirmed admin user', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'admin-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: true },
    });
    render(<AdminDataProvider><AdminCatalogProbe /></AdminDataProvider>);

    await waitFor(() => expect(fetchContentCatalogMock).toHaveBeenCalledOnce());
  });

  it('finishes loading and exposes an admin catalog error when the request fails', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'admin-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: true },
    });
    fetchContentCatalogMock.mockRejectedValueOnce(new Error('Admin catalog unavailable'));
    render(<AdminDataProvider><AdminCatalogProbe /></AdminDataProvider>);

    await waitFor(() => expect(screen.getByTestId('admin-error').textContent).toContain('Admin catalog unavailable'));
    expect(screen.getByTestId('admin-loading').textContent).toBe('false');
  });

  it('preserves the message from a structured admin catalog error', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'admin-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: true },
    });
    fetchContentCatalogMock.mockRejectedValueOnce({ message: 'Catalog endpoint is unavailable.' });
    render(<AdminDataProvider><AdminCatalogProbe /></AdminDataProvider>);

    await waitFor(() => expect(screen.getByTestId('admin-error').textContent).toBe('Catalog endpoint is unavailable.'));
    expect(screen.getByTestId('admin-loading').textContent).toBe('false');
  });

  it('does not apply a pending admin catalog response after the user loses admin role', async () => {
    useAuthMock.mockReturnValue({
      user: { id: 'admin-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: true },
    });
    let resolveCatalog!: (catalog: { games: Array<Record<string, unknown>>; levels: never[]; spots: never[] }) => void;
    fetchContentCatalogMock.mockReturnValueOnce(new Promise((resolve) => { resolveCatalog = resolve; }));
    const view = render(<AdminDataProvider><AdminCatalogProbe /></AdminDataProvider>);
    await waitFor(() => expect(fetchContentCatalogMock).toHaveBeenCalledOnce());

    useAuthMock.mockReturnValue({
      user: { id: 'player-id', emailConfirmedAt: '2026-10-13T00:00:00.000Z', isAdmin: false },
    });
    view.rerender(<AdminDataProvider><AdminCatalogProbe /></AdminDataProvider>);
    await waitFor(() => expect(screen.getByTestId('admin-loading').textContent).toBe('false'));

    await act(async () => {
      resolveCatalog({
        games: [{ id: 'private-state', name: 'Stale admin data', description: '', status: 'draft', created_at: null, sort_order: 0 }],
        levels: [],
        spots: [],
      });
    });
    expect(screen.getByTestId('admin-games').textContent).toBe('');
  });
});