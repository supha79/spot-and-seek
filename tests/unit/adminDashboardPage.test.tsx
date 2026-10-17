import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AdminDashboard from '../../src/pages/admin/AdminDashboard';

const { useAdminDataMock, loadSummaryMock, loadRecentPlaysMock } = vi.hoisted(() => ({
  useAdminDataMock: vi.fn(),
  loadSummaryMock: vi.fn(),
  loadRecentPlaysMock: vi.fn(),
}));

vi.mock('../../src/context/AdminDataContext', () => ({
  useAdminData: useAdminDataMock,
}));

vi.mock('../../src/services/adminDashboard', () => ({
  loadAdminDashboardSummary: loadSummaryMock,
  loadRecentAdminPlays: loadRecentPlaysMock,
}));

vi.mock('../../src/components/ui/LevelArtwork', () => ({
  default: ({ title }: { title: string }) => <div role="img" aria-label={`${title} artwork`} />,
}));

beforeEach(() => {
  useAdminDataMock.mockReturnValue({
    games: [],
    levels: [{
      id: 'published-level',
      title: 'Cozy Treehouse Cafe',
      description: 'A published treehouse level.',
      difficulty: 'Easy',
      emoji: '🌳',
      time: 120,
      maxHints: 3,
      questions: 3,
      status: 'published',
      gameId: 'game-1',
    }],
    questions: [
      { id: 'q1', levelId: 'published-level', active: true },
      { id: 'q2', levelId: 'published-level', active: true },
      { id: 'q3', levelId: 'published-level', active: false },
    ],
    isLoading: false,
    error: null,
    refreshCatalog: vi.fn(),
  });
  loadSummaryMock.mockResolvedValue({
    usersCount: 12,
    totalPlays: 24,
    difficultyStats: [
      { difficulty: 'easy', count: 12, percentage: 50 },
      { difficulty: 'medium', count: 8, percentage: 33 },
      { difficulty: 'hard', count: 4, percentage: 17 },
    ],
    unknownLevelSessionCount: 0,
    unknownLevelIds: [],
  });
  loadRecentPlaysMock.mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Admin dashboard', () => {
  it('shows published content spotlight, active-question count, and real dashboard actions', async () => {
    render(<MemoryRouter><AdminDashboard /></MemoryRouter>);

    expect(await screen.findByText('2 Active questions')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Cozy Treehouse Cafe' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /\+ New question/ }).getAttribute('href')).toBe('/admin/questions/new');
    expect(screen.getByRole('link', { name: /\+ New level/ }).getAttribute('href')).toBe('/admin/levels');
    expect(screen.getByText('No plays recorded yet.')).toBeTruthy();
  });
});