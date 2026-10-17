import { useEffect, useReducer, useRef, useState, type MouseEvent, type SyntheticEvent } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { useGameData, type Level } from '../../context/GameDataContext';
import {
  abandonGameRun,
  createGameRequestId,
  finishGameRun,
  pauseGameRun,
  recordGameRunEvent,
  resumeGameRun,
  startGameRun,
  type GameRunSnapshot,
} from '../../services/gameRuns';
import { getPublishedLevelContent } from '../../services/playerContent';
import { LEGACY_LEVEL_KEYS, type LevelSpotRow } from '../../services/content';
import { getGameRunReadinessNotice, getRemainingHints } from '../../services/compatibilityContracts';
import type { PublishedGameplayAssetPair } from '../../services/levelAssets';

type GameStatus = 'ready' | 'playing' | 'paused' | 'complete';

type FoundSpot = {
  id: string;
  x: number;
  y: number;
};

type GameplayImageName = 'Original' | 'Comparison';
type GameplayImageReadiness = 'loading' | 'ready' | 'error';

type GameState = {
  status: GameStatus;
  timeRemainingSeconds: number;
  totalDifferences: number;
  foundSpots: FoundSpot[];
  wrongClicks: number;
  hintsRemaining: number;
  hintHighlight: string | null;
};

type GameAction =
  | { type: 'TICK' }
  | { type: 'SERVER_SYNC'; snapshot: GameRunSnapshot; maxHints: number; foundSpot?: FoundSpot; hintSpotId?: string }
  | { type: 'CLEAR_HINT' }

type PendingOperation = {
  requestId: string | null;
  label: string;
  run: () => Promise<GameRunSnapshot>;
  foundSpot?: FoundSpot;
  hintSpotId?: string;
};

type SpotConfig = {
  id: string;
  shape: LevelSpotRow['shape'];
  x_norm: number;
  y_norm: number;
  width_norm: number | null;
  height_norm: number | null;
  radius_norm: number | null;
  tolerance_norm: number | null;
  score_value: number | null;
  sort_order: number | null;
  is_active: boolean;
  label: string;
};

function mapGameplaySpots(rows: LevelSpotRow[]): SpotConfig[] {
  return rows.map((spot) => ({
    id: spot.spot_key,
    shape: spot.shape,
    x_norm: spot.x_norm,
    y_norm: spot.y_norm,
    width_norm: spot.width_norm,
    height_norm: spot.height_norm,
    radius_norm: spot.radius_norm,
    tolerance_norm: spot.tolerance_norm,
    score_value: spot.score_value,
    sort_order: spot.sort_order,
    is_active: spot.is_active,
    label: spot.label,
  }));
}

type LevelContentState = {
  levelId: string;
  spots: SpotConfig[];
  originalImageUrl: string | null;
  comparisonImageUrl: string | null;
  assetPair: PublishedGameplayAssetPair | null;
  artworkNotice: string | null;
  error: string | null;
};

