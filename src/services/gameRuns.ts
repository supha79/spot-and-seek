import { supabase, supabaseConfigError } from '../supabaseClient';
import { buildGameRunStartRequest, parseGameRunSnapshot } from './compatibilityContracts';
import type { LevelIdentity } from './compatibilityContracts';

export type { GameRunSnapshot, GameRunStatus } from './compatibilityContracts';

function getClient() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  }

  return supabase;
}

function isAuthenticationError(error: { code?: string; status?: number; message: string }) {
  return error.status === 401
    || error.code === '28000'
    || /jwt.*expired|invalid.*jwt|authentication required/i.test(error.message);
}

async function callGameRunRpc(name: string, args: Record<string, unknown>) {
  const client = getClient();
  let { data, error } = await client.rpc(name, args);

  if (error && isAuthenticationError(error)) {
    const { error: refreshError } = await client.auth.refreshSession();
    if (refreshError) {
      throw new Error('Your sign-in session expired. Sign in again, then retry this operation.');
    }
    ({ data, error } = await client.rpc(name, args));
    if (error && isAuthenticationError(error)) {
      throw new Error('Your sign-in session expired. Sign in again, then retry this operation.');
    }
  }

  if (error) throw new Error(error.message);
  return parseGameRunSnapshot(data);
}

export function createGameRequestId() {
  return globalThis.crypto.randomUUID();
}

export function startGameRun(identity: LevelIdentity, requestId: string, expectedRuleVersionId?: string) {
  const { rpcName, args } = buildGameRunStartRequest(identity, requestId, expectedRuleVersionId);
  return callGameRunRpc(rpcName, args);
}

export function recordGameRunEvent(
  runId: string,
  requestId: string,
  eventType: 'wrong_click' | 'hint_used' | 'spot_found',
  spotId: string | null = null,
) {
  return callGameRunRpc('record_game_run_event', {
    p_run_id: runId,
    p_request_id: requestId,
    p_event_type: eventType,
    p_spot_id: spotId,
  });
}

export function pauseGameRun(runId: string, requestId: string) {
  return callGameRunRpc('pause_game_run', {
    p_run_id: runId,
    p_request_id: requestId,
  });
}

export function resumeGameRun(runId: string, requestId: string) {
  return callGameRunRpc('resume_game_run', {
    p_run_id: runId,
    p_request_id: requestId,
  });
}

export function finishGameRun(runId: string) {
  return callGameRunRpc('finish_game_run', { p_run_id: runId });
}

export function abandonGameRun(runId: string, requestId: string) {
  return callGameRunRpc('abandon_game_run', {
    p_run_id: runId,
    p_request_id: requestId,
  });
}
