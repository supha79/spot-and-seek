import { useNavigate } from 'react-router-dom';
import { useGameData } from '../../context/GameDataContext';
import { Button } from '../../components/ui/Button';

export default function BuddyPicker() {
  const navigate = useNavigate();
  const { selectedBuddy, setSelectedBuddy, buddyOptions } = useGameData();

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-8">
      <section className="rounded-[28px] bg-surface-container-lowest p-6 text-center shadow-[0_20px_50px_rgba(124,200,240,0.22)]">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-r from-primary-fixed to-secondary-fixed text-primary">
          <span className="material-symbols-outlined text-[30px]">pets</span>
        </div>
        <h1 className="mt-4 text-headline-lg text-on-surface">Pick your buddy</h1>
        <p className="mt-2 text-body-md text-on-surface-variant">เลือกอวาตาร์ที่ชอบ เปลี่ยนภายหลังได้ที่หน้า Profile</p>
      </section>

      {/* Mock state updates immediately; real persistence should wait for Confirm. */}
      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {buddyOptions.map((buddy) => (
          <button
            key={buddy.id}
            type="button"
            onClick={() => setSelectedBuddy(buddy.id)}
            className={`rounded-[24px] border p-4 text-center transition-all ${selectedBuddy === buddy.id ? 'border-primary bg-primary-fixed/40 shadow-[0_8px_24px_rgba(124,200,240,0.35)]' : 'border-transparent bg-surface-container-lowest shadow-[0_8px_24px_rgba(43,139,198,0.08)] hover:border-outline-variant'}`}
          >
            <div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${buddy.accent} text-headline-md text-on-surface`}>
              {buddy.id.slice(0, 1)}
            </div>
            <div className="mt-3 text-label-md text-on-surface">{buddy.name}</div>
          </button>
        ))}
      </section>

      <div className="flex justify-center gap-3">
        <Button variant="ghost" onClick={() => navigate('/dashboard/home')}>Back</Button>
        <Button variant="primary" disabled={!selectedBuddy} onClick={() => navigate('/dashboard/home')}>Confirm</Button>
      </div>
    </div>
  );
}
