import { useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import Modal from '../../components/ui/Modal';
import { useAdminData } from '../../context/AdminDataContext';

export default function ManageLevels() {
  const { levels, games, addLevel, deleteLevel, updateLevel } = useAdminData();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [difficulty, setDifficulty] = useState<'Easy' | 'Medium' | 'Hard'>('Easy');
  const [time, setTime] = useState(120);
  const [questions, setQuestions] = useState(3);
  const [active, setActive] = useState(true);
  const [gameId, setGameId] = useState(games[0]?.id ?? 'game-1');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNewModal = () => {
    setEditingId(null);
    setTitle('');
    setDifficulty('Easy');
    setTime(120);
    setQuestions(3);
    setActive(true);
    setGameId(games[0]?.id ?? 'game-1');
    setIsModalOpen(true);
  };

  const openEditModal = (level: (typeof levels)[number]) => {
    setEditingId(level.id);
    setTitle(level.title);
    setDifficulty(level.difficulty);
    setTime(level.time);
    setQuestions(level.questions);
    setActive(level.active);
    setGameId(level.gameId);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!title.trim()) return;

    const payload = {
      title: title.trim(),
      difficulty,
      emoji: title.startsWith('Cozy') ? '🐱' : title.startsWith('Balloon') ? '🎈' : title.startsWith('Sunny') ? '🧺' : title.startsWith('Breezy') ? '🌾' : '🌙',
      time,
      questions,
      active,
      gameId,
    };

    if (editingId) {
      updateLevel(editingId, payload);
    } else {
      addLevel(payload);
    }

    setIsModalOpen(false);
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

      <div className="rounded-lg bg-surface-container-lowest p-space-md shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08)]">
        <div className="flex flex-wrap items-center justify-between gap-space-md">
          <div className="flex flex-wrap items-center gap-space-md">
            <div className="rounded-full bg-surface-container-low px-space-md py-2.5 text-label-md text-on-surface">{games[0]?.name ?? 'Spot & Seek — Find the Differences'}</div>
            <div className="flex items-center gap-space-xs rounded-full bg-surface-container-low p-1.5">
              {['All', 'Easy', 'Medium', 'Hard'].map((item) => (
                <button key={item} type="button" className={`rounded-full px-space-md py-1.5 text-label-md ${item === 'All' ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant'}`}>
                  {item} {item === 'All' ? `(${levels.length})` : `(${levels.filter((level) => level.difficulty === item).length})`}
                </button>
              ))}
            </div>
          </div>
          <div className="rounded-full bg-surface-container px-4 py-2 text-label-sm text-on-surface-variant">{levels.length} Levels total · ทั้งหมด {levels.length} ด่าน</div>
        </div>
      </div>

      <section className="space-y-space-md">
        {levels.map((level) => (
          <div key={level.id} className="flex flex-col justify-between gap-space-md rounded-lg bg-surface-container-lowest p-space-md shadow-[0_8px_24px_-4px_rgba(43,139,198,0.08),0_2px_6px_0_rgba(43,139,198,0.04)] md:flex-row md:items-center">
            <div className="flex min-w-0 items-center gap-space-md">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-fixed text-[26px] shadow-[0_4px_0_#2b8bc6]">{level.emoji}</div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-3 py-0.5 text-label-sm ${level.difficulty === 'Easy' ? 'bg-secondary-fixed text-on-secondary-fixed' : level.difficulty === 'Medium' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                    {level.difficulty}
                  </span>
                  <span className="rounded-full bg-surface-container px-2.5 py-0.5 text-label-sm text-on-surface">{level.title}</span>
                  {level.active ? <span className="rounded-full bg-secondary-container px-2.5 py-0.5 text-label-sm text-secondary">Active</span> : null}
                </div>
                <h3 className="mt-2 text-headline-sm text-on-surface">{level.title}</h3>
              </div>
            </div>

            <div className="flex items-center justify-between gap-space-lg md:justify-end">
              <div className="flex items-center gap-space-md">
                <div className="rounded-full bg-surface-container-low px-space-md py-1.5 text-label-md text-on-surface-variant">{level.time}s</div>
                <div className="rounded-full bg-surface-container-low px-space-md py-1.5 text-label-md text-on-surface-variant">{level.questions} Questions</div>
              </div>
              <div className="flex items-center gap-space-xs">
                <Button variant="ghost" leftIcon="edit" className="!h-10 !w-10 !rounded-full !px-0 !py-0" onClick={() => openEditModal(level)}>
                  <span className="sr-only">Edit level</span>
                </Button>
                <Button variant="tertiary" leftIcon="delete" className="!h-10 !w-10 !rounded-full !px-0 !py-0" onClick={() => setDeleteId(level.id)}>
                  <span className="sr-only">Delete level</span>
                </Button>
              </div>
            </div>
          </div>
        ))}
      </section>

      <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)}>
        <div className="space-y-space-lg p-space-xl">
          <div className="text-center">
            <h3 className="text-headline-md text-on-surface">{editingId ? 'Edit level' : 'New level'}</h3>
            <p className="text-body-md text-on-surface-variant">{editingId ? 'Update the level details' : 'Create a new stage for this game'}</p>
          </div>

          <div className="space-y-space-md">
            <div>
              <label className="mb-1.5 block text-label-md text-on-surface">Title</label>
              <Input value={title} onChange={setTitle} placeholder="Level title" />
            </div>
            <div className="grid grid-cols-2 gap-space-md">
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Difficulty</label>
                <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')} className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none">
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Game</label>
                <select value={gameId} onChange={(e) => setGameId(e.target.value)} className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none">
                  {games.map((game) => (
                    <option key={game.id} value={game.id}>{game.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-space-md">
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Time</label>
                <Input value={String(time)} onChange={(value) => setTime(Number(value) || 0)} />
              </div>
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Questions</label>
                <Input value={String(questions)} onChange={(value) => setQuestions(Number(value) || 0)} />
              </div>
              <div>
                <label className="mb-1.5 block text-label-md text-on-surface">Active</label>
                <button type="button" onClick={() => setActive((v) => !v)} className={`flex h-12 w-full items-center justify-center rounded-full ${active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-low text-on-surface-variant'}`}>
                  {active ? 'Active' : 'Inactive'}
                </button>
              </div>
            </div>
          </div>

          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setIsModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleSave}>{editingId ? 'Save changes' : 'Create level'}</Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={Boolean(deleteId)} onClose={() => setDeleteId(null)}>
        <div className="space-y-space-lg p-space-xl">
          <h3 className="text-headline-md text-on-surface">Delete level?</h3>
          <p className="text-body-md text-on-surface-variant">This removes the stage and its related questions from the admin mock state.</p>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setDeleteId(null)}>Cancel</Button>
            <Button variant="tertiary" onClick={() => {
              if (deleteId) deleteLevel(deleteId);
              setDeleteId(null);
            }}>Delete</Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
