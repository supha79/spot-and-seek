import { supabase, supabaseConfigError } from '../supabaseClient';
import { getBuddyOption, type BuddyOption } from '../data/buddies';
import { resolveAdminDashboardLevel } from './compatibilityContracts';

export type DashboardDifficulty = 'easy' | 'medium' | 'hard';

export type DifficultyStat = {
  difficulty: DashboardDifficulty;
  count: number;
  percentage: number;
};

export type AdminDashboardSummary = {
  usersCount: number;
  totalPlays: number;
  difficultyStats: DifficultyStat[];
  unknownLevelSessionCount: number;
  unknownLevelIds: string[];
};

export type RecentAdminPlay = {
  id: string;
  userId: string;
  username: string;
  buddy: BuddyOption | null;
  levelId: string;
  title: string;
  difficulty: DashboardDifficulty | null;
  score: number;
  result: 'win' | 'loss';
  playedAt: string;
};

type SessionLevelRow = {
  level_id: string;
  content_level_id: string | null;
  level_key: string | null;
  rule_version_id: string | null;
};

type RecentSessionRow = SessionLevelRow & {
  id: string;
  user_id: string;
  score: number;
  result: 'win' | 'loss';
  played_at: string;
};

type ProfileRow = {
  id: string;
  username: string;
  selectedBuddy: string | null;
};

const SESSION_PAGE_SIZE = 500;
const DIFFICULTIES: DashboardDifficulty[] = ['easy', 'medium', 'hard'];
const legacyLevelsById = new Map<string, { title: string; difficulty: DashboardDifficulty }>([
  ['cozy-cat-corner', { title: 'Cozy Cat Corner', difficulty: 'easy' }],
  ['sunny-picnic', { title: 'Sunny Picnic', difficulty: 'easy' }],
  ['balloon-hills', { title: 'Balloon Hills', difficulty: 'easy' }],
  ['greenhouse-garden', { title: 'Greenhouse Garden', difficulty: 'medium' }],
  ['bakery-breeze', { title: 'Bakery Breeze', difficulty: 'medium' }],
  ['night-train', { title: 'Night Train', difficulty: 'medium' }],
  ['stormy-shelf', { title: 'Stormy Shelf', difficulty: 'hard' }],
  ['forest-fable', { title: 'Forest Fable', difficulty: 'hard' }],
]);

function getClient() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  }

  return supabase;
}

function parseRows<T>(value: unknown, fields: (row: Record<string, unknown>) => T): T[] {
  if (!Array.isArray(value)) {
    throw new Error('Supabase returned an invalid dashboard response.');
  }

  return value.map((item) => {
    if (typeof item !== 'object' || item === null || Array.isArray(item)) {
      throw new Error('Supabase returned an invalid dashboard row.');
    }

    return fields(item as Record<string, unknown>);
  });
}

function parseSessionLevelRows(value: unknown): SessionLevelRow[] {
  return parseRows(value, (row) => {
    const identityFields = ['content_level_id', 'level_key', 'rule_version_id'] as const;
    if (
      typeof row.level_id !== 'string'
      || !row.level_id.trim()
      || identityFields.some((field) => row[field] !== undefined && row[field] !== null && typeof row[field] !== 'string')
    ) {
      throw new Error('Supabase returned a session without a level ID.');
    }

    return {
      level_id: row.level_id,
      content_level_id: typeof row.content_level_id === 'string' ? row.content_level_id : null,
      level_key: typeof row.level_key === 'string' ? row.level_key : null,
      rule_version_id: typeof row.rule_version_id === 'string' ? row.rule_version_id : null,
    };
  });
}