export default function GamePlay() {
  const { routeParam: levelIdParam = '' } = useParams();
  const location = useLocation();
  const openReadyModalOnEntry = (location.state as { openReadyModal?: boolean } | null)?.openReadyModal === true;
  const { levels, levelsLoading, levelsError, dynamicGameplayGateState, refreshLevels, refreshProfile, refreshHistory } = useGameData();
  const level = levels.find((item) => item.id === levelIdParam);
  const [contentState, setContentState] = useState<LevelContentState | null>(null);
  const [contentRetry, setContentRetry] = useState(0);
  const loadedContent = contentState?.levelId === level?.id ? contentState : null;

  useEffect(() => {
    if (!level?.identity.contentLevelId) return;
    let isMounted = true;
    setContentState(null);

    void getPublishedLevelContent(level.identity.contentLevelId)
      .then(({ spots, originalImageUrl, comparisonImageUrl, assetPair, artworkNotice }) => {
        if (isMounted) {
          setContentState({
            levelId: level.identity.contentLevelId!,
            spots: mapGameplaySpots(spots),
            originalImageUrl,
            comparisonImageUrl,
            assetPair,
            artworkNotice,
            error: null,
          });
        }
      })
      .catch((error: unknown) => {
        if (isMounted) {
          setContentState({
            levelId: level.identity.contentLevelId!,
            spots: [],
            originalImageUrl: null,
            comparisonImageUrl: null,
            assetPair: null,
            artworkNotice: null,
            error: error instanceof Error ? error.message : 'Could not load level content.',
          });
        }
      });

    return () => {
      isMounted = false;
    };
  }, [contentRetry, level?.identity.contentLevelId]);

  if (levelsLoading) {
    return <p role="status" className="py-12 text-center text-body-md text-on-surface-variant">Loading published levels...</p>;
  }

  if (levelsError) {
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-body-md text-error">{levelsError}</p>
        <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshLevels()}>Retry</Button>
      </div>
    );
  }

  if (!level) {
    const isLegacyRoute = (LEGACY_LEVEL_KEYS as readonly string[]).includes(levelIdParam);
    return (
      <div role="status" className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-headline-sm text-on-surface">{isLegacyRoute ? 'Legacy level content is unavailable.' : 'This published level is not available.'}</p>
        {isLegacyRoute ? <p className="text-body-md text-on-surface-variant">This reserved Legacy level needs a verified Legacy catalog and runtime source. No Dynamic content has been substituted.</p> : null}
        <Link to="/dashboard/easy-levels" className="text-label-md text-primary">Back to levels</Link>
      </div>
    );
  }

  if (!level.identity.contentLevelId) {
    return (
      <div role="status" className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-headline-sm text-on-surface">Legacy level content is unavailable.</p>
        <p className="text-body-md text-on-surface-variant">A verified Legacy catalog and runtime source is required. No Dynamic content has been substituted.</p>
        <Link to="/dashboard/easy-levels" className="text-label-md text-primary">Back to levels</Link>
      </div>
    );
  }

  if (!loadedContent) {
    return <p role="status" className="py-12 text-center text-body-md text-on-surface-variant">Loading level content...</p>;
  }

  if (loadedContent.error) {
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-body-md text-error">{loadedContent.error}</p>
        <Button variant="ghost" leftIcon="refresh" onClick={() => setContentRetry((current) => current + 1)}>Retry</Button>
      </div>
    );
  }

  if (loadedContent.spots.length === 0) {
    return (
      <div className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-headline-sm text-on-surface">This level has no active spots yet.</p>
        <Link to="/dashboard/easy-levels" className="text-label-md text-primary">Back to levels</Link>
      </div>
    );
  }

  const runReadinessNotice = getGameRunReadinessNotice(level.identity, dynamicGameplayGateState);
  if (runReadinessNotice) {
    return (
      <div role="status" className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-headline-sm text-on-surface">Dynamic gameplay is not ready.</p>
        <p className="text-body-md text-on-surface-variant">{runReadinessNotice}</p>
        <Link to="/dashboard/easy-levels" className="text-label-md text-primary">Back to levels</Link>
      </div>
    );
  }

  if (!loadedContent.assetPair || !loadedContent.originalImageUrl || !loadedContent.comparisonImageUrl) {
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-headline-sm text-on-surface">Both gameplay images are required.</p>
        <Button variant="ghost" leftIcon="refresh" onClick={() => setContentRetry((current) => current + 1)}>Retry</Button>
      </div>
    );
  }

  const imageSetKey = JSON.stringify([
    level.id,
    loadedContent.assetPair.original.id,
    loadedContent.originalImageUrl,
    loadedContent.assetPair.comparison.id,
    loadedContent.comparisonImageUrl,
  ]);

  return <ActiveGamePlay key={imageSetKey} level={{ ...level, image: loadedContent.originalImageUrl, differences: loadedContent.spots.length }} comparisonImageUrl={loadedContent.comparisonImageUrl} assetPair={loadedContent.assetPair} spots={loadedContent.spots} artworkNotice={loadedContent.artworkNotice} dynamicGameplayGateState={dynamicGameplayGateState} refreshProfile={refreshProfile} refreshHistory={refreshHistory} openReadyModalOnEntry={openReadyModalOnEntry} />;
}

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function reducer(state: GameState, action: GameAction): GameState {
  switch (action.type) {
    case 'TICK': {
      if (state.status !== 'playing') return state;
      return { ...state, timeRemainingSeconds: Math.max(0, state.timeRemainingSeconds - 1) };
    }
    case 'SERVER_SYNC': {
      const status = action.snapshot.status === 'active'
        ? 'playing'
        : action.snapshot.status === 'paused'
          ? 'paused'
          : ['completed', 'won', 'lost'].includes(action.snapshot.status)
            ? 'complete'
            : state.status;
      return {
        ...state,
        status,
        timeRemainingSeconds: Math.ceil(action.snapshot.time_remaining_seconds),
        wrongClicks: action.snapshot.wrong_clicks,
        hintsRemaining: getRemainingHints(action.maxHints, action.snapshot.hints_used),
        foundSpots: action.foundSpot && !state.foundSpots.some((spot) => spot.id === action.foundSpot?.id)
          ? [...state.foundSpots, action.foundSpot]
          : state.foundSpots,
        hintHighlight: action.hintSpotId ?? state.hintHighlight,
      };
    }
    case 'CLEAR_HINT':
      return { ...state, hintHighlight: null };
    default:
      return state;
  }
}

