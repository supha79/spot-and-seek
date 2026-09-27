import { useGameData } from '../../context/GameDataContext';

export default function Profile() {
  const { profile, selectedBuddy, setSelectedBuddy, buddyOptions } = useGameData();

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <section className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed text-headline-md text-primary">
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
            <div>
              <div className="text-label-sm text-on-surface-variant uppercase tracking-[0.2em]">Profile</div>
              <h1 className="text-headline-lg text-on-surface">{profile.displayName}</h1>
            </div>
          </div>

          <div className="rounded-full bg-secondary-container px-4 py-2 text-label-md text-on-secondary-container">Casual play</div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        <div className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h2 className="text-headline-md text-on-surface">Current buddy</h2>
          <div className="mt-4 flex items-center gap-4 rounded-2xl bg-surface-container-low p-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-headline-md text-primary">{selectedBuddy.slice(0, 1)}</div>
            <div>
              <div className="text-headline-sm text-on-surface">{selectedBuddy}</div>
              <div className="text-body-sm text-on-surface-variant">Your companion is ready to help you spot details.</div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h2 className="text-headline-md text-on-surface">Stats</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl bg-surface-container-low p-3">
              <div className="text-label-sm text-on-surface-variant">Best score</div>
              <div className="mt-1 text-headline-sm text-on-surface">{profile.bestScore}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3">
              <div className="text-label-sm text-on-surface-variant">Play count</div>
              <div className="mt-1 text-headline-sm text-on-surface">{profile.totalPlays}</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3">
              <div className="text-label-sm text-on-surface-variant">Avg. time</div>
              <div className="mt-1 text-headline-sm text-on-surface">{profile.avgTime}s</div>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-3">
              <div className="text-label-sm text-on-surface-variant">Stages</div>
              <div className="mt-1 text-headline-sm text-on-surface">{profile.levelsCompleted}/{profile.totalLevels}</div>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
        <h2 className="text-headline-md text-on-surface">Choose buddy</h2>
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-4">
          {buddyOptions.map((buddy) => (
            <button
              key={buddy.id}
              type="button"
              onClick={() => setSelectedBuddy(buddy.id)}
              className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all ${selectedBuddy === buddy.id ? 'border-primary bg-primary-fixed/40 shadow-[0_8px_24px_rgba(124,200,240,0.35)]' : 'border-transparent bg-surface-container-low hover:border-outline-variant'}`}
            >
              <div className={`flex h-16 w-16 items-center justify-center rounded-full ${buddy.accent} text-headline-md text-on-surface`}>
                {buddy.id.slice(0, 1)}
              </div>
              <span className="text-label-md text-on-surface">{buddy.name}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
