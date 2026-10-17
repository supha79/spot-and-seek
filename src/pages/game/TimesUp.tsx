import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { getGameRunResult, type GameRunResult } from '../../services/gameRunResults';

function formatTime(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60).toString().padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function TimesUp() {
  const navigate = useNavigate();
  const { runId } = useParams();
  const [gameResult, setGameResult] = useState<GameRunResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);
    setGameResult(null);

    void getGameRunResult(runId ?? '')
      .then((result) => {
        if (!isMounted) return;
        if (result.status !== 'lost') {
          setHasError(true);
          return;
        }
        setGameResult(result);
      })
      .catch(() => {
        if (isMounted) setHasError(true);
      })
      .finally(() => {
        if (isMounted) setIsLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [retryCount, runId]);

  if (isLoading || (!hasError && gameResult?.run_id !== runId)) {
    return <p role="status" className="py-12 text-center text-body-md text-on-surface-variant">Loading game result...</p>;
  }

  if (hasError || !gameResult || gameResult.run_id !== runId) {
    return (
      <div role="alert" className="mx-auto max-w-xl space-y-4 py-12 text-center">
        <p className="text-headline-sm text-on-surface">This game result is unavailable.</p>
        <Button variant="ghost" leftIcon="refresh" onClick={() => setRetryCount((count) => count + 1)}>Retry</Button>
        <Link to="/dashboard/history" className="block text-label-md text-primary">Back to history</Link>
      </div>
    );
  }

  const replayLevelId = gameResult.level.content_level_id ?? gameResult.level.id;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-[620px] rounded-xl bg-surface-container-lowest p-5 shadow-[0_16px_40px_-10px_rgba(43,139,198,0.14),0_2px_10px_0_rgba(43,139,198,0.06)] sm:p-8">
        <div className="mb-5 flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
            <div className="absolute inset-2 rounded-full bg-primary-container/30 blur-md" />
            <svg className="relative h-full w-full drop-shadow-[0_8px_16px_rgba(0,102,136,0.15)]" viewBox="0 0 120 120" fill="none" xmlns="http://www.w3.org/2000/svg">
              <circle cx="56" cy="52" r="42" fill="#7CC8F0" stroke="#006688" strokeWidth="4.5" />
              <circle cx="56" cy="52" r="33" fill="#F0F8FD" />
              <ellipse cx="44" cy="38" fill="#FFFFFF" opacity="0.75" rx="14" ry="7" transform="rotate(-30 44 38)" />
              <ellipse cx="45" cy="50" rx="3.5" ry="4.5" fill="#171c1e" />
              <circle cx="43.5" cy="48" r="1.5" fill="#FFFFFF" />
              <ellipse cx="67" cy="50" rx="3.5" ry="4.5" fill="#171c1e" />
              <circle cx="65.5" cy="48" r="1.5" fill="#FFFFFF" />
              <ellipse cx="38" cy="57" rx="5" ry="3" fill="#FFC2D4" opacity="0.85" />
              <ellipse cx="74" cy="57" rx="5" ry="3" fill="#FFC2D4" opacity="0.85" />
              <path d="M51 56 Q56 61 61 56" stroke="#171c1e" strokeWidth="3" strokeLinecap="round" />
              <path d="M78 38 C78 38 84 43 84 47 C84 50 81 52 78 52 C75 52 73 50 73 47 C73 43 78 38 78 38 Z" fill="#84D0F8" />
              <g transform="rotate(-38 84 84)">
                <rect x="80" y="80" width="15" height="34" rx="7.5" fill="#FFD9E3" />
                <rect x="82" y="83" width="11" height="28" rx="5.5" fill="#EAAFC1" />
                <path d="M84 84 L84 104" stroke="#FFFFFF" strokeWidth="2.5" strokeLinecap="round" />
              </g>
            </svg>
          </div>

          <h1 className="text-headline-lg text-on-surface tracking-tight">Time's Up</h1>
          <p className="mt-1 max-w-md text-body-md text-on-surface-variant">
            หมดเวลาแล้ว ไม่เป็นไรนะ ลองใหม่อีกครั้งได้เลย
          </p>

          <div className="mt-4 inline-flex items-center gap-2 rounded-full bg-secondary-container px-4 py-2 text-label-lg text-on-secondary-container shadow-[0_2px_8px_-1px_rgba(44,105,86,0.15)]">
            <span className="material-symbols-outlined text-[20px]">check_circle</span>
            <span>Found {gameResult.found_count} / {gameResult.total_spots} Differences</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-DEFAULT bg-primary-fixed/40 p-3 text-center shadow-sm">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[0_2px_0_#2B8BC6]">
              <span className="material-symbols-outlined text-[18px]">timer</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Time</div>
            <div className="text-headline-sm text-on-surface">{formatTime(Math.round(gameResult.elapsed_active_seconds))}</div>
          </div>

          <div className="rounded-DEFAULT bg-tertiary-fixed/40 p-3 text-center shadow-sm">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container shadow-[0_2px_0_#E85B88]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Wrong clicks</div>
            <div className="text-headline-sm text-on-surface">{gameResult.wrong_clicks}</div>
          </div>

          <div className="rounded-DEFAULT bg-secondary-fixed/40 p-3 text-center shadow-sm">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container shadow-[0_2px_0_#2BA678]">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Hints used</div>
            <div className="text-headline-sm text-on-surface">{gameResult.hints_used}</div>
          </div>
          <div className="rounded-DEFAULT bg-secondary-fixed/40 p-3 text-center shadow-sm">
              <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
                <span className="material-symbols-outlined text-[18px]">star</span>
              </div>
              <div className="text-label-sm text-on-surface-variant">Score</div>
              <div className="text-headline-sm text-on-surface">{gameResult.score.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button variant="primary" size="lg" onClick={() => navigate(`/dashboard/play/${replayLevelId}`)} className="w-full justify-center">
            Try again
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/dashboard/easy-levels')} className="w-full justify-center">
            Back to levels
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-on-surface-variant">
          <span className="text-label-sm">{gameResult.level.title ?? gameResult.level.id} · {gameResult.level.difficulty ?? 'Legacy'}</span>
        </div>
        <p className="mt-2 text-center text-body-sm text-on-surface-variant">Completed {new Date(gameResult.played_at).toLocaleString()}</p>
        <div className="mt-3 text-center">
          <Link to="/dashboard/history" className="text-label-md text-primary hover:underline">View history</Link>
        </div>
      </div>
    </div>
  );
}
