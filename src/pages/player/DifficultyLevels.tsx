import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LevelArtwork from '../../components/ui/LevelArtwork';
import { difficultyOptions, useGameData, type DifficultyMode, type Level } from '../../context/GameDataContext';
import type { HistoryEntry } from '../../context/GameDataContext';
import { getGameRunReadinessNotice } from '../../services/compatibilityContracts';

type DifficultyLevelsProps = {
  difficulty: DifficultyMode;
};

const difficultyRoutes: Record<DifficultyMode, string> = {
  easy: '/dashboard/easy-levels',
  medium: '/dashboard/play/medium',
  hard: '/dashboard/play/hard',
};

const difficultyIcons: Record<DifficultyMode, string> = {
  easy: 'eco',
  medium: 'filter_drama',
  hard: 'local_fire_department',
};

function historyMatchesLevel(entry: HistoryEntry, level: Level) {
  if (entry.identity.contentLevelId || level.identity.contentLevelId) {
    return Boolean(entry.identity.contentLevelId && entry.identity.contentLevelId === level.identity.contentLevelId);
  }
  if (entry.identity.legacyLevelId || level.identity.legacyLevelId) {
    return Boolean(entry.identity.legacyLevelId && entry.identity.legacyLevelId === level.identity.legacyLevelId);
  }
  return Boolean(level.identity.levelKey && entry.identity.levelKey === level.identity.levelKey);
}

