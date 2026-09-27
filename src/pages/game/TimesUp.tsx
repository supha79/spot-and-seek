import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import PlaceholderIllustration from '../../components/ui/PlaceholderIllustration';

type LocationState = {
  timeTaken?: number;
  mistakes?: number;
  hintsUsed?: number;
  found?: number;
  totalDifferences?: number;
  score?: number;
};

export default function TimesUp() {
  const navigate = useNavigate();
  const { levelId = 'cozy-cat-corner' } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as LocationState;

  const mistakes = state.mistakes ?? 3;
  const hintsUsed = state.hintsUsed ?? 1;
  const found = state.found ?? 2;
  const totalDifferences = state.totalDifferences ?? 3;

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
            <span>Found {found} / {totalDifferences} Differences</span>
          </div>
        </div>

        <div className="rounded-lg bg-surface-container-low p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-label-md font-bold text-primary">จุดต่างที่คุณเกือบเจอแล้ว</span>
              <span className="material-symbols-outlined text-[18px] text-primary">search</span>
            </div>
            <span className="rounded-full bg-tertiary-fixed px-2 py-1 text-label-sm text-on-tertiary-fixed font-semibold">1 Spot Missed</span>
          </div>

          <div className="relative aspect-square w-full overflow-hidden rounded-[20px] bg-surface-container shadow-inner">
            <PlaceholderIllustration className="h-full w-full rounded-[20px]" label="missed difference" />
            <div className="absolute bottom-[32%] right-[18%] flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container/40 animate-pulse">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container shadow-[0_3px_0_#2BA678]">
                <span className="material-symbols-outlined text-[18px] text-on-secondary-container">done</span>
              </div>
            </div>
            <div className="absolute left-[62%] top-[39%] flex h-11 w-11 items-center justify-center rounded-full bg-secondary-container/40 animate-pulse">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container shadow-[0_3px_0_#2BA678]">
                <span className="material-symbols-outlined text-[18px] text-on-secondary-container">done</span>
              </div>
            </div>
            <div className="absolute left-[48%] top-[56%] -translate-x-1/2 -translate-y-1/2">
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-fixed/70 shadow-[0_4px_12px_rgba(234,175,193,0.6)]">
                <div className="absolute -inset-3 rounded-full bg-tertiary-container/50 animate-ping" />
                <span className="material-symbols-outlined text-[26px] text-on-tertiary-container">visibility</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          <div className="rounded-DEFAULT bg-primary-fixed/40 p-3 text-center shadow-sm">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-primary-container text-on-primary-container shadow-[0_2px_0_#2B8BC6]">
              <span className="material-symbols-outlined text-[18px]">timer</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Time</div>
            <div className="text-headline-sm text-on-surface">02:00</div>
          </div>

          <div className="rounded-DEFAULT bg-tertiary-fixed/40 p-3 text-center shadow-sm">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-tertiary-container text-on-tertiary-container shadow-[0_2px_0_#E85B88]">
              <span className="material-symbols-outlined text-[18px]">close</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Wrong clicks</div>
            <div className="text-headline-sm text-on-surface">{mistakes}</div>
          </div>

          <div className="rounded-DEFAULT bg-secondary-fixed/40 p-3 text-center shadow-sm">
            <div className="mb-1 flex h-8 w-8 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container shadow-[0_2px_0_#2BA678]">
              <span className="material-symbols-outlined text-[18px]">lightbulb</span>
            </div>
            <div className="text-label-sm text-on-surface-variant">Hints used</div>
            <div className="text-headline-sm text-on-surface">{hintsUsed}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3">
          <Button variant="primary" size="lg" onClick={() => navigate(`/dashboard/play/${levelId}`)} className="w-full justify-center">
            Try again
          </Button>
          <Button variant="ghost" size="lg" onClick={() => navigate('/dashboard/easy-levels')} className="w-full justify-center">
            Back to levels
          </Button>
        </div>

        <div className="mt-4 flex items-center justify-center gap-2 text-on-surface-variant">
          <span className="text-[16px]">🐱</span>
          <span className="text-label-sm">Cozy Cat Corner · Easy Level 1</span>
        </div>
      </div>
    </div>
  );
}
