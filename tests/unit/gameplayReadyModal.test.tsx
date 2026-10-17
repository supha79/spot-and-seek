import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import GamePlay from '../../src/pages/game/GamePlay';

const { useGameDataMock, createGameRequestIdMock, startGameRunMock, pauseGameRunMock, finishGameRunMock, recordGameRunEventMock, getPublishedLevelContentMock } = vi.hoisted(() => ({
  useGameDataMock: vi.fn(),
  createGameRequestIdMock: vi.fn(),
  startGameRunMock: vi.fn(),
  pauseGameRunMock: vi.fn(),
  finishGameRunMock: vi.fn(),
  recordGameRunEventMock: vi.fn(),
  getPublishedLevelContentMock: vi.fn(),
}));

vi.mock('../../src/context/GameDataContext', () => ({
  useGameData: useGameDataMock,
}));

vi.mock('../../src/services/gameRuns', () => ({
  abandonGameRun: vi.fn(),
  createGameRequestId: createGameRequestIdMock,
  finishGameRun: finishGameRunMock,
  pauseGameRun: pauseGameRunMock,
  recordGameRunEvent: recordGameRunEventMock,
  resumeGameRun: vi.fn(),
  startGameRun: startGameRunMock,
}));

vi.mock('../../src/services/playerContent', () => ({
  getPublishedLevelContent: getPublishedLevelContentMock,
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
  differences: 0,
  time: 120,
  maxHints: 3,
  stars: 0,
  cleared: false,
  bestScore: 0,
  image: '',
};

const nextLevel = {
  ...level,
  id: 'next-level-uuid',
  identity: { ...level.identity, contentLevelId: 'next-level-uuid', levelKey: 'summer-garden' },
  title: 'Summer Garden',
};

const gameplaySpot = {
  id: 'spot-uuid',
  level_id: level.id,
  spot_key: 'flower',
  label: 'Flower',
  shape: 'circle' as const,
  x_norm: 0.5,
  y_norm: 0.5,
  width_norm: null,
  height_norm: null,
  radius_norm: 0.05,
  tolerance_norm: 0.03,
  score_value: 100,
  sort_order: 0,
  is_active: true,
  created_at: null,
  updated_at: null,
};

function createPublishedContent(overrides: Record<string, unknown> = {}) {
  return {
    level: {},
    spots: [gameplaySpot],
    originalImageUrl: 'https://assets.example.test/original.png',
    comparisonImageUrl: 'https://assets.example.test/comparison.png',
    assetPair: {
      level_id: level.id,
      rule_version_id: '1973c86f-3955-44f9-8313-6f6274e8da8b',
      original: {
        id: 'd287e432-8434-43ef-9c2b-004e9f397a26',
        bucket_name: 'gameplay-assets',
        storage_path: `${level.id}/e4210ad1-13c3-4e0b-bf2b-f4e00e61f6cd/original.png`,
        mime_type: 'image/png',
        width: 640,
        height: 480,
        file_size_bytes: 1024,
        signed_url: 'https://assets.example.test/original.png',
      },
      comparison: {
        id: 'f225397a-e603-480f-8a6c-0da472d0d1ad',
        bucket_name: 'gameplay-assets',
        storage_path: `${level.id}/e4210ad1-13c3-4e0b-bf2b-f4e00e61f6cd/comparison.webp`,
        mime_type: 'image/webp',
        width: 640,
        height: 480,
        file_size_bytes: 1024,
        signed_url: 'https://assets.example.test/comparison.png',
      },
    },
    artworkNotice: null,
    ...overrides,
  };
}

function createDeferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

function loadImage(image: HTMLImageElement, width = 640, height = 480) {
  Object.defineProperties(image, {
    naturalWidth: { configurable: true, value: width },
    naturalHeight: { configurable: true, value: height },
  });
  fireEvent.load(image);
}

function renderGamePlay(routeParam = 'level-uuid', routeState: { openReadyModal?: boolean } = {}) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: `/dashboard/play/${routeParam}`, state: routeState }]}>
      <RouteControls />
      <Routes>
        <Route path="/dashboard/play/:routeParam" element={<GamePlay />} />
        <Route path="/dashboard/play/:runId/times-up" element={<ResultRoute />} />
        <Route path="/dashboard/play/:runId/complete" element={<ResultRoute />} />
        <Route path="/dashboard/easy-levels" element={<p>Levels page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

function RouteControls() {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate('/dashboard/play/next-level-uuid')}>Next level</button>;
}