export default function DifficultyLevels({ difficulty }: DifficultyLevelsProps) {
  const {
    games,
    gamesLoading,
    gamesError,
    dynamicGameplayGateState,
    refreshDynamicGameplayGate,
    refreshGames,
    levels,
    levelsLoading,
    levelsError,
    refreshLevels,
    history,
    historyLoading,
  } = useGameData();
  const mode = difficultyOptions.find((option) => option.id === difficulty) ?? difficultyOptions[0];
  const modeLevels = levels.filter((level) => level.difficulty === difficulty);
  const actionVariant = difficulty === 'easy' ? 'secondary' : difficulty === 'medium' ? 'primary' : 'tertiary';
  const modeLabel = difficulty === 'easy' ? 'Casual Relax' : difficulty === 'medium' ? 'Mindful Seeker' : 'Master Detective';
  const modeDescription = difficulty === 'easy'
    ? 'ค้นหาจุดต่างแบบสบายตา ผ่อนคลาย ไม่มีเวลากดดัน'
    : mode.description;
  const clearedCount = modeLevels.filter((level) => history.some((entry) => entry.status === 'Cleared' && historyMatchesLevel(entry, level))).length;
  const modeBestScore = Math.max(0, ...history
    .filter((entry) => entry.difficulty.toLowerCase() === difficulty)
    .map((entry) => entry.score ?? 0));

  return (
    <div className="-mx-4 -mt-6 space-y-space-xl bg-gradient-to-br from-primary-fixed/30 via-surface to-secondary-container/25 px-4 pb-space-2xl pt-space-lg sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-space-lg">
        <section className="flex flex-col items-center justify-between gap-space-md lg:flex-row">
          <Link to="/dashboard/play" className="inline-flex items-center gap-space-xs rounded-full bg-surface-container-lowest px-space-md py-space-xs text-label-md text-on-surface-variant shadow-[0_4px_14px_rgba(43,139,198,0.08)] transition-colors hover:text-primary">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
            Choose Difficulty
          </Link>

          <nav aria-label="Select difficulty" className="flex max-w-full flex-wrap items-center justify-center gap-space-xs rounded-full bg-surface-container-lowest p-space-xs shadow-[0_6px_20px_rgba(43,139,198,0.08)]">
            {difficultyOptions.map((option) => {
              const isActive = option.id === difficulty;
              const selectedClass = option.accent === 'secondary'
                ? 'bg-secondary-container text-on-secondary-container shadow-[0_4px_0_#2BA678]'
                : option.accent === 'primary'
                  ? 'bg-primary-fixed text-on-primary-fixed-variant shadow-[0_4px_0_#2B8BC6]'
                  : 'bg-tertiary-fixed text-on-tertiary-fixed-variant shadow-[0_4px_0_#E85B88]';
              const iconClass = option.accent === 'secondary' ? 'text-secondary' : option.accent === 'primary' ? 'text-primary' : 'text-tertiary';
              return (
                <Link
                  key={option.id}
                  to={difficultyRoutes[option.id]}
                  aria-current={isActive ? 'page' : undefined}
                  className={`inline-flex items-center gap-space-xs rounded-full px-space-sm py-space-xs text-label-sm transition-colors sm:px-space-md sm:text-label-md ${isActive ? selectedClass : 'text-on-surface-variant hover:bg-surface-container-low'}`}
                >
                  <span className={`material-symbols-outlined text-[18px] ${iconClass}`} aria-hidden="true">{difficultyIcons[option.id]}</span>
                  {option.name}
                </Link>
              );
            })}
          </nav>

          <span className="hidden items-center gap-space-xs rounded-full bg-secondary-fixed/50 px-space-md py-space-xs text-label-sm text-on-secondary-fixed-variant lg:inline-flex">
            <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">relax</span>
            No Rush Mode
          </span>
        </section>

        <section className="relative flex flex-col items-center justify-between gap-space-lg overflow-hidden rounded-lg bg-surface-container-lowest p-space-md shadow-[0_8px_30px_rgba(43,139,198,0.07)] sm:p-space-lg lg:flex-row lg:p-space-xl">
          <div className="pointer-events-none absolute -right-12 -top-12 h-56 w-56 rounded-full bg-secondary-container/30 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-12 -left-12 h-48 w-48 rounded-full bg-primary-fixed/30 blur-2xl" />
          <div className="relative z-10 flex min-w-0 items-center gap-space-md">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed text-primary shadow-[0_6px_0_#2B8BC6]">
              <span className="material-symbols-outlined text-[30px]" aria-hidden="true">search</span>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-space-xs">
                <span className="rounded-full bg-secondary-container px-space-sm py-space-xs text-label-sm text-on-secondary-container">{modeLabel}</span>
                <span className="h-1.5 w-1.5 rounded-full bg-outline-variant" />
                <span className="text-label-sm text-on-surface-variant">Stage Map</span>
              </div>
              <h1 className="text-headline-lg text-on-surface">{mode.name} Levels</h1>
              <p className="text-body-sm text-on-surface-variant sm:text-body-md">{modeDescription}</p>
            </div>
          </div>

          <div className="relative z-10 flex w-full min-w-0 items-center justify-center lg:w-auto lg:justify-end">
            <div className="flex w-full max-w-full flex-wrap items-center justify-between gap-x-space-md gap-y-space-xs rounded-lg bg-surface-container-low px-space-md py-space-sm shadow-[inset_0_2px_4px_rgba(43,139,198,0.04)] sm:w-auto sm:flex-nowrap sm:px-space-lg">
              <div className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">{mode.name} Mode Cleared</span>
                <span className="text-headline-sm text-on-surface">
                  {historyLoading ? '...' : clearedCount}
                  <span className="text-body-sm text-on-surface-variant"> / {modeLevels.length} Levels</span>
                </span>
              </div>
              <span className="h-8 w-px bg-outline-variant/40" />
              <div className="flex flex-col">
                <span className="text-label-sm text-on-surface-variant">Best Record</span>
                <span className="inline-flex items-center gap-1 text-headline-sm text-on-surface">
                  <span className="material-symbols-outlined text-[20px] text-amber-600" aria-hidden="true">emoji_events</span>
                  {historyLoading ? '...' : `${modeBestScore.toLocaleString()} pts`}
                </span>
              </div>
            </div>
          </div>
        </section>

        {gamesLoading ? <p role="status" className="text-body-md text-on-surface-variant">Loading published games...</p> : null}
        {gamesError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-space-md rounded-lg border border-error/40 bg-error/10 px-space-md py-space-sm text-body-md text-error">
            <span>{gamesError}</span>
            <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshGames()}>Retry</Button>
          </div>
        ) : null}
        {levelsLoading ? <p role="status" className="text-body-md text-on-surface-variant">Loading published levels...</p> : null}
        {levelsError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-space-md rounded-lg border border-error/40 bg-error/10 px-space-md py-space-sm text-body-md text-error">
            <span>{levelsError}</span>
            <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshLevels()}>Retry</Button>
          </div>
        ) : null}
        {!gamesLoading && !gamesError && games.length === 0 ? <p className="rounded-lg bg-surface-container-lowest px-space-md py-space-sm text-body-md text-on-surface-variant">No published games are available yet.</p> : null}
        {!levelsLoading && !levelsError && games.length > 0 && modeLevels.length === 0 ? <p className="rounded-lg bg-surface-container-lowest px-space-md py-space-sm text-body-md text-on-surface-variant">No published {mode.name} levels are available for this game.</p> : null}

        <section aria-label={`${mode.name} levels`} className="grid grid-cols-1 gap-space-lg md:grid-cols-2 lg:grid-cols-3">
          {modeLevels.map((level, index) => {
            const runReadinessNotice = getGameRunReadinessNotice(level.identity, dynamicGameplayGateState);
            const levelHistory = history.filter((entry) => historyMatchesLevel(entry, level));
            const cleared = levelHistory.some((entry) => entry.status === 'Cleared');
            const bestScore = Math.max(level.bestScore, ...levelHistory.map((entry) => entry.score ?? 0));
            const hasPlayed = levelHistory.length > 0;
            const statusClass = runReadinessNotice
              ? 'bg-tertiary-fixed text-on-tertiary-fixed-variant'
              : cleared
                ? 'bg-secondary-container text-on-secondary-container'
                : 'bg-primary-fixed text-on-primary-fixed-variant';

            return (
              <Card key={level.id} className="flex h-full flex-col overflow-hidden p-space-sm transition-transform hover:-translate-y-1 sm:p-space-md">
                <div className="flex flex-1 flex-col">
                  <LevelArtwork levelId={level.id} title={level.title} className="aspect-square w-full rounded-md bg-surface-container">
                    <span className="absolute left-space-sm top-space-sm inline-flex items-center gap-1.5 rounded-full bg-surface-container-lowest/95 px-space-sm py-space-xs text-label-sm text-on-surface shadow-sm">
                      <span className="h-2 w-2 rounded-full bg-secondary" />
                      Level {index + 1}
                    </span>
                    <span className={`absolute right-space-sm top-space-sm inline-flex items-center gap-1 rounded-full px-space-sm py-space-xs text-label-sm ${statusClass}`}>
                      <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{runReadinessNotice ? 'lock' : cleared ? 'check_circle' : 'auto_awesome'}</span>
                      {runReadinessNotice ? 'Not ready' : cleared ? 'Cleared' : 'New'}
                    </span>
                  </LevelArtwork>

                  <div className="flex flex-1 flex-col pt-space-sm">
                    <div className="flex items-start justify-between gap-space-xs">
                      <div className="min-w-0">
                        <h2 className="text-headline-sm text-on-surface">{level.title}</h2>
                        <p className="text-body-sm text-on-surface-variant">{level.subtitle || level.description}</p>
                      </div>
                      {level.stars > 0 ? (
                        <div aria-label={`${level.stars} of 3 stars earned`} className="flex shrink-0 items-center gap-0.5 rounded-full bg-surface-container-low px-space-sm py-space-xs">
                          {Array.from({ length: 3 }, (_, starIndex) => (
                            <span key={starIndex} className={`material-symbols-outlined text-[18px] ${starIndex < level.stars ? 'text-amber-500' : 'text-outline-variant'}`} aria-hidden="true" style={{ fontVariationSettings: "'FILL' 1" }}>star</span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className={`mt-space-sm flex items-center justify-between gap-space-xs rounded-full px-space-md py-space-xs ${hasPlayed ? 'bg-surface-container-low' : 'bg-tertiary-fixed/35'}`}>
                      <span className="inline-flex items-center gap-1.5 text-label-sm text-on-surface-variant">
                        <span className="material-symbols-outlined text-[16px] text-amber-600" aria-hidden="true">emoji_events</span>
                        {hasPlayed ? 'Best Record' : 'Ready to start'}
                      </span>
                      <span className="shrink-0 text-label-sm text-on-surface">{bestScore.toLocaleString()} pts</span>
                    </div>

                    <div className="mt-space-sm flex flex-wrap items-center gap-space-xs">
                      {level.differences > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary-fixed/30 px-space-sm py-space-xs text-label-sm text-on-secondary-fixed-variant">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">visibility</span>
                          {level.differences} differences
                        </span>
                      ) : null}
                      {level.time > 0 ? (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-space-sm py-space-xs text-label-sm text-on-surface-variant">
                          <span className="material-symbols-outlined text-[14px]" aria-hidden="true">timer</span>
                          {level.time} sec
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="pt-space-md">
                  {runReadinessNotice ? (
                    <div className="space-y-space-sm">
                      <Button type="button" variant={actionVariant} disabled className="w-full justify-center">Not ready</Button>
                      {dynamicGameplayGateState === 'unknown' ? <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshDynamicGameplayGate()} className="w-full justify-center">Retry check</Button> : null}
                      <p role="status" className="text-body-sm text-on-surface-variant">{runReadinessNotice}</p>
                    </div>
                  ) : (
                    <Link to={`/dashboard/play/${level.id}`} state={{ openReadyModal: true }} className="block">
                      <Button variant={actionVariant} leftIcon={cleared ? 'replay' : 'play_arrow'} className="w-full justify-center">
                        {cleared ? 'Play again' : 'Play'}
                      </Button>
                    </Link>
                  )}
                </div>
              </Card>
            );
          })}
        </section>

        <div className="mx-auto flex max-w-4xl items-center justify-center gap-space-sm rounded-full bg-surface-container-lowest/90 px-space-lg py-space-md text-center text-body-sm text-on-surface-variant shadow-[0_6px_22px_rgba(43,139,198,0.06)]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <span className="material-symbols-outlined text-[20px]" aria-hidden="true">lightbulb</span>
          </span>
          <p><strong className="font-semibold text-on-surface">เคล็ดลับ:</strong> เลือกเล่นด่านไหนก่อนก็ได้ตามใจเลย · สบายใจได้ไม่มีการล็อกด่าน</p>
        </div>
      </div>
    </div>
  );
}