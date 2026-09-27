import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import PlaceholderIllustration from '../../components/ui/PlaceholderIllustration';
import { useAdminData } from '../../context/AdminDataContext';

export default function QuestionEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { questions, addQuestion, updateQuestion, levels } = useAdminData();

  const existingQuestion = useMemo(() => questions.find((question) => question.id === id) ?? null, [id, questions]);

  const [levelId, setLevelId] = useState(existingQuestion?.levelId ?? levels[0]?.id ?? 'level-1');
  const [title, setTitle] = useState(existingQuestion?.title ?? 'Q1: Cozy Cat Nap Spot');
  const [note, setNote] = useState(existingQuestion?.note ?? 'จุดระฆังคอแมวสีทอง');
  const [differences, setDifferences] = useState(existingQuestion?.differences ?? 3);
  const [difficulty, setDifficulty] = useState<('Easy' | 'Medium' | 'Hard')>(existingQuestion?.difficulty ?? 'Easy');
  const [active, setActive] = useState(existingQuestion?.active ?? true);

  const selectedLevel = levels.find((level) => level.id === levelId) ?? levels[0];

  const handleSave = () => {
    const payload = {
      levelId,
      levelName: `${selectedLevel ? `Level ${levels.findIndex((level) => level.id === levelId) + 1} — ${selectedLevel.title}` : 'Level 1 — Cozy Cat Corner'}`,
      difficulty,
      title: title.trim() || 'Untitled question',
      note: note.trim() || 'New item',
      active,
      differences,
      imageA: existingQuestion?.imageA ?? '',
      imageB: existingQuestion?.imageB ?? '',
    };

    if (existingQuestion) {
      updateQuestion(existingQuestion.id, payload);
    } else {
      addQuestion(payload);
    }

    navigate('/admin/questions');
  };

  return (
    <div className="space-y-space-xl">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div>
          <nav className="flex items-center gap-space-xs text-label-md text-on-surface-variant">
            <Link to="/admin/questions" className="flex items-center gap-1">Questions</Link>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="rounded-full bg-primary-fixed px-3 py-0.5 text-primary">{existingQuestion ? 'Edit Question' : 'New Question'}</span>
          </nav>
          <div className="mt-2 flex items-baseline gap-space-sm">
            <h1 className="text-headline-lg text-on-surface">Question Editor</h1>
            <span className="text-[28px]">🎨</span>
          </div>
          <p className="text-body-md text-on-surface-variant">{existingQuestion ? 'แก้ไขข้อสอบที่มีอยู่' : 'สร้างจุดจับผิดภาพใหม่และกำหนดพิกัดความต่าง'}</p>
        </div>

        <div className="rounded-full bg-surface-container-lowest px-space-md py-2.5 shadow-[0_4px_16px_rgba(43,139,198,0.08)]">
          <span className="text-label-md text-on-surface">{selectedLevel ? selectedLevel.title : 'Level 1 — Cozy Cat Corner'}</span>
          <span className="ml-2 rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm text-on-secondary-fixed">{difficulty} · {differences} Diff Req</span>
        </div>
      </div>

      <div className="rounded-lg bg-tertiary-fixed/60 p-space-md shadow-[0_4px_0_#eaafc1]">
        <div className="flex items-start justify-between gap-space-md">
          <div className="flex items-start gap-space-md">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-container-lowest text-tertiary shadow-[0_3px_0_#eaafc1]">
              <span className="material-symbols-outlined text-[24px]">troubleshoot</span>
            </div>
            <div>
              <div className="text-headline-sm text-on-tertiary-container">Easy ต้องมีจุดที่แตกต่าง 3 จุด</div>
              <p className="text-body-sm text-on-tertiary-container/90">กรุณากำหนดตำแหน่งจุดแตกต่างให้ครบ 3 จุดก่อนบันทึกข้อสอบ</p>
            </div>
          </div>
          <Button variant="ghost" className="!rounded-full !bg-surface-container-lowest !text-tertiary">Add Diff #{differences + 1}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-space-lg xl:grid-cols-12">
        <aside className="xl:col-span-3">
          <div className="space-y-space-lg rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
            <div className="flex items-center gap-space-sm">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary-fixed text-primary shadow-[0_2px_0_#84d0f8]">
                <span className="material-symbols-outlined text-[18px]">tune</span>
              </div>
              <h2 className="text-headline-sm text-on-surface">Configuration</h2>
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Assign Level</label>
              <select value={levelId} onChange={(e) => setLevelId(e.target.value)} className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none">
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>{level.title} ({level.difficulty})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Question Title / ชื่อด่าน</label>
              <Input value={title} onChange={setTitle} />
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Hint / note</label>
              <Input value={note} onChange={setNote} placeholder="จุดระฆังคอแมวสีทอง" />
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Difficulty</label>
              <select value={difficulty} onChange={(e) => setDifficulty(e.target.value as 'Easy' | 'Medium' | 'Hard')} className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none">
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Differences</label>
              <Input value={String(differences)} onChange={(value) => setDifferences(Number(value) || 1)} />
            </div>

            <button type="button" onClick={() => setActive((v) => !v)} className={`w-full rounded-full px-4 py-3 text-label-md ${active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-low text-on-surface-variant'}`}>
              {active ? 'Question active' : 'Question inactive'}
            </button>
          </div>
        </aside>

        <section className="xl:col-span-6">
          <div className="rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_12px_32px_rgba(43,139,198,0.08)]">
            <div className="flex items-center justify-between gap-space-sm">
              <div className="inline-flex items-center gap-space-xs rounded-full bg-secondary-fixed/50 px-3.5 py-1.5 text-label-md text-on-secondary-fixed-variant">
                <span className="material-symbols-outlined text-[18px]">drag_pan</span>
                ลากเมาส์บนภาพเพื่อกำหนดพื้นที่จุดแตกต่าง
              </div>
              <div className="flex items-center gap-space-xs">
                <button type="button" className="rounded-full bg-surface-container-low px-3 py-1.5 text-label-sm text-on-surface-variant">100%</button>
                <button type="button" className="rounded-full bg-surface-container-low px-3 py-1.5 text-label-sm text-on-surface-variant">Reset</button>
              </div>
            </div>

            <div className="mt-space-md overflow-hidden rounded-lg bg-surface-container-low p-2 shadow-inner">
              <div className="relative aspect-square overflow-hidden rounded-md">
                {existingQuestion?.imageA ? (
                  <img className="h-full w-full object-cover" src={existingQuestion.imageA} alt="editor preview" />
                ) : (
                  <PlaceholderIllustration className="h-full w-full rounded-md" label="preview" />
                )}
                <div className="absolute left-[38%] top-[56%] flex h-[15%] w-[15%] flex-col justify-between rounded-md bg-secondary-container/40 p-1 shadow-[0_0_0_2px_#2c6956]">
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-label-sm text-on-secondary">1</span>
                    <span className="rounded bg-surface-container-lowest/90 px-1.5 py-0.5 text-label-sm text-on-surface">Bell collar</span>
                  </div>
                </div>
                <div className="absolute right-[17%] top-[50%] flex h-[17%] w-[13%] flex-col justify-between rounded-md bg-secondary-container/40 p-1 shadow-[0_0_0_2px_#2c6956]">
                  <div className="flex items-center justify-between">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-secondary text-label-sm text-on-secondary">2</span>
                    <span className="rounded bg-surface-container-lowest/90 px-1.5 py-0.5 text-label-sm text-on-surface">Teacup steam</span>
                  </div>
                </div>
                <div className="absolute left-[20%] top-[24%] flex h-[16%] w-[18%] animate-pulse flex-col items-center justify-center rounded-md bg-tertiary-fixed/30 p-2 text-center shadow-[0_0_0_2px_#805160]">
                  <span className="flex h-6 w-6 items-center justify-center rounded-full bg-tertiary text-label-sm text-on-tertiary">3</span>
                  <span className="mt-1 rounded-full bg-surface-container-lowest/85 px-2 py-0.5 text-label-sm text-on-tertiary-container">+ Drag to define #3</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="xl:col-span-3">
          <div className="space-y-space-lg rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <h2 className="text-headline-sm text-on-surface">Differences</h2>
                <span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm text-on-secondary-fixed">{differences} / {differences} defined</span>
              </div>
              <span className="material-symbols-outlined text-[20px] text-outline">checklist</span>
            </div>

            {[1, 2, 3].map((index) => (
              <div key={index} className="rounded-lg bg-surface-container-low p-space-md shadow-[0_2px_0_#dfe3e5]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-secondary-fixed text-label-sm text-on-secondary-fixed">{index}</span>
                    <span className="text-label-md text-on-surface">{index === 1 ? 'Cat Collar Bell' : index === 2 ? 'Teacup Steam' : 'Window Plant'}</span>
                  </div>
                  <button type="button" className="flex h-7 w-7 items-center justify-center rounded-full bg-tertiary-fixed text-tertiary shadow-[0_2px_0_#eaafc1]">
                    <span className="material-symbols-outlined text-[16px]">delete</span>
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-1.5">
                  <div>
                    <span className="block px-1 text-label-sm text-outline">X</span>
                    <input defaultValue={index === 1 ? 120 : index === 2 ? 140 : 200} className="w-full rounded-full bg-surface-container-lowest px-2 py-1 text-center text-label-md text-on-surface outline-none" />
                  </div>
                  <div>
                    <span className="block px-1 text-label-sm text-outline">Y</span>
                    <input defaultValue={index === 1 ? 80 : index === 2 ? 110 : 210} className="w-full rounded-full bg-surface-container-lowest px-2 py-1 text-center text-label-md text-on-surface outline-none" />
                  </div>
                  <div>
                    <span className="block px-1 text-label-sm text-outline">W</span>
                    <input defaultValue={index === 1 ? 60 : index === 2 ? 70 : 65} className="w-full rounded-full bg-surface-container-lowest px-2 py-1 text-center text-label-md text-on-surface outline-none" />
                  </div>
                  <div>
                    <span className="block px-1 text-label-sm text-outline">H</span>
                    <input defaultValue={index === 1 ? 60 : index === 2 ? 80 : 55} className="w-full rounded-full bg-surface-container-lowest px-2 py-1 text-center text-label-md text-on-surface outline-none" />
                  </div>
                </div>
              </div>
            ))}

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" onClick={() => navigate('/admin/questions')}>Cancel</Button>
              <Button variant="primary" onClick={handleSave}>{existingQuestion ? 'Save changes' : 'Create question'}</Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
