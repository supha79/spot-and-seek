import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { difficultyOptions, levelCatalog, useGameData } from '../../context/GameDataContext';
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

type GameStatus = 'ready' | 'playing' | 'paused' | 'complete';

type FoundSpot = {
  id: string;
  x: number;
  y: number;
};

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
  | { type: 'SERVER_SYNC'; snapshot: GameRunSnapshot; foundSpot?: FoundSpot; hintSpotId?: string }
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
  x: number;
  y: number;
  label: string;
};

const spotCatalogByLevel: Record<string, SpotConfig[]> = {
  'cozy-cat-corner': [
    { id: 'window', x: 62, y: 27, label: 'window' },
    { id: 'plant', x: 34, y: 64, label: 'plant' },
    { id: 'teapot', x: 84, y: 58, label: 'teapot' },
  ],
  'sunny-picnic': [
    { id: 'umbrella', x: 42, y: 36, label: 'umbrella' },
    { id: 'flower', x: 72, y: 52, label: 'flower' },
    { id: 'basket', x: 18, y: 68, label: 'basket' },
  ],
  'balloon-hills': [
    { id: 'balloon', x: 56, y: 20, label: 'balloon' },
    { id: 'hill', x: 74, y: 44, label: 'hill' },
    { id: 'kite', x: 28, y: 61, label: 'kite' },
  ],
  easy: [
    { id: 'window', x: 62, y: 27, label: 'window' },
    { id: 'plant', x: 34, y: 64, label: 'plant' },
    { id: 'teapot', x: 84, y: 58, label: 'teapot' },
  ],
  medium: [
    { id: 'window', x: 52, y: 24, label: 'window' },
    { id: 'plant', x: 68, y: 58, label: 'plant' },
    { id: 'lamp', x: 32, y: 72, label: 'lamp' },
    { id: 'bench', x: 78, y: 40, label: 'bench' },
    { id: 'vase', x: 18, y: 46, label: 'vase' },
  ],
  hard: [
    { id: 'window', x: 48, y: 26, label: 'window' },
    { id: 'plant', x: 24, y: 58, label: 'plant' },
    { id: 'lamp', x: 72, y: 34, label: 'lamp' },
    { id: 'book', x: 44, y: 66, label: 'book' },
    { id: 'frame', x: 78, y: 72, label: 'frame' },
    { id: 'mug', x: 62, y: 48, label: 'mug' },
    { id: 'chair', x: 18, y: 38, label: 'chair' },
  ],
};

function getLevelByRoute(levelId: string) {
  const directMatch = levelCatalog.find((level) => level.id === levelId);
  if (directMatch) return directMatch;

  const difficultyMatch = difficultyOptions.find((option) => option.id === levelId);
  if (!difficultyMatch) return levelCatalog[0];

  const fallbackLevel = levelCatalog.find((level) => level.difficulty === difficultyMatch.id) ?? levelCatalog[0];
  return fallbackLevel;
}

