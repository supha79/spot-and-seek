import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { BrandMascot } from '../../components/ui/BrandMascot';
import Card from '../../components/ui/Card';
import LevelArtwork from '../../components/ui/LevelArtwork';
import PlaceholderIllustration from '../../components/ui/PlaceholderIllustration';
import { useGameData } from '../../context/GameDataContext';
import { getGameRunReadinessNotice } from '../../services/compatibilityContracts';

export default function Home() {
  const {
    profile,
    profileLoading,
    profileAvailable,
    profileError,
    dynamicGameplayGateState,
    refreshDynamicGameplayGate,
    games,
    gamesLoading,
    gamesError,
    refreshGames,
    history,
    historyLoading,
    historyError,
    refreshHistory,
    levels,
    levelsLoading,
    levelsError,
    refreshLevels,
  } = useGameData();
  const recommendedTitles = {
    easy: 'bakery',
    medium: 'colorful market',
    hard: 'candy kingdom',
  } as const;
  const recommendedLevels = (['easy', 'medium', 'hard'] as const)
    .map((difficulty) => levels.find((level) => level.difficulty === difficulty && level.title.toLowerCase().includes(recommendedTitles[difficulty]))
      ?? levels.find((level) => level.difficulty === difficulty))
    .filter((level) => level !== undefined);
  const [activeRecommendationIndex, setActiveRecommendationIndex] = useState(0);
  const activeIndex = recommendedLevels.length ? activeRecommendationIndex % recommendedLevels.length : 0;
  const featuredLevel = recommendedLevels[activeIndex];
  const featuredLevelReadinessNotice = featuredLevel
    ? getGameRunReadinessNotice(featuredLevel.identity, dynamicGameplayGateState)
    : null;

  useEffect(() => {
    if (recommendedLevels.length < 2) return;

    const interval = window.setInterval(() => {
      setActiveRecommendationIndex((index) => (index + 1) % recommendedLevels.length);
    }, 6000);
    return () => window.clearInterval(interval);
  }, [recommendedLevels.length]);
  const profileStatsAvailable = profileAvailable && !profileLoading && profile.totalPlays > 0;
  const unavailableProfileValue = profileLoading ? '...' : '—';
  const stats = [
    {
      title: 'Levels Completed',
      value: profileStatsAvailable ? profile.levelsCompleted.toLocaleString() : unavailableProfileValue,
      suffix: profileStatsAvailable ? `/ ${profile.totalLevels}` : profileLoading ? '/ ...' : '',
      icon: 'checklist',
      tone: 'secondary',
    },
    {
      title: 'Best Score',
      value: profileStatsAvailable ? profile.bestScore.toLocaleString() : unavailableProfileValue,
      suffix: '',
      icon: 'star',
      tone: 'tertiary',
    },
    {
      title: 'Total Plays',
      value: profileStatsAvailable ? profile.totalPlays.toLocaleString() : unavailableProfileValue,
      suffix: 'รอบ',
      icon: 'videogame_asset',
      tone: 'primary',
    },
    {
      title: 'Avg. Time',
      value: profileStatsAvailable ? profile.avgTime.toLocaleString() : unavailableProfileValue,
      suffix: 'วินาที',
      icon: 'timer',
      tone: 'secondary',
    },
  ];

  return (
    <div className="space-y-8 pb-6">
      <section className="flex flex-col gap-4 py-2 sm:flex-row sm:items-center">
        <BrandMascot className="h-16 w-16 shrink-0" />
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-display-hero-mobile text-on-primary-container">สวัสดี {profile.displayName}</h1>
            <span className="rounded-full bg-primary-fixed px-2 py-1 text-label-sm text-on-primary-fixed-variant">พร้อมเล่น</span>
          </div>
          <p className="mt-2 max-w-2xl text-body-md text-on-surface-variant">
            วันนี้พร้อมหาจุดต่างหรือยัง? มีมุมอบอุ่นรอให้ค้นพบอีกเพียบเลยนะ ✨
          </p>
        </div>
      </section>

      <section aria-label="Recommended level carousel" className="grid gap-5 overflow-hidden rounded-[28px] bg-gradient-to-br from-surface-container-low via-surface to-primary-fixed/40 p-3 shadow-[0_12px_32px_-6px_rgba(43,139,198,0.14)] md:p-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div key={featuredLevel?.id ?? 'empty'} className="recommendation-slide-in overflow-hidden rounded-[24px] bg-surface-container-lowest p-2 shadow-[0_8px_24px_rgba(35,65,79,0.12)]">
          {featuredLevel ? (
            <LevelArtwork levelId={featuredLevel.id} title={featuredLevel.title} resolution="full" className="h-[240px] w-full rounded-[20px] md:h-[300px]">
              <div className="absolute left-3 top-3 rounded-full bg-surface-container-lowest/90 px-3 py-1 text-label-sm text-on-primary-container shadow-sm">{featuredLevel.difficulty.toUpperCase()}</div>
            </LevelArtwork>
          ) : (
            <div className="flex h-[240px] items-center justify-center rounded-[20px] bg-surface-container-low md:h-[300px]">
              <span className="material-symbols-outlined text-[48px] text-outline-variant" aria-hidden="true">sports_esports</span>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col justify-between gap-5 p-2 md:p-4 lg:py-6">
            {gamesLoading ? <p role="status" className="text-body-md text-on-surface-variant">Loading published games...</p> : null}
            {gamesError ? (
              <div role="alert" className="space-y-3">
                <p className="text-body-sm text-error">{gamesError}</p>
                <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshGames()}>Retry</Button>
              </div>
            ) : null}
            {!gamesLoading && !gamesError && levelsLoading ? <p role="status" className="text-body-md text-on-surface-variant">Loading published levels...</p> : null}
            {levelsError ? (
              <div role="alert" className="space-y-3">
                <p className="text-body-sm text-error">{levelsError}</p>
                <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshLevels()}>Retry</Button>
              </div>
            ) : null}
            {!gamesLoading && !gamesError && games.length === 0 ? (
              <div role="status" className="space-y-3">
                <h2 className="text-headline-md text-on-surface">No published games yet</h2>
                <p className="text-body-md text-on-surface-variant">Games will appear here when they are ready to play.</p>
                <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshGames()}>Refresh</Button>
              </div>
            ) : null}
            {!gamesLoading && !gamesError && games.length > 0 && !levelsLoading && !levelsError && levels.length === 0 ? (
              <div role="status" className="space-y-3">
                <h2 className="text-headline-md text-on-surface">No published levels yet</h2>
                <p className="text-body-md text-on-surface-variant">Check back after a level has been published.</p>
                <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshLevels()}>Refresh</Button>
              </div>
            ) : null}
            {featuredLevel ? (
              <>
                <div key={featuredLevel.id} className="recommendation-slide-in">
                  <div className="space-y-3">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary-container/70 px-space-sm py-1 text-label-sm text-on-secondary-container">
                    <span className="material-symbols-outlined text-[15px]" aria-hidden="true">auto_awesome</span>
                    Recommended level
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-label-sm text-on-primary-fixed-variant">
                    <span className="material-symbols-outlined text-[16px]">palette</span>
                    {featuredLevel.difficulty}
                  </span>

                  <div>
                    <h2 className="text-headline-lg text-on-primary-container">{featuredLevel.title}</h2>
                    <p className="mt-2 text-body-md text-on-surface-variant">{featuredLevel.description || featuredLevel.subtitle}</p>
                  </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <span className="rounded-full bg-surface-container px-3 py-1 text-label-sm text-on-surface">{featuredLevel.time} sec</span>
                    <span className="rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">Published</span>
                  </div>

                  <div className="mt-5">
                    {featuredLevelReadinessNotice ? (
                      <div className="space-y-2">
                        <Button variant="primary" size="lg" disabled className="w-full justify-center sm:w-fit">Not ready to play</Button>
                        {dynamicGameplayGateState === 'unknown' ? <Button variant="ghost" leftIcon="refresh" onClick={() => void refreshDynamicGameplayGate()}>Retry check</Button> : null}
                        <p role="status" className="text-body-sm text-on-surface-variant">{featuredLevelReadinessNotice}</p>
                      </div>
                    ) : (
                      <Link to={`/dashboard/play/${featuredLevel.id}`} state={{ openReadyModal: true }} className="block w-full sm:w-fit">
                        <Button variant="primary" size="lg" leftIcon="play_circle" rightIcon="arrow_forward" className="w-full justify-center">
                          Play now
                        </Button>
                      </Link>
                    )}
                  </div>
                </div>

                {recommendedLevels.length > 1 ? (
                  <div className="mt-space-md flex flex-wrap items-center gap-space-xs">
                    <span className="mr-1 text-label-sm text-on-surface-variant">Browse levels</span>
                    <div role="tablist" aria-label="Recommended levels" className="flex flex-wrap items-center gap-space-xs">
                      {recommendedLevels.map((level, index) => {
                        const isActive = index === activeIndex;
                        const selectedTone = level.difficulty === 'easy'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : level.difficulty === 'medium'
                            ? 'bg-primary-fixed text-on-primary-fixed-variant'
                            : 'bg-tertiary-fixed text-on-tertiary-fixed-variant';
                        return (
                          <button
                            key={level.id}
                            type="button"
                            role="tab"
                            aria-selected={isActive}
                            aria-label={`Show ${level.difficulty} recommendation: ${level.title}`}
                            onClick={() => setActiveRecommendationIndex(index)}
                            className={`rounded-full px-space-sm py-1 text-label-sm transition-colors ${isActive ? selectedTone : 'bg-surface-container-lowest/80 text-on-surface-variant hover:bg-surface-container-low'}`}
                          >
                            {level.difficulty}
                          </button>
                        );
                      })}
                    </div>
                    <span aria-live="polite" className="ml-auto text-label-sm text-on-surface-variant">{activeIndex + 1} / {recommendedLevels.length}</span>
                  </div>
                ) : null}
              </>
            ) : null}
        </div>
      </section>

      <section>
        {profileAvailable && !profileLoading && profile.totalPlays === 0 ? (
          <p className="rounded-2xl bg-surface-container-low p-5 text-body-md text-on-surface-variant">No game history yet</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {stats.map((stat) => (
              <Card key={stat.title} className="p-5">
                <div className="flex items-center justify-between">
                  <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.tone === 'secondary' ? 'bg-secondary-fixed text-on-secondary-fixed' : stat.tone === 'tertiary' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : stat.tone === 'primary' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-secondary-container text-on-secondary-container'}`}>
                    <span className="material-symbols-outlined text-[26px]">{stat.icon}</span>
                  </div>
                  <span className="text-label-sm text-secondary uppercase">{stat.title === 'Levels Completed' ? 'Progress' : stat.title === 'Best Score' ? 'Top' : stat.title === 'Total Plays' ? 'Games' : 'Time'}</span>
                </div>

                <div className="mt-4">
                  <div className="text-label-md text-on-surface-variant">{stat.title}</div>
                  <div className="mt-1 flex items-baseline gap-1">
                    <span className="text-headline-lg text-on-surface">{stat.value}</span>
                    {stat.suffix ? <span className="text-headline-sm text-outline">{stat.suffix}</span> : null}
                  </div>
                </div>
                {stat.title === 'Levels Completed' && profileStatsAvailable && profile.totalLevels > 0 ? (
                  <div className="mt-4">
                    <div className="h-2 overflow-hidden rounded-full bg-surface-container-high">
                      <div className="h-full rounded-full bg-secondary" style={{ width: `${Math.min(100, Math.round((profile.levelsCompleted / profile.totalLevels) * 100))}%` }} />
                    </div>
                    <p className="mt-1 text-label-sm text-on-surface-variant">{Math.min(100, Math.round((profile.levelsCompleted / profile.totalLevels) * 100))}% complete</p>
                  </div>
                ) : null}
              </Card>
            ))}
          </div>
        )}
      </section>
      {profileError ? (
        <p role="alert" className="break-words text-body-sm text-error">{profileError}</p>
      ) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
            </div>
            <h3 className="text-headline-md text-on-surface">Recent plays</h3>
          </div>
          <Link to="/dashboard/history" className="text-label-md text-primary">View all →</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {historyLoading ? (
            <p role="status" className="text-body-sm text-on-surface-variant">Loading recent plays...</p>
          ) : historyError ? (
            <div className="space-y-3">
              <p role="alert" className="break-words text-body-sm text-error">{historyError}</p>
              <Button variant="ghost" leftIcon="refresh" onClick={refreshHistory}>Retry</Button>
            </div>
          ) : history.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant">No game history yet</p>
          ) : history.slice(0, 3).map((entry) => {
            const artworkLevelId = entry.playableLevelId ?? entry.identity.contentLevelId;
            return (
            <Link key={entry.id} to={`/dashboard/history/${entry.id}`} className="block rounded-[28px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
              <Card className="overflow-hidden p-3 transition-transform duration-200 hover:-translate-y-1">
                {artworkLevelId ? (
                  <LevelArtwork levelId={artworkLevelId} title={entry.title} className="h-40 w-full rounded-[20px]">
                    <span className={`absolute left-3 top-3 rounded-full px-3 py-1 text-label-sm ${entry.difficulty === 'easy' ? 'bg-secondary-fixed text-on-secondary-fixed' : entry.difficulty === 'medium' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>{entry.difficulty}</span>
                    <span className={`absolute right-3 top-3 rounded-full px-3 py-1 text-label-sm ${entry.status === 'Cleared' ? 'bg-secondary-container text-on-secondary-container' : entry.status === 'Lost' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-surface-container text-on-surface-variant'}`}>{entry.status}</span>
                  </LevelArtwork>
                ) : (
                  <PlaceholderIllustration className="h-40 w-full rounded-[20px]" label={entry.title} />
                )}
                <div className="px-1 pb-1 pt-3">
                  <h4 className="text-headline-sm text-on-surface">{entry.title}</h4>
                  <p className="mt-1 text-body-sm text-on-surface-variant">{entry.date}</p>
                  <div className="mt-3 flex items-center justify-between rounded-xl bg-surface-container-low px-3 py-2">
                    <span className="text-body-sm text-on-surface-variant">Score</span>
                    <span className="text-label-lg text-on-surface">{entry.score?.toLocaleString() ?? '—'}</span>
                  </div>
                </div>
              </Card>
            </Link>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-4 rounded-[28px] bg-surface-container-low p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-secondary-container text-on-secondary-container">
            <span className="material-symbols-outlined text-[24px]">coffee</span>
          </div>
          <div>
            <h3 className="text-headline-sm text-on-surface">พักสายตาสักนิด แล้วเลือกด่านต่อไป</h3>
            <p className="text-body-sm text-on-surface-variant">ทุกระดับเปิดให้เล่นได้ตามจังหวะของคุณ</p>
          </div>
        </div>
        <Link to="/dashboard/play" className="block shrink-0">
          <Button variant="ghost" rightIcon="arrow_forward" className="w-full justify-center">
            Levels Map
          </Button>
        </Link>
      </section>
    </div>
  );
}
