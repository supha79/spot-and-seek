import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import LevelAssetPairEditor from '../../src/pages/admin/LevelAssetPairEditor';

const { getAdminGameplayAssetPairForLevelMock, uploadAndRegisterGameplayAssetPairForLevelMock } = vi.hoisted(() => ({
  getAdminGameplayAssetPairForLevelMock: vi.fn(),
  uploadAndRegisterGameplayAssetPairForLevelMock: vi.fn(),
}));

vi.mock('../../src/services/levelAssets', () => ({
  getAdminGameplayAssetPairForLevel: getAdminGameplayAssetPairForLevelMock,
  uploadAndRegisterGameplayAssetPairForLevel: uploadAndRegisterGameplayAssetPairForLevelMock,
}));

const originalAsset = {
  id: 'd287e432-8434-43ef-9c2b-004e9f397a26',
  bucket_name: 'gameplay-assets',
  storage_path: 'level-id/upload-a/original.png',
  mime_type: 'image/png',
  width: 640,
  height: 480,
  file_size_bytes: 1024,
  signed_url: 'https://signed.example.test/original',
};
const comparisonAsset = {
  id: 'f225397a-e603-480f-8a6c-0da472d0d1ad',
  bucket_name: 'gameplay-assets',
  storage_path: 'level-id/upload-a/comparison.webp',
  mime_type: 'image/webp',
  width: 640,
  height: 480,
  file_size_bytes: 2048,
  signed_url: 'https://signed.example.test/comparison',
};

beforeEach(() => {
  vi.clearAllMocks();
  getAdminGameplayAssetPairForLevelMock.mockResolvedValue({ original: originalAsset, comparison: comparisonAsset });
});

afterEach(() => cleanup());

describe('Admin private image pair editor', () => {
  it('shows both images and preserves the current pair when replacement registration fails', async () => {
    uploadAndRegisterGameplayAssetPairForLevelMock.mockRejectedValueOnce(
      new Error('The image pair could not be registered. Existing artwork was not replaced.'),
    );
    render(<LevelAssetPairEditor levelId="level-id" levelTitle="Garden" levelStatus="draft" />);
    fireEvent.click(screen.getByText(/Manage image pair/));

    const originalPreview = await screen.findByAltText('Garden original') as HTMLImageElement;
    const comparisonPreview = screen.getByAltText('Garden comparison') as HTMLImageElement;
    expect(originalPreview.src).toBe(originalAsset.signed_url);
    expect(comparisonPreview.src).toBe(comparisonAsset.signed_url);

    fireEvent.change(screen.getByLabelText(/Original/), {
      target: { files: [new File(['original'], 'original.png', { type: 'image/png' })] },
    });
    fireEvent.change(screen.getByLabelText(/Comparison/), {
      target: { files: [new File(['comparison'], 'comparison.webp', { type: 'image/webp' })] },
    });
    fireEvent.click(screen.getByRole('button', { name: 'Upload image pair' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Existing artwork was not replaced.');
    expect(screen.getByAltText('Garden original').getAttribute('src')).toBe(originalAsset.signed_url);
    expect(screen.getByAltText('Garden comparison').getAttribute('src')).toBe(comparisonAsset.signed_url);
    expect(uploadAndRegisterGameplayAssetPairForLevelMock).toHaveBeenCalledOnce();
  });

  it('does not offer replacement inputs for a published level', async () => {
    render(<LevelAssetPairEditor levelId="level-id" levelTitle="Garden" levelStatus="published" />);
    fireEvent.click(screen.getByText(/Manage image pair/));

    expect(await screen.findByAltText('Garden comparison')).toBeTruthy();
    expect(screen.queryByLabelText(/Original/)).toBeNull();
    expect(screen.queryByLabelText(/Comparison/)).toBeNull();
    expect(screen.getByText('Unpublish this level before replacing its image pair.')).toBeTruthy();
  });
});
