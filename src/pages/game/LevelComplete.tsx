import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button';

type LocationState = {
  timeTaken?: number;
  mistakes?: number;
  hintsUsed?: number;
  score?: number;
  found?: number;
  totalDifferences?: number;
};

function formatTime(totalSeconds: number = 0) {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

export default function LevelComplete() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  if (!state || typeof state.score !== 'number') {
    return <Navigate to="/dashboard/easy-levels" replace />;
  }

  const timeTaken = state.timeTaken ?? 0;
  const mistakes = state.mistakes ?? 0;
  const hintsUsed = state.hintsUsed ?? 0;
  const score = state.score;
  const found = state.found ?? 0;
  const totalDifferences = state.totalDifferences ?? 0;

  return (
    <div className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-8">
      <div className="relative w-full max-w-[620px] rounded-xl bg-surface-container-lowest p-5 shadow-[0_20px_50px_-10px_rgba(0,102,136,0.12),0_8px_20px_-4px_rgba(44,105,86,0.08)] sm:p-8">
        <div className="relative mb-5 flex flex-col items-center text-center">
          <div className="relative mb-3 flex h-28 w-28 items-center justify-center sm:h-32 sm:w-32">
            <div className="absolute inset-2 rounded-full bg-primary-fixed/50 blur-md" />
            <svg className="relative h-full w-full drop-shadow-[0_8px_16px_rgba(0,102,136,0.18)]" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M34 84C24 74 20 60 26 54C32 48 42 58 48 70" stroke="#006688" strokeWidth="6" strokeLinecap="round" />
              <path d="M126 84C136 74 140 60 134 54C128 48 118 58 112 70" stroke="#006688" strokeWidth="6" strokeLinecap="round" />
              <circle cx="80" cy="74" r="54" fill="#005471" />
              <circle cx="80" cy="70" r="54" fill="#7cc8f0" />
              <circle cx="80" cy="70" r="44" fill="#c2e8ff" />
              <path d="M46 54C52 42 66 34 82 34C85 34 88 34.5 91 35C74 38 60 52 58 69C58 72 58.5 75 59 78C51 72 46 63 46 54Z" fill="#ffffff" fillOpacity="0.6" />
              <path d="M60 68C62 62 69 62 71 68" stroke="#001e2c" strokeWidth="4.5" strokeLinecap="round" />
              <path d="M89 68C91 62 98 62 100 68" stroke="#001e2c" strokeWidth="4.5" strokeLinecap="round" />
              <ellipse cx="55" cy="76" rx="6" ry="4" fill="#f2b6c8" />
              <ellipse cx="105" cy="76" rx="6" ry="4" fill="#f2b6c8" />
              <path d="M74 76C74 81 86 81 86 76" stroke="#001e2c" strokeWidth="4" strokeLinecap="round" />
              <path d="M80 124L80 148" stroke="#005471" strokeWidth="14" strokeLinecap="round" />
              <path d="M80 122L80 144" stroke="#7cc8f0" strokeWidth="10" strokeLinecap="round" />
              <circle cx="80" cy="144" r="4" fill="#ffffff" />
              <path d="M80 16L83 23L90 26L83 29L80 36L77 29L70 26L77 23Z" fill="#aeedd5" />
            </svg>
          </div>

          <h1 className="text-headline-lg text-on-surface tracking-tight">Level Complete!</h1>
          <p className="mt-1 text-headline-sm text-secondary font-medium">เก่งมาก! คุณหาจุดต่างครบแล้ว</p>
        </div>

        <div className="mb-6 flex items-center justify-center gap-3 sm:gap-4">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-tertiary-fixed shadow-[0_6px_0_#805160,inset_0_2px_0_rgba(255,255,255,0.7)] ${index === 1 ? '-translate-y-2' : ''}`}
            >
              <span className="material-symbols-outlined text-[34px] text-tertiary" style={{ fontVariationSettings: 'FILL 1' }}>
                star
              </span>
            </div>
          ))}
        </div>

        <div className="mb-4 text-center">
          <div className="text-label-md uppercase tracking-wider text-on-surface-variant">Score</div>
          <div className="text-display-hero text-primary leading-none tracking-tight drop-shadow-[0_2px_4px_rgba(0,102,136,0.15)]">
            {score.toLocaleString()}
          </div>
        </div>

        <div className="mb-6 inline-flex items-center gap-2 rounded-full bg-secondary-fixed/50 px-4 py-2 text-label-md text-on-secondary-fixed-variant shadow-sm">
          <span className="material-symbols-outlined text-[18px] text-secondary">check_circle</span>
          <span>บันทึกผลเรียบร้อยแล้ว</span>
        </div>

        <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-DEFAULT bg-surface-container-low p-3 text-center shadow-[0_4px_12px_rgba(0,102,136,0.04)]">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary-fixed">
              <span className="material-symbols-outlined text-[22px] text-primary">timer</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Time</div>
            <div className="text-headline-sm text-on-surface">{formatTime(timeTaken)}</div>
          </div>

          <div className="rounded-DEFAULT bg-surface-container-low p-3 text-center shadow-[0_4px_12px_rgba(0,102,136,0.04)]">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-tertiary-fixed">
              <span className="material-symbols-outlined text-[22px] text-tertiary">close</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Wrong clicks</div>
            <div className="text-headline-sm text-on-surface">{mistakes}</div>
          </div>

          <div className="rounded-DEFAULT bg-surface-container-low p-3 text-center shadow-[0_4px_12px_rgba(0,102,136,0.04)]">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-primary-container/40">
              <span className="material-symbols-outlined text-[22px] text-primary" style={{ fontVariationSettings: 'FILL 1' }}>
                lightbulb
              </span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Hints used</div>
            <div className="text-headline-sm text-on-surface">{hintsUsed}</div>
          </div>

          <div className="rounded-DEFAULT bg-surface-container-low p-3 text-center shadow-[0_4px_12px_rgba(0,102,136,0.04)]">
            <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-secondary-fixed">
              <span className="material-symbols-outlined text-[22px] text-secondary">check</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Found</div>
            <div className="text-headline-sm text-secondary font-bold">{found} / {totalDifferences}</div>
          </div>
        </div>

        <div className="flex flex-col gap-3">
          <Button variant="primary" size="lg" onClick={() => navigate('/dashboard/easy-levels')} className="w-full justify-center">
            Next level
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/dashboard/easy-levels')} className="w-full justify-center">
            Back to levels
          </Button>
          <div className="pt-1 text-center">
            <Link to="/dashboard/history" className="inline-flex items-center gap-1 text-label-lg text-on-surface-variant hover:text-primary">
              <span>View history</span>
              <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