function parseRecentSessionRows(value: unknown): RecentSessionRow[] {
  return parseRows(value, (row) => {
    if (
      typeof row.id !== 'string'
      || typeof row.user_id !== 'string'
      || typeof row.level_id !== 'string'
      || ['content_level_id', 'level_key', 'rule_version_id'].some((field) => row[field] !== undefined && row[field] !== null && typeof row[field] !== 'string')
      || typeof row.score !== 'number'
      || (row.result !== 'win' && row.result !== 'loss')
      || typeof row.played_at !== 'string'
    ) {
      throw new Error('Supabase returned an invalid recent session.');
    }

    return {
      id: row.id,
      user_id: row.user_id,
      level_id: row.level_id,
      content_level_id: typeof row.content_level_id === 'string' ? row.content_level_id : null,
      level_key: typeof row.level_key === 'string' ? row.level_key : null,
      rule_version_id: typeof row.rule_version_id === 'string' ? row.rule_version_id : null,
      score: row.score,
      result: row.result,
      played_at: row.played_at,
    };
  });
}

function parseProfileRows(value: unknown): ProfileRow[] {
  return parseRows(value, (row) => {
    if (
      typeof row.id !== 'string'
      || typeof row.username !== 'string'
      || (row.selected_buddy !== undefined && row.selected_buddy !== null && typeof row.selected_buddy !== 'string')
    ) {
      throw new Error('Supabase returned an invalid profile.');
    }

    return { id: row.id, username: row.username, selectedBuddy: typeof row.selected_buddy === 'string' ? row.selected_buddy : null };
  });
}

export async function loadAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const client = getClient();
  const [profilesResult, initialSessionsPage] = await Promise.all([
    client.from('profiles').select('id', { count: 'exact', head: true }),
    fetchSessionLevelPage(client, 0, true, true),
  ]);

  if (profilesResult.error || initialSessionsPage.error) {
    throw new Error('Could not load dashboard summary.');
  }

  const usersCount = profilesResult.count ?? 0;
  const totalPlays = initialSessionsPage.count ?? 0;
  const dynamicIdentitySupported = initialSessionsPage.dynamicIdentitySupported;
  const sessionLevelRows = parseSessionLevelRows(initialSessionsPage.data as unknown);

  for (let offset = sessionLevelRows.length; offset < totalPlays;) {
    const { data, error } = await fetchSessionLevelPage(client, offset, false, dynamicIdentitySupported);

    if (error) {
      throw new Error('Could not load all sessions for the difficulty breakdown.');
    }

    const nextPage = parseSessionLevelRows(data as unknown);
    if (nextPage.length === 0) {
      throw new Error('Could not load all sessions for the difficulty breakdown.');
    }

    sessionLevelRows.push(...nextPage);
    offset += nextPage.length;
  }

  const dynamicLevels = await fetchDynamicLevelCatalog(client, sessionLevelRows);

  const difficultyCounts: Record<DashboardDifficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  const unknownLevelIds = new Set<string>();
  let unknownLevelSessionCount = 0;

  for (const row of sessionLevelRows) {
    const level = resolveAdminDashboardLevel(row, dynamicLevels, legacyLevelsById);
    if (!level.difficulty) {
      if (level.reference) unknownLevelIds.add(level.reference);
      unknownLevelSessionCount += 1;
      continue;
    }

    difficultyCounts[level.difficulty] += 1;
  }

  return {
    usersCount,
    totalPlays,
    difficultyStats: DIFFICULTIES.map((difficulty) => ({
      difficulty,
      count: difficultyCounts[difficulty],
      percentage: totalPlays === 0 ? 0 : (difficultyCounts[difficulty] / totalPlays) * 100,
    })),
    unknownLevelSessionCount,
    unknownLevelIds: [...unknownLevelIds],
  };
}