function getSpotsForLevel(levelId: string, difficulty: string): SpotConfig[] {
  return spotCatalogByLevel[levelId] ?? spotCatalogByLevel[difficulty] ?? spotCatalogByLevel.easy;
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
          : action.snapshot.status === 'completed'
            ? 'complete'
            : state.status;
      return {
        ...state,
        status,
        timeRemainingSeconds: Math.ceil(action.snapshot.time_remaining_seconds),
        wrongClicks: action.snapshot.wrong_clicks,
        hintsRemaining: Math.max(0, 3 - action.snapshot.hints_used),
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

export default function GamePlay() {
  const navigate = useNavigate();
  const { routeParam: levelId = 'cozy-cat-corner' } = useParams();
  const level = getLevelByRoute(levelId);
  const spots = useMemo(() => getSpotsForLevel(level.id, level.difficulty), [level.difficulty, level.id]);
  const { refreshProfile } = useGameData();

  const initialState: GameState = {
    status: 'ready',
    timeRemainingSeconds: level.time,
    totalDifferences: level.differences,
    foundSpots: [],
    wrongClicks: 0,
    hintsRemaining: 3,
    hintHighlight: null,
  };

  const [state, dispatch] = useReducer(reducer, initialState);
  const [wrongFlash, setWrongFlash] = useState(false);
  const [recentFound, setRecentFound] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [operationError, setOperationError] = useState<string | null>(null);
  const [pendingOperation, setPendingOperation] = useState<PendingOperation | null>(null);
  const runIdRef = useRef<string | null>(null);
  const pendingOperationRef = useRef<PendingOperation | null>(null);
  const operationInFlightRef = useRef(false);
  const finishRequestedRef = useRef(false);
  const inputDisabled = isSubmitting || pendingOperation !== null;

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
      dispatch({ type: 'SERVER_SYNC', snapshot, foundSpot: operation.foundSpot, hintSpotId: operation.hintSpotId });
      if (snapshot.status === 'active') runIdRef.current = snapshot.run_id;

      if (snapshot.status === 'won') {
        finishRequestedRef.current = true;
        refreshProfile();
        navigate(`/dashboard/play/${level.id}/complete`, {
          state: {
            timeTaken: Math.round(snapshot.elapsed_active_seconds),
            mistakes: snapshot.wrong_clicks,
            hintsUsed: snapshot.hints_used,
            score: snapshot.score,
            found: snapshot.found_count,
            totalDifferences: snapshot.total_spots,
          },
        });
      } else if (snapshot.status === 'lost') {
        finishRequestedRef.current = true;
        refreshProfile();
        navigate(`/dashboard/play/${level.id}/times-up`, {
          state: {
            timeTaken: Math.round(snapshot.elapsed_active_seconds),
            mistakes: snapshot.wrong_clicks,
            hintsUsed: snapshot.hints_used,
            score: snapshot.score,
            found: snapshot.found_count,
            totalDifferences: snapshot.total_spots,
          },
        });
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
    submitRequest('Start game', (requestId) => startGameRun(level.id, requestId));
  };

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
      { foundSpot: { id: spot.id, x: spot.x, y: spot.y } },
    );
    setRecentFound(spot.id);
    window.setTimeout(() => setRecentFound(null), 700);
  };

  const handleWrongClick = () => {
    const runId = runIdRef.current;
    if (!runId || state.status !== 'playing') return;
    submitRequest('Record wrong click', (requestId) => recordGameRunEvent(runId, requestId, 'wrong_click'));
    setWrongFlash(true);
    window.setTimeout(() => setWrongFlash(false), 600);
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

  return (
    <div className="relative w-full pb-10">
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute left-1/4 top-8 h-32 w-32 rounded-full bg-secondary-fixed/40 blur-3xl" />
        <div className="absolute right-12 top-1/2 h-48 w-48 rounded-full bg-tertiary-fixed/30 blur-3xl" />
        <div className="absolute bottom-10 left-10 h-40 w-40 rounded-full bg-primary-fixed/30 blur-3xl" />
      </div>

      {operationError && pendingOperation ? (
        <div role="alert" className="mb-4 flex flex-col gap-3 rounded-2xl bg-tertiary-fixed p-4 text-on-tertiary-fixed sm:flex-row sm:items-center sm:justify-between">
          <p className="text-body-sm">{operationError}</p>
          <Button type="button" variant="tertiary" disabled={isSubmitting} onClick={retryPendingOperation} leftIcon="refresh">
            {isSubmitting ? 'Retrying...' : 'Retry'}
          </Button>
        </div>
      ) : null}

      <section className="mb-6 w-full">
        <div className="flex w-full flex-wrap items-center justify-between gap-4 rounded-[18px] bg-surface-container-lowest p-3 shadow-[0_8px_24px_-4px_rgba(43,139,198,0.12),0_2px_6px_0_rgba(43,139,198,0.06)] sm:p-4">
          <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={handlePause}
              disabled={inputDisabled || state.status !== 'playing'}
              className="group flex items-center gap-2 rounded-full bg-surface-container-low px-4 py-2 text-label-md text-on-surface shadow-[0_4px_0_#bfc8ce] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_#bfc8ce]"
            >
              <span className="material-symbols-outlined text-[20px] text-primary transition-transform group-hover:scale-110">pause_circle</span>
              <span className="font-semibold">Pause</span>
            </button>

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
              className="group relative flex items-center gap-1.5 rounded-full border-2 border-secondary bg-surface-container-lowest px-4 py-2 text-secondary shadow-[0_4px_0_#2c6956] transition-all active:translate-y-[3px] active:shadow-[0_1px_0_#2c6956] disabled:cursor-not-allowed disabled:opacity-60"
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

      <section className="w-full">
        <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6">
          <div className="rounded-[20px] bg-surface-container-lowest p-3 shadow-[0_10px_30px_-6px_rgba(43,139,198,0.12),0_4px_10px_0_rgba(43,139,198,0.04)] sm:p-4">
            <div className="mb-3 flex items-center justify-between px-1">
              <div className="flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-full bg-secondary-fixed-dim" />
                <span className="text-[16px] font-bold text-on-surface sm:text-[18px]">Original</span>
              </div>
              <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface-variant font-semibold">Reference</span>
            </div>

            <div className="relative aspect-square w-full overflow-hidden rounded-[20px] bg-surface-container-low shadow-[inset_0_0_0_2px_rgba(43,139,198,0.1)]">
              <img
                src={level.image}
                alt={`${level.title} original illustration`}
                className="h-full w-full object-cover object-center"
              />

              {spots.map((spot) => {
                const isFound = state.foundSpots.some((item) => item.id === spot.id);
                if (!isFound) return null;

                return (
                  <div
                    key={spot.id}
                    className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2"
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                  >
                    <span className="absolute -inset-3 rounded-full bg-secondary-container/60 animate-ping" />
                    <div className="relative flex h-11 w-11 items-center justify-center rounded-full border-2 border-secondary bg-secondary-container/90 shadow-[0_4px_12px_rgba(44,105,86,0.35),inset_0_2px_0_rgba(255,255,255,0.8)]">
                      <span className="text-label-md font-bold text-secondary">{spots.findIndex((item) => item.id === spot.id) + 1}</span>
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

            <div className="relative aspect-square w-full overflow-hidden rounded-[20px] bg-surface-container-low shadow-[inset_0_0_0_2px_rgba(43,139,198,0.1)]" onClick={inputDisabled ? undefined : handleWrongClick}>
              <img
                src={level.image}
                alt={`${level.title} altered illustration`}
                className="h-full w-full object-cover object-center"
              />

              {spots.map((spot) => {
                const isFound = state.foundSpots.some((item) => item.id === spot.id);
                const isHinted = state.hintHighlight === spot.id;

                return (
                  <button
                    key={spot.id}
                    type="button"
                    disabled={inputDisabled || state.status !== 'playing' || isFound}
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCorrectSpot(spot);
                    }}
                    className="group absolute -translate-x-1/2 -translate-y-1/2 cursor-pointer rounded-full border-0 bg-transparent p-0"
                    style={{ left: `${spot.x}%`, top: `${spot.y}%` }}
                    aria-label={`Find difference ${spot.label}`}
                  >
                    <div
                      className={`relative flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed transition-all ${
                        isFound ? 'border-secondary bg-secondary-container/30' : isHinted ? 'border-tertiary bg-tertiary-fixed/25 shadow-[0_0_20px_rgba(234,175,193,0.8)]' : 'border-primary/70 bg-primary-fixed/15'
                      }`}
                    >
                      {isHinted ? (
                        <div className="absolute -inset-4 rounded-full bg-tertiary-fixed/50 animate-ping" />
                      ) : null}
                      <span className={`material-symbols-outlined text-[20px] ${isFound ? 'text-secondary' : isHinted ? 'text-tertiary' : 'text-primary'}`}>
                        {isFound ? 'check_circle' : 'search'}
                      </span>
                    </div>
                    {isFound ? (
                      <span className="absolute -top-8 left-1/2 -translate-x-1/2 rounded-full bg-secondary-container px-2 py-1 text-[11px] font-bold text-on-secondary-container whitespace-nowrap">
                        Found!
                      </span>
                    ) : null}
                    {recentFound === spot.id ? (
                      <span className="absolute -top-10 left-1/2 -translate-x-1/2 rounded-full bg-surface-container-lowest px-2 py-1 text-[11px] font-bold text-secondary shadow-md">
                        Nice! {spot.label}
                      </span>
                    ) : null}
                  </button>
                );
              })}

              {state.hintHighlight ? (
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
      </section>

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

      {state.status === 'ready' ? (
        <Modal isOpen={true} onClose={handleStart}>
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

            <div className="mt-5 flex w-full flex-wrap items-center justify-center gap-2">
              <span className="rounded-full bg-secondary-container px-3 py-1.5 text-label-md text-on-secondary-container">{level.title}</span>
              <span className="rounded-full bg-primary-fixed px-3 py-1.5 text-label-md text-on-primary-fixed-variant">{level.differences} differences</span>
              <span className="rounded-full bg-tertiary-fixed px-3 py-1.5 text-label-md text-on-tertiary-fixed">{formatTime(level.time)}</span>
            </div>

            <Button variant="secondary" size="lg" onClick={handleStart} disabled={inputDisabled} className="mt-7 w-full justify-center">
              {isSubmitting ? 'Starting...' : 'Start'}
            </Button>
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
