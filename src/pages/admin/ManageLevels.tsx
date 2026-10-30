import { useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useAdminData } from '../../context/AdminDataContext';
import { getParentGamePublishBlockReason } from '../../services/compatibilityContracts';
import { getAdminGameplayAssetPairForLevel } from '../../services/levelAssets';
import { waitForPopOut } from '../../utils/motion';
import LevelAssetPairEditor from './LevelAssetPairEditor';
import LevelArtwork from '../../components/ui/LevelArtwork';

type LevelDifficulty = 'Easy' | 'Medium' | 'Hard';
const levelPageSize = 6;

const durationRules: Record<LevelDifficulty, { min: number; max?: number; suggested: number; range: string }> = {
  Easy: { min: 91, suggested: 120, range: '91 or more' },
  Medium: { min: 61, max: 90, suggested: 90, range: '61 to 90' },
  Hard: { min: 1, max: 60, suggested: 60, range: '60 or less' },
};

function getDurationError(difficulty: LevelDifficulty, time: number) {
  const { min, max, range } = durationRules[difficulty];
  return !Number.isInteger(time) || time < min || (max !== undefined && time > max)
    ? `${difficulty} levels need ${range} seconds.`
    : null;
}

export default function ManageLevels() {
  const {
    levels,
    games,
    questions,
    addLevel,
    deleteLevel,
    updateLevel,
    publishLevel,
    unpublishLevel,
    archiveLevel,
    restoreLevel,
    refreshCatalog,
    isLoading,
    error,
    catalogWarnings,
  } = useAdminData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [difficulty, setDifficulty] = useState<LevelDifficulty>('Easy');
  const [time, setTime] = useState(120);
  const [maxHints, setMaxHints] = useState(3);
  const [gameId, setGameId] = useState(games[0]?.id ?? 'game-1');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyLevelId, setBusyLevelId] = useState<string | null>(null);
  const [removingLevelId, setRemovingLevelId] = useState<string | null>(null);
  const [difficultyFilter, setDifficultyFilter] = useState<'All' | 'Easy' | 'Medium' | 'Hard'>('All');
  const [page, setPage] = useState(1);
  const visibleLevels = (difficultyFilter === 'All' ? levels : levels.filter((level) => level.difficulty === difficultyFilter))
    .map((level) => {
      const parentGame = games.find((game) => game.id === level.gameId);
      return {
        level,
        parentGame,
        parentGameBlockReason: getParentGamePublishBlockReason(parentGame?.status),
      };
    });
  const pageCount = Math.ceil(visibleLevels.length / levelPageSize);
  const currentPage = Math.min(page, pageCount || 1);
  const pageStart = Math.max(1, Math.min(currentPage - 2, pageCount - 4));
  const pageNumbers = Array.from({ length: Math.min(pageCount, 5) }, (_, index) => pageStart + index);
  const paginatedLevels = visibleLevels.slice((currentPage - 1) * levelPageSize, currentPage * levelPageSize);

  const openNewModal = () => {
    setFormError(null);
    setEditingId(null);
    setTitle('');
    setDescription('');
    setDifficulty('Easy');
    setTime(120);
    setMaxHints(3);
    setGameId(games[0]?.id ?? '');
    setIsModalOpen(true);
  };

  const openEditModal = (level: (typeof levels)[number]) => {
    setEditingId(level.id);
    setTitle(level.title);
    setDescription(level.description);
    setDifficulty(level.difficulty);
    setTime(level.time);
    setMaxHints(level.maxHints);
    setGameId(level.gameId);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!title.trim()) {
      setFormError('Level title is required.');
      return;
    }
    if (!gameId || !games.some((game) => game.id === gameId)) {
      setFormError('Select a game for this level.');
      return;
    }
    const durationError = getDurationError(difficulty, time);
    if (durationError) {
      setFormError(durationError);
      return;
    }
    if (!Number.isInteger(maxHints) || maxHints < 0 || maxHints > 3) {
      setFormError('Max hints must be a whole number from 0 to 3.');
      return;
    }

    const payload = {
      title: title.trim(),
      description: description.trim(),
      difficulty,
      emoji: title.startsWith('Cozy') ? '🐱' : title.startsWith('Balloon') ? '🎈' : title.startsWith('Sunny') ? '🧺' : title.startsWith('Breezy') ? '🌾' : '🌙',
      time,
      maxHints,
      gameId,
    };

    setIsSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateLevel(editingId, payload);
      } else {
        await addLevel(payload);
      }

      setIsModalOpen(false);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the level.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleLevelAction = async (id: string, action: (levelId: string) => Promise<void>) => {
    if (busyLevelId) return;
    setBusyLevelId(id);
    setActionError(null);
    try {
      await action(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the level.');
    } finally {
      setBusyLevelId(null);
    }
  };

  const handlePublish = async (level: (typeof levels)[number]) => {
    const parentGame = games.find((game) => game.id === level.gameId);
    const parentGameBlockReason = getParentGamePublishBlockReason(parentGame?.status);
    if (parentGameBlockReason) {
      setActionError(parentGameBlockReason);
      return;
    }

    const activeSpotCount = questions.filter((spot) => spot.levelId === level.id && spot.active).length;
    if (!level.title.trim()) {
      setActionError('A level title is required before publishing.');
      return;
    }
    if (!['Easy', 'Medium', 'Hard'].includes(level.difficulty)) {
      setActionError('Choose a valid difficulty before publishing.');
      return;
    }
    const durationError = getDurationError(level.difficulty as LevelDifficulty, level.time);
    if (durationError) {
      setActionError(durationError);
      return;
    }
    if (activeSpotCount < 1) {
      setActionError('Add at least one active spot before publishing this level.');
      return;
    }
    try {
      const assetPair = await getAdminGameplayAssetPairForLevel(level.id);
      if (!assetPair.original || !assetPair.comparison) {
        setActionError('Add both Original and Comparison images before publishing this level.');
        return;
      }
    } catch {
      setActionError('Both private images must load successfully before this level can be published.');
      return;
    }
    await handleLevelAction(level.id, publishLevel);
  };

  return (
    <div className="space-y-space-xl">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-space-sm">
            <h1 className="text-headline-lg text-on-surface">Levels</h1>
            <span className="rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">ชุดข้อมูลด่าน</span>
          </div>
          <p className="text-body-md text-on-surface-variant">จัดการด่านทั้งหมดในแต่ละชุดเกม · Manage, organize, and fine-tune game stages</p>
        </div>

        <Button variant="primary" leftIcon="add_circle" onClick={openNewModal}>+ New level</Button>
      </div>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-space-md rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">
          <span>{error.startsWith('Saved successfully, but the catalog could not be refreshed:')
            ? error
            : `Unable to load or update levels: ${error}`}</span>
          <Button variant="ghost" leftIcon="refresh" disabled={isLoading} onClick={() => void refreshCatalog().catch(() => undefined)}>Retry</Button>
        </div>
      ) : null}
      {catalogWarnings.map((warning) => <p key={warning} role="status" className="rounded-lg border border-tertiary/40 bg-tertiary-fixed/40 px-space-md py-3 text-body-md text-on-surface">{warning}</p>)}
      {actionError ? <div role="alert" className="rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">{actionError}</div> : null}

      {isLoading ? <p role="status" className="rounded-lg bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant">Loading levels...</p> : null}
      {!isLoading && levels.length === 0 && !error ? <p className="rounded-lg bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant">No levels yet. Create a level to get started.</p> : null}

      <div className="rounded-lg bg-surface-container-lowest p-space-md shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-md">
            <div className="rounded-full bg-surface-container-low px-space-md py-2.5 text-label-md text-on-surface">{games[0]?.name ?? 'No games available'}</div>
            <div className="flex max-w-full flex-wrap items-center justify-center gap-space-xs rounded-full bg-surface-container-low p-1.5">
              {(['All', 'Easy', 'Medium', 'Hard'] as const).map((item) => (
                <button key={item} type="button" aria-pressed={item === difficultyFilter} onClick={() => { setDifficultyFilter(item); setPage(1); }} className={`ui-pressable rounded-full px-space-sm py-1.5 text-label-sm sm:px-space-md sm:text-label-md ${item === difficultyFilter ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
                  {item} {item === 'All' ? `(${levels.length})` : `(${levels.filter((level) => level.difficulty === item).length})`}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-full bg-surface-container px-4 py-2 text-label-sm text-on-surface-variant">{levels.length} Levels total · ทั้งหมด {levels.length} ด่าน</div>
        </div>
      </div>

      <section aria-label="Managed levels" className="space-y-space-md">
        {!isLoading && paginatedLevels.map(({ level, parentGame, parentGameBlockReason }) => (
          <div key={level.id} className={`flex flex-col justify-between gap-space-md rounded-lg bg-surface-container-lowest p-space-md shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08),0_2px_6px_0_rgba(43,139,198,0.04)] md:flex-row md:items-center ${removingLevelId === level.id ? 'ui-pop-out' : ''}`}>
            <div className="flex min-w-0 items-center gap-space-md">
              <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md bg-primary-fixed shadow-[0_4px_0_#2b8bc6]">
                <LevelArtwork access="admin" loading="lazy" levelId={level.id} title={level.title} className="h-full w-full" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-0.5 text-label-sm ${level.difficulty === 'Easy' ? 'bg-secondary-fixed text-on-secondary-fixed' : level.difficulty === 'Medium' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                    {level.difficulty}
                  </span>
                  <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface">{level.title}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-label-sm ${level.status === 'published' ? 'bg-secondary-container text-on-secondary-container' : level.status === 'archived' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-surface-container-high text-on-surface-variant'}`}>{level.status}</span>
                </div>
                <h3 className="mt-2 text-headline-sm text-on-surface">{level.title}</h3>
                <p className="mt-1 text-body-sm text-on-surface-variant">Parent game: {parentGame?.name ?? 'Unavailable'} · {parentGame?.status ?? 'status unknown'}</p>
                {level.status === 'draft' && parentGameBlockReason ? <p role="status" className="mt-1 text-body-sm text-error">{parentGameBlockReason}</p> : null}
                <LevelAssetPairEditor levelId={level.id} levelTitle={level.title} levelStatus={level.status} />
              </div>
            </div>

            <div className="flex flex-col gap-space-sm sm:flex-row sm:items-center sm:justify-between sm:gap-space-lg md:justify-end">
              <div className="flex flex-wrap items-center gap-space-sm sm:gap-space-md">
                <div className="rounded-full bg-surface-container-low px-space-md py-1.5 text-label-md text-on-surface-variant">{level.time}s</div>
                <div className="rounded-full bg-surface-container-low px-space-md py-1.5 text-label-md text-on-surface-variant">{level.questions} Spots</div>
              </div>
              <div className="flex w-full min-w-0 flex-wrap items-center gap-space-xs sm:w-auto sm:justify-end">
                {level.status === 'draft' ? <Button variant="secondary" leftIcon="publish" disabled={busyLevelId !== null || parentGameBlockReason !== null} onClick={() => void handlePublish(level)}>Publish</Button> : null}
                {level.status === 'published' ? <Button variant="ghost" leftIcon="unpublished" disabled={busyLevelId !== null} onClick={() => void handleLevelAction(level.id, unpublishLevel)}>Unpublish</Button> : null}
                {level.status === 'archived' ? <Button variant="secondary" leftIcon="restore" disabled={busyLevelId !== null || parentGameBlockReason !== null} onClick={() => void handleLevelAction(level.id, restoreLevel)}>Restore &amp; publish</Button> : null}
                {level.status !== 'archived' ? <Button variant="tertiary" leftIcon="archive" disabled={busyLevelId !== null} onClick={() => void handleLevelAction(level.id, archiveLevel)}>Archive</Button> : null}
                <Button variant="ghost" leftIcon="edit" disabled={busyLevelId !== null} className="!h-10 !w-10 !rounded-full !px-0 !py-0" onClick={() => openEditModal(level)}>
                  <span className="sr-only">Edit level</span>
                </Button>
                <Button variant="tertiary" leftIcon="delete" disabled={busyLevelId !== null} className="!h-10 !w-10 !rounded-full !px-0 !py-0" onClick={() => setDeleteId(level.id)}>
                  <span className="sr-only">Delete level</span>
                </Button>
                {busyLevelId === level.id ? <span role="status" className="text-body-sm text-on-surface-variant">Saving...</span> : null}
              </div>
            </div>
          </div>
        ))}
        {!isLoading && levels.length > 0 && visibleLevels.length === 0 ? (
          <p className="rounded-lg bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant">No levels match this difficulty.</p>
        ) : null}
      </section>

      {!isLoading && visibleLevels.length > 0 ? (
        <section className="flex flex-col items-center justify-between gap-space-md rounded-lg bg-surface-container-lowest px-space-lg py-space-md shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08)] sm:flex-row">
          <p className="text-body-sm text-on-surface-variant">Page {currentPage} of {pageCount} · {visibleLevels.length} levels in current filter</p>
          <nav aria-label="Level pagination" className="flex items-center gap-space-xs">
            <button type="button" onClick={() => setPage(Math.max(1, currentPage - 1))} disabled={currentPage === 1} className="rounded-full bg-surface-container-low px-space-md py-2 text-label-sm text-on-surface-variant disabled:opacity-50">‹‹ Prev</button>
            {pageNumbers.map((pageNumber) => (
              <button key={pageNumber} type="button" aria-current={pageNumber === currentPage ? 'page' : undefined} onClick={() => setPage(pageNumber)} className={`h-9 min-w-9 rounded-full px-space-sm text-label-sm ${pageNumber === currentPage ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low'}`}>
                {pageNumber}
              </button>
            ))}
            <button type="button" onClick={() => setPage(Math.min(pageCount, currentPage + 1))} disabled={currentPage === pageCount} className="rounded-full bg-surface-container-low px-space-md py-2 text-label-sm text-on-surface-variant disabled:opacity-50">Next ››</button>
          </nav>
        </section>
      ) : null}

      <Modal isOpen={isModalOpen} onClose={() => { if (!isSaving) setIsModalOpen(false); }}>
        <div className="space-y-space-lg p-space-xl">
          <div className="text-center">
            <h3 className="text-headline-md text-on-surface">{editingId ? 'Edit level' : 'New level'}</h3>
            <p className="text-body-md text-on-surface-variant">{editingId ? 'Update the level details' : 'Create a new stage for this game'}</p>
          </div>

          <div className="space-y-space-md">
            <div>
              <label className="mb-1.5 block text-label-md text-on-surface">Title</label>
              <Input value={title} onChange={setTitle} disabled={isSaving} placeholder="Level title" />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md text-on-surface">Description</label>
              <textarea value={description} onChange={(event) => setDescription(event.target.value)} disabled={isSaving} rows={3} className="w-full resize-y rounded-lg bg-surface-container-low px-space-md py-3 text-body-md text-on-surface outline-none focus:bg-surface-container-lowest" />
            </div>
            {formError ? <p className="text-body-sm text-error">{formError}</p> : null}
            <div className="grid grid-cols-2 gap-space-md">
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Difficulty</label>
                <select
                  value={difficulty}
                  disabled={isSaving}
                  onChange={(event) => {
                    const nextDifficulty = event.target.value as LevelDifficulty;
                    setDifficulty(nextDifficulty);
                    if (getDurationError(nextDifficulty, time)) setTime(durationRules[nextDifficulty].suggested);
                  }}
                  className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Game</label>
                <select value={gameId} disabled={isSaving || games.length === 0} onChange={(e) => setGameId(e.target.value)} className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none">
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-space-md">
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Time (seconds)</label>
                <Input
                  aria-label="Time limit in seconds"
                  type="number"
                  min={durationRules[difficulty].min}
                  max={durationRules[difficulty].max}
                  step={1}
                  value={String(time)}
                  onChange={(value) => setTime(Number(value) || 0)}
                  disabled={isSaving}
                />
                <p className="mt-1 text-body-sm text-on-surface-variant">{difficulty}: {durationRules[difficulty].range} seconds</p>
              </div>
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Max hints</label>
                <Input value={String(maxHints)} onChange={(value) => setMaxHints(Number(value) || 0)} disabled={isSaving} />
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" disabled={isSaving} onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={isSaving || games.length === 0} onClick={handleSave}>{isSaving ? 'Saving...' : editingId ? 'Save changes' : 'Create level'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <div className="space-y-space-lg p-space-xl">
          <h3 className="text-headline-md text-on-surface">Delete level?</h3>
          <p className="text-body-md text-on-surface-variant">This permanently deletes the level and its spots. Archive is safer for content you may need later.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" disabled={busyLevelId !== null} onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="tertiary" onClick={async () => {
              if (!deleteId || busyLevelId) return;
              const id = deleteId;
              setBusyLevelId(id);
              setRemovingLevelId(id);
              setDeleteId(null);
              setActionError(null);
              try {
                await waitForPopOut();
                await deleteLevel(id);
              } catch (error) {
                setRemovingLevelId(null);
                setActionError(error instanceof Error ? error.message : 'Unable to delete the level.');
              } finally {
                setBusyLevelId(null);
                setRemovingLevelId(null);
              }
            }} disabled={busyLevelId !== null}>{busyLevelId ? 'Deleting...' : 'Delete'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
