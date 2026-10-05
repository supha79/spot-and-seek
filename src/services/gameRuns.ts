import { supabase, supabaseConfigError } from '../supabaseClient';

export type GameRunStatus = 'active' | 'paused' | 'completed' | 'won' | 'lost' | 'abandoned';

export type GameRunSnapshot = {
  run_id: string;
  level_id: string;
  status: GameRunStatus;
  result: 'win' | 'loss' | null;
  elapsed_active_seconds: number;
  time_remaining_seconds: number;
  wrong_clicks: number;
  hints_used: number;
  found_count: number;
  total_spots: number;
  score: number | null;
  session_id: string | null;
};

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

function parseSnapshot(value: unknown): GameRunSnapshot {
  if (!value || typeof value !== 'object') {
    throw new Error('Supabase returned an invalid game run response.');
  }

  const snapshot = value as Partial<GameRunSnapshot>;
  const validStatuses: GameRunStatus[] = ['active', 'paused', 'completed', 'won', 'lost', 'abandoned'];
  if (
    typeof snapshot.run_id !== 'string'
    || typeof snapshot.level_id !== 'string'
    || !snapshot.status
    || !validStatuses.includes(snapshot.status)
    || typeof snapshot.time_remaining_seconds !== 'number'
  ) {
    throw new Error('Supabase returned an incomplete game run response.');
  }

  return {
    run_id: snapshot.run_id,
    level_id: snapshot.level_id,
    status: snapshot.status,
    result: snapshot.result ?? null,
    elapsed_active_seconds: Number(snapshot.elapsed_active_seconds ?? 0),
    time_remaining_seconds: snapshot.time_remaining_seconds,
    wrong_clicks: Number(snapshot.wrong_clicks ?? 0),
    hints_used: Number(snapshot.hints_used ?? 0),
    found_count: Number(snapshot.found_count ?? 0),
    total_spots: Number(snapshot.total_spots ?? 0),
    score: snapshot.score ?? null,
    session_id: snapshot.session_id ?? null,
  };
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
  return parseSnapshot(data);
}

export function createGameRequestId() {
  return globalThis.crypto.randomUUID();
}

export function startGameRun(levelId: string, requestId: string) {
  return callGameRunRpc('start_game_run', {
    p_level_id: levelId,
    p_request_id: requestId,
  });
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
