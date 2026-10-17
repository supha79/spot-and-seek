export type GameRunResult = {
  run_id: string;
  status: 'won' | 'lost';
  result: 'win' | 'loss';
  score: number;
  session_id: string;
  played_at: string;
  started_at: string;
  completed_at: string;
  ended_at: string;
  elapsed_active_seconds: number;
  wrong_clicks: number;
  hints_used: number;
  found_count: number;
  total_spots: number;
  level: {
    id: string;
    content_level_id: string | null;
    level_key: string | null;
    rule_version_id: string | null;
    title: string | null;
    difficulty: 'easy' | 'medium' | 'hard' | null;
    max_duration_seconds: number;
  };
};

export type GameRunResultRpcClient = {
  rpc: (
    name: 'get_game_run_result',
    args: { p_run_id: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const validDifficulties = ['easy', 'medium', 'hard'];

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isTimestamp(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0 && Number.isFinite(Date.parse(value));
}

function invalidResult(): never {
  throw new Error('The game result is unavailable or invalid.');
}

export function parseGameRunResult(value: unknown, requestedRunId: string): GameRunResult {
  if (!uuidPattern.test(requestedRunId) || !value || typeof value !== 'object' || Array.isArray(value)) {
    return invalidResult();
  }

  const response = value as Record<string, unknown>;
  const rawLevel = response.level;
  if (!rawLevel || typeof rawLevel !== 'object' || Array.isArray(rawLevel)) return invalidResult();
  const level = rawLevel as Record<string, unknown>;

  const status = response.status;
  const expectedResult: 'win' | 'loss' | null = status === 'won' ? 'win' : status === 'lost' ? 'loss' : null;
  const isDynamic = typeof level.content_level_id === 'string' && uuidPattern.test(level.content_level_id as string);
  const validLevel = typeof level.id === 'string'
    && level.id.trim().length > 0
    && isNonNegativeInteger(level.max_duration_seconds)
    && level.max_duration_seconds > 0
    && (isDynamic
      ? typeof level.level_key === 'string'
        && level.id === level.level_key
        && typeof level.rule_version_id === 'string'
        && uuidPattern.test(level.rule_version_id)
        && typeof level.title === 'string'
        && level.title.trim().length > 0
        && typeof level.difficulty === 'string'
        && validDifficulties.includes(level.difficulty)
      : level.content_level_id === null
        && level.level_key === null
        && level.rule_version_id === null
        && level.title === null
        && level.difficulty === null);

  if (
    response.run_id !== requestedRunId
    || (status !== 'won' && status !== 'lost')
    || response.result !== expectedResult
    || !isNonNegativeInteger(response.score)
    || typeof response.session_id !== 'string'
    || !uuidPattern.test(response.session_id)
    || !isTimestamp(response.played_at)
    || !isTimestamp(response.started_at)
    || !isTimestamp(response.completed_at)
    || !isTimestamp(response.ended_at)
    || typeof response.elapsed_active_seconds !== 'number'
    || !Number.isFinite(response.elapsed_active_seconds)
    || response.elapsed_active_seconds < 0
    || !isNonNegativeInteger(response.wrong_clicks)
    || !isNonNegativeInteger(response.hints_used)
    || !isNonNegativeInteger(response.found_count)
    || !isNonNegativeInteger(response.total_spots)
    || response.total_spots < 1
    || response.found_count > response.total_spots
    || !validLevel
  ) {
    return invalidResult();
  }

  if (expectedResult === null) return invalidResult();

  return {
    run_id: requestedRunId,
    status,
    result: expectedResult,
    score: response.score,
    session_id: response.session_id,
    played_at: response.played_at,
    started_at: response.started_at,
    completed_at: response.completed_at,
    ended_at: response.ended_at,
    elapsed_active_seconds: response.elapsed_active_seconds,
    wrong_clicks: response.wrong_clicks,
    hints_used: response.hints_used,
    found_count: response.found_count,
    total_spots: response.total_spots,
    level: {
      id: level.id as string,
      content_level_id: isDynamic ? level.content_level_id as string : null,
      level_key: isDynamic ? level.level_key as string : null,
      rule_version_id: isDynamic ? level.rule_version_id as string : null,
      title: isDynamic ? level.title as string : null,
      difficulty: isDynamic ? level.difficulty as 'easy' | 'medium' | 'hard' : null,
      max_duration_seconds: level.max_duration_seconds as number,
    },
  };
}

export async function readGameRunResult(
  client: GameRunResultRpcClient,
  runId: string,
  timeoutMs = 8000,
): Promise<GameRunResult> {
  if (!uuidPattern.test(runId)) return invalidResult();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const response = await Promise.race([
      client.rpc('get_game_run_result', { p_run_id: runId }),
      new Promise<never>((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error('Result lookup timed out.')), timeoutMs);
      }),
    ]);
    if (response.error) return invalidResult();
    return parseGameRunResult(response.data, runId);
  } catch {
    return invalidResult();
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function getGameRunResult(runId: string): Promise<GameRunResult> {
  const { supabase, supabaseConfigError } = await import('../supabaseClient');
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  return readGameRunResult({ rpc: (name, args) => supabase.rpc(name, args) }, runId);
}