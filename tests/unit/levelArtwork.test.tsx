import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import LevelArtwork from '../../src/components/ui/LevelArtwork';

const { getAdminPreviewMock, getPublishedPreviewMock } = vi.hoisted(() => ({
  getAdminPreviewMock: vi.fn(),
  getPublishedPreviewMock: vi.fn(),
}));

vi.mock('../../src/services/levelAssets', () => ({
  getAdminGameplayAssetPreviewForLevel: getAdminPreviewMock,
  getPublishedGameplayAssetPreviewForLevel: getPublishedPreviewMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(() => {
  cleanup();
});

describe('LevelArtwork', () => {
  it('retries a failed transformed thumbnail with one full-resolution URL', async () => {
    const thumbnailUrl = 'https://storage.example/thumbnail.png';
    const fullUrl = 'https://storage.example/full.png';
    getPublishedPreviewMock.mockImplementation(async (_levelId: string, resolution: string) => ({
      signed_url: resolution === 'full' ? fullUrl : thumbnailUrl,
    }));

    render(<LevelArtwork levelId="level-1" title="Magic Garden" />);

    const image = await screen.findByRole('img', { name: 'Magic Garden level artwork' });
    await waitFor(() => expect(image.getAttribute('src')).toBe(thumbnailUrl));

    fireEvent.error(image);
    await waitFor(() => expect(image.getAttribute('src')).toBe(fullUrl));
    expect(getPublishedPreviewMock).toHaveBeenNthCalledWith(1, 'level-1', 'thumbnail');
    expect(getPublishedPreviewMock).toHaveBeenNthCalledWith(2, 'level-1', 'full');

    fireEvent.error(image);
    await waitFor(() => expect(screen.queryByRole('img', { name: 'Magic Garden level artwork' })).toBeNull());
    expect(getPublishedPreviewMock).toHaveBeenCalledTimes(2);
  });
});