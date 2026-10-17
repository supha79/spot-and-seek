import type { DynamicGameplayGateState } from './compatibilityContracts';

type DynamicGameplayGateRpcClient = {
  rpc: (
    name: 'get_dynamic_gameplay_gate_status',
    args: Record<string, never>,
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

type DynamicGameplayGateControlRpcClient = {
  rpc: (
    name: 'set_dynamic_gameplay_gate',
    args: { p_is_enabled: boolean; p_change_note: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

export type DynamicGameplayGateAuditResult = {
  gate_name: 'dynamic_gameplay';
  previous_enabled: boolean;
  is_enabled: boolean;
  audit_id: string;
  changed_by: string;
  changed_at: string;
  change_note: string;
};

export function parseDynamicGameplayGateResponse(value: unknown): DynamicGameplayGateState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return 'unknown';

  const response = value as { gate_name?: unknown; is_enabled?: unknown };
  if (response.gate_name !== 'dynamic_gameplay' || typeof response.is_enabled !== 'boolean') return 'unknown';
  return response.is_enabled ? 'enabled' : 'disabled';
}

export async function readDynamicGameplayGateState(
  client: DynamicGameplayGateRpcClient,
  timeoutMs = 5000,
): Promise<DynamicGameplayGateState> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const result = await Promise.race([
      client.rpc('get_dynamic_gameplay_gate_status', {}),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Dynamic gameplay gate lookup timed out.')), timeoutMs);
      }),
    ]);
    if (result.error) return 'unknown';
    return parseDynamicGameplayGateResponse(result.data);
  } catch {
    return 'unknown';
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function callSetDynamicGameplayGateRpc(
  client: DynamicGameplayGateControlRpcClient,
  isEnabled: boolean,
  changeNote: string,
): Promise<DynamicGameplayGateAuditResult> {
  const note = changeNote.trim();
  if (!note) throw new Error('A change note is required for the gate audit.');

  const { data, error } = await client.rpc('set_dynamic_gameplay_gate', {
    p_is_enabled: isEnabled,
    p_change_note: note,
  });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Supabase returned an invalid gate audit response.');
  }

  const response = data as Partial<DynamicGameplayGateAuditResult>;
  if (
    response.gate_name !== 'dynamic_gameplay'
    || response.is_enabled !== isEnabled
    || typeof response.previous_enabled !== 'boolean'
    || typeof response.audit_id !== 'string'
    || typeof response.changed_by !== 'string'
    || typeof response.changed_at !== 'string'
    || !Number.isFinite(Date.parse(response.changed_at))
    || response.change_note !== note
  ) {
    throw new Error('Supabase returned an incomplete or mismatched gate audit response.');
  }

  return response as DynamicGameplayGateAuditResult;
}