import { useEffect, useState } from 'react';
import Button from '../../components/ui/Button';
import Input from '../../components/ui/Input';
import {
  approveScorePolicy,
  createScorePolicyVersion,
  loadScorePolicyAudit,
  type ScorePolicyAuditRow,
} from '../../services/scorePolicies';

export default function ScorePolicyManager() {
  const [policies, setPolicies] = useState<ScorePolicyAuditRow[]>([]);
  const [version, setVersion] = useState('');
  const [timeWeight, setTimeWeight] = useState('');
  const [wrongClickPenalty, setWrongClickPenalty] = useState('');
  const [hintPenalty, setHintPenalty] = useState('');
  const [approvalNote, setApprovalNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    try {
      const result = await loadScorePolicyAudit();
      setPolicies(result.policies);
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not load score policy audit.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleCreate = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      await createScorePolicyVersion({
        version,
        timeWeight: Number(timeWeight),
        wrongClickPenalty: Number(wrongClickPenalty),
        hintPenalty: Number(hintPenalty),
      });
      setVersion('');
      setTimeWeight('');
      setWrongClickPenalty('');
      setHintPenalty('');
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not create score policy.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (policy: ScorePolicyAuditRow) => {
    setIsSaving(true);
    try {
      await approveScorePolicy(policy, approvalNote);
      setApprovalNote('');
      await refresh();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not approve score policy.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-space-md border-t border-outline-variant/60 pt-space-lg">
      <div>
        <h2 className="text-headline-md text-on-surface">Dynamic score policies</h2>
        <p className="text-body-sm text-on-surface-variant">A sole Admin may approve their own policy. When multiple Admins exist, approval must come from another Admin.</p>
      </div>

      <form className="grid gap-space-sm md:grid-cols-5" onSubmit={handleCreate}>
        <Input aria-label="Policy version" required value={version} onChange={setVersion} disabled={isSaving} placeholder="Version" />
        <Input aria-label="Time weight" type="number" required min="0" step="1" value={timeWeight} onChange={setTimeWeight} disabled={isSaving} placeholder="Time weight" />
        <Input aria-label="Wrong-click penalty" type="number" required min="0" step="1" value={wrongClickPenalty} onChange={setWrongClickPenalty} disabled={isSaving} placeholder="Wrong-click penalty" />
        <Input aria-label="Hint penalty" type="number" required min="0" step="1" value={hintPenalty} onChange={setHintPenalty} disabled={isSaving} placeholder="Hint penalty" />
        <Button type="submit" leftIcon="add" disabled={isSaving}>Create unapproved policy</Button>
      </form>

      <div className="flex flex-col gap-space-sm md:flex-row">
        <Input aria-label="Approval audit note" required value={approvalNote} onChange={setApprovalNote} disabled={isSaving} placeholder="Approval note" />
        {isLoading ? <p role="status" className="text-body-sm text-on-surface-variant">Loading policy audit...</p> : null}
      </div>

      {error ? <p role="alert" className="break-words text-body-sm text-error">{error}</p> : null}
      {!isLoading && !error && policies.length === 0 ? <p className="text-body-sm text-on-surface-variant">No Dynamic score policies have been created.</p> : null}
      <div className="divide-y divide-outline-variant/60">
        {policies.map((policy) => (
          <article key={policy.id} className="grid gap-space-sm py-space-md md:grid-cols-[1fr_auto] md:items-center">
            <div className="min-w-0">
              <h3 className="break-words text-label-lg text-on-surface">{policy.version}</h3>
              <p className="text-body-sm text-on-surface-variant">
                Time {policy.timeWeight} · Wrong click {policy.wrongClickPenalty} · Hint {policy.hintPenalty}
              </p>
              <p className="break-all text-body-sm text-on-surface-variant">
                Created by {policy.createdBy} · {new Date(policy.createdAt).toLocaleString()}
              </p>
              {policy.approvedBy ? (
                <p className="break-all text-body-sm text-on-surface-variant">
                  Approved by {policy.approvedBy} · {policy.approvedAt ? new Date(policy.approvedAt).toLocaleString() : ''} · “{policy.approvalNote}”
                </p>
              ) : <p className="text-body-sm text-tertiary">Pending approval</p>}
            </div>
            {!policy.approvedBy ? (
              <Button
                variant="secondary"
                leftIcon="verified"
                disabled={isSaving || !approvalNote.trim()}
                onClick={() => void handleApprove(policy)}
              >
                Approve
              </Button>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  );
}