export async function loadRecentAdminPlays(limit = 5): Promise<RecentAdminPlay[]> {
  const client = getClient();
  const dynamicResult = await client
    .from('game_sessions')
    .select('id, user_id, level_id, content_level_id, level_key, rule_version_id, score, result, played_at')
    .order('played_at', { ascending: false })
    .limit(limit);
  let recentSessionData: unknown;

  if (dynamicResult.error && isMissingDynamicIdentityColumns(dynamicResult.error)) {
    const legacyResult = await client
      .from('game_sessions')
      .select('id, user_id, level_id, score, result, played_at')
      .order('played_at', { ascending: false })
      .limit(limit);
    if (legacyResult.error) throw new Error('Could not load recent plays.');
    recentSessionData = legacyResult.data;
  } else if (dynamicResult.error) {
    throw new Error('Could not load recent plays.');
  } else {
    recentSessionData = dynamicResult.data;
  }

  const sessions = parseRecentSessionRows(recentSessionData);
  if (sessions.length === 0) {
    return [];
  }

  const dynamicLevels = await fetchDynamicLevelCatalog(client, sessions);

  const userIds = [...new Set(sessions.map((session) => session.user_id))];
  const { data: profileData, error: profileError } = await client
    .from('profiles')
    .select('id, username, selected_buddy')
    .in('id', userIds);

  if (profileError) {
    throw new Error('Could not load players for recent plays.');
  }

  const profilesById = new Map(
    parseProfileRows(profileData as unknown).map((profile) => [profile.id, profile]),
  );

  return sessions.map((session) => {
    const level = resolveAdminDashboardLevel(session, dynamicLevels, legacyLevelsById);
    const player = profilesById.get(session.user_id);

    return {
      id: session.id,
      userId: session.user_id,
      username: player?.username ?? 'Unknown player',
      buddy: getBuddyOption(player?.selectedBuddy),
      levelId: session.level_id,
      title: level.title,
      difficulty: level.difficulty,
      score: session.score,
      result: session.result,
      playedAt: session.played_at,
    };
  });
}

function isMissingDynamicIdentityColumns(error: { code?: string; message: string }) {
  return error.code === '42703'
    || error.code === 'PGRST204'
    || /column .* does not exist|could not find.*column.*schema cache/i.test(error.message);
}

function hasDynamicIdentity(row: SessionLevelRow) {
  return Boolean(row.content_level_id || row.level_key || row.rule_version_id);
}

async function fetchDynamicLevelCatalog(client: ReturnType<typeof getClient>, sessions: SessionLevelRow[]) {
  if (!sessions.some(hasDynamicIdentity)) return [];

  const { data, error } = await client
    .from('levels')
    .select('id, level_key, title, difficulty');
  if (error) throw error;

  return (data ?? []).flatMap((row) => {
    if (
      typeof row.id !== 'string'
      || typeof row.level_key !== 'string'
      || typeof row.title !== 'string'
      || !DIFFICULTIES.includes(row.difficulty as DashboardDifficulty)
    ) return [];

    return [{
      id: row.id,
      level_key: row.level_key,
      title: row.title,
      difficulty: row.difficulty as DashboardDifficulty,
    }];
  });
}

async function fetchSessionLevelPage(
  client: ReturnType<typeof getClient>,
  offset: number,
  includeCount: boolean,
  dynamicIdentitySupported: boolean,
) {
  const rangeEnd = offset + SESSION_PAGE_SIZE - 1;
  if (dynamicIdentitySupported) {
    const dynamicResult = await client
      .from('game_sessions')
      .select('level_id, content_level_id, level_key, rule_version_id', includeCount ? { count: 'exact' } : undefined)
      .order('id', { ascending: true })
      .range(offset, rangeEnd);

    if (!dynamicResult.error || !isMissingDynamicIdentityColumns(dynamicResult.error)) {
      return { ...dynamicResult, dynamicIdentitySupported: true };
    }
  }

  const legacyResult = await client
    .from('game_sessions')
    .select('level_id', includeCount ? { count: 'exact' } : undefined)
    .order('id', { ascending: true })
    .range(offset, rangeEnd);
  return { ...legacyResult, dynamicIdentitySupported: false };
}