import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Home from '../../src/pages/player/Home';

const { useGameDataMock } = vi.hoisted(() => ({ useGameDataMock: vi.fn() }));

vi.mock('../../src/context/GameDataContext', () => ({
  useGameData: useGameDataMock,
}));

vi.mock('../../src/services/compatibilityContracts', () => ({
  getGameRunReadinessNotice: vi.fn(() => null),
}));

vi.mock('../../src/components/ui/LevelArtwork', () => ({
  default: ({ title }: { title: string }) => <div role="img" aria-label={`${title} artwork`} />,
}));

const recommendations = [
  { id: 'level-easy', title: 'Bakery', difficulty: 'easy' },
  { id: 'level-medium', title: 'Colorful Market', difficulty: 'medium' },
  { id: 'level-hard', title: 'Candy Kingdom', difficulty: 'hard' },
].map((level, index) => ({
  ...level,
  identity: { legacyLevelId: null, contentLevelId: `${index + 1}`, levelKey: `${level.title.toLowerCase().replaceAll(' ', '-')}`, ruleVersionId: null },
  gameId: 'game-1',
  subtitle: '',
  description: `${level.title} scene`,
  differences: 5,
  time: 120,
  maxHints: 3,
  stars: 0,
  cleared: false,
  bestScore: 0,
  image: '',
}));

beforeEach(() => {
  useGameDataMock.mockReturnValue({
    profile: {
      username: 'Player', displayName: 'Player', selectedBuddy: 'Bunny', levelsCompleted: 0,
      totalLevels: 3, bestScore: 0, totalPlays: 0, avgTime: 0, statsNotice: null,
    },
    profileLoading: false,
    profileAvailable: true,
    profileError: null,
    dynamicGameplayGateState: 'enabled',
    refreshDynamicGameplayGate: vi.fn(),
    games: [{ id: 'game-1', name: 'Game', slug: 'game', description: '' }],
    gamesLoading: false,
    gamesError: null,
    refreshGames: vi.fn(),
    history: [],
    historyLoading: false,
    historyError: null,
    refreshHistory: vi.fn(),
    levels: recommendations,
    levelsLoading: false,
    levelsError: null,
    refreshLevels: vi.fn(),
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Home recommended levels', () => {
  it('starts with Easy and automatically advances every six seconds', async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><Home /></MemoryRouter>);

    const tabs = within(screen.getByRole('tablist', { name: 'Recommended levels' }));
    expect(screen.getByText('Recommended level')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Bakery' })).toBeTruthy();
    expect(tabs.getByRole('tab', { name: 'Show easy recommendation: Bakery' }).getAttribute('aria-selected')).toBe('true');

    await act(async () => { vi.advanceTimersByTime(5999); });
    expect(screen.getByRole('heading', { name: 'Bakery' })).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(screen.getByRole('heading', { name: 'Colorful Market' })).toBeTruthy();
    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(screen.getByRole('heading', { name: 'Candy Kingdom' })).toBeTruthy();

    await act(async () => { vi.advanceTimersByTime(6000); });
    expect(screen.getByRole('heading', { name: 'Bakery' })).toBeTruthy();

    fireEvent.click(tabs.getByRole('tab', { name: 'Show medium recommendation: Colorful Market' }));
    expect(screen.getByRole('heading', { name: 'Colorful Market' })).toBeTruthy();
  });
});
