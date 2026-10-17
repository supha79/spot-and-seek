import { useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import LevelArtwork from '../../components/ui/LevelArtwork';
import { useAdminData } from '../../context/AdminDataContext';
import { waitForPopOut } from '../../utils/motion';

const questionPageSize = 6;

export default function Questions() {
  const {
    questions,
    levels,
    deleteQuestion,
    deactivateQuestion,
    reactivateQuestion,
    refreshCatalog,
    isLoading,
    error: catalogError,
    catalogWarnings,
  } = useAdminData();
  const [actionError, setActionError] = useState<string | null>(null);
  const [busySpotId, setBusySpotId] = useState<string | null>(null);
  const [removingSpotId, setRemovingSpotId] = useState<string | null>(null);
  const [levelFilter, setLevelFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const filteredSpots = questions.filter((spot) => (
    (levelFilter === 'all' || spot.levelId === levelFilter)
    && `${spot.label} ${spot.spotKey} ${spot.levelName}`.toLowerCase().includes(search.toLowerCase())
  ));
  const pageCount = Math.ceil(filteredSpots.length / questionPageSize);
  const currentPage = Math.min(page, pageCount || 1);
  const pageStart = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(pageCount, 5) }, (_, index) => pageStart + index);
  const paginatedSpots = filteredSpots.slice((currentPage - 1) * questionPageSize, currentPage * questionPageSize);

  const handleSpotAction = async (spotId: string, action: (id: string) => Promise<void>, popOut = false) => {
    if (busySpotId) return;
    setBusySpotId(spotId);
    setActionError(null);
    try {
      if (popOut) {
        setRemovingSpotId(spotId);
        await waitForPopOut();
      }
      await action(spotId);
    } catch (error) {
      setRemovingSpotId(null);
      setActionError(error instanceof Error ? error.message : 'Unable to update the spot.');
    } finally {
      setBusySpotId(null);
      setRemovingSpotId(null);
    }
  };

  return (
    <div className="space-y-space-xl">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-space-md">
            <h1 className="text-headline-lg text-on-surface">Spots</h1>
            <span className="rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">Total {questions.length} spots</span>
          </div>
          <p className="mt-2 text-body-md text-on-surface-variant">Manage spot labels, geometry, scoring values, and availability.</p>
        </div>

        <Link to="/admin/questions/new">
          <Button variant="primary" leftIcon="add_circle">+ New spot</Button>
        </Link>
      </div>

      {catalogError ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-space-md rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">
          <span>Unable to load spots: {catalogError}</span>
          <Button variant="ghost" leftIcon="refresh" disabled={isLoading} onClick={() => void refreshCatalog().catch(() => undefined)}>Retry</Button>
        </div>
      ) : null}
      {catalogWarnings.map((warning) => <p key={warning} role="status" className="rounded-lg border border-tertiary/40 bg-tertiary-fixed/40 px-space-md py-3 text-body-md text-on-surface">{warning}</p>)}
      {actionError ? <div role="alert" className="rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">{actionError}</div> : null}

      <div className="rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_-4px_rgba(0,102,136,0.06)]">
        <div className="flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-space-md sm:flex-row sm:items-center">
            <div className="relative min-w-[260px]">
              <select value={levelFilter} onChange={(event) => { setLevelFilter(event.target.value); setPage(1); }} className="w-full appearance-none rounded-full bg-surface-container-low px-4 py-3 pr-10 text-label-md text-on-surface outline-none">
                <option value="all">All Levels (ด่านทั้งหมด)</option>
                {levels.map((level) => <option key={level.id} value={level.id}>{level.title} ({level.difficulty})</option>)}
              </select>
            </div>
              <input value={search} onChange={(event) => { setSearch(event.target.value); setPage(1); }} placeholder="Search label or spot key" className="w-full rounded-full bg-surface-container-low px-4 py-2.5 text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/60 lg:min-w-[280px]" />
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="rounded-full bg-surface-container-high px-4 py-2 text-label-sm text-on-surface-variant">Showing {paginatedSpots.length} of {filteredSpots.length} spots</span>
          </div>
        </div>
      </div>

      {isLoading ? <p role="status" className="rounded-lg bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant">Loading spots...</p> : null}
      {!isLoading && questions.length === 0 && !catalogError ? <p className="rounded-lg bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant">No spots yet. Add the first spot to a level.</p> : null}
      {!isLoading && questions.length > 0 && filteredSpots.length === 0 ? <p className="rounded-lg bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant">No spots match this filter.</p> : null}

      <div role="region" aria-label="Question spots" className="grid grid-cols-1 gap-space-lg md:grid-cols-2 xl:grid-cols-3">
        {!isLoading && paginatedSpots.map((question) => (
          <div key={question.id} className={`rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_-4px_rgba(0,102,136,0.08)] ${removingSpotId === question.id ? 'ui-pop-out' : ''}`}>
            <div className="flex items-start justify-between gap-space-sm">
              <div className="flex min-w-0 items-start gap-space-sm">
                <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface-container-low shadow-sm">
                  <LevelArtwork access="admin" loading="lazy" levelId={question.levelId} title={question.levelName} className="h-full w-full" />
                </div>
                <div className="min-w-0">
                  <span className={`inline-flex max-w-full items-center gap-1 rounded-full px-3 py-1 text-label-sm ${question.difficulty === 'Easy' ? 'bg-secondary-fixed text-on-secondary-fixed' : question.difficulty === 'Medium' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-current" />
                    <span className="truncate">{question.difficulty} · {question.levelName}</span>
                  </span>
                  <h2 className="mt-2 text-headline-sm text-on-surface">{question.label}</h2>
                  <p className="mt-1 text-body-sm text-on-surface-variant">Key: {question.spotKey}</p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Link to={`/admin/questions/${question.id}/edit`}>
                  <Button type="button" variant="ghost" leftIcon="edit" disabled={busySpotId !== null} className="!h-9 !w-9 !rounded-full !px-0 !py-0"><span className="sr-only">Edit spot</span></Button>
                </Link>
                <button
                  type="button"
                  disabled={busySpotId !== null}
                  aria-label={question.active ? 'Deactivate spot' : 'Reactivate spot'}
                  onClick={() => void handleSpotAction(question.id, question.active ? deactivateQuestion : reactivateQuestion)}
                  className="ui-pressable flex h-9 items-center justify-center rounded-full bg-surface-container-high px-3 text-label-sm text-on-surface-variant disabled:opacity-50"
                >
                  {question.active ? 'Deactivate' : 'Reactivate'}
                </button>
                <button
                  type="button"
                  disabled={busySpotId !== null}
                  aria-label="Delete spot"
                  onClick={() => void handleSpotAction(question.id, deleteQuestion, true)}
                  className="ui-pressable flex h-9 w-9 items-center justify-center rounded-full bg-tertiary-fixed text-tertiary shadow-[0_2px_0_#f2b6c8]"
                >
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>

            <div className="mt-space-md grid grid-cols-2 gap-space-sm rounded-lg bg-surface-container-low p-space-md text-body-sm text-on-surface-variant">
              <span>Shape: {question.shape}</span>
              <span>Position: {question.xNorm}, {question.yNorm}</span>
              <span>{question.shape === 'circle' ? `Radius: ${question.radiusNorm}` : `Size: ${question.widthNorm} × ${question.heightNorm}`}</span>
              <span>Tolerance: {question.toleranceNorm}</span>
              <span>Score: {question.scoreValue}</span>
              <span>Order: {question.sortOrder}</span>
            </div>

            <div className="mt-space-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-secondary-fixed/50 px-2.5 py-1 text-label-sm text-secondary">{question.active ? 'Active' : 'Offline'}</span>
              </div>
              <span className="text-body-sm text-on-surface-variant/70">{question.createdAt}</span>
            </div>
            {busySpotId === question.id ? <p role="status" className="mt-space-sm text-body-sm text-on-surface-variant">Saving...</p> : null}
          </div>
        ))}
      </div>

      {!isLoading && pageCount > 1 ? (
        <section className="flex flex-col items-center justify-between gap-space-md rounded-lg bg-surface-container-lowest px-space-lg py-space-md shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08)] sm:flex-row">
          <p className="text-body-sm text-on-surface-variant">Page {currentPage} of {pageCount} · {filteredSpots.length} spots match current filters</p>
          <nav aria-label="Question pagination" className="flex items-center gap-space-xs">
            <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-full bg-surface-container-low px-space-md py-2 text-label-sm text-on-surface-variant disabled:opacity-50">‹ Prev</button>
            {pageNumbers.map((pageNumber) => (
              <button key={pageNumber} type="button" aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => setPage(pageNumber)} className={`h-9 min-w-9 rounded-full px-space-sm text-label-sm ${pageNumber === currentPage ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                {pageNumber}
              </button>
            ))}
            <button type="button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} className="rounded-full bg-surface-container-low px-space-md py-2 text-label-sm text-on-surface-variant disabled:opacity-50">Next ›</button>
          </nav>
        </section>
      ) : null}
    </div>
  );
}
