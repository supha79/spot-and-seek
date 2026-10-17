import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { BrandMascot } from '../../components/ui/BrandMascot';
import LevelArtwork from '../../components/ui/LevelArtwork';
import PlaceholderIllustration from '../../components/ui/PlaceholderIllustration';
import { difficultyOptions, useGameData, type DifficultyMode, type HistoryEntry, type Level } from '../../context/GameDataContext';

type HistoryFilter = 'all' | DifficultyMode;

const pageSize = 6;

const historyFilters: { id: HistoryFilter; label: string; dot: string }[] = [
  { id: 'all', label: 'All Records', dot: '' },
  { id: 'easy', label: 'Easy', dot: 'bg-secondary-container' },
  { id: 'medium', label: 'Medium', dot: 'bg-primary-container' },
  { id: 'hard', label: 'Hard', dot: 'bg-tertiary-container' },
];

function findHistoryLevel(entry: HistoryEntry, levels: Level[]) {
  if (entry.playableLevelId) {
    const playableLevel = levels.find((level) => level.id === entry.playableLevelId);
    if (playableLevel) return playableLevel;
  }

  if (entry.identity.contentLevelId) {
    return levels.find((level) => level.identity.contentLevelId === entry.identity.contentLevelId);
  }
  if (entry.identity.legacyLevelId) {
    return levels.find((level) => level.identity.legacyLevelId === entry.identity.legacyLevelId);
  }
  if (entry.identity.levelKey) {
    return levels.find((level) => level.identity.levelKey === entry.identity.levelKey);
  }
  return undefined;
}

function getStatusClass(status: HistoryEntry['status']) {
  if (status === 'Cleared') return 'bg-secondary-container text-on-secondary-container';
  if (status === 'Lost') return 'bg-primary-fixed text-on-primary-fixed-variant';
  return 'bg-surface-container text-on-surface-variant';
}

