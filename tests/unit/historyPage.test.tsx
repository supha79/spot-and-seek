import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import History from '../../src/pages/player/History';
import type { HistoryEntry } from '../../src/context/GameDataContext';

const { useGameDataMock } = vi.hoisted(() => ({ useGameDataMock: vi.fn() }));

vi.mock('../../src/context/GameDataContext', () => ({
  difficultyOptions: [
    { id: 'easy', name: 'Easy', description: 'Relaxed', accent: 'secondary', highlight: false },
    { id: 'medium', name: 'Medium', description: 'Balanced', accent: 'primary', highlight: true },
    { id: 'hard', name: 'Hard', description: 'Challenging', accent: 'tertiary', highlight: false },
  ],
  useGameData: useGameDataMock,
}));

vi.mock('../../src/components/ui/LevelArtwork', () => ({
  default: ({ title }: { title: string }) => <div role="img" aria-label={`${title} artwork`} />,
}));

vi.mock('../../src/components/ui/PlaceholderIllustration', () => ({
  default: ({ label }: { label: string }) => <div>{label}</div>,
}));

const historyEntries: HistoryEntry[] = [
  { id: '1', identity: { legacyLevelId: null, contentLevelId: 'level-1', levelKey: 'cozy-cat', ruleVersionId: null }, playableLevelId: null, title: 'Cozy Cat Corner', difficulty: 'Easy', date: '20 Sep 2026', score: 2450, result: 'win', status: 'Cleared' },
  { id: '2', identity: { legacyLevelId: null, contentLevelId: 'level-2', levelKey: 'sunny-picnic', ruleVersionId: null }, playableLevelId: null, title: 'Sunny Picnic', difficulty: 'Medium', date: '19 Sep 2026', score: 1920, result: 'win', status: 'Cleared' },
  { id: '3', identity: { legacyLevelId: null, contentLevelId: 'level-3', levelKey: 'starlit-night', ruleVersionId: null }, playableLevelId: null, title: 'Starlit Night', difficulty: 'Hard', date: '18 Sep 2026', score: 1150, result: 'loss', status: 'Lost' },
  { id: '4', identity: { legacyLevelId: null, contentLevelId: 'level-4', levelKey: 'afternoon-tea', ruleVersionId: null }, playableLevelId: null, title: 'Afternoon Tea', difficulty: 'Easy', date: '17 Sep 2026', score: 1800, result: 'win', status: 'Cleared' },
  { id: '5', identity: { legacyLevelId: null, contentLevelId: 'level-5', levelKey: 'breezy-windmill', ruleVersionId: null }, playableLevelId: null, title: 'Breezy Windmill', difficulty: 'Medium', date: '16 Sep 2026', score: 1780, result: 'win', status: 'Cleared' },
  { id: '6', identity: { legacyLevelId: null, contentLevelId: 'level-6', levelKey: 'bakery', ruleVersionId: null }, playableLevelId: null, title: 'Bakery', difficulty: 'Hard', date: '15 Sep 2026', score: 1200, result: 'loss', status: 'Lost' },
  { id: '7', identity: { legacyLevelId: null, contentLevelId: 'level-7', levelKey: 'late-game', ruleVersionId: null }, playableLevelId: null, title: 'Late Game', difficulty: 'Easy', date: '14 Sep 2026', score: 2100, result: 'win', status: 'Cleared' },
];

function renderHistory(
  entries = historyEntries,
  profileOverrides: Partial<{ totalPlays: number; levelsCompleted: number; totalLevels: number; bestScore: number; avgTime: number }> = {},
) {
  useGameDataMock.mockReturnValue({
    history: entries,
    historyLoading: false,
    historyError: null,
    historyNotice: null,
    refreshHistory: vi.fn(),
    profile: {
      username: 'mint_saki',
      displayName: 'Mint Saki',
      selectedBuddy: 'Bunny',
      levelsCompleted: 3,
      totalLevels: 7,
      bestScore: 2450,
      totalPlays: 12,
      avgTime: 48,
      statsNotice: null,
      ...profileOverrides,
    },
    profileLoading: false,
    profileAvailable: true,
    levels: [],
  });

  return render(<MemoryRouter><History /></MemoryRouter>);
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('History page', () => {
  it('shows the no-play onboarding with real empty-state metrics and game links', () => {
    renderHistory([], { totalPlays: 0, levelsCompleted: 0, totalLevels: 9, bestScore: 0, avgTime: 0 });

    expect(screen.getByRole('heading', { name: 'No plays yet' })).toBeTruthy();
    expect(screen.getByText('Total Plays').parentElement?.textContent).toContain('0รอบ');
    expect(screen.getByText('Completed Levels').parentElement?.textContent).toContain('0/ 9 ด่าน');
    expect(screen.getByText('Best Time').parentElement?.textContent).toContain('--:--');
    expect(screen.getByRole('link', { name: /Start Playing/ }).getAttribute('href')).toBe('/dashboard/play');
    expect(screen.getByRole('link', { name: /ดูวิธีเล่น/ }).getAttribute('href')).toBe('/dashboard/how-to-play');
    expect(screen.getByRole('link', { name: /Easy · 0 ด่าน/ }).getAttribute('href')).toBe('/dashboard/easy-levels');
  });

  it('shows profile summaries, filters records by difficulty, and paginates results', () => {
    renderHistory();

    expect(screen.getByText('12')).toBeTruthy();
    expect(screen.getAllByText('2,450')).toHaveLength(2);
    expect(screen.getByText('48s')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /View details for/ })).toHaveLength(6);

    fireEvent.click(screen.getByRole('button', { name: 'Hard' }));
    const records = screen.getByRole('region', { name: 'Game history records' });
    expect(within(records).getAllByRole('link', { name: /View details for/ })).toHaveLength(2);
    expect(within(records).getByRole('link', { name: 'View details for Starlit Night' })).toBeTruthy();
    expect(within(records).queryByRole('link', { name: 'View details for Cozy Cat Corner' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'All Records 7' }));
    fireEvent.click(within(screen.getByRole('navigation', { name: 'History pagination' })).getByRole('button', { name: 'Next →' }));
    expect(screen.getByRole('link', { name: 'View details for Late Game' })).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'View details for Cozy Cat Corner' })).toBeNull();
  });
});