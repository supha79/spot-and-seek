import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import HowToPlay from '../../src/pages/player/HowToPlay';

const { useGameDataMock, loadPreviewPairMock } = vi.hoisted(() => ({
  useGameDataMock: vi.fn(),
  loadPreviewPairMock: vi.fn(),
}));

vi.mock('../../src/context/GameDataContext', () => ({
  useGameData: useGameDataMock,
}));

vi.mock('../../src/pages/player/Home', () => ({
  default: () => <div data-testid="home-backdrop">Home content</div>,
}));

vi.mock('../../src/services/levelAssets', () => ({
  getPublishedGameplayAssetPreviewPairForLevel: loadPreviewPairMock,
}));

function CurrentPath() {
  const location = useLocation();
  return <p data-testid="current-path">{location.pathname}</p>;
}

function renderTutorial() {
  return render(
    <MemoryRouter initialEntries={['/dashboard/how-to-play']}>
      <Routes>
        <Route path="/dashboard/how-to-play" element={<HowToPlay />} />
        <Route path="/dashboard/home" element={<p>Home page</p>} />
        <Route path="/dashboard/play" element={<p>Play page</p>} />
      </Routes>
      <CurrentPath />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  loadPreviewPairMock.mockResolvedValue({
    original: { signed_url: 'https://assets.example/cozy-house/original' },
    comparison: { signed_url: 'https://assets.example/cozy-house/comparison' },
  });
  useGameDataMock.mockReturnValue({
    levels: [{ id: 'level-1', title: 'Cozy House', time: 120, maxHints: 3 }],
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('How to Play tutorial modal', () => {
  it('opens on step one with distinct level images and closes to Home', async () => {
    renderTutorial();

    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Step 1 of 3' })).toBeTruthy();
    expect(screen.getByText('1. Compare Both Pictures')).toBeTruthy();
    expect(screen.getByTestId('home-backdrop')).toBeTruthy();

    const originalImage = await screen.findByRole('img', { name: 'Cozy House original image' });
    const differenceImage = await screen.findByRole('img', { name: 'Cozy House difference image' });
    expect(originalImage.getAttribute('src')).not.toBe(differenceImage.getAttribute('src'));

    fireEvent.click(screen.getByRole('button', { name: 'Got it · เข้าใจแล้ว!' }));
    expect(screen.getByRole('group', { name: 'Step 2 of 3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Previous · ย้อนกลับ' }));
    expect(screen.getByRole('group', { name: 'Step 1 of 3' })).toBeTruthy();

    fireEvent.click(within(screen.getByRole('tablist', { name: 'Tutorial steps' })).getByRole('tab', { name: 'Step 3' }));
    expect(screen.getByRole('group', { name: 'Step 3 of 3' })).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Close tutorial' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByTestId('current-path').textContent).toBe('/dashboard/home');
  });

  it('starts playing from the final tutorial step', () => {
    renderTutorial();
    fireEvent.click(screen.getByRole('button', { name: 'Got it · เข้าใจแล้ว!' }));
    fireEvent.click(screen.getByRole('button', { name: 'Got it · เข้าใจแล้ว!' }));

    expect(screen.getByRole('group', { name: 'Step 3 of 3' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Start Playing · เริ่มเล่นเลย!' }));

    expect(screen.getByTestId('current-path').textContent).toBe('/dashboard/play');
    expect(screen.getByText('Play page')).toBeTruthy();
  });
});
