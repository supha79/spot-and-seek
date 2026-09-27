import { Link } from 'react-router-dom';
import { useAdminData } from '../../context/AdminDataContext';

export default function AdminDashboard() {
  const { games, levels, questions } = useAdminData();

  const statCards = [
    { label: 'Users', value: '128', icon: 'groups', tint: 'bg-primary-fixed text-primary' },
    { label: 'Games', value: String(games.length), icon: 'sports_esports', tint: 'bg-secondary-fixed text-secondary' },
    { label: 'Levels', value: String(levels.length), icon: 'layers', tint: 'bg-primary-container text-on-primary-container' },
    { label: 'Questions', value: String(questions.length), icon: 'psychology_alt', tint: 'bg-surface-container-high text-tertiary' },
    { label: 'Total plays', value: '1,024', icon: 'local_fire_department', tint: 'bg-tertiary-fixed text-tertiary' },
  ];

  return (
    <div className="space-y-space-xl">
      <section className="relative flex flex-col gap-6 overflow-hidden rounded-[24px] bg-surface-container-lowest p-6 shadow-[0_12px_32px_-6px_rgba(43,139,198,0.12)] md:flex-row md:items-center md:justify-between">
        <div className="absolute -left-12 -top-12 h-48 w-48 rounded-full bg-primary-fixed/40 blur-2xl" />
        <div className="absolute -bottom-16 right-36 h-56 w-56 rounded-full bg-tertiary-fixed/40 blur-2xl" />

        <div className="relative z-10 flex items-center gap-space-lg">
          <div className="flex h-20 w-20 items-center justify-center rounded-lg bg-surface-container text-3xl shadow-[0_6px_0_#bfc8ce]">🦊</div>
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-space-xs">
              <span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm text-on-secondary-fixed">Spot &amp; Seek Master Hub</span>
              <span className="text-tertiary text-xs">✦</span>
              <span className="text-body-sm text-on-surface-variant">Live Insights</span>
            </div>
            <h1 className="text-headline-lg text-on-surface">Admin Dashboard</h1>
            <p className="text-body-md text-on-surface-variant">
              ภาพรวมข้อมูลของระบบ <span className="text-secondary">· สถานะการทำงานปกติ พร้อมเปิดด่านใหม่</span>
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-space-md">
          <Link to="/admin/questions/new" className="inline-flex items-center gap-2 rounded-full bg-primary-container px-5 py-3 text-label-lg text-on-primary-container shadow-[0_6px_0_#2b8bc6] active:translate-y-1 active:shadow-[0_2px_0_#2b8bc6]">
            <span className="material-symbols-outlined text-[20px]">add_circle</span>
            <span>+ New question</span>
          </Link>
          <Link to="/admin/levels" className="inline-flex items-center gap-2 rounded-full bg-secondary-container px-5 py-3 text-label-lg text-on-secondary-container shadow-[0_6px_0_#2c6956] active:translate-y-1 active:shadow-[0_2px_0_#2c6956]">
            <span className="material-symbols-outlined text-[20px]">add_task</span>
            <span>+ New level</span>
          </Link>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-space-md sm:grid-cols-2 lg:grid-cols-5">
        {statCards.map(({ label, value, icon, tint }) => (
          <div key={label} className="rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_20px_rgba(43,139,198,0.06)]">
            <div className="flex items-center justify-between">
              <span className="text-label-md text-on-surface-variant">{label}</span>
              <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tint}`}>
                <span className="material-symbols-outlined text-[20px]">{icon}</span>
              </div>
            </div>
            <div className="mt-space-md">
              <div className="text-display-hero text-on-surface">{value}</div>
              <p className="mt-1 text-body-sm text-on-surface-variant">
                {label === 'Users' ? 'ผู้เล่นทั้งหมด' : label === 'Games' ? 'เกมที่เปิดใช้งาน' : label === 'Levels' ? 'ด่านทั้งหมด' : label === 'Questions' ? 'จุดต่างทั้งหมด' : 'จำนวนการเล่นรวม'}
              </p>
            </div>
          </div>
        ))}
      </section>

      <section className="grid grid-cols-1 gap-space-lg lg:grid-cols-12">
        <div className="lg:col-span-5 rounded-lg bg-surface-container-lowest p-space-xl shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-headline-md text-on-surface">Plays by difficulty</h3>
              <p className="text-body-sm text-on-surface-variant">สถิติการเล่นตามระดับความยาก</p>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-container text-on-surface-variant">
              <span className="material-symbols-outlined text-[20px]">bar_chart</span>
            </div>
          </div>

          <div className="mt-space-xl space-y-space-lg">
            {[
              { label: 'Easy', count: '580 plays', percentage: '56%', badge: 'bg-secondary-fixed text-on-secondary-fixed', bar: 'bg-secondary-fixed', color: 'text-secondary' },
              { label: 'Medium', count: '312 plays', percentage: '31%', badge: 'bg-primary-fixed text-on-primary-fixed-variant', bar: 'bg-primary-container', color: 'text-primary' },
              { label: 'Hard', count: '132 plays', percentage: '13%', badge: 'bg-tertiary-fixed text-on-tertiary-fixed', bar: 'bg-tertiary-container', color: 'text-tertiary' },
            ].map((row) => (
              <div key={row.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-space-xs">
                    <span className={`h-3 w-3 rounded-full ${row.bar}`} />
                    <span className="text-label-lg text-on-surface">{row.label}</span>
                    <span className={`rounded-full px-2 py-0.5 text-label-sm ${row.badge}`}>{row.label === 'Easy' ? 'ด่านง่าย' : row.label === 'Medium' ? 'ปานกลาง' : 'ท้าทาย'}</span>
                  </div>
                  <span className="text-label-md text-on-surface">{row.count} <span className={`font-bold ${row.color}`}>({row.percentage})</span></span>
                </div>
                <div className="h-5 w-full rounded-full bg-surface-container p-1 shadow-[inset_0_2px_4px_rgba(0,0,0,0.06)]">
                  <div className={`h-full rounded-full ${row.bar}`} style={{ width: row.percentage }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="lg:col-span-7 rounded-lg bg-surface-container-lowest p-space-xl shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-headline-md text-on-surface">Recent plays</h3>
              <p className="text-body-sm text-on-surface-variant">การเล่นล่าสุดของผู้เล่น</p>
            </div>
            <span className="flex items-center gap-1 rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">
              <span className="h-2 w-2 rounded-full bg-secondary animate-pulse" />
              Real-time feed
            </span>
          </div>

          <div className="mt-space-lg space-y-space-sm">
            {[
              ['mint_saki', 'Cozy Cat Corner', 'Easy', '2,100 pts', '2 mins ago', 'bg-secondary-fixed'],
              ['breeze_wow', 'Breezy Windmill Hill', 'Medium', '1,860 pts', '6 mins ago', 'bg-primary-fixed'],
              ['fox_jelly', 'Starlit Night Market', 'Hard', '2,420 pts', '12 mins ago', 'bg-tertiary-fixed'],
              ['petal_nim', 'Balloon Hills', 'Easy', '1,980 pts', '21 mins ago', 'bg-secondary-container'],
            ].map(([user, title, difficulty, points, time, tint], index) => (
              <div key={`${user}-${index}`} className="flex items-center justify-between gap-space-md rounded-DEFAULT bg-surface-container-low p-space-md">
                <div className="flex items-center gap-space-md">
                  <div className={`flex h-10 w-10 items-center justify-center rounded-full ${tint} text-sm`}>
                    {index % 2 === 0 ? '🐱' : index % 3 === 0 ? '🦊' : '🌙'}
                  </div>
                  <div>
                    <div className="text-label-md text-on-surface">{user}</div>
                    <div className="text-body-sm text-on-surface-variant">{title}</div>
                  </div>
                </div>
                <div className="flex items-center gap-space-md">
                  <span className={`rounded-full px-3 py-1 text-label-sm ${difficulty === 'Easy' ? 'bg-secondary-fixed text-on-secondary-fixed' : difficulty === 'Medium' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                    {difficulty}
                  </span>
                  <div className="text-right">
                    <div className="text-label-md text-secondary">{points}</div>
                    <div className="text-body-sm text-outline">{time}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
