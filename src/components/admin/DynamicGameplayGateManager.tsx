import { useEffect, useState } from 'react';
import Button from '../ui/Button';
import Input from '../ui/Input';
import { supabase, supabaseConfigError } from '../../supabaseClient';
import { readDynamicGameplayGateState, callSetDynamicGameplayGateRpc } from '../../services/dynamicGameplayGate';
import type { DynamicGameplayGateState } from '../../services/compatibilityContracts';

export default function DynamicGameplayGateManager() {
  const [gateState, setGateState] = useState<DynamicGameplayGateState>('unknown');
  const [changeNote, setChangeNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const refresh = async () => {
    setIsLoading(true);
    if (!supabase) {
      setError(supabaseConfigError ?? 'Supabase is not configured.');
      setGateState('unknown');
      setIsLoading(false);
      return;
    }

    const client = supabase;
    const state = await readDynamicGameplayGateState({
      rpc: (name, args) => client.rpc(name, args),
    });
    setGateState(state);
    setError(state === 'unknown' ? 'Could not verify Dynamic gameplay gate status.' : null);
    setIsLoading(false);
  };

  useEffect(() => {
    void refresh();
  }, []);

  const handleSetGate = async (isEnabled: boolean) => {
    if (!supabase) {
      setError(supabaseConfigError ?? 'Supabase is not configured.');
      return;
    }

    const client = supabase;
    setIsSaving(true);
    try {
      const result = await callSetDynamicGameplayGateRpc(
        { rpc: (name, args) => client.rpc(name, args) },
        isEnabled,
        changeNote,
      );
      setGateState(result.is_enabled ? 'enabled' : 'disabled');
      setChangeNote('');
      setError(null);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Could not update Dynamic gameplay gate.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="space-y-space-md border-t border-outline-variant/60 pt-space-lg">
      <div>
        <h2 className="text-headline-md text-on-surface">Dynamic gameplay gate</h2>
        <p className="text-body-sm text-on-surface-variant">Every change records the Admin, timestamp, and reason. Enabling requires published levels with approved runtime rules and complete asset pairs.</p>
      </div>

      <div className="flex flex-col gap-space-sm md:flex-row md:items-center">
        <p role="status" className="text-body-sm text-on-surface-variant">
          Status: {isLoading ? 'Checking...' : gateState}
        </p>
        <Input
          aria-label="Gate change audit note"
          required
          value={changeNote}
          onChange={setChangeNote}
          disabled={isSaving || isLoading}
          placeholder="Reason for changing the gate"
        />
        {gateState === 'enabled' ? (
          <Button variant="tertiary" leftIcon="lock" disabled={isSaving || isLoading || !changeNote.trim()} onClick={() => void handleSetGate(false)}>
            Close gate
          </Button>
        ) : (
          <Button variant="secondary" leftIcon="lock_open_right" disabled={isSaving || isLoading || gateState !== 'disabled' || !changeNote.trim()} onClick={() => void handleSetGate(true)}>
            Open gate
          </Button>
        )}
        <Button variant="ghost" leftIcon="refresh" disabled={isSaving || isLoading} onClick={() => void refresh()}>
          Refresh
        </Button>
      </div>

      {error ? <p role="alert" className="break-words text-body-sm text-error">{error}</p> : null}
    </section>
  );
}