import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import { difficultyOptions } from '../../context/GameDataContext';

export default function ChooseDifficulty() {
  return (
    <div className="space-y-8 pb-8">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link to="/dashboard/home" className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-label-md text-on-surface-variant shadow-[0_4px_14px_rgba(43,139,198,0.08)]">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Dashboard
          </Link>

          <div className="inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-label-sm text-on-surface-variant shadow-[0_4px_12px_rgba(43,139,198,0.05)]">
            <span className="material-symbols-outlined text-[18px] text-secondary">lock_open_right</span>
            Play any difficulty anytime
          </div>
        </div>

        <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
          <div>
            <div className="text-label-md text-tertiary">STAGE SELECT</div>
            <h1 className="text-display-hero-mobile text-on-surface">Choose Difficulty</h1>
          </div>

          <div className="hidden items-center gap-3 rounded-full bg-surface-container-lowest px-4 py-2 shadow-[0_4px_16px_rgba(43,139,198,0.06)] lg:flex">
            <span className="rounded-full bg-secondary-fixed/60 px-2 py-1 text-label-sm text-on-secondary-fixed-variant">3 Total Cleared</span>
            <span className="rounded-full bg-tertiary-fixed/60 px-2 py-1 text-label-sm text-on-tertiary-fixed-variant">9 Stars Awaiting</span>
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-3">
        {difficultyOptions.map((mode) => (
          <Card key={mode.id} className={`relative overflow-hidden p-6 ${mode.highlight ? 'ring-2 ring-primary-container' : ''}`}>
            <div className={`absolute -right-12 -top-12 h-32 w-32 rounded-full ${mode.accent === 'secondary' ? 'bg-secondary-container/40' : mode.accent === 'primary' ? 'bg-primary-container/40' : 'bg-tertiary-container/40'} blur-2xl`} />

            <div className="relative space-y-5">
              <div className="flex items-center justify-between">
                <span className={`rounded-full px-3 py-1 text-label-sm ${mode.accent === 'secondary' ? 'bg-secondary-container text-on-secondary-container' : mode.accent === 'primary' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant'}`}>
                  {mode.name.toUpperCase()}
                </span>
                <div className="flex gap-1 text-primary">
                  {Array.from({ length: 3 }).map((_, index) => (
                    <span key={index} className={`material-symbols-outlined text-[18px] ${index < (mode.id === 'easy' ? 1 : mode.id === 'medium' ? 2 : 1) ? 'text-primary' : 'text-outline-variant'}`}>
                      star
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex h-48 items-center justify-center rounded-[24px] bg-gradient-to-b from-surface-container to-surface-container-low">
                <div className="flex h-24 w-24 items-center justify-center rounded-full bg-white/80 shadow-[0_8px_20px_rgba(43,139,198,0.15)]">
                  <span className="material-symbols-outlined text-[48px] text-primary">search</span>
                </div>
              </div>

              <div>
                <h2 className="text-headline-md text-on-surface">{mode.name} Mode</h2>
                <p className="mt-2 text-body-md text-on-surface-variant">{mode.description}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">{mode.differences} differences</span>
                <span className="rounded-full bg-surface-container px-2.5 py-1 text-label-sm text-on-surface-variant">{mode.time} sec</span>
                <span className="rounded-full bg-primary-fixed px-2.5 py-1 text-label-sm text-on-primary-fixed-variant">Relaxed</span>
              </div>

              <div className="rounded-2xl bg-surface-container-low p-3">
                <div className="flex items-center justify-between text-label-sm">
                  <span className="text-on-surface-variant">Stage Progress</span>
                  <span className={`${mode.accent === 'secondary' ? 'text-secondary' : mode.accent === 'primary' ? 'text-primary' : 'text-tertiary'} font-bold`}>2 / 3 Levels</span>
                </div>
                <div className="mt-2 h-3 overflow-hidden rounded-full bg-surface-container-highest p-0.5">
                  <div className={`h-full rounded-full ${mode.accent === 'secondary' ? 'bg-secondary' : mode.accent === 'primary' ? 'bg-primary' : 'bg-tertiary'}`} style={{ width: mode.id === 'easy' ? '66%' : mode.id === 'medium' ? '33%' : '12%' }} />
                </div>
              </div>

              <Link to={mode.id === 'easy' ? '/dashboard/easy-levels' : `/dashboard/play/${mode.id}`}>
                <Button variant={mode.accent === 'secondary' ? 'secondary' : mode.accent === 'primary' ? 'primary' : 'tertiary'} size="lg" className="w-full justify-center">
                  Select {mode.name} Mode
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
