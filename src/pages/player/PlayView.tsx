import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button } from '../../components/ui/Button';
import { difficultyOptions, levelCatalog } from '../../context/GameDataContext';
import GamePlay from '../game/GamePlay';

export default function PlayView() {
  const navigate = useNavigate();
  const { routeParam: difficulty = 'easy' } = useParams();
  const selectedOption = difficultyOptions.find((option) => option.id === difficulty) ?? difficultyOptions[0];
  const isLevelRoute = !difficultyOptions.some((option) => option.id === difficulty) && levelCatalog.some((level) => level.id === difficulty);
  const firstLevel = levelCatalog.find((level) => level.difficulty === selectedOption.id) ?? levelCatalog[0];

  if (isLevelRoute) {
    return <GamePlay />;
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <section className="rounded-[28px] bg-surface-container-lowest p-5 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Link to="/dashboard/play" className="inline-flex items-center gap-2 rounded-full bg-surface-container px-4 py-2 text-label-md text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px]">arrow_back</span>
            Choose Difficulty
          </Link>

          <div className="flex flex-wrap gap-2">
            {difficultyOptions.map((option) => (
              <Link
                key={option.id}
                to={`/dashboard/play/${option.id}`}
                className={`rounded-full px-4 py-2 text-label-md ${selectedOption.id === option.id ? (option.id === 'easy' ? 'bg-secondary-container text-on-secondary-container' : option.id === 'medium' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed-variant') : 'bg-surface-container text-on-surface-variant'}`}
              >
                {option.name}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] bg-surface-container-lowest p-6 shadow-[0_12px_32px_rgba(43,139,198,0.08)] md:p-8">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed text-primary">
            <span className="material-symbols-outlined text-[36px]">search</span>
          </div>
          <div>
            <div className="text-label-md text-primary">{selectedOption.name.toUpperCase()} MODE</div>
            <h1 className="mt-2 text-headline-lg text-on-surface">{selectedOption.name} play session</h1>
            <p className="mt-2 text-body-md text-on-surface-variant">{selectedOption.description}</p>
          </div>
        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-3">
          <div className="rounded-2xl bg-surface-container-low p-4 text-center">
            <div className="text-label-sm text-on-surface-variant">Differences</div>
            <div className="mt-2 text-headline-md text-on-surface">{selectedOption.differences}</div>
          </div>
          <div className="rounded-2xl bg-surface-container-low p-4 text-center">
            <div className="text-label-sm text-on-surface-variant">Time</div>
            <div className="mt-2 text-headline-md text-on-surface">{selectedOption.time}s</div>
          </div>
          <div className="rounded-2xl bg-surface-container-low p-4 text-center">
            <div className="text-label-sm text-on-surface-variant">Best score</div>
            <div className="mt-2 text-headline-md text-on-surface">{selectedOption.id === 'easy' ? '2450' : selectedOption.id === 'medium' ? '1820' : '0'}</div>
          </div>
        </div>

        <div className="mt-8 rounded-[28px] bg-gradient-to-br from-primary-fixed/30 via-surface-container-low to-secondary-fixed/30 p-5">
          <div className="flex min-h-[260px] items-center justify-center rounded-[22px] border border-dashed border-primary/50 bg-surface-container-lowest/70 text-center">
            <div>
              <div className="text-headline-md text-on-surface">Mock stage preview</div>
              <p className="mt-2 text-body-md text-on-surface-variant">// TODO: connect to backend</p>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Button variant={selectedOption.id === 'easy' ? 'secondary' : selectedOption.id === 'medium' ? 'primary' : 'tertiary'} size="lg" leftIcon="play_circle" className="justify-center" onClick={() => navigate(`/dashboard/play/${firstLevel.id}`)}>
            Start session
          </Button>
          <Link to="/dashboard/play">
            <Button variant="ghost" size="lg" leftIcon="arrow_back" className="justify-center">
              Back to modes
            </Button>
          </Link>
        </div>
      </section>
    </div>
  );
}
