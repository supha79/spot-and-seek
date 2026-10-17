import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ChooseDifficulty from '../../src/pages/player/ChooseDifficulty';
import DifficultyLevels from '../../src/pages/player/DifficultyLevels';
import Home from '../../src/pages/player/Home';
import PlayView from '../../src/pages/player/PlayView';
import type { DynamicGameplayGateState } from '../../src/services/compatibilityContracts';

const { useGameDataMock, refreshDynamicGameplayGateMock } = vi.hoisted(() => ({
  useGameDataMock: vi.fn(),
  refreshDynamicGameplayGateMock: vi.fn(),
}));

vi.mock('../../src/context/GameDataContext', () => ({
  difficultyOptions: [{ id: 'easy', name: 'Easy', description: 'Relaxed', accent: 'secondary', highlight: false }],
  useGameData: useGameDataMock,
}));

const level = {
  id: 'level-uuid',
  identity: {
    legacyLevelId: null,
    contentLevelId: 'level-uuid',
    levelKey: 'spring-garden',
    ruleVersionId: null,
  },
  gameId: 'game-uuid',
  difficulty: 'easy' as const,
  title: 'Spring Garden',
  subtitle: '',
  description: '',
  differences: 1,
  time: 120,
  maxHints: 3,
  stars: 0,
  cleared: false,
  bestScore: 0,
  image: '',
};

function renderPlayView(dynamicGameplayGateState: DynamicGameplayGateState) {
  useGameDataMock.mockReturnValue({
    games: [{ id: 'game-uuid', slug: 'garden', name: 'Garden', description: '' }],
    gamesLoading: false,
    gamesError: null,
    dynamicGameplayGateState,
    refreshDynamicGameplayGate: refreshDynamicGameplayGateMock,
    refreshGames: vi.fn(),
    selectedGameId: 'game-uuid',
    selectGame: vi.fn(),
    levels: [level],
    levelsLoading: false,
    levelsError: null,
    refreshLevels: vi.fn(),
    history: [],
    historyLoading: false,
  });

  return render(
    <MemoryRouter initialEntries={['/dashboard/play/easy']}>
      <Routes>
        <Route path="/dashboard/play/:routeParam" element={<PlayView />} />
      </Routes>
    </MemoryRouter>,
  );
}

function renderEmptyCatalogPage(page: ReactNode) {
  useGameDataMock.mockReturnValue({
    profile: {
      username: 'Player',
      displayName: 'Player',
      selectedBuddy: 'Bunny',
      levelsCompleted: 0,
      totalLevels: 0,
      bestScore: 0,
      totalPlays: 0,
      avgTime: 0,
      statsNotice: null,
    },
    profileLoading: false,
    profileAvailable: true,
    profileError: null,
    dynamicGameplayGateState: 'disabled',
    refreshDynamicGameplayGate: vi.fn(),
    games: [],
    gamesLoading: false,
    gamesError: null,
    refreshGames: vi.fn(),
    selectedGameId: null,
    selectGame: vi.fn(),
    levels: [],
    levelsLoading: false,
    levelsError: null,
    refreshLevels: vi.fn(),
    history: [],
    historyLoading: false,
    historyError: null,
    refreshHistory: vi.fn(),
  });

  return render(<MemoryRouter>{page}</MemoryRouter>);
}

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('Player Dynamic Gameplay gate', () => {
  it('shows an actionable empty state on Home without the Legacy implementation warning', () => {
    renderEmptyCatalogPage(<Home />);

    expect(screen.getByText('No published games yet')).toBeTruthy();
    expect(screen.queryByText(/Legacy levels are not part of the Dynamic Content Catalog/)).toBeNull();
  });

  it('keeps difficulty cards visible but unavailable when the catalog is empty', () => {
    renderEmptyCatalogPage(<ChooseDifficulty />);

    expect(screen.getByText('No published games yet')).toBeTruthy();
    expect(screen.queryByText(/Legacy levels are not part of the Dynamic Content Catalog/)).toBeNull();
    expect(screen.getByRole('link', { name: /Home/ }).getAttribute('href')).toBe('/dashboard/home');
    expect(screen.getByRole('region', { name: 'Choose a difficulty' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Easy Mode' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No published levels yet' }).hasAttribute('disabled')).toBe(true);
  });

  it('shows cleared progress and best records from the selected difficulty history', () => {
    useGameDataMock.mockReturnValue({
      games: [{ id: 'game-uuid', slug: 'garden', name: 'Garden', description: '' }],
      gamesLoading: false,
      gamesError: null,
      refreshGames: vi.fn(),
      dynamicGameplayGateState: 'enabled',
      refreshDynamicGameplayGate: vi.fn(),
      levels: [{ ...level, stars: 2 }],
      levelsLoading: false,
      levelsError: null,
      refreshLevels: vi.fn(),
      history: [{
        id: 'session-uuid',
        identity: level.identity,
        playableLevelId: level.id,
        title: level.title,
        difficulty: 'Easy',
        date: 'Today',
        score: 2450,
        result: 'win',
        status: 'Cleared',
      }],
      historyLoading: false,
    });

    render(<MemoryRouter><DifficultyLevels difficulty="easy" /></MemoryRouter>);

    expect(screen.getByText('Easy Mode Cleared').parentElement?.textContent).toContain('1 / 1 Levels');
    expect(screen.getAllByText('2,450 pts')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Play again' })).toBeTruthy();
  });

  it('offers Play only when the gate is enabled', () => {
    renderPlayView('enabled');

    expect(screen.getByRole('button', { name: 'Play' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Not ready' })).toBeNull();
  });

  it('does not offer Play when the gate is disabled', () => {
    renderPlayView('disabled');

    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Not ready' })).toBeTruthy();
    expect(screen.getByText(/disabled by the server/i)).toBeTruthy();
  });

  it('does not offer Play when the gate status is unknown', () => {
    renderPlayView('unknown');

    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull();
    expect(screen.getByRole('button', { name: 'Not ready' })).toBeTruthy();
    expect(screen.getByText(/availability could not be verified/i)).toBeTruthy();
    expect(screen.queryByText(/gameplay is disabled/i)).toBeNull();
  });

  it('fails closed when a gate-status lookup failure is represented as unknown', () => {
    const failedGateLookupState: DynamicGameplayGateState = 'unknown';
    renderPlayView(failedGateLookupState);

    expect(screen.queryByRole('button', { name: /Play/ })).toBeNull();
    expect(screen.getByText(/availability could not be verified/i)).toBeTruthy();
  });

  it('allows the player to retry an unknown gate lookup', () => {
    renderPlayView('unknown');
    screen.getByRole('button', { name: 'Retry check' }).click();

    expect(refreshDynamicGameplayGateMock).toHaveBeenCalledOnce();
  });
});