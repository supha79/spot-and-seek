import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Questions from '../../src/pages/admin/Questions';

const { useAdminDataMock } = vi.hoisted(() => ({ useAdminDataMock: vi.fn() }));

vi.mock('../../src/context/AdminDataContext', () => ({
  useAdminData: useAdminDataMock,
}));

vi.mock('../../src/components/ui/LevelArtwork', () => ({
  default: ({ title, access, loading }: { title: string; access: string; loading: string }) => (
    <div role="img" aria-label={`${title} ${access} ${loading} thumbnail`} />
  ),
}));

vi.mock('../../src/components/admin/ScorePolicyManager', () => ({ default: () => null }));

const levels = [
  { id: 'level-easy', title: 'Cozy House', difficulty: 'Easy' },
  { id: 'level-hard', title: 'Forest Camp', difficulty: 'Hard' },
];
const questions = Array.from({ length: 13 }, (_, index) => {
  const id = index + 1;
  const isEasy = id <= 7;
  return {
    id: `question-${id}`,
    levelId: isEasy ? 'level-easy' : 'level-hard',
    levelName: isEasy ? 'Cozy House' : 'Forest Camp',
    difficulty: isEasy ? 'Easy' : 'Hard',
    spotKey: `spot-${id}`,
    label: `Question ${id}`,
    shape: 'circle',
    xNorm: 0.2,
    yNorm: 0.3,
    widthNorm: null,
    heightNorm: null,
    radiusNorm: 0.04,
    toleranceNorm: 0.02,
    scoreValue: 100,
    sortOrder: 0,
    active: true,
    createdAt: 'Oct 16, 2026',
  };
});

beforeEach(() => {
  useAdminDataMock.mockReturnValue({
    levels,
    questions,
    games: [],
    deleteQuestion: vi.fn(),
    deactivateQuestion: vi.fn(),
    reactivateQuestion: vi.fn(),
    refreshCatalog: vi.fn(),
    isLoading: false,
    error: null,
    catalogWarnings: [],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('Manage Questions page', () => {
  it('shows six level thumbnails per page and filters records by level and search', () => {
    render(<MemoryRouter><Questions /></MemoryRouter>);

    const questionGrid = screen.getByRole('region', { name: 'Question spots' });
    expect(within(questionGrid).getAllByRole('heading', { level: 2 })).toHaveLength(6);
    expect(within(questionGrid).getAllByRole('img', { name: 'Cozy House admin lazy thumbnail' })).toHaveLength(6);
    expect(screen.getByText('Page 1 of 3 · 13 spots match current filters')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByRole('heading', { name: 'Question 7' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Question 1' })).toBeNull();

    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'level-easy' } });
    expect(screen.getByText('Page 1 of 2 · 7 spots match current filters')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Question 1' })).toBeTruthy();

    fireEvent.change(screen.getByPlaceholderText('Search label or spot key'), { target: { value: 'spot-7' } });
    expect(screen.getByRole('heading', { name: 'Question 7' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Question pagination' })).toBeNull();
  });
});
