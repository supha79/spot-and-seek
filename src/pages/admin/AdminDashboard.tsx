import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdminData } from '../../context/AdminDataContext';
import { BrandMascot } from '../../components/ui/BrandMascot';
import { BuddyAvatar } from '../../components/ui/BuddyAvatar';
import LevelArtwork from '../../components/ui/LevelArtwork';
import {
  loadAdminDashboardSummary,
  loadRecentAdminPlays,
  type AdminDashboardSummary,
  type RecentAdminPlay,
} from '../../services/adminDashboard';

type DashboardData = {
  summary: AdminDashboardSummary;
  recentPlays: RecentAdminPlay[];
};

const difficultyStyles = {
  easy: {
    badge: 'bg-secondary-fixed text-on-secondary-fixed',
    bar: 'bg-secondary-fixed',
    color: 'text-secondary',
  },
  medium: {
    badge: 'bg-primary-fixed text-on-primary-fixed-variant',
    bar: 'bg-primary-container',
    color: 'text-primary',
  },
  hard: {
    badge: 'bg-tertiary-fixed text-on-tertiary-fixed',
    bar: 'bg-tertiary-container',
    color: 'text-tertiary',
  },
} as const;

function formatPlayedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export default function AdminDashboard() {
  const {
    games,
    levels,
    questions,
    isLoading: catalogLoading,
    error: catalogError,
    refreshCatalog,
  } = useAdminData();
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    setHasError(false);
    setDashboardData(null);

    void Promise.all([loadAdminDashboardSummary(), loadRecentAdminPlays()])
      .then(([summary, recentPlays]) => {
        if (isMounted) setDashboardData({ summary, recentPlays });
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
  }, [retryCount]);

  useEffect(() => {
    let isMounted = true;
    const refreshRecentPlays = () => {
      void loadRecentAdminPlays()
        .then((recentPlays) => {
          if (isMounted) {
            setDashboardData((current) => current ? { ...current, recentPlays } : current);
          }
        })
        .catch(() => undefined);
    };

    window.addEventListener('focus', refreshRecentPlays);
    return () => {
      isMounted = false;
      window.removeEventListener('focus', refreshRecentPlays);
    };
  }, []);

  const statCards = dashboardData ? [
    { label: 'Users', value: dashboardData.summary.usersCount.toLocaleString(), icon: 'groups', tint: 'bg-primary-fixed text-primary' },
    { label: 'Games', value: catalogLoading ? '...' : catalogError ? '—' : String(games.length), icon: 'sports_esports', tint: 'bg-secondary-fixed text-secondary' },
    { label: 'Levels', value: catalogLoading ? '...' : catalogError ? '—' : String(levels.length), icon: 'layers', tint: 'bg-primary-container text-on-primary-container' },
    { label: 'Questions', value: catalogLoading ? '...' : catalogError ? '—' : String(questions.length), icon: 'psychology_alt', tint: 'bg-surface-container-high text-tertiary' },
    { label: 'Total plays', value: dashboardData.summary.totalPlays.toLocaleString(), icon: 'local_fire_department', tint: 'bg-tertiary-fixed text-tertiary' },
  ] : [];
  const featuredLevel = levels.find((level) => level.status === 'published');
  const featuredActiveQuestions = featuredLevel
    ? questions.filter((question) => question.levelId === featuredLevel.id && question.active).length
    : 0;

  return (
    <div className="space-y-space-lg">
      <section className="relative flex flex-col gap-space-md overflow-hidden rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_12px_32px_-6px_rgba(43,139,198,0.12)] md:flex-row md:items-center md:justify-between">
        <div className="pointer-events-none absolute -left-12 -top-12 h-48 w-48 rounded-full bg-primary-fixed/40 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-36 h-56 w-56 rounded-full bg-tertiary-fixed/40 blur-2xl" />

        <div className="relative z-10 flex items-center gap-space-lg">
          <BrandMascot className="h-20 w-20 shrink-0" />
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs">
              <span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm text-on-secondary-fixed">Spot &amp; Seek Master Hub</span>
              <span className="text-tertiary text-xs">✦</span>
              <span className="text-body-sm text-on-surface-variant">Live Insights</span>
            </div>
            <h1 className="text-headline-lg text-on-surface">Admin Dashboard</h1>
            <p className="text-body-md text-on-surface-variant">
              ภาพรวมข้อมูลของระบบ · สถิติการเล่นและเนื้อหาที่เผยแพร่
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-space-md">
          <Link to="/admin/questions/new" className="ui-pressable inline-flex items-center gap-2 rounded-full bg-primary-container px-space-lg py-3 text-label-lg text-on-primary-container shadow-[0_6px_0_#2b8bc6]">
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>+ New question</span>
          </Link>
          <Link to="/admin/levels" className="ui-pressable inline-flex items-center gap-2 rounded-full bg-secondary-container px-space-lg py-3 text-label-lg text-on-secondary-container shadow-[0_6px_0_#2c6956]">
            <span className="material-symbols-outlined text-[20px]">add_task</span>
            <span>+ New level</span>
          </Link>
        </div>
      </section>

      {catalogError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-space-md rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">
          <span>Content catalog could not be loaded: {catalogError}</span>
          <button type="button" disabled={catalogLoading} onClick={() => void refreshCatalog().catch(() => undefined)} className="ui-pressable rounded-full bg-surface-container-lowest px-4 py-2 text-label-md text-error disabled:opacity-50">Retry</button>
        </div>
      ) : null}

      {isLoading ? (
        <section className="rounded-lg bg-surface-container-lowest p-space-xl text-center shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
          <p role="status" className="text-body-md text-on-surface-variant">Loading dashboard data...</p>
        </section>
      ) : hasError || !dashboardData ? (
        <section className="rounded-lg bg-surface-container-lowest p-space-xl text-center shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
          <h2 className="text-headline-md text-on-surface">Unable to load dashboard data</h2>
          <p role="alert" className="mt-2 text-body-md text-on-surface-variant">Please check the connection and try again.</p>
          <button
            type="button"
            onClick={() => setRetryCount((count) => count + 1)}
            className="ui-pressable mt-5 rounded-full bg-primary-container px-5 py-3 text-label-md text-on-primary-container shadow-[0_4px_0_#2b8bc6]"
          >
            Retry
          </button>
        </section>
      ) : (
      <>
      <section className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, icon, tint }) => (
          <div key={label} className="group relative flex flex-col justify-between overflow-hidden rounded-md bg-surface-container-lowest p-space-md shadow-[0_8px_20px_rgba(43,139,198,0.06)] transition-transform hover:-translate-y-1 sm:p-space-lg">
            <span className={`pointer-events-none absolute -bottom-6 -right-6 h-20 w-20 rounded-full opacity-30 ${tint.split(' ')[0]}`} />
            <div className="relative z-10 flex items-center justify-between">
              <span className="text-label-md text-on-surface-variant">{label}</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tint}`}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </div>
            </div>
            <div className="relative z-10 mt-space-md">
              <div className="text-headline-lg text-on-surface sm:text-display-hero">{value}</div>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                {label === 'Users' ? 'ผู้เล่นทั้งหมด' : label === 'Games' ? 'เกมที่เปิดใช้งาน' : label === 'Levels' ? 'ด่านทั้งหมด' : label === 'Questions' ? 'จุดต่างทั้งหมด' : 'จำนวนการเล่นรวม'}
              </p>
            </div>
          </div>
        ))}
      </section>

      {featuredLevel ? (
        <section className="flex flex-col items-center gap-space-md rounded-lg bg-surface-container-lowest p-space-md shadow-[0_8px_24px_rgba(43,139,198,0.06)] md:flex-row md:p-space-lg">
          <div className="relative h-32 w-full shrink-0 overflow-hidden rounded-md bg-surface-container sm:h-36 md:w-48">
            <LevelArtwork levelId={featuredLevel.id} title={featuredLevel.title} className="h-full w-full" loading="lazy">
              <span className="absolute left-space-sm top-space-sm inline-flex items-center gap-1 rounded-full bg-surface-container-lowest/90 px-space-sm py-0.5 text-label-sm text-primary">
                <span className="material-symbols-outlined text-[14px]" aria-hidden="true">star</span>
                Featured
              </span>
            </LevelArtwork>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-space-sm">
              <span className="rounded-full bg-primary-fixed px-space-sm py-0.5 text-label-sm text-on-primary-fixed-variant">Published level</span>
              <span className="text-label-sm text-on-surface-variant">{featuredLevel.difficulty}</span>
            </div>
            <h2 className="mt-1 text-headline-sm text-on-surface">{featuredLevel.title}</h2>
            <p className="mt-1 line-clamp-2 text-body-sm text-on-surface-variant">{featuredLevel.description || 'Published level content and active difference spots.'}</p>
          </div>
          <div className="flex w-full shrink-0 items-center justify-between gap-space-md md:w-auto md:flex-col md:items-end">
            <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-space-sm py-1 text-label-sm text-on-surface-variant">
              <span className="material-symbols-outlined text-[15px] text-secondary" aria-hidden="true">check_circle</span>
              {featuredActiveQuestions} Active questions
            </span>
            <Link to="/admin/levels" className="text-label-sm text-primary hover:underline">Manage level →</Link>
          </div>
        </section>
      ) : null}

      <section className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-lg bg-surface-container-lowest p-space-xl shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-headline-md text-on-surface">Plays by difficulty</h3>
              <p className="text-body-sm text-on-surface-variant">สถิติการเล่นตามระดับความยาก</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            </div>
          </div>

          <div className="mt-space-xl space-y-space-lg">
            {dashboardData.summary.difficultyStats.map((row) => {
              const styles = difficultyStyles[row.difficulty];
              const label = row.difficulty.charAt(0).toUpperCase() + row.difficulty.slice(1);

              return (
              <div key={row.difficulty} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className={`h-3 w-3 rounded-full ${styles.bar}`} />
                    <span className="text-label-lg text-on-surface">{label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-label-sm ${styles.badge}`}>{label === 'Easy' ? 'ด่านง่าย' : label === 'Medium' ? 'ปานกลาง' : 'ท้าทาย'}</span>
                  </div>
                  <span className="text-label-md text-on-surface">{row.count.toLocaleString()} plays <span className={`font-bold ${styles.color}`}>({Math.round(row.percentage)}%)</span></span>
                </div>
                <div className="h-5 w-full rounded-full bg-surface-container p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
                  <div className={`h-full rounded-full ${styles.bar}`} style={{ width: `${Math.min(row.percentage, 100)}%` }} />
                </div>
              </div>
              );
            })}
            {dashboardData.summary.unknownLevelSessionCount > 0 ? (
              <p role="status" className="text-body-sm text-on-surface-variant">
                {dashboardData.summary.unknownLevelSessionCount.toLocaleString()} session(s) excluded from difficulty totals because their level identity is incomplete or unmatched: {dashboardData.summary.unknownLevelIds.slice(0, 3).join(', ')}{dashboardData.summary.unknownLevelIds.length > 3 ? ', ...' : ''}
              </p>
            ) : null}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-lg bg-surface-container-lowest p-space-xl shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-headline-md text-on-surface">Recent plays</h3>
              <p className="text-body-sm text-on-surface-variant">การเล่นล่าสุดของผู้เล่น</p>
            </div>
            <span className="rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">Recent activity</span>
          </div>

          <div className="mt-space-lg space-y-space-sm">
            {dashboardData.recentPlays.length === 0 ? (
              <p className="rounded-DEFAULT bg-surface-container-low p-space-md text-center text-body-sm text-on-surface-variant">
                No plays recorded yet.
              </p>
            ) : dashboardData.recentPlays.map((play) => {
              const styles = play.difficulty ? difficultyStyles[play.difficulty] : null;

              return (
              <div key={play.id} className="flex items-center justify-between gap-space-md rounded-DEFAULT bg-surface-container-low p-space-md">
                <div className="flex items-center gap-space-md">
                  {play.buddy ? (
                    <BuddyAvatar emoji={play.buddy.emoji} accent={play.buddy.accent} size="md" label={`${play.username}'s selected buddy`} />
                  ) : (
                    <div role="img" aria-label={`${play.username}'s buddy unavailable`} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-container-high text-on-surface-variant">
                      <span className="material-symbols-outlined text-[20px]" aria-hidden="true">person</span>
                    </div>
                  )}
                  <div>
                    <div className="text-label-md text-on-surface">{play.username}</div>
                    <div className="text-body-sm text-on-surface-variant">{play.title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-space-md">
                  <span className={`rounded-full px-3 py-1 text-label-sm ${styles?.badge ?? 'bg-surface-container-high text-on-surface-variant'}`}>
                    {play.difficulty ? play.difficulty.charAt(0).toUpperCase() + play.difficulty.slice(1) : 'Unknown'}
                  </span>
                  <div className="text-right">
                    <div className="text-label-md text-secondary">{play.score.toLocaleString()} pts · {play.result === 'win' ? 'Won' : 'Lost'}</div>
                    <div className="text-body-sm text-outline">{formatPlayedAt(play.playedAt)}</div>
                  </div>
                </div>
              </div>
              );
            })}
          </div>
        </div>
      </section>
      </>
      )}
    </div>
  );
}