async function openReadyModal() {
  fireEvent.click(await screen.findByRole('button', { name: 'Start game' }));
  return screen.findByRole('button', { name: 'Start' });
}

async function loadGameplayImages(title = level.title) {
  await openReadyModal();
  const originalImage = await screen.findByAltText(`${title} original image preload`);
  const comparisonImage = await screen.findByAltText(`${title} comparison image preload`);

  await act(async () => {
    loadImage(originalImage);
    loadImage(comparisonImage);
    await Promise.resolve();
    await Promise.resolve();
  });
  await waitFor(() => expect(screen.getByRole('button', { name: 'Start' }).hasAttribute('disabled')).toBe(false));
}

function ResultRoute() {
  const { runId } = useParams();
  return <p>Result route: {runId}</p>;
}

async function expectDismissalDoesNotStart(close: () => void) {
  renderGamePlay();
  await loadGameplayImages();
  await screen.findByRole('button', { name: 'Start' });

  close();

  expect(await screen.findByText('Levels page')).toBeTruthy();
  expect(startGameRunMock).not.toHaveBeenCalled();
}

beforeEach(() => {
  useGameDataMock.mockReturnValue({
    levels: [level, nextLevel],
    dynamicGameplayGateState: 'enabled',
    levelsLoading: false,
    levelsError: null,
    refreshLevels: vi.fn(),
    refreshProfile: vi.fn(),
    refreshHistory: vi.fn(),
  });
  createGameRequestIdMock.mockReturnValue('request-1');
  startGameRunMock.mockResolvedValue({
    run_id: 'run-1',
    identity: level.identity,
    status: 'active',
    result: null,
    elapsed_active_seconds: 0,
    time_remaining_seconds: 120,
    wrong_clicks: 0,
    hints_used: 0,
    found_count: 0,
    total_spots: 1,
    score: null,
    session_id: null,
  });
  pauseGameRunMock.mockResolvedValue({
    run_id: 'run-1',
    identity: level.identity,
    status: 'paused',
    result: null,
    elapsed_active_seconds: 0,
    time_remaining_seconds: 120,
    wrong_clicks: 0,
    hints_used: 0,
    found_count: 0,
    total_spots: 1,
    score: null,
    session_id: null,
  });
  finishGameRunMock.mockResolvedValue({
    run_id: 'run-1',
    identity: level.identity,
    status: 'lost',
    result: 'loss',
    elapsed_active_seconds: 120,
    time_remaining_seconds: 0,
    wrong_clicks: 0,
    hints_used: 0,
    found_count: 0,
    total_spots: 1,
    score: 0,
    session_id: 'session-1',
  });
  recordGameRunEventMock.mockReset();
  getPublishedLevelContentMock.mockResolvedValue({
    level: {},
    spots: [{
      id: 'spot-uuid',
      level_id: level.id,
      spot_key: 'flower',
      label: 'Flower',
      shape: 'circle',
      x_norm: 0.5,
      y_norm: 0.5,
      width_norm: null,
      height_norm: null,
      radius_norm: 0.05,
      tolerance_norm: 0.03,
      score_value: 100,
      sort_order: 0,
      is_active: true,
      created_at: null,
      updated_at: null,
    }],
    originalImageUrl: 'https://assets.example.test/original.png',
    comparisonImageUrl: 'https://assets.example.test/comparison.png',
    assetPair: {
      level_id: level.id,
      rule_version_id: '1973c86f-3955-44f9-8313-6f6274e8da8b',
      original: {
        id: 'd287e432-8434-43ef-9c2b-004e9f397a26',
        bucket_name: 'gameplay-assets',
        storage_path: `${level.id}/e4210ad1-13c3-4e0b-bf2b-f4e00e61f6cd/original.png`,
        mime_type: 'image/png',
        width: 640,
        height: 480,
        file_size_bytes: 1024,
        signed_url: 'https://assets.example.test/original.png',
      },
      comparison: {
        id: 'f225397a-e603-480f-8a6c-0da472d0d1ad',
        bucket_name: 'gameplay-assets',
        storage_path: `${level.id}/e4210ad1-13c3-4e0b-bf2b-f4e00e61f6cd/comparison.webp`,
        mime_type: 'image/webp',
        width: 640,
        height: 480,
        file_size_bytes: 1024,
        signed_url: 'https://assets.example.test/comparison.png',
      },
    },
    artworkNotice: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe('Ready modal dismissal', () => {
  it('waits for the player to choose Start game before opening the Ready modal', async () => {
    renderGamePlay();

    expect(await screen.findByRole('button', { name: 'Start game' })).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'Ready?' })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Start game' }));

    expect(await screen.findByRole('heading', { name: 'Ready?' })).toBeTruthy();
  });

  it('opens Ready from a level-card Start game action and starts only after confirmation', async () => {
    renderGamePlay('level-uuid', { openReadyModal: true });

    expect(await screen.findByRole('heading', { name: 'Ready?' })).toBeTruthy();
    expect(startGameRunMock).not.toHaveBeenCalled();

    const startButton = screen.getByRole('button', { name: 'Start' });
    const originalImage = await screen.findByAltText('Spring Garden original image preload');
    const comparisonImage = screen.getByAltText('Spring Garden comparison image preload');
    await act(async () => {
      loadImage(originalImage);
      loadImage(comparisonImage);
    });
    await waitFor(() => expect(startButton.hasAttribute('disabled')).toBe(false));
    fireEvent.click(startButton);

    await waitFor(() => expect(startGameRunMock).toHaveBeenCalledWith(
      level.identity,
      'request-1',
      '1973c86f-3955-44f9-8313-6f6274e8da8b',
    ));
  });

  it('keeps a reserved Legacy route unavailable without a verified catalog or artwork', async () => {
    useGameDataMock.mockReturnValue({
      levels: [],
      dynamicGameplayGateState: 'unknown',
      levelsLoading: false,
      levelsError: null,
      refreshLevels: vi.fn(),
      refreshProfile: vi.fn(),
      refreshHistory: vi.fn(),
    });

    renderGamePlay('cozy-cat-corner');

    expect(await screen.findByText('Legacy level content is unavailable.')).toBeTruthy();
    expect(screen.getByText(/No Dynamic content has been substituted/)).toBeTruthy();
    expect(getPublishedLevelContentMock).not.toHaveBeenCalled();
    expect(startGameRunMock).not.toHaveBeenCalled();
  });

  it('blocks Ready and Start when either required image is unavailable', async () => {
    getPublishedLevelContentMock.mockResolvedValueOnce({
      level: {},
      spots: [{
        id: 'spot-uuid',
        level_id: level.id,
        spot_key: 'flower',
        label: 'Flower',
        shape: 'circle',
        x_norm: 0.5,
        y_norm: 0.5,
        width_norm: null,
        height_norm: null,
        radius_norm: 0.05,
        tolerance_norm: 0.03,
        score_value: 100,
        sort_order: 0,
        is_active: true,
        created_at: null,
        updated_at: null,
      }],
      originalImageUrl: 'https://assets.example.test/original.png',
      comparisonImageUrl: null,
      assetPair: null,
      artworkNotice: null,
    });
    renderGamePlay();

    expect(await screen.findByText('Both gameplay images are required.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(startGameRunMock).not.toHaveBeenCalled();
  });

  it('blocks gameplay when the Original image is missing', async () => {
    getPublishedLevelContentMock.mockResolvedValueOnce(createPublishedContent({ originalImageUrl: null, assetPair: null }));
    renderGamePlay();

    expect(await screen.findByText('Both gameplay images are required.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Start' })).toBeNull();
    expect(startGameRunMock).not.toHaveBeenCalled();
  });

  it('keeps Start disabled until both hidden preload images load with valid dimensions', async () => {
    renderGamePlay();
    const startButton = await openReadyModal();
    const originalImage = await screen.findByAltText('Spring Garden original image preload');
    const comparisonImage = screen.getByAltText('Spring Garden comparison image preload');

    expect(startButton.hasAttribute('disabled')).toBe(true);
    expect(screen.getByRole('status').textContent).toContain('Original: loading. Comparison: loading.');

    await act(async () => {
      loadImage(originalImage);
      loadImage(comparisonImage);
      await Promise.resolve();
    });
    await waitFor(() => expect(startButton.hasAttribute('disabled')).toBe(false));
    expect(startButton.hasAttribute('disabled')).toBe(false);
  });

  it('keeps Start disabled and explains when a preloaded image fails to load', async () => {
    renderGamePlay();
    const startButton = await openReadyModal();
    const comparisonImage = await screen.findByAltText('Spring Garden comparison image preload');

    fireEvent.error(comparisonImage);

    expect((await screen.findByRole('alert')).textContent).toContain('Could not load or decode the Comparison image.');
    expect(startButton.hasAttribute('disabled')).toBe(true);
    fireEvent.click(startButton);
    expect(startGameRunMock).not.toHaveBeenCalled();
  });

  it('keeps Start disabled when a loaded image has invalid dimensions', async () => {
    renderGamePlay();
    const startButton = await openReadyModal();
    const originalImage = await screen.findByAltText('Spring Garden original image preload');

    loadImage(originalImage, 0, 0);

    expect((await screen.findByRole('alert')).textContent).toContain('Could not load or decode the Original image.');
    expect(startButton.hasAttribute('disabled')).toBe(true);
    expect(startGameRunMock).not.toHaveBeenCalled();
  });

  it('ignores image load events from the previous level after switching asset pairs', async () => {
    const requests: Array<{ levelId: string; resolve: (content: ReturnType<typeof createPublishedContent>) => void }> = [];
    getPublishedLevelContentMock.mockImplementation((requestedLevelId: string) => new Promise((resolve) => {
      requests.push({ levelId: requestedLevelId, resolve });
    }));

    renderGamePlay();
    await waitFor(() => expect(requests).toHaveLength(1));
    requests[0].resolve(createPublishedContent());
    const oldOriginal = await screen.findByAltText('Spring Garden original image preload');
    await act(async () => {
      loadImage(oldOriginal);
    });

    fireEvent.click(screen.getByRole('button', { name: 'Next level' }));
    await waitFor(() => expect(requests).toHaveLength(2));
    const baseContent = createPublishedContent();
    const nextOriginalUrl = 'https://assets.example.test/next-original.png';
    const nextComparisonUrl = 'https://assets.example.test/next-comparison.png';
    requests[1].resolve(createPublishedContent({
      originalImageUrl: nextOriginalUrl,
      comparisonImageUrl: nextComparisonUrl,
      assetPair: {
        ...baseContent.assetPair,
        level_id: nextLevel.id,
        original: { ...baseContent.assetPair.original, id: 'next-original-id', signed_url: nextOriginalUrl },
        comparison: { ...baseContent.assetPair.comparison, id: 'next-comparison-id', signed_url: nextComparisonUrl },
      },
    }));

    const startButton = await openReadyModal();
    const nextOriginal = await screen.findByAltText('Summer Garden original image preload');
    const nextComparison = screen.getByAltText('Summer Garden comparison image preload');
    expect(startButton.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      loadImage(oldOriginal);
    });
    expect(startButton.hasAttribute('disabled')).toBe(true);

    await act(async () => {
      loadImage(nextOriginal);
      loadImage(nextComparison);
      await Promise.resolve();
    });
    expect(startButton.hasAttribute('disabled')).toBe(false);
  });

  it('closes through the Close button without starting a run', async () => {
    await expectDismissalDoesNotStart(() => {
      fireEvent.click(screen.getByRole('button', { name: 'Close' }));
    });
  });

  it('closes on Escape without starting a run', async () => {
    await expectDismissalDoesNotStart(() => {
      fireEvent.keyDown(window, { key: 'Escape' });
    });
  });

  it('closes on backdrop click without starting a run', async () => {
    await expectDismissalDoesNotStart(() => {
      fireEvent.click(screen.getByRole('presentation'));
    });
  });

  it('hides gameplay images until Start starts the run', async () => {
    renderGamePlay();
    await loadGameplayImages();
    expect(screen.queryByRole('img', { name: 'Spring Garden original illustration' })).toBeNull();
    expect(screen.queryByRole('img', { name: 'Spring Garden comparison illustration' })).toBeNull();
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

    await waitFor(() => {
      expect(startGameRunMock).toHaveBeenCalledWith(
        level.identity,
        'request-1',
        '1973c86f-3955-44f9-8313-6f6274e8da8b',
      );
    });
    expect(await screen.findByRole('button', { name: /Pause/ })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Spring Garden original illustration' })).toBeTruthy();
    expect(screen.getByRole('img', { name: 'Spring Garden comparison illustration' })).toBeTruthy();
  });

  it('renders a distinct comparison image with spots aligned to normalized coordinates', async () => {
    renderGamePlay();
    await loadGameplayImages();
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('button', { name: /Pause/ });

    const originalImage = screen.getByRole('img', { name: 'Spring Garden original illustration' }) as HTMLImageElement;
    const comparisonImage = screen.getByRole('img', { name: 'Spring Garden comparison illustration' }) as HTMLImageElement;
    const spotButton = screen.getByRole('button', { name: 'Find difference Flower' });

    expect(originalImage.src).toBe('https://assets.example.test/original.png');
    expect(comparisonImage.src).toBe('https://assets.example.test/comparison.png');
    expect(comparisonImage.src).not.toBe(originalImage.src);
    expect(comparisonImage.parentElement?.style.aspectRatio).toBe('640 / 480');
    expect(spotButton.style.left).toBe('50%');
    expect(spotButton.style.top).toBe('50%');
  });

  it('records a spot once across rapid duplicate clicks and disables it after server confirmation', async () => {
    const secondSpot = { ...gameplaySpot, id: 'second-spot', spot_key: 'leaf', label: 'Leaf', x_norm: 0.75 };
    getPublishedLevelContentMock.mockResolvedValueOnce(createPublishedContent({ spots: [gameplaySpot, secondSpot] }));
    const eventResponse = createDeferred();
    recordGameRunEventMock.mockReturnValue(eventResponse.promise);
    renderGamePlay();
    await loadGameplayImages();
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));
    await screen.findByRole('button', { name: /Pause/ });

    const leafButton = screen.getByRole('button', { name: 'Find difference Leaf' });
    await act(async () => {
      fireEvent.click(leafButton);
      fireEvent.click(leafButton);
    });

    expect(recordGameRunEventMock).toHaveBeenCalledOnce();
    expect(recordGameRunEventMock).toHaveBeenCalledWith('run-1', 'request-1', 'spot_found', 'leaf');

    await act(async () => {
      eventResponse.resolve({
        run_id: 'run-1',
        identity: level.identity,
        status: 'active',
        result: null,
        elapsed_active_seconds: 1,
        time_remaining_seconds: 119,
        wrong_clicks: 0,
        hints_used: 0,
        found_count: 1,
        total_spots: 2,
        score: null,
        session_id: null,
      });
      await eventResponse.promise;
    });

    expect(await screen.findByText('Found 1 / 2')).toBeTruthy();
  expect(screen.getAllByLabelText('Found 1 Leaf')).toHaveLength(1);
  expect(screen.getAllByText('1', { exact: true })).toHaveLength(2);
  expect(leafButton.getAttribute('aria-disabled')).toBe('true');
  fireEvent.click(leafButton);
    expect(recordGameRunEventMock.mock.calls.map((call) => call[2])).toEqual(['spot_found']);
  });

  it('shows a server gate rejection in the Ready modal after an enabled lookup', async () => {
    startGameRunMock.mockRejectedValueOnce(new Error('Dynamic gameplay is disabled.'));
    renderGamePlay();
    await loadGameplayImages();
    fireEvent.click(await screen.findByRole('button', { name: 'Start' }));

    expect((await screen.findByRole('alert')).textContent).toContain('Dynamic gameplay is disabled.');
    expect(screen.getByRole('heading', { name: 'Ready?' })).toBeTruthy();
  });

  it('starts the timer only after Start and preserves server-backed pause behavior', async () => {
    renderGamePlay();
    await loadGameplayImages();
    await screen.findByRole('button', { name: 'Start' });
    expect(document.querySelector('#game-timer')?.textContent).toBe('02:00');

    vi.useFakeTimers();
    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(document.querySelector('#game-timer')?.textContent).toBe('02:00');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });
    expect(document.querySelector('#game-timer')?.textContent).toBe('01:58');

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Pause/ }));
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(screen.getByRole('heading', { name: 'Paused' })).toBeTruthy();
    expect(pauseGameRunMock).toHaveBeenCalledWith('run-1', 'request-1');
  });

  it('finalizes through the existing finish RPC when the timer expires', async () => {
    renderGamePlay();
    await loadGameplayImages();
    await screen.findByRole('button', { name: 'Start' });
    vi.useFakeTimers();

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Start' }));
      await Promise.resolve();
      await Promise.resolve();
    });
    await act(async () => {
      vi.advanceTimersByTime(120000);
    });

    expect(finishGameRunMock).toHaveBeenCalledWith('run-1');
    expect(screen.getByText('Result route: run-1')).toBeTruthy();
  });
});