import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useAdminData } from '../../context/AdminDataContext';

export default function ManageGames() {
  const { games, addGame, deleteGame, updateGame } = useAdminData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingId(null);
    setName('');
    setDescription('');
    setIsModalOpen(true);
  };

  const openEditModal = (game: { id: string; name: string; description: string }) => {
    setEditingId(game.id);
    setName(game.name);
    setDescription(game.description);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name.trim()) {
      return;
    }

    if (editingId) {
      updateGame(editingId, { name, description });
    } else {
      addGame({ name, description });
    }

    setIsModalOpen(false);
    setName('');
    setDescription('');
    setEditingId(null);
  };

  const stats = useMemo(
    () => ({
      total: games.length,
      levels: games.reduce((sum, game) => sum + game.levels, 0),
      rating: games.reduce((sum, game) => sum + game.rating, 0) / Math.max(games.length, 1),
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
          { label: 'Cozy Rating', value: `${stats.rating.toFixed(1)}%`, icon: 'favorite', tone: 'bg-tertiary-fixed text-tertiary' },
          { label: 'Sync Status', value: 'Up-to-date', icon: 'schedule', tone: 'bg-surface-container-high text-on-surface' },
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

      <section className="space-y-space-lg">
        {games.map((game) => (
          <div key={game.id} className="flex flex-col justify-between gap-space-lg rounded-[28px] bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08),0_2px_6px_0_rgba(43,139,198,0.04)] xl:flex-row xl:items-center">
            <div className="flex flex-1 flex-col gap-space-lg md:flex-row md:items-center">
              <div className="relative h-24 w-24 overflow-hidden rounded-[20px] bg-primary-fixed/40 shadow-[0_4px_12px_rgba(43,139,198,0.12)] sm:h-28 sm:w-28">
                <img src={game.image} alt={game.name} className="h-full w-full object-cover" />
                <div className="absolute left-2 top-2 rounded-full bg-surface/90 px-2 py-0.5 text-label-sm text-on-surface">{game.rating.toFixed(1)}</div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-space-xs">
                  <h2 className="text-headline-sm text-on-surface">{game.name}</h2>
                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm ${game.status === 'Active' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-container text-on-tertiary-container'}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {game.status}
                  </span>
                </div>
                <p className="mt-2 text-body-md text-on-surface-variant">{game.description}</p>
                <div className="mt-3 flex flex-wrap items-center gap-space-xs">
                  <span className="rounded-full bg-secondary-container px-3 py-1 text-label-sm text-on-secondary-container">{game.levels} Levels</span>
                  <span className="rounded-full bg-surface-container-high px-3 py-1 text-label-sm text-on-surface-variant">Created {game.createdAt}</span>
                  <span className="rounded-full bg-primary-fixed-dim/30 px-3 py-1 text-label-sm text-on-primary-fixed">Avg. {game.averageTime}</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-space-sm xl:self-center">
              <Button variant="ghost" leftIcon="edit" onClick={() => openEditModal(game)} className="!px-4 !py-2.5">
                Edit
              </Button>
              <Button variant="tertiary" leftIcon="delete" onClick={() => setDeleteId(game.id)} className="!px-4 !py-2.5">
                Delete
              </Button>
            </div>
          </div>
        ))}
      </section>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-space-lg p-space-xl">
          <div className="text-center">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-primary-container text-3xl shadow-[0_6px_0_#2b8bc6]">🦊</div>
            <h3 className="mt-4 text-headline-md text-on-surface">{editingId ? 'Edit game' : 'New game'}</h3>
            <p className="text-body-md text-on-surface-variant">{editingId ? 'ปรับปรุงข้อมูลเกม' : 'สร้างชุดเกมจับผิดภาพชุดใหม่'}</p>
          </div>

          <div className="space-y-space-md">
            <div>
              <label className="mb-1.5 block text-label-md text-on-surface">Name</label>
              <Input value={name} onChange={setName} placeholder="เช่น Spot & Seek — Garden Whispers" />
            </div>
            <div>
              <label className="mb-1.5 block text-label-md text-on-surface">Description</label>
              <textarea
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                rows={3}
                className="w-full resize-none rounded-[20px] bg-surface-container-low px-5 py-3 text-body-md text-on-surface outline-none transition-all placeholder:text-outline-variant focus:bg-surface-container-lowest focus:shadow-[0_0_0_3px_rgba(124,200,240,0.4)]"
                placeholder="เช่น เกมจับผิดภาพธีมธรรมชาติและการพักผ่อน"
              />
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>{editingId ? 'Save changes' : 'Create game'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <div className="space-y-space-lg p-space-xl">
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-tertiary-fixed text-2xl">🗑️</div>
            <h3 className="mt-4 text-headline-md text-on-surface">Delete game?</h3>
            <p className="text-body-md text-on-surface-variant">This action removes the game and its related levels from the mock dataset.</p>
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="tertiary" onClick={() => {
              if (deleteId) deleteGame(deleteId);
              setDeleteId(null);
            }}>
              Delete
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
