import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import LevelArtwork from '../../components/ui/LevelArtwork';
import PlaceholderIllustration from '../../components/ui/PlaceholderIllustration';
import { difficultyOptions, useGameData } from '../../context/GameDataContext';

const difficultyDetails = {
  easy: {
    description: 'เหมาะสำหรับเริ่มต้น ภาพเรียบง่าย จุดต่างเห็นชัด',
    mood: 'Cozy Warmup',
    icon: 'eco',
  },
  medium: {
    description: 'ภาพละเอียดขึ้น ต้องสังเกตมากขึ้นอีกนิด',
    mood: 'Mindful Seeker',
    icon: 'explore',
  },
  hard: {
    description: 'ท้าทายสายตา ชวนให้หาจุดแตกต่างที่ซ่อนอยู่',
    mood: 'Master Detective',
    icon: 'psychology',
  },
} as const;

export default function ChooseDifficulty() {
  const {
    games,
    gamesLoading,
    gamesError,
    refreshGames,
    levels,
    levelsLoading,
    levelsError,
    refreshLevels,
    profile,
    history,
  } = useGameData();
  const totalLevels = levels.length;

  return (
    <div className="-mx-4 -mt-6 space-y-8 bg-gradient-to-br from-primary-fixed/30 via-surface to-tertiary-fixed/30 px-4 pb-8 pt-6 sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="mx-auto w-full max-w-7xl space-y-8">
        <section className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link to="/dashboard/home" className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-3 py-1.5 text-label-sm text-on-surface-variant shadow-[0_4px_12px_rgba(43,139,198,0.05)] transition-colors hover:bg-surface-container-low">
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">arrow_back</span>
              </span>
              Home
            </Link>
            <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-label-sm text-on-surface-variant shadow-[0_4px_12px_rgba(43,139,198,0.05)]">
              <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">lock_open_right</span>
              เล่นได้ทุกระดับ ไม่มีล็อก
            </div>
          </div>

          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <h1 className="text-display-hero-mobile text-on-surface sm:text-display-hero">Choose Difficulty</h1>
              <p className="mt-1 text-headline-sm text-on-surface-variant">เลือกความยากที่เหมาะกับคุณ <span className="text-primary">✦</span></p>
            </div>
            <div className="flex flex-wrap items-center gap-2 rounded-full bg-surface-container-lowest px-3 py-2 shadow-[0_4px_16px_rgba(43,139,198,0.06)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-fixed/50 px-2 py-1 text-label-sm text-on-secondary-fixed-variant">
                <span className="material-symbols-outlined text-[16px] text-secondary" aria-hidden="true">check_circle</span>
                {profile.levelsCompleted} Total Cleared
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-tertiary-fixed/60 px-2 py-1 text-label-sm text-on-tertiary-fixed-variant">
                <span className="material-symbols-outlined text-[16px] text-tertiary" aria-hidden="true">extension</span>
                {totalLevels} Levels Available
              </span>
            </div>
          </div>
        </section>

        {gamesLoading ? <p role="status" className="text-body-md text-on-surface-variant">Loading published games...</p> : null}
        {gamesError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-body-md text-error">
            <span>{gamesError}</span>
            <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshGames()}>Retry</Button>
          </div>
        ) : null}
        {levelsLoading ? <p role="status" className="text-body-sm text-on-surface-variant">Loading published levels...</p> : null}
        {levelsError ? (
          <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-error/40 bg-error/10 px-4 py-3 text-body-md text-error">
            <span>{levelsError}</span>
            <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshLevels()}>Retry</Button>
          </div>
        ) : null}
        {!gamesLoading && !gamesError && games.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-sm">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
                <span className="material-symbols-outlined" aria-hidden="true">sports_esports</span>
              </span>
              <div>
                <h2 className="text-label-lg text-on-surface">No published games yet</h2>
                <p className="text-body-sm text-on-surface-variant">Published games will appear here when they are ready to play.</p>
              </div>
            </div>
            <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshGames()}>Refresh</Button>
          </div>
        ) : null}
        {!gamesLoading && !gamesError && games.length > 0 && !levelsLoading && !levelsError && levels.length === 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-lg border border-outline-variant bg-surface-container-lowest px-4 py-3 shadow-sm">
            <div>
              <h2 className="text-label-lg text-on-surface">No published levels yet</h2>
              <p className="text-body-sm text-on-surface-variant">There are no playable levels in this game yet.</p>
            </div>
            <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshLevels()}>Refresh</Button>
          </div>
        ) : null}

        <section aria-label="Choose a difficulty" className="grid items-stretch gap-4 md:grid-cols-2 lg:grid-cols-3">
        {difficultyOptions.map((mode) => {
          const modeLevels = levels.filter((level) => level.difficulty === mode.id);
          const previewLevel = modeLevels[0];
          const modeHistory = history.filter((entry) => entry.difficulty.toLowerCase() === mode.id && entry.status === 'Cleared');
          const clearedKeys = new Set(modeHistory.map((entry) => entry.identity.contentLevelId ?? entry.identity.legacyLevelId ?? entry.identity.levelKey ?? entry.id));
          const clearedCount = modeLevels.filter((level) => clearedKeys.has(level.identity.contentLevelId ?? level.identity.legacyLevelId ?? level.identity.levelKey ?? level.id)).length;
          const progress = modeLevels.length ? Math.round((clearedCount / modeLevels.length) * 100) : 0;
          const rating = difficultyOptions.findIndex((option) => option.id === mode.id) + 1;
          const details = difficultyDetails[mode.id];
          const accentClass = mode.accent === 'secondary'
            ? 'bg-secondary-container text-on-secondary-container'
            : mode.accent === 'primary'
              ? 'bg-primary-fixed text-on-primary-fixed-variant'
              : 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
          const iconClass = mode.accent === 'secondary' ? 'text-secondary' : mode.accent === 'primary' ? 'text-primary' : 'text-tertiary';
          const buttonVariant = mode.accent === 'secondary' ? 'secondary' : mode.accent === 'primary' ? 'primary' : 'tertiary';

          return (
          <Card key={mode.id} className={`relative flex h-full flex-col overflow-hidden p-space-lg transition-transform hover:-translate-y-1 ${mode.highlight ? 'ring-2 ring-primary-container' : ''}`}>
            <div className={`pointer-events-none absolute -right-12 -top-12 h-32 w-32 rounded-full ${mode.accent === 'secondary' ? 'bg-secondary-container/40' : mode.accent === 'primary' ? 'bg-primary-container/40' : 'bg-tertiary-container/40'} blur-2xl`} />
            <div className="relative flex flex-1 flex-col gap-space-md">
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm ${accentClass}`}>
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{details.icon}</span>
                  {mode.name.toUpperCase()}
                </span>
                <span className={`inline-flex items-center gap-0.5 ${iconClass}`} aria-label={`${mode.name} difficulty: ${rating} of 3 stars`}>
                  {Array.from({ length: 3 }, (_, index) => (
                    <span key={index} className={`material-symbols-outlined text-[18px] ${index >= rating ? 'text-surface-variant' : ''}`} aria-hidden="true" style={{ fontVariationSettings: index < rating ? "'FILL' 1" : "'FILL' 0" }}>star</span>
                  ))}
                </span>
              </div>

              <div className="relative h-40 overflow-hidden rounded-md bg-gradient-to-b from-surface-container to-surface-container-low sm:h-44">
                {previewLevel ? (
                  <LevelArtwork levelId={previewLevel.id} title={previewLevel.title} className="h-full w-full" />
                ) : <PlaceholderIllustration className="h-full w-full" label={mode.name} />}
                <div className={`absolute bottom-2 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 whitespace-nowrap rounded-full bg-surface-container-lowest/90 px-3 py-1 text-label-sm shadow-sm ${iconClass}`}>
                  <span className="material-symbols-outlined text-[14px]" aria-hidden="true">{details.icon}</span>
                  {details.mood}
                </div>
              </div>

              <div>
                <h2 className="text-headline-sm text-on-surface">{mode.name} Mode</h2>
                <p className="mt-1 text-body-sm text-on-surface-variant">{details.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-label-sm ${accentClass}`}>
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">visibility</span>
                  {previewLevel && previewLevel.differences > 0 ? `${previewLevel.differences} Differences` : `${modeLevels.length} Levels`}
                </span>
                <span className="inline-flex items-center gap-1 rounded-full bg-surface-container px-2 py-1 text-label-sm text-on-surface-variant">
                  <span className="material-symbols-outlined text-[15px]" aria-hidden="true">schedule</span>
                  {previewLevel && previewLevel.time > 0 ? `${previewLevel.time} Sec` : 'Play anytime'}
                </span>
                {previewLevel && previewLevel.maxHints > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary-container/30 px-2 py-1 text-label-sm text-on-primary-container">
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">lightbulb</span>
                    {previewLevel.maxHints} {previewLevel.maxHints === 1 ? 'Hint' : 'Hints'}
                  </span>
                ) : null}
              </div>

              <div className="mt-auto rounded-md bg-surface-container-low p-space-sm">
                <div className="mb-1.5 flex items-center justify-between gap-2 text-label-sm">
                  <span className="text-on-surface-variant">Stage Progress</span>
                  <span className={iconClass}>{modeLevels.length ? `${clearedCount} / ${modeLevels.length} Levels` : 'Ready to start'}</span>
                </div>
                <div role="progressbar" aria-label={`${mode.name} stage progress`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-3 overflow-hidden rounded-full bg-surface-container-highest p-0.5">
                  <div className={`h-full rounded-full transition-[width] duration-500 ${mode.accent === 'secondary' ? 'bg-secondary' : mode.accent === 'primary' ? 'bg-primary' : 'bg-tertiary'}`} style={{ width: `${progress}%` }} />
                </div>
              </div>

              {modeLevels.length > 0 ? (
                <Link to={mode.id === 'easy' ? '/dashboard/easy-levels' : `/dashboard/play/${mode.id}`} className="mt-1 block">
                  <Button variant={buttonVariant} rightIcon="play_arrow" className="w-full justify-center">
                    Select {mode.name} Mode
                  </Button>
                </Link>
              ) : (
                <Button disabled variant={buttonVariant} className="mt-1 w-full justify-center">
                  {levelsLoading ? 'Loading levels...' : 'No published levels yet'}
                </Button>
              )}
            </div>
          </Card>
          );
        })}
        </section>

        <div className="mx-auto flex max-w-3xl items-center justify-center gap-2 rounded-full bg-surface-container-lowest px-4 py-3 text-center text-body-sm text-on-surface-variant shadow-[0_4px_16px_rgba(43,139,198,0.06)] sm:px-6">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[18px]" aria-hidden="true">lightbulb</span>
          </span>
          <p><span className="font-semibold text-primary">เคล็ดลับ:</span> สลับระดับและเล่นซ้ำได้ตลอดเวลา ไม่จำกัดจำนวนครั้ง</p>
        </div>
      </div>
    </div>
  );
}
