import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import { useAdminData } from '../../context/AdminDataContext';
import { getAdminGameplayAssetPairForLevel, type SignedGameplayAsset } from '../../services/levelAssets';

export default function QuestionEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { questions, addQuestion, updateQuestion, levels, isLoading, error, catalogWarnings } = useAdminData();
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const existingQuestion = useMemo(() => questions.find((question) => question.id === id) ?? null, [id, questions]);

  const [levelId, setLevelId] = useState(existingQuestion?.levelId ?? levels[0]?.id ?? '');
  const [spotKey, setSpotKey] = useState(existingQuestion?.spotKey ?? 'spot-1');
  const [label, setLabel] = useState(existingQuestion?.label ?? '');
  const [shape, setShape] = useState<'circle' | 'rectangle'>(existingQuestion?.shape ?? 'rectangle');
  const [xNorm, setXNorm] = useState(existingQuestion?.xNorm ?? 0.5);
  const [yNorm, setYNorm] = useState(existingQuestion?.yNorm ?? 0.5);
  const [widthNorm, setWidthNorm] = useState(existingQuestion?.widthNorm ?? 0.12);
  const [heightNorm, setHeightNorm] = useState(existingQuestion?.heightNorm ?? 0.12);
  const [radiusNorm, setRadiusNorm] = useState(existingQuestion?.radiusNorm ?? 0.04);
  const [toleranceNorm, setToleranceNorm] = useState(existingQuestion?.toleranceNorm ?? 0.03);
  const [scoreValue, setScoreValue] = useState(existingQuestion?.scoreValue ?? 100);
  const [sortOrder, setSortOrder] = useState(existingQuestion?.sortOrder ?? questions.length);
  const [active, setActive] = useState(existingQuestion?.active ?? true);
  const [comparisonArtwork, setComparisonArtwork] = useState<SignedGameplayAsset | null>(null);
  const [comparisonArtworkError, setComparisonArtworkError] = useState<string | null>(null);

  const selectedLevel = levels.find((level) => level.id === levelId) ?? levels[0];

  useEffect(() => {
    if (existingQuestion) {
      setLevelId(existingQuestion.levelId);
      setSpotKey(existingQuestion.spotKey);
      setLabel(existingQuestion.label);
      setShape(existingQuestion.shape);
      setXNorm(existingQuestion.xNorm);
      setYNorm(existingQuestion.yNorm);
      setWidthNorm(existingQuestion.widthNorm ?? 0.12);
      setHeightNorm(existingQuestion.heightNorm ?? 0.12);
      setRadiusNorm(existingQuestion.radiusNorm ?? 0.04);
      setToleranceNorm(existingQuestion.toleranceNorm);
      setScoreValue(existingQuestion.scoreValue);
      setSortOrder(existingQuestion.sortOrder);
      setActive(existingQuestion.active);
    } else if (levels.length > 0) {
      const selectedLevelId = levels.some((level) => level.id === levelId) ? levelId : levels[0].id;
      const levelSpots = questions.filter((question) => question.levelId === selectedLevelId);
      const usedKeys = new Set(levelSpots.map((question) => question.spotKey));
      let nextKeyNumber = 1;
      while (usedKeys.has(`spot-${nextKeyNumber}`)) nextKeyNumber += 1;

      setLevelId(selectedLevelId);
      setSpotKey((current) => usedKeys.has(current) ? `spot-${nextKeyNumber}` : current);
      setSortOrder(levelSpots.length);
    }
  }, [existingQuestion?.id, levelId, levels, questions]);

  useEffect(() => {
    if (!selectedLevel?.id) {
      setComparisonArtwork(null);
      setComparisonArtworkError(null);
      return;
    }
    let isMounted = true;
    setComparisonArtwork(null);
    setComparisonArtworkError(null);

    void getAdminGameplayAssetPairForLevel(selectedLevel.id)
      .then((pair) => {
        if (isMounted) setComparisonArtwork(pair.comparison);
      })
      .catch(() => {
        if (isMounted) setComparisonArtworkError('Comparison artwork could not be loaded.');
      });

    return () => {
      isMounted = false;
    };
  }, [selectedLevel?.id]);

  const handleSave = async () => {
    if (isSaving) return;
    if (!selectedLevel) {
      setFormError('Create a level before adding spots.');
      return;
    }
    if (!spotKey.trim()) {
      setFormError('Spot key is required.');
      return;
    }
    if (!label.trim()) {
      setFormError('Spot label is required.');
      return;
    }
    if (![xNorm, yNorm].every((value) => Number.isFinite(value) && value >= 0 && value <= 1)) {
      setFormError('Position values must be between 0 and 1.');
      return;
    }
    if (shape === 'rectangle' && (![widthNorm, heightNorm].every((value) => Number.isFinite(value) && value > 0 && value <= 1))) {
      setFormError('Rectangle width and height must be greater than 0 and no more than 1.');
      return;
    }
    if (shape === 'circle' && (!Number.isFinite(radiusNorm) || radiusNorm <= 0 || radiusNorm > 1)) {
      setFormError('Circle radius must be greater than 0 and no more than 1.');
      return;
    }
    if (!Number.isFinite(toleranceNorm) || toleranceNorm < 0 || toleranceNorm > 0.25) {
      setFormError('Tolerance must be between 0 and 0.25.');
      return;
    }
    if (!Number.isInteger(scoreValue) || scoreValue < 0 || !Number.isInteger(sortOrder) || sortOrder < 0) {
      setFormError('Score and sort order must be non-negative whole numbers.');
      return;
    }

    const payload = {
      levelId,
      spotKey: spotKey.trim(),
      label: label.trim(),
      shape,
      xNorm,
      yNorm,
      widthNorm: shape === 'rectangle' ? widthNorm : null,
      heightNorm: shape === 'rectangle' ? heightNorm : null,
      radiusNorm: shape === 'circle' ? radiusNorm : null,
      toleranceNorm,
      scoreValue,
      sortOrder,
      active,
    };

    setIsSaving(true);
    setFormError(null);
    try {
      if (existingQuestion) {
        await updateQuestion(existingQuestion.id, payload);
      } else {
        await addQuestion(payload);
      }

      setFormError(null);
      navigate('/admin/questions');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Unable to save the question.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-space-xl">
      <div className="flex flex-col gap-space-md md:flex-row md:items-center md:justify-between">
        <div>
          <nav className="flex items-center gap-space-xs text-label-md text-on-surface-variant">
            <Link to="/admin/questions" className="flex items-center gap-1">Spots</Link>
            <span className="material-symbols-outlined text-[16px]">chevron_right</span>
            <span className="rounded-full bg-primary-fixed px-3 py-0.5 text-primary">{existingQuestion ? 'Edit Spot' : 'New Spot'}</span>
          </nav>
          <div className="mt-2 flex items-baseline gap-space-sm">
            <h1 className="text-headline-lg text-on-surface">Spot Editor</h1>
            <span className="text-[28px]">🎨</span>
          </div>
          <p className="text-body-md text-on-surface-variant">{existingQuestion ? 'Edit the saved spot configuration.' : 'Add a spot to a level.'}</p>
        </div>

        <div className="rounded-full bg-surface-container-lowest px-space-md py-2.5 shadow-[0_4px_16px_rgba(43,139,198,0.08)]">
          <span className="text-label-md text-on-surface">{selectedLevel?.title ?? 'No level selected'}</span>
          {selectedLevel ? <span className="ml-2 rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm text-on-secondary-fixed">{selectedLevel.difficulty}</span> : null}
        </div>
      </div>

      {isLoading ? <p role="status" className="text-body-md text-on-surface-variant">Loading levels and spots...</p> : null}
      {error ? <p role="alert" className="rounded-lg border border-error/40 bg-error/10 px-space-md py-3 text-body-md text-error">{error}</p> : null}
      {catalogWarnings.map((warning) => <p key={warning} role="status" className="rounded-lg border border-tertiary/40 bg-tertiary-fixed/40 px-space-md py-3 text-body-md text-on-surface">{warning}</p>)}

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
              <select value={levelId} disabled={isSaving || isLoading || levels.length === 0} onChange={(e) => setLevelId(e.target.value)} className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none">
                {levels.map((level) => (
                  <option key={level.id} value={level.id}>{level.title} ({level.difficulty})</option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Spot key</label>
              <Input value={spotKey} onChange={setSpotKey} disabled={isSaving || Boolean(existingQuestion)} />
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Label</label>
              <Input value={label} onChange={setLabel} disabled={isSaving} placeholder="e.g. Window flowerpot" />
            </div>

            <div>
              <label className="mb-1.5 block text-label-md text-on-surface-variant">Shape</label>
              <select value={shape} disabled={isSaving} onChange={(event) => setShape(event.target.value as 'circle' | 'rectangle')} className="w-full rounded-full bg-surface-container-low px-4 py-3 text-body-md text-on-surface outline-none">
                <option value="rectangle">Rectangle</option>
                <option value="circle">Circle</option>
              </select>
            </div>

              <button type="button" disabled={isSaving} onClick={() => setActive((current) => !current)} className={`ui-pressable w-full rounded-full px-4 py-3 text-label-md ${active ? 'bg-secondary-container text-on-secondary-container' : 'bg-surface-container-low text-on-surface-variant'}`}>
              {active ? 'Spot active' : 'Spot inactive'}
            </button>
          </div>
        </aside>

        <section className="xl:col-span-6">
          <div className="rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_12px_32px_rgba(43,139,198,0.08)]">
            <div className="flex items-center justify-between gap-space-sm">
              <div className="inline-flex items-center gap-space-xs rounded-full bg-secondary-fixed/50 px-3.5 py-1.5 text-label-md text-on-secondary-fixed-variant">
                <span className="material-symbols-outlined text-[18px]">center_focus_strong</span>
                Normalized spot preview
              </div>
              <span className="text-label-sm text-on-surface-variant">{Math.round(xNorm * 100)}%, {Math.round(yNorm * 100)}%</span>
            </div>

            <div className="mt-space-md overflow-hidden rounded-lg bg-surface-container-low p-2 shadow-inner">
              <div
                className={`relative overflow-hidden rounded-md ${comparisonArtwork ? '' : 'aspect-square'}`}
                style={comparisonArtwork ? { aspectRatio: `${comparisonArtwork.width} / ${comparisonArtwork.height}` } : undefined}
              >
                {comparisonArtwork ? (
                  <img src={comparisonArtwork.signed_url} alt={`${selectedLevel?.title ?? 'Level'} comparison image`} className="h-full w-full rounded-md object-contain" />
                ) : (
                  <div role="img" aria-label="Comparison image missing" className="flex h-full items-center justify-center rounded-md bg-surface-container-low p-5 text-center text-body-sm text-on-surface-variant">
                    {comparisonArtworkError ?? 'Register a Comparison image in level management before placing spots.'}
                  </div>
                )}
                <div
                  className="absolute -translate-x-1/2 -translate-y-1/2 border-2 border-dashed border-secondary bg-secondary-container/30"
                  style={{
                    left: `${xNorm * 100}%`,
                    top: `${yNorm * 100}%`,
                    width: `${(shape === 'circle' ? radiusNorm * 2 : widthNorm) * 100}%`,
                    height: `${(shape === 'circle' ? radiusNorm * 2 : heightNorm) * 100}%`,
                    borderRadius: shape === 'circle' ? '50%' : '6px',
                  }}
                >
                  <span className="absolute left-1 top-1 max-w-[calc(100%-8px)] truncate rounded bg-surface-container-lowest/90 px-1.5 py-0.5 text-label-sm text-on-surface">{label || 'Spot label'}</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <aside className="xl:col-span-3">
          <div className="space-y-space-lg rounded-lg bg-surface-container-lowest p-space-lg shadow-[0_8px_24px_rgba(43,139,198,0.06)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-space-xs">
                <h2 className="text-headline-sm text-on-surface">Spot properties</h2>
                <span className="rounded-full bg-secondary-fixed px-2.5 py-0.5 text-label-sm text-on-secondary-fixed">{shape}</span>
              </div>
              <span className="material-symbols-outlined text-[20px] text-outline">tune</span>
            </div>

            {formError ? <div role="alert" className="rounded-lg border border-error/40 bg-error/10 px-space-md py-2 text-body-sm text-error">{formError}</div> : null}

            <div className="grid grid-cols-2 gap-space-sm">
              <label className="text-label-sm text-on-surface-variant">X (0-1)
                <input type="number" min="0" max="1" step="0.01" value={xNorm} disabled={isSaving} onChange={(event) => setXNorm(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
              </label>
              <label className="text-label-sm text-on-surface-variant">Y (0-1)
                <input type="number" min="0" max="1" step="0.01" value={yNorm} disabled={isSaving} onChange={(event) => setYNorm(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
              </label>
              {shape === 'rectangle' ? (
                <>
                  <label className="text-label-sm text-on-surface-variant">Width (0-1)
                    <input type="number" min="0.01" max="1" step="0.01" value={widthNorm} disabled={isSaving} onChange={(event) => setWidthNorm(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
                  </label>
                  <label className="text-label-sm text-on-surface-variant">Height (0-1)
                    <input type="number" min="0.01" max="1" step="0.01" value={heightNorm} disabled={isSaving} onChange={(event) => setHeightNorm(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
                  </label>
                </>
              ) : (
                <label className="text-label-sm text-on-surface-variant">Radius (0-1)
                  <input type="number" min="0.01" max="1" step="0.01" value={radiusNorm} disabled={isSaving} onChange={(event) => setRadiusNorm(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
                </label>
              )}
              <label className="text-label-sm text-on-surface-variant">Tolerance (0-0.25)
                <input type="number" min="0" max="0.25" step="0.01" value={toleranceNorm} disabled={isSaving} onChange={(event) => setToleranceNorm(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
              </label>
              <label className="text-label-sm text-on-surface-variant">Score value
                <input type="number" min="0" step="1" value={scoreValue} disabled={isSaving} onChange={(event) => setScoreValue(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
              </label>
              <label className="text-label-sm text-on-surface-variant">Sort order
                <input type="number" min="0" step="1" value={sortOrder} disabled={isSaving} onChange={(event) => setSortOrder(Number(event.target.value))} className="mt-1 w-full rounded-full bg-surface-container-low px-3 py-2 text-body-md text-on-surface outline-none" />
              </label>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <Button variant="ghost" disabled={isSaving} onClick={() => navigate('/admin/questions')}>Cancel</Button>
              <Button variant="primary" disabled={isSaving || isLoading || !selectedLevel} onClick={handleSave}>{isSaving ? 'Saving...' : existingQuestion ? 'Save changes' : 'Create spot'}</Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
