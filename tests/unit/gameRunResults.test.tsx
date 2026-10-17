import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LevelComplete from '../../src/pages/game/LevelComplete';
import TimesUp from '../../src/pages/game/TimesUp';

const { getGameRunResultMock } = vi.hoisted(() => ({
  getGameRunResultMock: vi.fn(),
}));

vi.mock('../../src/services/gameRunResults', () => ({
  getGameRunResult: getGameRunResultMock,
}));

const runId = 'a2d5b83e-b6c8-4de1-88c1-e5919a24d39a';
const baseResult = {
  run_id: runId,
  status: 'won' as const,
  result: 'win' as const,
  score: 940,
  session_id: 'd827967b-4cc2-44eb-9073-ec1ff166dca5',
  played_at: '2026-10-11T10:02:03.000Z',
  started_at: '2026-10-11T10:00:00.000Z',
  completed_at: '2026-10-11T10:02:00.000Z',
  ended_at: '2026-10-11T10:02:03.000Z',
  elapsed_active_seconds: 120,
  wrong_clicks: 1,
  hints_used: 0,
  found_count: 3,
  total_spots: 3,
  level: {
    id: 'spring-garden',
    content_level_id: '85ac4f0c-8bdd-4246-b0f4-f1ecbd3bf619',
    level_key: 'spring-garden',
    rule_version_id: '1973c86f-3955-44f9-8313-6f6274e8da8b',
    title: 'Spring Garden',
    difficulty: 'easy' as const,
    max_duration_seconds: 120,
  },
};

function renderResult(path: string, page: JSX.Element, state?: unknown) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, state }]}>
      <Routes>
        <Route path="/dashboard/play/:runId/complete" element={page} />
        <Route path="/dashboard/play/:runId/times-up" element={page} />
        <Route path="/dashboard/easy-levels" element={<CurrentPath />} />
        <Route path="/dashboard/play/:routeParam" element={<CurrentPath />} />
      </Routes>
    </MemoryRouter>,
  );
}

function CurrentPath() {
  return <p>{useLocation().pathname}</p>;
}

beforeEach(() => {
  vi.clearAllMocks();
  getGameRunResultMock.mockResolvedValue(baseResult);
});

afterEach(() => cleanup());

describe('server-backed game results', () => {
  it('loads a win from the run ID on a direct route without navigation state', async () => {
    renderResult(`/dashboard/play/${runId}/complete`, <LevelComplete />);

    expect(await screen.findByRole('heading', { name: 'Level Complete!' })).toBeTruthy();
    expect(screen.getByText('Spring Garden · easy')).toBeTruthy();
    expect(screen.getByText('940')).toBeTruthy();
    expect(getGameRunResultMock).toHaveBeenCalledWith(runId);
  });

  it('uses persisted result data instead of client navigation state', async () => {
    renderResult(`/dashboard/play/${runId}/complete`, <LevelComplete />, { score: 999999, found: 0 });

    expect(await screen.findByRole('heading', { name: 'Level Complete!' })).toBeTruthy();
    expect(screen.getByText('940')).toBeTruthy();
    expect(screen.queryByText('999,999')).toBeNull();
  });

  it('loads a loss from the run ID after refresh', async () => {
    getGameRunResultMock.mockResolvedValueOnce({ ...baseResult, status: 'lost', result: 'loss', score: 0, found_count: 1 });
    renderResult(`/dashboard/play/${runId}/times-up`, <TimesUp />);

    expect(await screen.findByRole('heading', { name: "Time's Up" })).toBeTruthy();
    expect(screen.getByText(/Differences/).textContent).toContain('1 / 3 Differences');
    expect(screen.getByText('Score').parentElement?.textContent).toContain('0');
  });

  it('does not present a win route for a loss or an unavailable run', async () => {
    getGameRunResultMock.mockResolvedValueOnce({ ...baseResult, status: 'lost', result: 'loss' });
    renderResult(`/dashboard/play/${runId}/complete`, <LevelComplete />);

    expect(await screen.findByText('This game result is unavailable.')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Level Complete!' })).toBeNull();
  });

  it('returns a completed medium level to the medium level list', async () => {
    getGameRunResultMock.mockResolvedValueOnce({
      ...baseResult,
      level: { ...baseResult.level, difficulty: 'medium' },
    });
    renderResult(`/dashboard/play/${runId}/complete`, <LevelComplete />);

    await screen.findByRole('heading', { name: 'Level Complete!' });
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));

    expect(await screen.findByText('/dashboard/play/medium')).toBeTruthy();
  });

  it('returns a timed-out hard level to the hard level list', async () => {
    getGameRunResultMock.mockResolvedValueOnce({
      ...baseResult,
      status: 'lost',
      result: 'loss',
      level: { ...baseResult.level, difficulty: 'hard' },
    });
    renderResult(`/dashboard/play/${runId}/times-up`, <TimesUp />);

    await screen.findByRole('heading', { name: "Time's Up" });
    fireEvent.click(screen.getByRole('button', { name: 'Back to levels' }));

    expect(await screen.findByText('/dashboard/play/hard')).toBeTruthy();
  });
});