export default function History() {
  const {
    history,
    historyLoading,
    historyError,
    historyNotice,
    refreshHistory,
    profile,
    profileLoading,
    profileAvailable,
    levels,
  } = useGameData();
  const [filter, setFilter] = useState<HistoryFilter>('all');
  const [page, setPage] = useState(1);
  const filteredHistory = filter === 'all'
    ? history
    : history.filter((entry) => entry.difficulty.toLowerCase() === filter);
  const pageCount = Math.ceil(filteredHistory.length / pageSize);
  const currentPage = Math.min(page, pageCount || 1);
  const pageStart = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(pageCount, 5) }, (_, index) => pageStart + index);
  const visibleHistory = filteredHistory.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const profileValue = (value: string | number) => profileLoading ? '...' : profileAvailable ? value : '—';
  const noHistory = !historyLoading && !historyError && history.length === 0;
  const summaryStats = noHistory
    ? [
        { label: 'Total Plays', value: profileValue(profile.totalPlays), suffix: 'รอบ', caption: 'พร้อมเริ่มตาแรก', captionIcon: 'play_circle', icon: 'sports_esports', tone: 'bg-primary-fixed text-primary', valueTone: 'text-on-surface', glow: 'bg-primary-fixed/20' },
        { label: 'Completed Levels', value: profileLoading ? '...' : profileAvailable ? profile.levelsCompleted : '—', suffix: `/ ${profile.totalLevels} ด่าน`, caption: 'เปิดครบทุกห้อง', captionIcon: 'lock_open_right', icon: 'stars', tone: 'bg-secondary-fixed text-secondary', valueTone: 'text-on-surface', glow: 'bg-secondary-fixed/30' },
        { label: 'Best Time', value: '--:--', suffix: '', caption: 'บันทึกเวลาเมื่อจบด่าน', captionIcon: 'pace', icon: 'timer', tone: 'bg-tertiary-fixed text-tertiary', valueTone: 'text-on-surface', glow: 'bg-tertiary-fixed/30' },
      ]
    : [
        { label: 'Total Plays', value: profileValue(profile.totalPlays.toLocaleString()), suffix: '', caption: '', captionIcon: '', icon: 'sports_esports', tone: 'bg-primary-fixed text-on-primary-fixed-variant', valueTone: 'text-primary', glow: '' },
        { label: 'Best Score', value: profileValue(profile.bestScore.toLocaleString()), suffix: '', caption: '', captionIcon: '', icon: 'military_tech', tone: 'bg-tertiary-fixed text-on-tertiary-fixed-variant', valueTone: 'text-tertiary', glow: '' },
        { label: 'Avg. Time', value: profileValue(profile.avgTime > 0 ? `${profile.avgTime}s` : '—'), suffix: '', caption: '', captionIcon: '', icon: 'timer', tone: 'bg-secondary-fixed text-on-secondary-fixed-variant', valueTone: 'text-secondary', glow: '' },
      ];

  return (
    <div className="-mx-4 -mt-6 min-h-screen space-y-space-lg bg-gradient-to-br from-primary-fixed/20 via-surface to-secondary-container/20 px-4 pb-space-2xl pt-space-lg sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-space-lg">
        <section className="flex flex-col gap-space-lg lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-space-md">
            <div className="relative flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary shadow-[0_4px_0_#84d0f8]">
              <span className="material-symbols-outlined text-[28px]" aria-hidden="true">menu_book</span>
              <span className="absolute -right-1 -top-1 inline-flex items-center gap-0.5 rounded-full bg-secondary-container px-1.5 py-0.5 text-label-sm text-on-secondary-container shadow-sm">
                <span className="material-symbols-outlined text-[12px]" aria-hidden="true">auto_awesome</span>
                Logs
              </span>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-space-sm">
                <h1 className="text-headline-lg text-on-surface">History</h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-fixed px-space-sm py-1 text-label-sm text-on-primary-fixed-variant">
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">verified</span>
                  {profile.username ? `${profile.username}'s logs` : 'Your logs'}
                </span>
              </div>
              <p className="text-headline-sm text-secondary">ผลการเล่นทั้งหมดของคุณ</p>
              <p className="hidden text-body-sm text-on-surface-variant sm:block">{noHistory ? 'ผลการเล่นทั้งหมดของคุณ • สถิติและการค้นพบที่ผ่านมา' : 'A cozy scrapbook of past spot-and-seek journeys. Relax and review your sharp-eyed moments.'}</p>
            </div>
          </div>

          {noHistory ? (
            <div className="flex items-center gap-space-xs self-start rounded-full bg-surface-container-low p-1.5 shadow-sm lg:self-auto">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest px-space-md py-1 text-label-sm text-primary shadow-sm">
                <span className="h-2 w-2 rounded-full bg-primary-container" />
                ทุกระดับ (All Stages)
              </span>
              <span className="px-space-md py-1 text-label-sm text-on-surface-variant">ล่าสุด</span>
            </div>
          ) : null}
        </section>

        <section className={`grid gap-space-md ${noHistory ? 'grid-cols-1 md:grid-cols-3 md:gap-space-lg' : 'grid-cols-3 lg:w-auto'}`}>
          {summaryStats.map((stat) => (
            <div key={stat.label} className={`group relative flex min-w-0 overflow-hidden rounded-md bg-surface-container-lowest shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08)] ${noHistory ? 'items-center gap-space-md p-space-md sm:p-space-lg' : 'flex-col items-center justify-center p-space-sm text-center sm:p-space-md'}`}>
              {stat.glow ? <span className={`pointer-events-none absolute -bottom-6 -right-6 h-24 w-24 rounded-full ${stat.glow}`} /> : null}
              <span className={`relative z-10 flex shrink-0 items-center justify-center rounded-full ${noHistory ? 'h-12 w-12 sm:h-16 sm:w-16' : 'mb-1 h-8 w-8 sm:h-10 sm:w-10'} ${stat.tone}`}>
                <span className={`material-symbols-outlined ${noHistory ? 'text-[24px] sm:text-[30px]' : 'text-[20px]'}`} aria-hidden="true">{stat.icon}</span>
              </span>
              <div className={`relative z-10 min-w-0 ${noHistory ? '' : 'flex flex-col items-center'}`}>
                <span className="text-label-sm text-on-surface-variant">{stat.label}</span>
                <div className="flex flex-wrap items-baseline gap-1">
                  <span className={`${noHistory ? 'text-headline-lg' : 'text-headline-sm'} ${stat.valueTone}`}>{stat.value}</span>
                  {stat.suffix ? <span className="text-label-md text-on-surface-variant">{stat.suffix}</span> : null}
                </div>
                {stat.caption ? <span className={`mt-0.5 inline-flex items-center gap-1 text-body-sm ${stat.valueTone}`}>
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{stat.captionIcon}</span>
                  {stat.caption}
                </span> : null}
              </div>
            </div>
          ))}
        </section>

        {historyNotice ? <p role="status" className="rounded-md border border-tertiary/40 bg-tertiary-fixed/40 px-space-md py-3 text-body-sm text-on-surface">{historyNotice}</p> : null}

        {!historyLoading && !historyError && history.length > 0 ? (
          <section aria-label="Filter game history" className="mb-space-lg flex flex-col items-start justify-between gap-space-md rounded-full bg-surface-container-low/70 p-space-xs shadow-sm sm:flex-row sm:items-center">
            <div className="flex w-full items-center gap-space-xs overflow-x-auto p-1 sm:w-auto">
              {historyFilters.map((item) => {
                const count = item.id === 'all'
                  ? history.length
                  : history.filter((entry) => entry.difficulty.toLowerCase() === item.id).length;
                const isActive = filter === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    aria-pressed={isActive}
                    onClick={() => { setFilter(item.id); setPage(1); }}
                    className={`inline-flex shrink-0 items-center gap-space-xs rounded-full py-2 text-label-md transition-all duration-150 ${isActive ? 'bg-primary-container px-space-lg text-on-primary-container shadow-[0_5px_0_#005471] -translate-y-0.5' : 'px-space-md text-on-surface-variant hover:bg-surface-container-lowest/70'}`}
                  >
                    {item.dot ? <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ring-2 ${item.dot} ${item.id === 'easy' ? 'ring-secondary-fixed-dim' : item.id === 'medium' ? 'ring-primary-fixed-dim' : 'ring-tertiary-fixed-dim'}`} /> : null}
                    {item.label}
                    {item.id === 'all' ? <span className="rounded-full bg-surface-container-lowest/80 px-1.5 py-0.5 text-label-sm">{count}</span> : null}
                  </button>
                );
              })}
            </div>
            <div className="hidden items-center gap-space-xs px-space-md text-body-sm text-on-surface-variant md:flex">
              <span className="material-symbols-outlined text-[18px] text-outline" aria-hidden="true">sort</span>
              Newest First (เรียงล่าสุด)
            </div>
          </section>
        ) : null}

        {historyLoading ? (
          <section className="rounded-md bg-surface-container-lowest p-space-xl text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
            <p role="status" className="text-body-md text-on-surface-variant">Loading history...</p>
          </section>
        ) : historyError ? (
          <section className="rounded-md bg-surface-container-lowest p-space-xl text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
            <h2 className="text-headline-md text-on-surface">Unable to load history</h2>
            <p role="alert" className="mt-2 break-words text-body-md text-on-surface-variant">{historyError}</p>
            <Button variant="ghost" leftIcon="refresh" onClick={refreshHistory} className="mt-5">Retry</Button>
          </section>
        ) : history.length === 0 ? (
          <section className="relative flex flex-col items-center overflow-hidden rounded-lg bg-surface-container-lowest p-space-lg text-center shadow-[0_16px_40px_-8px_rgba(43,139,198,0.09),0_4px_12px_0_rgba(43,139,198,0.04)] sm:p-space-xl">
            <span className="pointer-events-none absolute -left-16 -top-16 h-56 w-56 rounded-full bg-primary-fixed/25 blur-2xl" />
            <span className="pointer-events-none absolute -right-20 top-1/3 h-64 w-64 rounded-full bg-secondary-fixed/30 blur-2xl" />
            <span className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-tertiary-fixed/30 blur-2xl" />

            <div className="relative z-10 mb-space-md flex h-44 w-full max-w-64 items-center justify-center">
              <span className="material-symbols-outlined absolute left-1/4 top-4 text-[22px] text-primary-container" aria-hidden="true">auto_awesome</span>
              <span className="material-symbols-outlined absolute right-1/4 top-8 text-[18px] text-tertiary-fixed-dim" aria-hidden="true">auto_awesome</span>
              <div className="absolute bottom-2 left-1/2 flex h-24 w-48 -translate-x-1/2 -rotate-3 items-center justify-between rounded-md bg-surface-container-low p-space-sm shadow-[0_8px_16px_rgba(43,139,198,0.1)]">
                <div className="grid h-full w-1/2 grid-cols-3 place-items-center rounded-md bg-surface-container-lowest p-space-sm">
                  {Array.from({ length: 12 }, (_, index) => <span key={index} className="h-1.5 w-1.5 rounded-full bg-surface-dim" />)}
                </div>
                <span className="mx-space-xs h-20 w-px bg-outline-variant/50" />
                <div className="grid h-full w-1/2 grid-cols-3 place-items-center rounded-md bg-surface-container-lowest p-space-sm">
                  {Array.from({ length: 12 }, (_, index) => <span key={index} className="h-1.5 w-1.5 rounded-full bg-surface-dim" />)}
                </div>
              </div>
              <BrandMascot className="absolute left-1/2 top-0 h-24 w-24 -translate-x-1/2 drop-shadow-[0_8px_16px_rgba(43,139,198,0.2)]" />
            </div>

            <div className="relative z-10 max-w-lg">
              <h2 className="text-headline-lg text-on-surface">No plays yet</h2>
              <p className="mt-2 text-body-md text-on-surface-variant">ยังไม่มีประวัติการเล่น เริ่มเล่นด่านแรกเพื่อดูผลของคุณที่นี่</p>
              <div className="mx-auto mt-space-md inline-flex max-w-md items-center gap-space-sm rounded-full bg-secondary-container/35 px-space-md py-space-xs text-label-md text-on-secondary-container">
                <span className="material-symbols-outlined shrink-0 text-[18px] text-secondary" aria-hidden="true">favorite</span>
                <span>ด่านทั้งหมดเปิดให้เล่นอิสระ ไม่มีล็อกด่าน เลือกเล่นระดับที่ชอบได้เลย!</span>
              </div>

              <div className="mt-space-xl flex flex-col items-center justify-center gap-space-md sm:flex-row">
                <Link to="/dashboard/play" className="w-full sm:w-auto">
                  <Button variant="primary" size="lg" rightIcon="arrow_forward" className="w-full justify-center">
                    Start Playing
                  </Button>
                </Link>
                <Link to="/dashboard/how-to-play" className="w-full sm:w-auto">
                  <Button variant="ghost" size="lg" leftIcon="lightbulb" className="w-full justify-center">
                    ดูวิธีเล่น (How to Play)
                  </Button>
                </Link>
              </div>

              <div className="mt-space-xl flex flex-wrap items-center justify-center gap-space-xs text-on-surface-variant">
                <span className="mr-1 text-label-sm">เลือกความยาก:</span>
                {difficultyOptions.map((option) => {
                  const levelCount = levels.filter((level) => level.difficulty === option.id).length;
                  const chipClass = option.accent === 'secondary'
                    ? 'bg-secondary-fixed/50 text-on-secondary-fixed-variant shadow-[0_3px_0_#96d3bd]'
                    : option.accent === 'primary'
                      ? 'bg-primary-fixed/60 text-on-primary-fixed-variant shadow-[0_3px_0_#84d0f8]'
                      : 'bg-tertiary-fixed/60 text-on-tertiary-fixed-variant shadow-[0_3px_0_#f2b6c8]';
                  const dotClass = option.accent === 'secondary' ? 'bg-secondary' : option.accent === 'primary' ? 'bg-primary' : 'bg-tertiary';
                  const route = option.id === 'easy' ? '/dashboard/easy-levels' : `/dashboard/play/${option.id}`;
                  return (
                    <Link key={option.id} to={route} className={`inline-flex items-center gap-1 rounded-full px-space-sm py-1.5 text-label-sm transition-colors hover:brightness-105 ${chipClass}`}>
                      <span className={`h-2 w-2 rounded-full ${dotClass}`} />
                      {option.name} · {levelCount} ด่าน
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        ) : filteredHistory.length === 0 ? (
          <section className="rounded-md bg-surface-container-lowest p-space-xl text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
            <h2 className="text-headline-md text-on-surface">No {filter} records</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">Try another difficulty filter to see more plays.</p>
          </section>
        ) : (
          <section aria-label="Game history records" className="grid grid-cols-1 gap-space-md md:grid-cols-2">
            {visibleHistory.map((entry) => {
              const level = findHistoryLevel(entry, levels);
              return (
                <Link
                  key={entry.id}
                  to={`/dashboard/history/${entry.id}`}
                  aria-label={`View details for ${entry.title}`}
                  className="group relative flex w-full min-w-0 flex-col justify-between gap-space-md rounded-md border border-outline-variant/30 bg-surface-container-lowest p-space-md shadow-[0_10px_26px_-4px_rgba(43,139,198,0.09)] transition-all hover:-translate-y-1 hover:shadow-[0_16px_32px_-6px_rgba(43,139,198,0.14)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary sm:flex-row sm:items-start"
                >
                  <div className="flex min-w-0 flex-1 items-start gap-space-md">
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-surface-container sm:h-24 sm:w-24">
                      {level ? (
                        <LevelArtwork levelId={level.id} title={entry.title} className="h-full w-full" loading="lazy" />
                      ) : (
                        <PlaceholderIllustration className="h-full w-full" label={entry.title} />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="mb-1 flex flex-wrap items-center justify-between gap-space-xs">
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container-low px-space-sm py-0.5 text-label-sm text-on-surface-variant">
                          <span className={`h-2 w-2 rounded-full ${entry.difficulty.toLowerCase() === 'easy' ? 'bg-secondary' : entry.difficulty.toLowerCase() === 'medium' ? 'bg-primary' : entry.difficulty.toLowerCase() === 'hard' ? 'bg-tertiary' : 'bg-outline'}`} />
                          {entry.difficulty}
                        </span>
                        <span className="text-label-sm text-outline">{entry.date}</span>
                      </div>
                      <h2 className="truncate text-headline-sm text-on-surface transition-colors group-hover:text-primary">{entry.title}</h2>
                      {level?.subtitle || level?.description ? <p className="truncate text-body-sm text-on-surface-variant">{level.subtitle || level.description}</p> : null}
                      <span className={`mt-space-xs inline-flex rounded-full px-space-sm py-0.5 text-label-sm ${getStatusClass(entry.status)}`}>
                        {entry.status}
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-space-sm rounded-md bg-surface-container-low/70 p-space-sm text-center sm:min-w-36 sm:self-stretch">
                    <div className="flex flex-col justify-center">
                      <span className="text-label-sm text-outline">Score</span>
                      <span className="text-label-lg text-primary">{entry.score?.toLocaleString() ?? '—'}</span>
                    </div>
                    <div className="flex flex-col justify-center border-l border-outline-variant/50">
                      <span className="text-label-sm text-outline">Result</span>
                      <span className={`text-label-sm ${entry.status === 'Cleared' ? 'text-secondary' : entry.status === 'Lost' ? 'text-error' : 'text-on-surface-variant'}`}>{entry.result ?? entry.status}</span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </section>
        )}

        {pageCount > 1 && !historyLoading && !historyError ? (
          <nav aria-label="History pagination" className="flex items-center justify-center gap-space-xs">
            <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-full bg-surface-container-lowest px-space-md py-space-xs text-label-sm text-on-surface-variant disabled:opacity-50">← Prev</button>
            {pageNumbers.map((pageNumber) => (
              <button key={pageNumber} type="button" aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => setPage(pageNumber)} className={`h-8 min-w-8 rounded-full px-2 text-label-sm ${pageNumber === currentPage ? 'bg-primary-container text-on-primary-container' : 'bg-surface-container-lowest text-on-surface-variant'}`}>
                {pageNumber}
              </button>
            ))}
            <button type="button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} className="rounded-full bg-surface-container-lowest px-space-md py-space-xs text-label-sm text-on-surface-variant disabled:opacity-50">Next →</button>
          </nav>
        ) : null}
      </div>
    </div>
  );
}
