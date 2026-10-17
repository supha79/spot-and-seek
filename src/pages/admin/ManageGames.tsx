import { useMemo, useState } from 'react';
import { BrandMascot } from '../../components/ui/BrandMascot';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useAdminData } from '../../context/AdminDataContext';
import { waitForPopOut } from '../../utils/motion';
import DynamicGameplayGateManager from '../../components/admin/DynamicGameplayGateManager';
import ScorePolicyManager from './ScorePolicyManager';

export default function ManageGames() {
  const {
    games,
    addGame,
    deleteGame,
    updateGame,
    publishGame,
    unpublishGame,
    archiveGame,
    refreshCatalog,
    isLoading,
    error,
  } = useAdminData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [busyGameId, setBusyGameId] = useState<string | null>(null);
  const [removingGameId, setRemovingGameId] = useState<string | null>(null);

  const openNewModal = () => {
    setFormError(null);
    setEditingId(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (game: { id: string; name: string; description: string }) => {
    setFormError(null);
    setEditingId(game.id);
    setName(game.name);
    setDescription(game.description);
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (isSaving) return;
    if (!name.trim()) {
      setFormError('Game name is required.');
      return;
    }

    setIsSaving(true);
    setFormError(null);
    try {
      if (editingId) {
        await updateGame(editingId, { name, description });
      } else {
        await addGame({ name, description });
      }

      setIsModalOpen(false);
      setName('');
      setDescription('');
      setEditingId(null);
      setFormError(null);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the game.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGameAction = async (id: string, action: (gameId: string) => Promise<void>) => {
    if (busyGameId) return;
    setBusyGameId(id);
    setActionError(null);
    try {
      await action(id);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Unable to update the game.');
    } finally {
      setBusyGameId(null);
    }
  };

  const stats = useMemo(
    () => ({
      total: games.length,
      levels: games.reduce((sum, game) => sum + game.levels, 0),
      published: games.filter((game) => game.status === 'published').length,
    }),
    [games],
  );

  return (
    <div className="space-y-space-xl">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-space-sm">
            <h1 className="text-headline-lg text-on-surface">Games</h1>
            <span className="rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">Seeky Verified</span>
          </div>
          <p className="text-body-md text-on-surface-variant">จัดการชุดเกมและเนื้อหาทั้งหมดในระบบ</p>
        </div>

        <Button variant="primary" leftIcon="add_circle" onClick={openNewModal}>
          + New game
        </Button>
      </div>

      <section className="grid grid-cols-2 gap-space-md md:grid-cols-4">
        {[
          { label: 'Total Games', value: `${stats.total} Sets`, icon: 'sports_esports', tone: 'bg-primary-fixed text-primary' },
          { label: 'Total Levels', value: `${stats.levels} Levels`, icon: 'layers', tone: 'bg-secondary-container text-secondary' },
          { label: 'Published Games', value: String(stats.published), icon: 'publish', tone: 'bg-tertiary-fixed text-tertiary' },
          { label: 'Sync Status', value: isLoading ? 'Loading' : error ? 'Error' : 'Up-to-date', icon: 'schedule', tone: 'bg-surface-container-high text-on-surface' },
        ].map(({ label, value, icon, tone }) => (
          <div key={label} className="flex items-center gap-space-md rounded-lg bg-surface-container-lowest p-space-md shadow-[0_8px_20px_-4px_rgba(43,139,198,0.06)]">
            <div className={`flex h-12 w-12 items-center justify-center rounded-full ${tone}`}>
              <span className="material-symbols-outlined text-[24px]">{icon}</span>
            </div>
            <div>
              <div className="text-label-sm text-on-surface-variant uppercase tracking-wider">{label}</div>
              <div className="text-headline-md text-on-surface">{value}</div>
            </div>
          </div>
        ))}
      </section>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-space-md rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">
          <span>{error.startsWith('Saved successfully, but the catalog could not be refreshed:')
            ? error
            : `Unable to load or update games: ${error}`}</span>
          <Button variant="ghost" leftIcon="refresh" disabled={isLoading} onClick={() => void refreshCatalog().catch(() => undefined)}>Retry</Button>
        </div>
      ) : null}
      {actionError ? <div role="alert" className="rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">{actionError}</div> : null}
      <section className="space-y-space-lg">
        {isLoading ? <p role="status" className="py-space-lg text-center text-body-md text-on-surface-variant">Loading games...</p> : null}
        {!isLoading && games.length === 0 && !error ? <p className="rounded-lg bg-surface-container-lowest p-space-xl text-center text-body-md text-on-surface-variant">No games yet. Create a game to get started.</p> : null}
        {!isLoading && games.map((game) => (
          <div key={game.id} className={`flex flex-col justify-between gap-space-lg rounded-[28px] bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08),0_2px_6px_0_rgba(43,139,198,0.04)] xl:flex-row xl:items-center ${removingGameId === game.id ? 'ui-pop-out' : ''}`}>
            <div className="flex flex-1 flex-col gap-space-lg md:flex-row md:items-center">
              <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-[20px] bg-primary-fixed/40 text-primary shadow-[0_4px_12px_rgba(43,139,198,0.12)] sm:h-28 sm:w-28">
                <span className="material-symbols-outlined text-[36px]" aria-hidden="true">sports_esports</span>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-space-xs">
                  <h2 className="text-headline-sm text-on-surface">{game.name}</h2>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm ${game.status === 'published' ? 'bg-secondary-container text-on-secondary-container' : game.status === 'archived' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : 'bg-surface-container-high text-on-surface-variant'}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {game.status}
                  </span>
                </div>
                <p className="mt-2 text-body-md text-on-surface-variant">{game.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-space-xs">
                  <span className="rounded-full bg-secondary-container px-3 py-1 text-label-sm text-on-secondary-container">{game.levels} Levels</span>
                  <span className="rounded-full bg-surface-container-high px-3 py-1 text-label-sm text-on-surface-variant">Created {game.createdAt}</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-space-sm xl:max-w-[360px] xl:justify-end xl:self-center">
              <Button variant="ghost" leftIcon="edit" disabled={busyGameId !== null} onClick={() => openEditModal(game)} className="!px-4 !py-2.5">
                Edit
              </Button>
              {game.status === 'draft' ? <Button variant="secondary" leftIcon="publish" disabled={busyGameId !== null} onClick={() => void handleGameAction(game.id, publishGame)}>Publish</Button> : null}
              {game.status === 'published' ? <Button variant="ghost" leftIcon="unpublished" disabled={busyGameId !== null} onClick={() => void handleGameAction(game.id, unpublishGame)}>Unpublish</Button> : null}
              {game.status !== 'archived' ? <Button variant="tertiary" leftIcon="archive" disabled={busyGameId !== null} onClick={() => void handleGameAction(game.id, archiveGame)}>Archive</Button> : null}
              {game.status !== 'archived' ? <Button variant="tertiary" leftIcon="delete" disabled={busyGameId !== null} onClick={() => setDeleteId(game.id)} className="!px-4 !py-2.5">Delete</Button> : null}
              {busyGameId === game.id ? <span role="status" className="text-body-sm text-on-surface-variant">Saving...</span> : null}
            </div>
          </div>
        ))}
      </section>

      <ScorePolicyManager />
      <DynamicGameplayGateManager />

      <Modal isOpen={isModalOpen} onClose={() => { if (!isSaving) setIsModalOpen(false); }}>
        <div className="space-y-space-lg p-space-xl">
          <div className="text-center">
            <BrandMascot className="mx-auto h-20 w-20" />
            <h3 className="mt-4 text-headline-md text-on-surface">{editingId ? 'Edit game' : 'New game'}</h3>
            <p className="text-body-md text-on-surface-variant">{editingId ? 'ปรับปรุงข้อมูลเกม' : 'สร้างชุดเกมจับผิดภาพชุดใหม่'}</p>
          </div>

          <div className="space-y-space-md">
            <div>
              <label className="mb-1.5 block text-label-md text-on-surface">Name</label>
              <Input value={name} onChange={setName} disabled={isSaving} placeholder="เช่น Spot & Seek — Garden Whispers" />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md text-on-surface">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                disabled={isSaving}
                rows={3}
                className="w-full resize-none rounded-[20px] bg-surface-container-low px-5 py-3 text-body-md text-on-surface outline-none transition-all placeholder:text-outline-variant focus:bg-surface-container-lowest focus:shadow-[0_0_0_3px_rgba(124,200,240,0.4)]"
                placeholder="เช่น เกมจับผิดภาพธีมธรรมชาติและการพักผ่อน"
              />
            </div>
            {formError ? <p className="text-body-sm text-error">{formError}</p> : null}
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" disabled={isSaving} onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" disabled={isSaving} onClick={handleSave}>{isSaving ? 'Saving...' : editingId ? 'Save changes' : 'Create game'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <div className="space-y-space-lg p-space-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-fixed text-2xl">🗑️</div>
            <h3 className="mt-4 text-headline-md text-on-surface">Delete game?</h3>
            <p className="text-body-md text-on-surface-variant">This permanently deletes the game and related content. Archive is safer for content you may need later.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" disabled={busyGameId !== null} onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="tertiary" onClick={async () => {
              if (!deleteId || busyGameId) return;
              const id = deleteId;
              setBusyGameId(id);
              setRemovingGameId(id);
              setDeleteId(null);
              setActionError(null);
              try {
                await waitForPopOut();
                await deleteGame(id);
              } catch (error) {
                setRemovingGameId(null);
                setActionError(error instanceof Error ? error.message : 'Unable to delete the game.');
              } finally {
                setBusyGameId(null);
                setRemovingGameId(null);
              }
            }} disabled={busyGameId !== null}>
              {busyGameId ? 'Deleting...' : 'Delete'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
