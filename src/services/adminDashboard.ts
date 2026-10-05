import { levelCatalog } from '../context/GameDataContext';
import { supabase, supabaseConfigError } from '../supabaseClient';

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
  levelId: string;
  title: string;
  difficulty: DashboardDifficulty | null;
  score: number;
  result: 'win' | 'loss';
  playedAt: string;
};

type SessionLevelRow = {
  level_id: string;
};

type RecentSessionRow = {
  id: string;
  user_id: string;
  level_id: string;
  score: number;
  result: 'win' | 'loss';
  played_at: string;
};

type ProfileRow = {
  id: string;
  username: string;
};

const SESSION_PAGE_SIZE = 500;
const DIFFICULTIES: DashboardDifficulty[] = ['easy', 'medium', 'hard'];
const levelsById = new Map(levelCatalog.map((level) => [level.id, level]));

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
    if (typeof row.level_id !== 'string') {
      throw new Error('Supabase returned a session without a level ID.');
    }

    return { level_id: row.level_id };
  });
}

function parseRecentSessionRows(value: unknown): RecentSessionRow[] {
  return parseRows(value, (row) => {
    if (
      typeof row.id !== 'string'
      || typeof row.user_id !== 'string'
      || typeof row.level_id !== 'string'
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
      score: row.score,
      result: row.result,
      played_at: row.played_at,
    };
  });
}

function parseProfileRows(value: unknown): ProfileRow[] {
  return parseRows(value, (row) => {
    if (typeof row.id !== 'string' || typeof row.username !== 'string') {
      throw new Error('Supabase returned an invalid profile.');
    }

    return { id: row.id, username: row.username };
  });
}

export async function loadAdminDashboardSummary(): Promise<AdminDashboardSummary> {
  const client = getClient();
  const [profilesResult, firstSessionsPage] = await Promise.all([
    client.from('profiles').select('id', { count: 'exact', head: true }),
    client
      .from('game_sessions')
      .select('level_id', { count: 'exact' })
      .order('id', { ascending: true })
      .range(0, SESSION_PAGE_SIZE - 1),
  ]);

  if (profilesResult.error || firstSessionsPage.error) {
    throw new Error('Could not load dashboard summary.');
  }

  const usersCount = profilesResult.count ?? 0;
  const totalPlays = firstSessionsPage.count ?? 0;
  const sessionLevelRows = parseSessionLevelRows(firstSessionsPage.data as unknown);

  for (let offset = sessionLevelRows.length; offset < totalPlays;) {
    const { data, error } = await client
      .from('game_sessions')
      .select('level_id')
      .order('id', { ascending: true })
      .range(offset, offset + SESSION_PAGE_SIZE - 1);

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

  const difficultyCounts: Record<DashboardDifficulty, number> = {
    easy: 0,
    medium: 0,
    hard: 0,
  };
  const unknownLevelIds = new Set<string>();
  let unknownLevelSessionCount = 0;

  for (const row of sessionLevelRows) {
    const level = levelsById.get(row.level_id);
    if (!level) {
      unknownLevelIds.add(row.level_id);
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
  const { data, error } = await client
    .from('game_sessions')
    .select('id, user_id, level_id, score, result, played_at')
    .order('played_at', { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error('Could not load recent plays.');
  }

  const sessions = parseRecentSessionRows(data as unknown);
  if (sessions.length === 0) {
    return [];
  }

  const userIds = [...new Set(sessions.map((session) => session.user_id))];
  const { data: profileData, error: profileError } = await client
    .from('profiles')
    .select('id, username')
    .in('id', userIds);

  if (profileError) {
    throw new Error('Could not load players for recent plays.');
  }

  const usernamesById = new Map(
    parseProfileRows(profileData as unknown).map((profile) => [profile.id, profile.username]),
  );

  return sessions.map((session) => {
    const level = levelsById.get(session.level_id);

    return {
      id: session.id,
      userId: session.user_id,
      username: usernamesById.get(session.user_id) ?? 'Unknown player',
      levelId: session.level_id,
      title: level?.title ?? `Unknown level (${session.level_id})`,
      difficulty: level?.difficulty ?? null,
      score: session.score,
      result: session.result,
      playedAt: session.played_at,
    };
  });
}