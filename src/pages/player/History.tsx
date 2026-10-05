import { useGameData } from '../../context/GameDataContext';

export default function History() {
  const { history, historyLoading, historyError } = useGameData();

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col gap-4 rounded-[28px] bg-surface-container-lowest p-5 shadow-[0_12px_28px_rgba(43,139,198,0.08)] md:flex-row md:items-center md:justify-between">
        <div>
          <div className="text-label-sm text-on-surface-variant uppercase tracking-[0.2em]">History</div>
          <h1 className="mt-1 text-headline-lg text-on-surface">Your recent plays</h1>
        </div>

      </section>

      {historyLoading ? (
        <section className="rounded-[28px] bg-surface-container-lowest p-10 text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <p role="status" className="text-body-md text-on-surface-variant">Loading history...</p>
        </section>
      ) : historyError ? (
        <section className="rounded-[28px] bg-surface-container-lowest p-10 text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h2 className="text-headline-md text-on-surface">Unable to load history</h2>
          <p role="alert" className="mt-2 text-body-md text-on-surface-variant">Please try again later.</p>
        </section>
      ) : history.length === 0 ? (
        <section className="rounded-[28px] bg-surface-container-lowest p-10 text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-fixed text-primary">
            <span className="material-symbols-outlined text-[32px]">history</span>
          </div>
          <h2 className="mt-4 text-headline-md text-on-surface">No plays yet</h2>
          <p className="mt-2 text-body-md text-on-surface-variant">Start a cozy puzzle to build your history stack.</p>
        </section>
      ) : (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {history.map((entry) => (
            <article key={entry.id} className="rounded-[28px] bg-surface-container-lowest p-5 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
              <div className="flex items-center justify-between">
                <span className="text-label-sm text-primary">{entry.difficulty}</span>
                <span className={`rounded-full px-2 py-1 text-label-sm ${entry.status === 'Cleared' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-fixed text-on-primary-fixed-variant'}`}>
                  {entry.status}
                </span>
              </div>
              <h3 className="mt-3 text-headline-sm text-on-surface">{entry.title}</h3>
              <p className="mt-1 text-body-sm text-on-surface-variant">{entry.date}</p>
              <div className="mt-5 flex items-center justify-between border-t border-outline-variant/60 pt-3">
                <span className="text-body-sm text-on-surface-variant">Score</span>
                <span className="text-label-lg text-on-surface">{entry.score}</span>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
