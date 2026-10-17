export type LevelIdentity = {
  legacyLevelId: string | null;
  contentLevelId: string | null;
  levelKey: string | null;
  ruleVersionId: string | null;
};

export type LevelIdentityInput = Partial<LevelIdentity> | null | undefined;
export type DynamicGameplayGateState = 'enabled' | 'disabled' | 'unknown';

export type GameRunStatus = 'active' | 'paused' | 'completed' | 'won' | 'lost' | 'abandoned';

export type GameRunSnapshot = {
  run_id: string;
  identity: LevelIdentity;
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

export type LevelLifecycleAction = 'publish' | 'unpublish' | 'archive';
export type LevelLifecycleStatus = 'published' | 'draft' | 'archived';

export type LevelLifecycleResponse = {
  level_id: string;
  level_key: string;
  status: LevelLifecycleStatus;
  rule_version_id?: string;
  rule_version?: number;
  content_hash?: string;
  published_at?: null;
};

export type GameLifecycleAction = 'publish' | 'unpublish' | 'archive';
export type GameLifecycleStatus = 'published' | 'draft' | 'archived';

export type GameLifecycleResponse = {
  game_id: string;
  status: GameLifecycleStatus;
  published_at: string | null;
};

export type ProfileRunIdentityInput = {
  level_id: string | null;
  content_level_id?: string | null;
  rule_version_id?: string | null;
};

export type HistoryIdentityInput = ProfileRunIdentityInput & {
  level_key?: string | null;
};

export type PublishedLevelRuntimeFields = {
  game_id: string;
  difficulty: string;
  title: string;
  max_duration_seconds: number;
  max_hints: number;
};

export type DashboardLevel = {
  id: string;
  level_key: string;
  title: string;
  difficulty: 'easy' | 'medium' | 'hard';
};

export type DashboardLevelDetails = {
  title: string;
  difficulty: 'easy' | 'medium' | 'hard' | null;
  reference: string | null;
};

export function getLegacyRunLevelId(identityInput: LevelIdentityInput) {
  const identity = resolveLevelIdentity(identityInput);
  if (!identity.legacyLevelId || identity.contentLevelId || identity.levelKey || identity.ruleVersionId) return null;
  return identity.legacyLevelId;
}

const reservedLegacyLevelKeys = new Set([
  'cozy-cat-corner', 'sunny-picnic', 'balloon-hills', 'greenhouse-garden',
  'bakery-breeze', 'night-train', 'stormy-shelf', 'forest-fable',
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBuildableDynamicIdentity(identity: LevelIdentity) {
  return !identity.legacyLevelId
    && Boolean(identity.contentLevelId && identity.levelKey)
    && !identity.ruleVersionId
    && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(identity.levelKey ?? '')
    && !reservedLegacyLevelKeys.has(identity.levelKey ?? '');
}

export function buildGameRunStartRequest(
  identity: LevelIdentity,
  requestId: string,
  expectedRuleVersionId?: string,
) {
  const legacyLevelId = getLegacyRunLevelId(identity);
  if (!requestId.trim()) throw new Error('A request ID is required before starting a game run.');

  if (legacyLevelId) {
    return {
      rpcName: 'start_game_run',
      args: { p_level_id: legacyLevelId, p_request_id: requestId },
    } as const;
  }

  const resolvedIdentity = resolveLevelIdentity(identity);
  if (!isBuildableDynamicIdentity(resolvedIdentity)) {
    throw new Error('The level does not have a complete, unambiguous Legacy or Dynamic identity.');
  }
  if (!expectedRuleVersionId || !uuidPattern.test(expectedRuleVersionId)) {
    throw new Error('A published rule version is required before starting Dynamic gameplay.');
  }

  return {
    rpcName: 'start_game_run_for_rule_version',
    args: {
      p_level_key: resolvedIdentity.levelKey!,
      p_expected_rule_version_id: expectedRuleVersionId,
      p_request_id: requestId,
    },
  } as const;
}

export function getGameRunReadinessNotice(
  identityInput: LevelIdentityInput,
  gateState: DynamicGameplayGateState = 'unknown',
) {
  if (getLegacyRunLevelId(identityInput)) return null;
  const identity = resolveLevelIdentity(identityInput);
  if (!isBuildableDynamicIdentity(identity)) {
    if (identity.contentLevelId || identity.levelKey || identity.ruleVersionId) return 'This level has an incomplete or ambiguous Dynamic identity and cannot be started.';
    return 'This level has no verified Legacy gameplay identity and cannot be started.';
  }
  if (gateState === 'disabled') return 'Dynamic gameplay is disabled by the server.';
  if (gateState !== 'enabled') return 'Dynamic gameplay availability could not be verified. Starting is unavailable.';
  return null;
}

export function getSafeLevelAssetUrl(value: unknown) {
  if (typeof value !== 'string' || !value.trim()) return null;

  try {
    const url = new URL(value.trim());
    if ((url.protocol !== 'https:' && url.protocol !== 'http:') || url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function getParentGamePublishBlockReason(status: string | null | undefined) {
  if (status === 'published') return null;
  if (status === 'archived') return 'The parent game is archived and cannot be published.';
  if (status === 'draft') return 'Publish the parent game before publishing this level.';
  return 'The parent game status could not be verified. Refresh the catalog before publishing this level.';
}

export function getRemainingHints(maxHints: number, hintsUsed: number) {
  if (!Number.isSafeInteger(maxHints) || maxHints < 0 || !Number.isSafeInteger(hintsUsed) || hintsUsed < 0) {
    return 0;
  }
  return Math.max(0, maxHints - hintsUsed);
}

type LifecycleRpcClient = {
  rpc: (
    name: string,
    args: { p_level_id: string } | { p_game_id: string },
  ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
};

const validRunStatuses: GameRunStatus[] = ['active', 'paused', 'completed', 'won', 'lost', 'abandoned'];
const lifecycleRpcNames: Record<LevelLifecycleAction, string> = {
  publish: 'publish_level_with_runtime_rules',
  unpublish: 'unpublish_level',
  archive: 'archive_level',
};
const lifecycleStatuses: Record<LevelLifecycleAction, LevelLifecycleStatus> = {
  publish: 'published',
  unpublish: 'draft',
  archive: 'archived',
};

function normalizeIdentityValue(value: unknown) {
  return typeof value === 'string' && value.trim() ? value : null;
}

export function resolveLevelIdentity(identity: LevelIdentityInput): LevelIdentity {
  return {
    legacyLevelId: normalizeIdentityValue(identity?.legacyLevelId),
    contentLevelId: normalizeIdentityValue(identity?.contentLevelId),
    levelKey: normalizeIdentityValue(identity?.levelKey),
    ruleVersionId: normalizeIdentityValue(identity?.ruleVersionId),
  };
}

export function getCompletedLevelIdentityKey(run: ProfileRunIdentityInput) {
  const hasDynamicIdentity = Boolean(run.content_level_id || run.rule_version_id);
  const identity = resolveLevelIdentity({
    legacyLevelId: hasDynamicIdentity ? null : run.level_id,
    contentLevelId: run.content_level_id,
    ruleVersionId: run.rule_version_id,
  });

  if (hasDynamicIdentity) {
    return identity.contentLevelId && identity.ruleVersionId ? `content:${identity.contentLevelId}` : null;
  }
  return identity.legacyLevelId ? `legacy:${identity.legacyLevelId}` : null;
}

export function resolveHistoryIdentity(session: HistoryIdentityInput) {
  const hasDynamicIdentity = Boolean(session.content_level_id || session.level_key || session.rule_version_id);
  const identity = resolveLevelIdentity({
    legacyLevelId: hasDynamicIdentity ? null : session.level_id,
    contentLevelId: session.content_level_id,
    levelKey: session.level_key,
    ruleVersionId: session.rule_version_id,
  });
  const isComplete = hasDynamicIdentity
    ? Boolean(identity.contentLevelId && identity.levelKey && identity.ruleVersionId && session.level_id === identity.levelKey)
    : Boolean(identity.legacyLevelId);

  return { identity, isComplete };
}

export function resolveAdminDashboardLevel(
  session: HistoryIdentityInput,
  dynamicLevels: DashboardLevel[],
  legacyLevels: ReadonlyMap<string, Omit<DashboardLevel, 'id' | 'level_key'>>,
): DashboardLevelDetails {
  const { identity, isComplete } = resolveHistoryIdentity(session);
  if (identity.contentLevelId || identity.levelKey || identity.ruleVersionId) {
    if (!isComplete || !identity.contentLevelId || !identity.levelKey) {
      return {
        title: 'Level identity incomplete',
        difficulty: null,
        reference: `content_level_id=${identity.contentLevelId ?? 'unavailable'}; level_key=${identity.levelKey ?? 'unavailable'}`,
      };
    }

    const level = dynamicLevels.find((item) => item.id === identity.contentLevelId && item.level_key === identity.levelKey);
    return level
      ? { title: level.title, difficulty: level.difficulty, reference: null }
      : {
          title: 'Level details unavailable',
          difficulty: null,
          reference: `content_level_id=${identity.contentLevelId}; level_key=${identity.levelKey}`,
        };
  }

  if (!identity.legacyLevelId) {
    return { title: 'Level identity unavailable', difficulty: null, reference: 'level_id=unavailable' };
  }

  const level = legacyLevels.get(identity.legacyLevelId);
  return level
    ? { ...level, reference: null }
    : { title: 'Level details unavailable', difficulty: null, reference: `level_id=${identity.legacyLevelId}` };
}

export function countUnmappedSpotReferences(levelIds: Iterable<string>, spots: Array<{ level_id: string | null }>) {
  const knownLevelIds = new Set(levelIds);
  return spots.filter((spot) => !spot.level_id || !knownLevelIds.has(spot.level_id)).length;
}

export function hasPublishedRuntimeFieldChanges(
  current: PublishedLevelRuntimeFields,
  next: PublishedLevelRuntimeFields,
) {
  return current.game_id !== next.game_id
    || current.difficulty !== next.difficulty
    || current.title !== next.title
    || current.max_duration_seconds !== next.max_duration_seconds
    || current.max_hints !== next.max_hints;
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function parseGameRunSnapshot(value: unknown): GameRunSnapshot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Supabase returned an invalid game run response.');
  }

  const snapshot = value as Record<string, unknown>;
  const rawLevelId = normalizeIdentityValue(snapshot.level_id);
  const contentLevelId = normalizeIdentityValue(snapshot.content_level_id);
  const levelKey = normalizeIdentityValue(snapshot.level_key);
  const ruleVersionId = normalizeIdentityValue(snapshot.rule_version_id);
  const hasDynamicIdentity = contentLevelId !== null || levelKey !== null || ruleVersionId !== null;
  const identity = resolveLevelIdentity({
    legacyLevelId: hasDynamicIdentity ? null : rawLevelId,
    contentLevelId,
    levelKey,
    ruleVersionId,
  });
  const status = snapshot.status;
  const result = snapshot.result ?? null;
  const score = snapshot.score ?? null;
  const sessionId = snapshot.session_id ?? null;
  const counters = [snapshot.wrong_clicks, snapshot.hints_used, snapshot.found_count, snapshot.total_spots];
  const isFinalResult = status === 'won' || status === 'lost';

  if (
    typeof snapshot.run_id !== 'string'
    || !snapshot.run_id.trim()
    || typeof status !== 'string'
    || !validRunStatuses.includes(status as GameRunStatus)
    || !isNonNegativeFiniteNumber(snapshot.elapsed_active_seconds)
    || !isNonNegativeFiniteNumber(snapshot.time_remaining_seconds)
    || !counters.every(isNonNegativeInteger)
    || (snapshot.total_spots as number) < 1
    || (snapshot.found_count as number) > (snapshot.total_spots as number)
    || !(score === null || isNonNegativeInteger(score))
    || !(sessionId === null || (typeof sessionId === 'string' && sessionId.trim().length > 0))
    || !(result === null || result === 'win' || result === 'loss')
    || (isFinalResult && (score === null || sessionId === null))
    || (!isFinalResult && (score !== null || sessionId !== null || result !== null))
    || (status === 'won' && result !== 'win')
    || (status === 'lost' && result !== 'loss')
    || (hasDynamicIdentity
      ? !identity.contentLevelId || !identity.levelKey || !identity.ruleVersionId || rawLevelId !== identity.levelKey
      : !identity.legacyLevelId)
  ) {
    throw new Error('Supabase returned an incomplete or invalid game run response.');
  }

  return {
    run_id: snapshot.run_id,
    identity,
    status: status as GameRunStatus,
    result,
    elapsed_active_seconds: snapshot.elapsed_active_seconds,
    time_remaining_seconds: snapshot.time_remaining_seconds,
    wrong_clicks: snapshot.wrong_clicks as number,
    hints_used: snapshot.hints_used as number,
    found_count: snapshot.found_count as number,
    total_spots: snapshot.total_spots as number,
    score,
    session_id: sessionId as string | null,
  };
}

function lifecycleErrorMessage(message: string) {
  const normalized = message.toLowerCase();

  if (normalized.includes('a level needs at least one active spot')) {
    return 'Add at least one active spot to this level before publishing.';
  }
  if (
    normalized.includes('no approved game run score policy version exists')
    || (/score policy/.test(normalized) && /not approved|no approved|approval required/.test(normalized))
  ) {
    return 'Dynamic content cannot be published because no approved Dynamic score policy is available. A Legacy policy approval does not approve Dynamic gameplay.';
  }
  if (normalized.includes('level key must be a lowercase slug')) {
    return 'The level key must use lowercase letters, numbers, and hyphens before publishing.';
  }
  if (normalized.includes('legacy level keys are reserved')) {
    return 'This level key is reserved for Legacy gameplay and cannot be published as Dynamic content.';
  }
  if (normalized.includes('level key is already in use') || normalized.includes('level key is already permanently registered')) {
    return 'This level key is already assigned to another level.';
  }
  if (normalized.includes('level key cannot change')) {
    return 'A level key cannot change after its first publish.';
  }
  if (normalized.includes('archived levels or parent games cannot be published')) {
    return 'An archived level or parent game cannot be published.';
  }

  return message;
}

function parseLifecycleResponse(value: unknown, action: LevelLifecycleAction, requestedLevelId: string): LevelLifecycleResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Supabase returned an invalid level lifecycle response.');
  }

  const response = value as Record<string, unknown>;
  if (
    response.level_id !== requestedLevelId
    || typeof response.level_key !== 'string'
    || !response.level_key.trim()
    || response.status !== lifecycleStatuses[action]
  ) {
    throw new Error('Supabase returned an incomplete level lifecycle response.');
  }

  if (action === 'publish') {
    if (
      typeof response.rule_version_id !== 'string'
      || !response.rule_version_id.trim()
      || !Number.isSafeInteger(response.rule_version)
      || (response.rule_version as number) < 1
      || typeof response.content_hash !== 'string'
      || !/^[0-9a-f]{64}$/.test(response.content_hash)
    ) {
      throw new Error('Supabase returned an incomplete publish response.');
    }

    return {
      level_id: requestedLevelId,
      level_key: response.level_key,
      status: 'published',
      rule_version_id: response.rule_version_id,
      rule_version: response.rule_version as number,
      content_hash: response.content_hash,
    };
  }

  if (response.published_at !== null) {
    throw new Error('Supabase returned an incomplete level lifecycle response.');
  }

  return {
    level_id: requestedLevelId,
    level_key: response.level_key,
    status: lifecycleStatuses[action],
    published_at: null,
  };
}

export async function callLevelLifecycleRpc(
  client: LifecycleRpcClient,
  action: LevelLifecycleAction,
  levelId: string,
): Promise<LevelLifecycleResponse> {
  const { data, error } = await client.rpc(lifecycleRpcNames[action], { p_level_id: levelId });
  if (error) throw new Error(lifecycleErrorMessage(error.message));
  return parseLifecycleResponse(data, action, levelId);
}

const gameLifecycleRpcNames: Record<GameLifecycleAction, string> = {
  publish: 'publish_game',
  unpublish: 'unpublish_game',
  archive: 'archive_game',
};
const gameLifecycleStatuses: Record<GameLifecycleAction, GameLifecycleStatus> = {
  publish: 'published',
  unpublish: 'draft',
  archive: 'archived',
};

export async function callGameLifecycleRpc(
  client: LifecycleRpcClient,
  action: GameLifecycleAction,
  gameId: string,
): Promise<GameLifecycleResponse> {
  const { data, error } = await client.rpc(gameLifecycleRpcNames[action], { p_game_id: gameId });
  if (error) throw new Error(error.message);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error('Supabase returned an invalid game lifecycle response.');
  }

  const response = data as Record<string, unknown>;
  const status = gameLifecycleStatuses[action];
  const publishedAt = response.published_at;
  if (
    response.game_id !== gameId
    || response.status !== status
    || (status === 'published'
      ? typeof publishedAt !== 'string' || !publishedAt.trim() || Number.isNaN(Date.parse(publishedAt))
      : publishedAt !== null)
  ) {
    throw new Error('Supabase returned an incomplete game lifecycle response.');
  }

  return { game_id: gameId, status, published_at: publishedAt as string | null };
}