function ActiveGamePlay({ level, comparisonImageUrl, assetPair, spots, artworkNotice, dynamicGameplayGateState, refreshProfile, refreshHistory, openReadyModalOnEntry }: { level: Level; comparisonImageUrl: string; assetPair: PublishedGameplayAssetPair; spots: SpotConfig[]; artworkNotice: string | null; dynamicGameplayGateState: ReturnType<typeof useGameData>['dynamicGameplayGateState']; refreshProfile: () => void; refreshHistory: () => void; openReadyModalOnEntry: boolean }) {
  const navigate = useNavigate();

  const initialState: GameState = {
    status: 'ready',
    timeRemainingSeconds: level.time,
    totalDifferences: level.differences,
    foundSpots: [],
    wrongClicks: 0,
    hintsRemaining: level.maxHints,
    hintHighlight: null,
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  const [isReadyModalOpen, setIsReadyModalOpen] = useState(openReadyModalOnEntry);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [recentFound, setRecentFound] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const [imageReadiness, setImageReadiness] = useState<Record<GameplayImageName, GameplayImageReadiness>>({
    Original: 'loading',
    Comparison: 'loading',
  });
  const imageSetIsCurrentRef = useRef(true);
  const runIdRef = useRef<string | null>(null);
  const pendingOperationRef = useRef<PendingOperation | null>(null);
  const operationInFlightRef = useRef(false);
  const finishRequestedRef = useRef(false);
  const imagesReady = imageReadiness.Original === 'ready' && imageReadiness.Comparison === 'ready';
  const failedImage = (Object.keys(imageReadiness) as GameplayImageName[]).find((name) => imageReadiness[name] === 'error');
  const inputDisabled = isSubmitting || pendingOperation !== null || !imagesReady;

  useEffect(() => {
    imageSetIsCurrentRef.current = true;
    return () => {
      imageSetIsCurrentRef.current = false;
    };
  }, []);

  const handleImageLoad = (name: GameplayImageName, expectedUrl: string) => (event: SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (!imageSetIsCurrentRef.current || image.getAttribute('src') !== expectedUrl) return;

    const isValidImage = image.naturalWidth > 0 && image.naturalHeight > 0;
    setImageReadiness((current) => ({ ...current, [name]: isValidImage ? 'ready' : 'error' }));
  };

  const handleImageError = (name: GameplayImageName, expectedUrl: string) => (event: SyntheticEvent<HTMLImageElement>) => {
    if (!imageSetIsCurrentRef.current || event.currentTarget.getAttribute('src') !== expectedUrl) return;
    setImageReadiness((current) => ({ ...current, [name]: 'error' }));
  };

  useEffect(() => {
    if (state.status !== 'playing') return;

    const timerId = window.setInterval(() => {
      dispatch({ type: 'TICK' });
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, [state.status]);

  useEffect(() => {
    if (!state.hintHighlight) return;

    const timerId = window.setTimeout(() => {
      dispatch({ type: 'CLEAR_HINT' });
    }, 1500);

    return () => window.clearTimeout(timerId);
  }, [state.hintHighlight]);

  async function submitOperation(operation: PendingOperation) {
    if (operationInFlightRef.current) return;
    if (pendingOperationRef.current && pendingOperationRef.current !== operation) return;

    operationInFlightRef.current = true;
    pendingOperationRef.current = operation;
    setPendingOperation(operation);
    setIsSubmitting(true);
    setOperationError(null);
    let finishAfterOperation = false;

    try {
      const snapshot = await operation.run();
      pendingOperationRef.current = null;
      setPendingOperation(null);
      dispatch({ type: 'SERVER_SYNC', snapshot, maxHints: level.maxHints, foundSpot: operation.foundSpot, hintSpotId: operation.hintSpotId });
      if (operation.foundSpot) {
        setRecentFound(operation.foundSpot.id);
        window.setTimeout(() => setRecentFound((current) => current === operation.foundSpot?.id ? null : current), 700);
      }
      if (snapshot.status === 'active') runIdRef.current = snapshot.run_id;

      if (snapshot.status === 'won') {
        finishRequestedRef.current = true;
        refreshProfile();
        refreshHistory();
        navigate(`/dashboard/play/${snapshot.run_id}/complete`);
      } else if (snapshot.status === 'lost') {
        finishRequestedRef.current = true;
        refreshProfile();
        refreshHistory();
        navigate(`/dashboard/play/${snapshot.run_id}/times-up`);
      } else if (snapshot.status === 'abandoned') {
        navigate('/dashboard/easy-levels');
      } else if (
        (snapshot.status === 'completed' || (snapshot.status === 'active' && snapshot.time_remaining_seconds <= 0))
        && !finishRequestedRef.current
      ) {
        finishRequestedRef.current = true;
        finishAfterOperation = true;
      }
    } catch (error) {
      setOperationError(error instanceof Error ? error.message : 'The game request failed.');
    } finally {
      operationInFlightRef.current = false;
      setIsSubmitting(false);
    }

    if (finishAfterOperation) {
      const runId = runIdRef.current;
      if (runId) {
        void submitOperation({
          requestId: null,
          label: 'Save result',
          run: () => finishGameRun(runId),
        });
      }
    }
  }

  const submitRequest = (
    label: string,
    run: (requestId: string) => Promise<GameRunSnapshot>,
    extras: Pick<PendingOperation, 'foundSpot' | 'hintSpotId'> = {},
  ) => {
    if (operationInFlightRef.current || pendingOperationRef.current) return;
    const requestId = createGameRequestId();
    void submitOperation({ requestId, label, run: () => run(requestId), ...extras });
  };

  const retryPendingOperation = () => {
    const operation = pendingOperationRef.current;
    if (operation) void submitOperation(operation);
  };

  const handleStart = () => {
    setOperationError(null);
    if (!imagesReady) return;
    const readinessNotice = getGameRunReadinessNotice(level.identity, dynamicGameplayGateState);
    if (readinessNotice) {
      setOperationError(readinessNotice);
      return;
    }
    submitRequest('Start game', (requestId) => startGameRun(level.identity, requestId, assetPair.rule_version_id));
  };

  const handleReadyClose = () => navigate('/dashboard/easy-levels');

  const handlePause = () => {
    const runId = runIdRef.current;
    if (runId) submitRequest('Pause game', (requestId) => pauseGameRun(runId, requestId));
  };

  const handleResume = () => {
    const runId = runIdRef.current;
    if (runId) submitRequest('Resume game', (requestId) => resumeGameRun(runId, requestId));
  };

  const handleExit = () => {
    const runId = runIdRef.current;
    if (runId) submitRequest('Abandon game', (requestId) => abandonGameRun(runId, requestId));
  };

  const handleHint = () => {
    if (state.hintsRemaining <= 0 || state.status !== 'playing' || !runIdRef.current) return;
    const nextUnfound = spots.find((spot) => !state.foundSpots.some((item) => item.id === spot.id));
    submitRequest(
      'Use hint',
      (requestId) => recordGameRunEvent(runIdRef.current!, requestId, 'hint_used'),
      { hintSpotId: nextUnfound?.id },
    );
  };

  const handleCorrectSpot = (spot: SpotConfig) => {
    const runId = runIdRef.current;
    if (!runId || state.status !== 'playing' || state.foundSpots.some((item) => item.id === spot.id)) return;

    submitRequest(
      'Record found spot',
      (requestId) => recordGameRunEvent(runId, requestId, 'spot_found', spot.id),
      { foundSpot: { id: spot.id, x: spot.x_norm * 100, y: spot.y_norm * 100 } },
    );
  };

  const handleWrongClick = () => {
    const runId = runIdRef.current;
    if (!runId || state.status !== 'playing') return;
    submitRequest('Record wrong click', (requestId) => recordGameRunEvent(runId, requestId, 'wrong_click'));
    setWrongFlash(true);
    window.setTimeout(() => setWrongFlash(false), 600);
  };

  const handleImageSpotClick = (event: MouseEvent<HTMLDivElement>) => {
    if (inputDisabled || state.status !== 'playing') return;
    if (event.target instanceof HTMLElement && event.target.closest('button')) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - bounds.left) / bounds.width;
    const y = (event.clientY - bounds.top) / bounds.height;
    const matchedSpot = spots.find((spot) => {
      if (state.foundSpots.some((foundSpot) => foundSpot.id === spot.id)) return false;
      const tolerance = spot.tolerance_norm ?? 0;
      if (spot.shape === 'rectangle') {
        return Math.abs(x - spot.x_norm) <= (spot.width_norm ?? 0) / 2 + tolerance
          && Math.abs(y - spot.y_norm) <= (spot.height_norm ?? 0) / 2 + tolerance;
      }
      return Math.hypot(x - spot.x_norm, y - spot.y_norm) <= Math.max(spot.radius_norm ?? 0, tolerance);
    });

    if (matchedSpot) handleCorrectSpot(matchedSpot);
    else handleWrongClick();
  };

  useEffect(() => {
    if (
      state.status !== 'playing'
      || state.timeRemainingSeconds > 0
      || !runIdRef.current
      || finishRequestedRef.current
      || operationInFlightRef.current
      || pendingOperationRef.current
    ) return;
    finishRequestedRef.current = true;
    const runId = runIdRef.current;
    void submitOperation({ requestId: null, label: 'Finish game', run: () => finishGameRun(runId) });
  }, [state.status, state.timeRemainingSeconds]);

  const progressWidth = (state.timeRemainingSeconds / level.time) * 100;
  const foundCount = state.foundSpots.length;
  const getFoundOrder = (spotId: string) => state.foundSpots.findIndex((item) => item.id === spotId) + 1;

  return (
    <div className="relative w-full pb-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-8 h-32 w-32 rounded-full bg-secondary-fixed/40 blur-3xl" />
        <div className="absolute right-12 top-1/2 h-48 w-48 rounded-full bg-tertiary-fixed/30 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-40 w-40 rounded-full bg-primary-fixed/30 blur-3xl" />
      </div>

      {operationError && state.status === 'playing' ? (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl bg-tertiary-fixed p-4 text-on-tertiary-fixed sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-label-md">Game request failed</p>
            <p className="text-body-sm">{operationError}</p>
          </div>
          {pendingOperation ? (
            <Button type="button" variant="tertiary" disabled={isSubmitting} onClick={retryPendingOperation} leftIcon="refresh">
              {isSubmitting ? 'Retrying...' : 'Retry'}
            </Button>
          ) : null}
        </div>
      ) : null}
      {artworkNotice ? <p role="status" className="mb-4 rounded-lg border border-tertiary/40 bg-tertiary-fixed/40 px-4 py-3 text-body-sm text-on-surface-variant">{artworkNotice}</p> : null}

      <div aria-hidden="true" className="pointer-events-none fixed -left-[10000px] top-0 h-px w-px overflow-hidden opacity-0">
        <img src={level.image} alt={`${level.title} original image preload`} onLoad={handleImageLoad('Original', level.image)} onError={handleImageError('Original', level.image)} />
        <img src={comparisonImageUrl} alt={`${level.title} comparison image preload`} onLoad={handleImageLoad('Comparison', comparisonImageUrl)} onError={handleImageError('Comparison', comparisonImageUrl)} />
      </div>

      <section className="mb-6 w-full">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[18px] bg-surface-container-lowest p-3 shadow-[0_8px_24px_-4px_rgba(43,139,198,0.12),0_2px_6px_0_rgba(43,139,198,0.06)] sm:p-4">
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            {state.status === 'ready' ? (
              <Button variant="secondary" leftIcon="play_circle" onClick={() => setIsReadyModalOpen(true)}>
                Start game
              </Button>
            ) : (
              <button
                type="button"
                onClick={handlePause}
                disabled={inputDisabled || state.status !== 'playing'}
                className="ui-pressable group flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 text-label-md text-on-surface shadow-[0_4px_0_#bfc8ce]"
              >
                <span className="material-symbols-outlined text-[20px] text-primary transition-transform group-hover:scale-110">pause_circle</span>
                <span className="font-semibold">Pause</span>
              </button>
            )}

            <div className="flex items-center gap-1.5 rounded-full bg-secondary-container px-3 py-2 text-on-secondary-container shadow-[0_2px_8px_rgba(44,105,86,0.1)]">
              <span className="material-symbols-outlined text-[18px] text-secondary">eco</span>
              <span className="text-label-md font-bold tracking-tight">{level.difficulty === 'easy' ? 'Easy' : level.difficulty === 'medium' ? 'Medium' : 'Hard'} · {level.title}</span>
            </div>
          </div>

          <div className="mx-auto flex min-w-[180px] flex-col items-center justify-center sm:min-w-[220px]">
            <div className="flex items-center gap-1.5 text-on-surface">
              <span className="material-symbols-outlined text-[22px] text-primary animate-pulse">timer</span>
              <span className="text-[28px] font-bold leading-none tracking-tight sm:text-[32px]" id="game-timer">
                {formatTime(state.timeRemainingSeconds)}
              </span>
            </div>
            <div className="mt-2 h-3 w-full max-w-[160px] overflow-hidden rounded-full bg-surface-container-high p-0.5 shadow-inner sm:max-w-[200px]">
              <div
                id="timer-bar"
                className="h-full rounded-full bg-primary-container transition-all duration-1000"
                style={{ width: `${Math.max(progressWidth, 0)}%` }}
              />
            </div>
            <span className="mt-1 text-[11px] font-medium text-outline">Cozy Flow · No Rush</span>
          </div>

          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-2 rounded-full bg-surface-container-low px-3 py-1.5">
              <span className="text-label-md font-bold text-on-surface">Found {foundCount} / {state.totalDifferences}</span>
              <div className="flex items-center gap-1.5">
                {Array.from({ length: state.totalDifferences }).map((_, index) => (
                  <div
                    key={index}
                    className={`flex h-7 w-7 items-center justify-center rounded-full ${index < foundCount ? 'bg-secondary-container text-on-secondary-container shadow-[0_2px_0_#2c6956]' : 'bg-surface-container-highest text-outline-variant'}`}
                    title={index < foundCount ? `Found ${index + 1}` : `Difference ${index + 1}`}
                  >
                    <span className="material-symbols-outlined text-[16px] font-bold">{index < foundCount ? 'check' : 'search'}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-1.5 rounded-full bg-tertiary-fixed px-3 py-1.5 text-on-tertiary-fixed shadow-[0_2px_0_#eaafc1]">
              <span className="material-symbols-outlined text-[16px] font-bold text-tertiary">close</span>
              <span className="text-label-sm font-bold">Wrong {state.wrongClicks}</span>
            </div>

            <button
              type="button"
              onClick={handleHint}
              disabled={inputDisabled || state.hintsRemaining <= 0 || state.status !== 'playing'}
              className="ui-pressable group relative flex items-center gap-1.5 rounded-full border-2 border-secondary bg-surface-container-lowest px-4 py-2 text-secondary shadow-[0_4px_0_#2c6956] disabled:cursor-not-allowed disabled:opacity-60"
            >
              <span className="material-symbols-outlined text-[20px] text-secondary transition-transform group-hover:rotate-12 group-hover:scale-110">lightbulb</span>
              <span className="text-label-md font-bold text-secondary">Hint ({state.hintsRemaining})</span>
            </button>
          </div>
        </div>
      </section>

      {wrongFlash ? (
        <div className="mb-4 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full bg-tertiary-fixed px-4 py-2 text-on-tertiary-fixed shadow-[0_4px_16px_rgba(128,81,96,0.15),0_2px_0_#eaafc1] animate-pulse">
            <span className="material-symbols-outlined text-[18px] font-bold">sentiment_calm</span>
            <span className="text-label-md font-bold tracking-tight">ยังไม่ใช่จุดนี้ ลองดูอีกครั้ง</span>
            <span className="material-symbols-outlined text-[16px] font-bold">refresh</span>
          </div>
        </div>
      ) : null}

      {state.status !== 'ready' ? <section className="w-full">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6">
          <div className="rounded-[20px] bg-surface-container-lowest p-3 shadow-[0_10px_30px_-6px_rgba(43,139,198,0.12),0_4px_10px_0_rgba(43,139,198,0.04)] sm:p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-secondary-fixed-dim" />
                <span className="text-[16px] font-bold text-on-surface sm:text-[18px]">Original</span>
              </div>
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface-variant font-semibold">Reference</span>
            </div>

            <div className="relative w-full cursor-crosshair overflow-hidden rounded-[20px] bg-surface-container-low shadow-[inset_0_0_0_2px_rgba(43,139,198,0.1)]" style={{ aspectRatio: `${assetPair.original.width} / ${assetPair.original.height}` }} onClick={handleImageSpotClick}>
              <img
                src={level.image}
                alt={`${level.title} original illustration`}
                className="absolute inset-0 h-full w-full object-fill"
                onLoad={handleImageLoad('Original', level.image)}
                onError={handleImageError('Original', level.image)}
              />

              {spots.map((spot) => {
                const isFound = state.foundSpots.some((item) => item.id === spot.id);
                if (!isFound) return null;

                return (
                  <div
                    key={spot.id}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${spot.x_norm * 100}%`, top: `${spot.y_norm * 100}%` }}
                  >
                    <span className="absolute -inset-3 rounded-full bg-secondary-container/60 animate-ping" />
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-secondary bg-secondary-container/90 shadow-[0_4px_12px_rgba(44,105,86,0.35),inset_0_2px_0_rgba(255,255,255,0.8)]">
                      <span className="text-label-md font-bold text-secondary">{getFoundOrder(spot.id)}</span>
                      <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-secondary text-[11px] text-on-secondary">
                        <span className="material-symbols-outlined text-[11px] font-bold">check</span>
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-[20px] bg-surface-container-lowest p-3 shadow-[0_10px_30px_-6px_rgba(43,139,198,0.12),0_4px_10px_0_rgba(43,139,198,0.04)] sm:p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-primary-container animate-pulse" />
                <span className="text-[16px] font-bold text-on-surface sm:text-[18px]">Find the differences</span>
              </div>
              <div className="flex items-center gap-1 rounded-full bg-primary-fixed px-2.5 py-0.5 text-label-sm text-on-primary-fixed-variant font-semibold">
                <span className="material-symbols-outlined text-[14px]">search_check</span>
                <span>Tap Spot</span>
              </div>
            </div>

            <div className="relative w-full cursor-crosshair overflow-hidden rounded-[20px] bg-surface-container-low shadow-[inset_0_0_0_2px_rgba(43,139,198,0.1)]" style={{ aspectRatio: `${assetPair.comparison.width} / ${assetPair.comparison.height}` }} onClick={handleImageSpotClick}>
              <img
                src={comparisonImageUrl}
                alt={`${level.title} comparison illustration`}
                className="absolute inset-0 h-full w-full object-fill"
                onLoad={handleImageLoad('Comparison', comparisonImageUrl)}
                onError={handleImageError('Comparison', comparisonImageUrl)}
              />

              {spots.map((spot) => {
                const isFound = state.foundSpots.some((item) => item.id === spot.id);
                const disabled = isFound || inputDisabled;
                return (
                  <button
                    key={`target-${spot.id}`}
                    type="button"
                    aria-label={`Find difference ${spot.label}`}
                    aria-disabled={disabled}
                    disabled={disabled}
                    className="absolute z-10 h-11 w-11 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-transparent bg-transparent focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    style={{ left: `${spot.x_norm * 100}%`, top: `${spot.y_norm * 100}%` }}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCorrectSpot(spot);
                    }}
                  />
                );
              })}

              {spots.map((spot) => {
                const isFound = state.foundSpots.some((item) => item.id === spot.id);
                if (!isFound) return null;
                return (
                  <div key={spot.id} aria-label={`Found ${getFoundOrder(spot.id)} ${spot.label}`} className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${spot.x_norm * 100}%`, top: `${spot.y_norm * 100}%` }}>
                    <span className="absolute -inset-3 rounded-full bg-secondary-container/60 animate-ping" />
                    <span className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-secondary bg-secondary-container/90 text-label-md font-bold text-secondary shadow-[0_4px_12px_rgba(44,105,86,0.35)]">{getFoundOrder(spot.id)}</span>
                    {recentFound === spot.id ? <span className="ui-pop-in absolute -top-10 left-1/2 -translate-x-1/2 rounded-full bg-surface-container-lowest px-2 py-1 text-[11px] font-bold text-secondary shadow-md">Nice! {spot.label}</span> : null}
                  </div>
                );
              })}

              {state.hintHighlight ? (
                <div className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${(spots.find((spot) => spot.id === state.hintHighlight)?.x_norm ?? 0.5) * 100}%`, top: `${(spots.find((spot) => spot.id === state.hintHighlight)?.y_norm ?? 0.5) * 100}%` }}>
                  <div className="absolute -inset-8 rounded-full bg-tertiary-fixed/50 animate-ping" />
                  <div className="relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-tertiary bg-tertiary-fixed/20 shadow-[0_0_20px_rgba(234,175,193,0.8),inset_0_0_12px_rgba(234,175,193,0.6)]">
                    <span className="material-symbols-outlined text-[22px] text-tertiary animate-spin" style={{ animationDuration: '8s' }}>
                      flare
                    </span>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </section> : null}

      <section className="mt-6">
        <div className="flex flex-col items-center gap-3 rounded-[22px] bg-surface-container-lowest p-4 text-center shadow-[0_8px_20px_-4px_rgba(43,139,198,0.08)] sm:flex-row sm:items-start sm:text-left">
          <div className="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-full bg-secondary-container shadow-[0_6px_0_#2c6956,inset_0_2px_0_rgba(255,255,255,0.8)]">
            <span className="material-symbols-outlined text-[30px] text-secondary">search</span>
          </div>
          <div className="flex-1">
            <div className="mb-1 flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              <span className="text-headline-sm font-bold text-on-surface">Seeky คอยช่วยเหลือ</span>
              <span className="rounded-full bg-primary-fixed px-2 py-0.5 text-[11px] font-bold text-on-primary-fixed-variant">Helper Guide</span>
            </div>
            <p className="text-body-lg font-semibold text-on-surface">คลิกที่จุดที่แตกต่างในรูปใดรูปหนึ่ง</p>
            <p className="mt-1 text-body-sm text-on-surface-variant">
              สบายใจได้ หากหาไม่เจอสามารถกดปุ่ม <span className="font-semibold text-secondary">Hint (💡)</span> เพื่อรับตัวช่วยส่องประกายแสง
            </p>
          </div>
        </div>
      </section>

      {state.status === 'ready' && isReadyModalOpen ? (
        <Modal isOpen={true} onClose={handleReadyClose}>
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <div className="relative mb-5 flex h-24 w-24 items-center justify-center rounded-full bg-secondary-container shadow-[0_6px_0_#2c6956,inset_0_2px_0_rgba(255,255,255,0.8)]">
              <div className="absolute -bottom-1 -right-1 h-7 w-6 rotate-45 rounded-full bg-secondary shadow-sm" />
              <div className="flex flex-col items-center justify-center">
                <div className="flex items-center gap-3 pt-1">
                  <svg className="h-3 w-4 text-on-secondary-container" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4 C 5 9, 13 9, 17 4" />
                  </svg>
                  <svg className="h-3 w-4 text-on-secondary-container" viewBox="0 0 18 10" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M1 4 C 5 9, 13 9, 17 4" />
                  </svg>
                </div>
                <div className="mt-1.5 flex w-10 items-center justify-between">
                  <div className="h-1.5 w-3 rounded-full bg-tertiary-container/80" />
                  <div className="h-1.5 w-1.5 rounded-full bg-on-secondary-container" />
                  <div className="h-1.5 w-3 rounded-full bg-tertiary-container/80" />
                </div>
              </div>
            </div>

            <h2 className="text-[32px] font-bold leading-tight text-on-surface sm:text-[36px]">Ready?</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">เวลาจะเริ่มนับเมื่อคุณกด Start</p>
            {failedImage ? (
              <p role="alert" className="mt-3 text-body-sm text-error">Could not load or decode the {failedImage} image. Close this screen and try again.</p>
            ) : !imagesReady ? (
              <p role="status" className="mt-3 text-body-sm text-on-surface-variant">
                Original: {imageReadiness.Original}. Comparison: {imageReadiness.Comparison}.
              </p>
            ) : null}
            {operationError ? (
              <div role="alert" className="mt-4 w-full rounded-lg border border-error/40 bg-error/10 p-3 text-left text-body-sm text-error">
                <p className="font-semibold">Unable to start game</p>
                <p>{operationError}</p>
                {pendingOperation ? (
                  <Button type="button" variant="tertiary" disabled={isSubmitting} onClick={retryPendingOperation} leftIcon="refresh" className="mt-3">
                    {isSubmitting ? 'Retrying...' : 'Retry'}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-secondary-container px-3 py-1.5 text-label-md text-on-secondary-container">{level.title}</span>
              <span className="rounded-full bg-primary-fixed px-3 py-1.5 text-label-md text-on-primary-fixed-variant">{level.differences} differences</span>
              <span className="rounded-full bg-tertiary-fixed px-3 py-1.5 text-label-md text-on-tertiary-fixed">{formatTime(level.time)}</span>
            </div>

            <div className="mt-7 flex w-full gap-3">
              <Button variant="ghost" size="lg" onClick={handleReadyClose} className="flex-1 justify-center">
                Close
              </Button>
              <Button variant="secondary" size="lg" onClick={handleStart} disabled={inputDisabled} className="flex-1 justify-center">
                {isSubmitting ? 'Starting...' : 'Start'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {state.status === 'paused' ? (
        <Modal isOpen={true} onClose={handleResume}>
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary-container shadow-[0_6px_0_#2c6956,inset_0_2px_0_rgba(255,255,255,0.8)]">
              <span className="material-symbols-outlined text-[36px] text-secondary">pause_circle</span>
            </div>
            <h2 className="text-[30px] font-bold text-on-surface">Paused</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">เกมหยุดชั่วคราว คุณพร้อมกลับมาเล่นต่ออีกครั้งไหม?</p>
            {operationError ? (
              <div role="alert" className="mt-4 w-full rounded-lg border border-error/40 bg-error/10 p-3 text-left text-body-sm text-error">
                <p>Game request failed: {operationError}</p>
                {pendingOperation ? (
                  <Button type="button" variant="tertiary" disabled={isSubmitting} onClick={retryPendingOperation} leftIcon="refresh" className="mt-3">
                    {isSubmitting ? 'Retrying...' : 'Retry'}
                  </Button>
                ) : null}
              </div>
            ) : null}

            <div className="mt-6 flex w-full flex-col gap-3">
              <Button variant="primary" size="lg" onClick={handleResume} disabled={inputDisabled} className="w-full justify-center">
                {isSubmitting ? 'Resuming...' : 'Resume'}
              </Button>
              <Button variant="ghost" size="lg" onClick={handleExit} disabled={inputDisabled} className="w-full justify-center">
                {isSubmitting ? 'Saving...' : 'Exit'}
              </Button>
            </div>
          </div>
        </Modal>
      ) : null}

      {state.status === 'complete' ? (
        <Modal isOpen={true} onClose={() => undefined}>
          <div className="flex flex-col items-center p-6 text-center sm:p-8">
            <div className="mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-secondary-container text-secondary">
              <span className="material-symbols-outlined text-[36px]">task_alt</span>
            </div>
            <h2 className="text-headline-md text-on-surface">Saving result</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">
              {isSubmitting ? 'Your completed game is being finalized.' : 'The completed game is waiting to be finalized.'}
            </p>
            {operationError ? <p role="alert" className="mt-4 text-body-sm text-error">{operationError}</p> : null}
            {pendingOperation ? (
              <Button type="button" disabled={isSubmitting} onClick={retryPendingOperation} leftIcon="refresh" className="mt-6">
                {isSubmitting ? 'Retrying...' : 'Retry saving result'}
              </Button>
            ) : null}
            <Button type="button" variant="ghost" disabled={isSubmitting} onClick={() => navigate('/dashboard/easy-levels')} className="mt-3">
              Back to levels
            </Button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
