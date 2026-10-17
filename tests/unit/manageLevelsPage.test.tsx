import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ManageLevels from '../../src/pages/admin/ManageLevels';

const { useAdminDataMock } = vi.hoisted(() => ({ useAdminDataMock: vi.fn() }));

vi.mock('../../src/context/AdminDataContext', () => ({
  useAdminData: useAdminDataMock,
}));

vi.mock('../../src/components/ui/LevelArtwork', () => ({
  default: ({ title, access, loading }: { title: string; access: string; loading: string }) => (
    <div role="img" aria-label={`${title} ${access} ${loading} thumbnail`} />
  ),
}));

vi.mock('../../src/pages/admin/LevelAssetPairEditor', () => ({
  default: () => null,
}));

const levels = Array.from({ length: 13 }, (_, index) => ({
  id: `level-${index + 1}`,
  title: `Level ${index + 1}`,
  description: `Description ${index + 1}`,
  difficulty: index < 7 ? 'Easy' : 'Hard',
  emoji: '🎯',
  time: 120,
  maxHints: 3,
  questions: 3,
  status: 'draft',
  gameId: 'game-1',
}));

beforeEach(() => {
  useAdminDataMock.mockReturnValue({
    games: [{ id: 'game-1', name: 'Spot & Seek Playground', status: 'published' }],
    levels,
    questions: [],
    addLevel: vi.fn(),
    deleteLevel: vi.fn(),
    updateLevel: vi.fn(),
    publishLevel: vi.fn(),
    unpublishLevel: vi.fn(),
    archiveLevel: vi.fn(),
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

describe('Manage Levels page', () => {
  it('shows six admin thumbnails per page and resets pagination when filtering', () => {
    render(<MemoryRouter><ManageLevels /></MemoryRouter>);

    const levelList = screen.getByRole('region', { name: 'Managed levels' });
    expect(within(levelList).getAllByRole('heading', { level: 3 })).toHaveLength(6);
    expect(within(levelList).getByRole('img', { name: 'Level 1 admin lazy thumbnail' })).toBeTruthy();
    expect(screen.getByText('Page 1 of 3 · 13 levels in current filter')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: '2' }));
    expect(screen.getByRole('heading', { name: 'Level 7' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Level 1' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Easy (7)' }));
    expect(screen.getByText('Page 1 of 2 · 7 levels in current filter')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Level 1' })).toBeTruthy();
  });
});