import { Link } from 'react-router-dom';
import Button from '../../components/ui/Button';
import { useAdminData } from '../../context/AdminDataContext';

export default function Questions() {
  const { questions, deleteQuestion } = useAdminData();

  return (
    <div className="space-y-space-xl">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-space-md">
            <h1 className="text-headline-lg text-on-surface">Questions</h1>
            <span className="rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed">Total {questions.length} questions · ทั้งหมด {questions.length} ข้อ</span>
          </div>
          <p className="mt-2 text-body-md text-on-surface-variant">จัดการจุดจับผิดภาพและเฉลยในแต่ละด่าน</p>
        </div>

        <Link to="/admin/questions/new">
          <Button variant="primary" leftIcon="add_circle">+ New question</Button>
        </Link>
      </div>

      <div className="rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_-4px_rgba(0,102,136,0.06)]">
        <div className="flex flex-col gap-space-md lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-col gap-space-md sm:flex-row sm:items-center">
            <div className="relative min-w-[260px]">
              <select defaultValue="all" className="w-full appearance-none rounded-full bg-surface-container-low px-4 py-3 pr-10 text-label-md text-on-surface outline-none">
                <option value="all">All Levels (ด่านทั้งหมด)</option>
                <option value="cat">Level 1 — Cozy Cat Corner (Easy)</option>
              </select>
            </div>
            <input placeholder="ค้นหาชื่อภาพ หรือจุดต่าง เช่น 'cat bowl', 'pillow'..." className="w-full rounded-full bg-surface-container-low px-4 py-2.5 text-body-md text-on-surface outline-none placeholder:text-on-surface-variant/60 lg:min-w-[280px]" />
          </div>
          <div className="flex items-center gap-space-sm">
            <span className="rounded-full bg-surface-container-high px-4 py-2 text-label-sm text-on-surface-variant">Showing {questions.length} of {questions.length} puzzle pairs</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-lg md:grid-cols-2 xl:grid-cols-3">
        {questions.map((question) => (
          <div key={question.id} className="rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_-4px_rgba(0,102,136,0.08)]">
            <div className="flex items-start justify-between gap-space-sm">
              <div>
                <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-label-sm ${question.difficulty === 'Easy' ? 'bg-secondary-fixed text-on-secondary-fixed' : question.difficulty === 'Medium' ? 'bg-primary-fixed text-on-primary-fixed-variant' : 'bg-tertiary-fixed text-on-tertiary-fixed'}`}>
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                  {question.difficulty} · {question.levelName}
                </span>
                <h2 className="mt-2 text-headline-sm text-on-surface">{question.title}</h2>
              </div>

              <div className="flex items-center gap-1.5">
                <Link to={`/admin/questions/${question.id}/edit`}>
                  <button type="button" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary-fixed text-primary shadow-[0_2px_0_#84d0f8]">
                    <span className="material-symbols-outlined text-[18px]">edit</span>
                  </button>
                </Link>
                <button type="button" onClick={() => deleteQuestion(question.id)} className="flex h-9 w-9 items-center justify-center rounded-full bg-tertiary-fixed text-tertiary shadow-[0_2px_0_#f2b6c8]">
                  <span className="material-symbols-outlined text-[18px]">delete</span>
                </button>
              </div>
            </div>

            <div className="mt-space-md rounded-lg bg-surface-container-low p-space-sm">
              <div className="grid grid-cols-2 gap-2">
                <div className="relative overflow-hidden rounded-lg bg-surface-container">
                  <img src={question.imageA} alt={question.title} className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-surface/90 px-2 py-0.5 text-label-sm text-on-surface">Original</span>
                </div>
                <div className="relative overflow-hidden rounded-lg bg-surface-container">
                  <img src={question.imageB} alt={`${question.title} difference`} className="aspect-square w-full object-cover" />
                  <span className="absolute bottom-1.5 left-1.5 rounded-full bg-surface/90 px-2 py-0.5 text-label-sm text-on-surface">Difference</span>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between px-1 text-label-sm text-on-surface-variant">
                <span className="flex items-center gap-1 text-secondary"><span className="material-symbols-outlined text-[16px]">check_circle</span>{question.note}</span>
                <span className="text-on-surface-variant/60">Tap to inspect</span>
              </div>
            </div>

            <div className="mt-space-md flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-primary-fixed/60 px-2.5 py-1 text-label-sm text-on-primary-fixed-variant">{question.differences} differences</span>
                <span className="rounded-full bg-secondary-fixed/50 px-2.5 py-1 text-label-sm text-secondary">{question.active ? 'Active' : 'Offline'}</span>
              </div>
              <span className="text-body-sm text-on-surface-variant/70">{question.createdAt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
