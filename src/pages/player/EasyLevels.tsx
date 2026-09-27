import { Link } from 'react-router-dom';
import Card from '../../components/ui/Card';
import { levelCatalog } from '../../context/GameDataContext';

export default function EasyLevels() {
  const easyLevels = levelCatalog.filter((level) => level.difficulty === 'easy');

  return (
    <div className="space-y-8 pb-12">
      <section className="rounded-[28px] bg-surface-container-lowest p-5 shadow-[0_8px_30px_rgba(43,139,198,0.07)] md:p-7">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-fixed to-secondary-fixed shadow-[0_6px_0_#2B8BC6]">
              <span className="material-symbols-outlined text-[30px] text-primary">search</span>
            </div>
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-secondary-container px-3 py-1 text-label-sm text-on-secondary-container">Casual Relax</div>
              <h1 className="mt-2 text-headline-lg text-on-surface">Easy Levels</h1>
              <p className="text-body-md text-on-surface-variant">ค้นหาจุดต่างแบบสบายตา ผ่อนคลาย ไม่มีเวลากดดัน</p>
            </div>
          </div>

          <div className="rounded-full bg-surface-container-low px-5 py-2 text-label-md text-on-surface-variant">
            Easy Mode Cleared: 2 / 3 Levels
          </div>
        </div>
      </section>

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {easyLevels.map((level, index) => (
          <Card key={level.id} className="overflow-hidden p-4">
            <div className="space-y-4">
              <div className="relative overflow-hidden rounded-xl">
                <img src={level.image} alt={level.title} className="h-64 w-full object-cover" />
                <div className="absolute left-3 top-3 rounded-full bg-surface-container-lowest/95 px-3 py-1 text-label-sm text-on-surface shadow-sm">Level {index + 1}</div>
                {level.cleared ? (
                  <div className="absolute right-3 top-3 rounded-full bg-secondary-container px-2 py-1 text-label-sm text-on-secondary-container">Cleared</div>
                ) : (
                  <div className="absolute right-3 top-3 rounded-full bg-primary-container px-2 py-1 text-label-sm text-on-primary-container">New</div>
                )}
              </div>

              <div className="space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-headline-sm text-on-surface">{level.title}</h2>
                    <p className="text-body-sm text-on-surface-variant">{level.subtitle}</p>
                  </div>
                  <div className="flex gap-1 rounded-full bg-surface-container-low px-2 py-1">
                    {Array.from({ length: 3 }).map((_, starIndex) => (
                      <span
                        key={starIndex}
                        className={`material-symbols-outlined text-[18px] ${starIndex < level.stars ? 'text-amber-500' : 'text-outline-variant'}`}
                        style={{ fontVariationSettings: 'FILL 1' }}
                      >
                        star
                      </span>
                    ))}
                  </div>
                </div>

                <div className="rounded-full bg-surface-container-low px-3 py-2 text-label-sm text-on-surface-variant">
                  Best Record: <span className="font-bold text-on-surface">{level.bestScore || '—'} pts</span>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-secondary-fixed/30 px-2 py-1 text-label-sm text-on-secondary-fixed-variant">{level.differences} differences</span>
                  <span className="rounded-full bg-surface-container px-2 py-1 text-label-sm text-on-surface-variant">{level.time} sec</span>
                </div>
              </div>

              <Link to={`/dashboard/play/${level.id}`} className="block">
                <button type="button" className="flex w-full items-center justify-center gap-2 rounded-full bg-secondary-container px-4 py-3 text-label-lg text-on-secondary-container shadow-[0_6px_0_#2BA678] transition-all active:translate-y-1 active:shadow-[0_2px_0_#2BA678]">
                  <span className="material-symbols-outlined text-[20px]">replay</span>
                  <span>{level.cleared ? 'Play again' : 'Play level'}</span>
                </button>
              </Link>
            </div>
          </Card>
        ))}
      </section>
    </div>
  );
}
