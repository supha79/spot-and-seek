import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Card from '../../components/ui/Card';
import PlaceholderIllustration from '../../components/ui/PlaceholderIllustration';
import { useGameData } from '../../context/GameDataContext';

export default function Home() {
  const { profile, history } = useGameData();

  return (
    <div className="space-y-8 pb-6">
      <section className="flex flex-col gap-5 rounded-[32px] bg-gradient-to-br from-[#ebf7fd] via-[#f3faff] to-[#e7f3ff] p-5 shadow-[0_12px_32px_-6px_rgba(43,139,198,0.18)] md:p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/60 shadow-[0_8px_20px_rgba(43,139,198,0.15)]">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-primary-container to-primary-fixed">
                <div className="flex h-10 w-10 flex-col items-center justify-center rounded-full bg-white">
                  <div className="flex gap-2">
                    <span className="h-2.5 w-2.5 rounded-full bg-[#23414F]" />
                    <span className="h-2.5 w-2.5 rounded-full bg-[#23414F]" />
                  </div>
                  <div className="mt-1 h-1.5 w-6 rounded-b-full border-b-2 border-[#23414F]" />
                </div>
              </div>
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-display-hero-mobile text-on-primary-container">สวัสดี {profile.displayName}</h1>
                <span className="rounded-full bg-primary-fixed px-2 py-1 text-label-sm text-on-primary-fixed-variant">พร้อมเล่น</span>
              </div>
              <p className="mt-2 max-w-xl text-body-md text-on-surface-variant">
                วันนี้พร้อมหาจุดต่างหรือยัง? มีมุมอบอุ่นรอให้ค้นพบอีกเพียบเลยนะ ✨
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 shadow-[0_4px_16px_rgba(43,139,198,0.08)]">
            <span className="material-symbols-outlined text-secondary">wb_sunny</span>
            <div className="text-left">
              <div className="text-label-sm text-secondary">โหมดผ่อนคลาย</div>
              <div className="text-body-sm text-on-surface-variant">ไม่มีจำกัดเวลา</div>
            </div>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="overflow-hidden rounded-[24px] border border-white/40 bg-surface-container-lowest/70 p-3 shadow-[0_20px_40px_rgba(43,139,198,0.08)]">
            <div className="relative overflow-hidden rounded-[20px]">
              <PlaceholderIllustration className="h-[240px] w-full md:h-[280px]" label="greenhouse" />
              <div className="absolute left-3 top-3 rounded-full bg-surface-container-lowest/90 px-3 py-1 text-label-sm text-on-primary-container shadow-sm">ค้นพบแล้ว 2/5</div>
            </div>
          </div>

          <div className="flex flex-col justify-between rounded-[28px] bg-surface-container-lowest/70 p-5 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full bg-primary-fixed px-3 py-1 text-label-sm text-on-primary-fixed-variant">
                <span className="material-symbols-outlined text-[16px]">palette</span>
                Medium
              </span>

              <div>
                <h2 className="text-headline-lg text-on-primary-container">Level 3 — Greenhouse Garden</h2>
                <p className="mt-2 text-body-md text-on-surface-variant">
                  เล่นค้างไว้ล่าสุด มาหาจุดต่างต่อกันเลย! ใบไม้ระเบียงและกระถางต้นกระบองเพชรกำลังรอให้คุณค้นหาด้วยสายตาเฉียบแหลม
                </p>
              </div>
            </div>

            <div className="mt-5 flex flex-wrap gap-2">
              <span className="rounded-full bg-surface-container px-3 py-1 text-label-sm text-on-surface">5 differences</span>
              <span className="rounded-full bg-surface-container px-3 py-1 text-label-sm text-on-surface">90 sec</span>
              <span className="rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">Cozy Vibe</span>
            </div>

            <div className="mt-5">
              <Link to="/dashboard/play/medium">
                <Button variant="primary" size="lg" leftIcon="play_circle" className="w-full justify-center">
                  Play now
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          { title: 'Levels Completed', value: '4', suffix: '/ 9', icon: 'checklist', tone: 'secondary' },
          { title: 'Best Score', value: '2,450', suffix: '', icon: 'star', tone: 'tertiary' },
          { title: 'Total Plays', value: '12', suffix: 'รอบ', icon: 'videogame_asset', tone: 'primary' },
          { title: 'Avg. Time', value: '48', suffix: 'วินาที', icon: 'timer', tone: 'secondary' },
        ].map((stat) => (
          <Card key={stat.title} className="p-5">
            <div className="flex items-center justify-between">
              <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${stat.tone === 'secondary' ? 'bg-secondary-fixed text-on-secondary-fixed' : stat.tone === 'tertiary' ? 'bg-tertiary-fixed text-on-tertiary-fixed' : stat.tone === 'primary' ? 'bg-primary-fixed text-on-primary-fixed' : 'bg-secondary-container text-on-secondary-container'}`}>
                <span className="material-symbols-outlined text-[26px]">{stat.icon}</span>
              </div>
              <span className="text-label-sm text-secondary uppercase">{stat.title === 'Levels Completed' ? 'Progress' : stat.title === 'Best Score' ? 'Top' : stat.title === 'Total Plays' ? 'Games' : 'Time'}</span>
            </div>

            <div className="mt-4">
              <div className="text-label-md text-on-surface-variant">{stat.title}</div>
              <div className="mt-1 flex items-baseline gap-1">
                <span className="text-headline-lg text-on-surface">{stat.value}</span>
                {stat.suffix ? <span className="text-headline-sm text-outline">{stat.suffix}</span> : null}
              </div>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-4">
        <div className="rounded-[28px] border border-outline-variant/60 bg-surface-container-lowest p-4 shadow-[0_12px_28px_rgba(43,139,198,0.08)]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
                <span className="material-symbols-outlined text-[20px]">help_center</span>
              </div>
              <div>
                <h3 className="text-headline-md text-on-surface">Need a quick refresher?</h3>
                <p className="text-body-sm text-on-surface-variant">Learn the basics before your next cozy spotting round.</p>
              </div>
            </div>
            <Link to="/dashboard/how-to-play">
              <Button variant="ghost" size="md" leftIcon="school" className="justify-center">
                How to Play
              </Button>
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-container text-on-primary-container">
              <span className="material-symbols-outlined text-[20px]">history_edu</span>
            </div>
            <h3 className="text-headline-md text-on-surface">Recent plays</h3>
          </div>
          <Link to="/dashboard/history" className="text-label-md text-primary">View all →</Link>
        </div>

        <div className="grid gap-4 lg:grid-cols-3">
          {history.slice(0, 3).map((entry) => (
            <Card key={entry.id} className="p-4">
              <div className="flex items-center justify-between">
                <span className="text-label-sm text-primary">{entry.difficulty}</span>
                <span className={`rounded-full px-2 py-1 text-label-sm ${entry.status === 'Cleared' ? 'bg-secondary-container text-on-secondary-container' : 'bg-primary-fixed text-on-primary-fixed'}`}>{entry.status}</span>
              </div>
              <h4 className="mt-3 text-headline-sm text-on-surface">{entry.title}</h4>
              <p className="mt-1 text-body-sm text-on-surface-variant">{entry.date}</p>
              <div className="mt-4 flex items-center justify-between border-t border-outline-variant/70 pt-3">
                <span className="text-body-sm text-on-surface-variant">Score</span>
                <span className="text-label-lg text-on-surface">{entry.score}</span>
              </div>
            </Card>
          ))}
        </div>
      </section>
    </div>
  );
}
