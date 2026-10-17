import { Link, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { useGameData } from '../../context/GameDataContext';

export default function HistoryDetail() {
  const { sessionId } = useParams();
  const { history, historyLoading, historyError, historyNotice, refreshHistory } = useGameData();
  const entry = history.find((item) => item.id === sessionId);

  return (
    <div className="mx-auto max-w-3xl space-y-5 pb-8">
      {historyLoading ? (
        <section className="rounded-[28px] bg-surface-container-lowest p-10 text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <p role="status" className="text-body-md text-on-surface-variant">Loading game details...</p>
        </section>
      ) : historyError ? (
        <section className="rounded-[28px] bg-surface-container-lowest p-8 text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h1 className="text-headline-md text-on-surface">Unable to load game details</h1>
          <p role="alert" className="mt-2 break-words text-body-sm text-on-surface-variant">{historyError}</p>
          <Button variant="ghost" leftIcon="refresh" onClick={refreshHistory} className="mt-5">Retry</Button>
        </section>
      ) : !entry ? (
        <section className="rounded-[28px] bg-surface-container-lowest p-8 text-center shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <h1 className="text-headline-md text-on-surface">Game record not found</h1>
          <p className="mt-2 text-body-sm text-on-surface-variant">This record is unavailable in your history.</p>
          <Link to="/dashboard/history" className="mt-5 inline-flex text-label-md text-primary hover:underline">Return to history</Link>
        </section>
      ) : (
        <section className="rounded-[28px] bg-surface-container-lowest p-6 shadow-[0_12px_28px_rgba(43,139,198,0.08)] sm:p-8">
          {historyNotice ? <p role="status" className="mb-5 rounded-lg border border-tertiary/40 bg-tertiary-fixed/40 px-space-md py-3 text-body-sm text-on-surface">{historyNotice}</p> : null}
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-label-sm uppercase text-on-surface-variant">Game details</p>
              <h1 className="mt-1 break-words text-headline-lg text-on-surface">{entry.title}</h1>
              <p className="mt-1 text-body-sm text-on-surface-variant">{entry.difficulty} · {entry.date}</p>
            </div>
            <span className={`rounded-full px-3 py-1 text-label-sm ${entry.status === 'Cleared' ? 'bg-secondary-container text-on-secondary-container' : entry.status === 'Lost' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-surface-container text-on-surface-variant'}`}>
              {entry.result ?? 'Unknown result'}
            </span>
          </div>

          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-2xl bg-surface-container-low p-4">
              <dt className="text-label-sm text-on-surface-variant">Score</dt>
              <dd className="mt-1 text-headline-md text-on-surface">{entry.score?.toLocaleString() ?? 'Not available'}</dd>
            </div>
            <div className="rounded-2xl bg-surface-container-low p-4">
              <dt className="text-label-sm text-on-surface-variant">Result</dt>
              <dd className="mt-1 text-headline-md text-on-surface">{entry.status}</dd>
            </div>
          </dl>

          <p className="mt-5 text-body-sm text-on-surface-variant">
            Play duration and event details are not included in the history data currently loaded.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            {entry.playableLevelId ? (
              <Link to={`/dashboard/play/${entry.playableLevelId}`} className="flex-1">
                <Button variant="primary" leftIcon="replay" className="w-full">Play this level again</Button>
              </Link>
            ) : <p role="status" className="flex-1 text-body-sm text-on-surface-variant">Replay is unavailable because this level is not in the published catalog.</p>}
            <Link to="/dashboard/profile" className="flex-1">
              <Button variant="ghost" leftIcon="query_stats" className="w-full">View stats</Button>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}