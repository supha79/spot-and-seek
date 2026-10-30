import { supabase } from '../supabaseClient';
import { callGameLifecycleRpc, callLevelLifecycleRpc, getParentGamePublishBlockReason, hasPublishedRuntimeFieldChanges } from './compatibilityContracts';
import type { GameLifecycleResponse, LevelLifecycleResponse } from './compatibilityContracts';

export { resolveLevelIdentity } from './compatibilityContracts';
export type { LevelIdentity, LevelIdentityInput } from './compatibilityContracts';

export type ContentDifficulty = 'easy' | 'medium' | 'hard';
export type ContentStatus = 'draft' | 'published' | 'archived';

export const LEGACY_LEVEL_KEYS = [
  'cozy-cat-corner',
  'sunny-picnic',
  'balloon-hills',
  'greenhouse-garden',
  'bakery-breeze',
  'night-train',
  'stormy-shelf',
  'forest-fable',
] as const;

export type GameRow = {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  status: ContentStatus;
  created_at: string | null;
  updated_at: string | null;
  published_at: string | null;
  sort_order: number | null;
};

export type LevelRow = {
  id: string;
  game_id: string;
  level_key: string;
  difficulty: ContentDifficulty;
  title: string;
  subtitle: string | null;
  description: string | null;
  status: ContentStatus;
  sort_order: number | null;
  max_duration_seconds: number | null;
  max_hints: number | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  version: number | null;
};

export type LevelSpotRow = {
  id: string;
  level_id: string | null;
  spot_key: string;
  label: string;
  shape: 'circle' | 'rectangle';
  x_norm: number;
  y_norm: number;
  width_norm: number | null;
  height_norm: number | null;
  radius_norm: number | null;
  tolerance_norm: number | null;
  score_value: number | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
};

export type ContentCatalog = {
  games: GameRow[];
  levels: LevelRow[];
  spots: LevelSpotRow[];
};

function getClient() {
  if (!supabase) {
    throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  return supabase;
}

function toSafeText(value: string | null | undefined) {
  return (value ?? '').trim();
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);
}

function getUniqueStableKey(base: string, reserved: Set<string>) {
  let key = normalizeSlug(base) || 'level';
  if (!reserved.has(key)) {
    return key;
  }

  let suffix = 2;
  while (reserved.has(`${key}-${suffix}`)) {
    suffix += 1;
  }

  return `${key}-${suffix}`;
}

export function buildLegacyCompatibleLevelKey(value: string, existingKeys: string[] = []) {
  const reserve = new Set([...LEGACY_LEVEL_KEYS, ...existingKeys].map(normalizeSlug).filter(Boolean));
  const candidate = normalizeSlug(value) || 'level';
  return getUniqueStableKey(candidate, reserve);
}

async function getCurrentUserId() {
  const client = getClient();
  const { data, error } = await client.auth.getUser();

  if (error || !data.user) {
    throw new Error(error?.message ?? 'You must be signed in to manage content.');
  }

  return data.user.id;
}

export async function fetchContentCatalog(): Promise<ContentCatalog> {
  const client = getClient();

  const [{ data: gameRows, error: gameError }, { data: levelRows, error: levelError }, { data: spotRows, error: spotError }] = await Promise.all([
    client.from('games').select('*').order('sort_order', { ascending: true }),
    client.from('levels').select('*').order('sort_order', { ascending: true }),
    client.from('level_spots').select('*').order('sort_order', { ascending: true }),
  ]);

  if (gameError) throw gameError;
  if (levelError) throw levelError;
  if (spotError) throw spotError;

  return {
    games: (gameRows ?? []) as GameRow[],
    levels: (levelRows ?? []) as LevelRow[],
    spots: (spotRows ?? []) as LevelSpotRow[],
  };
}

export async function createGame(draft: { name: string; description: string }) {
  const name = toSafeText(draft.name);
  const description = toSafeText(draft.description);

  if (!name) {
    throw new Error('A game name is required.');
  }

  const client = getClient();
  const createdBy = await getCurrentUserId();
  const slugBase = normalizeSlug(name) || 'game';

  const { data: existingSlugs, error: slugError } = await client.from('games').select('slug').like('slug', `${slugBase}%`);
  if (slugError) throw slugError;

  const reserved = new Set((existingSlugs ?? []).map((row) => row.slug).filter(Boolean));
  let slug = slugBase;
  if (reserved.has(slug)) {
    let suffix = 2;
    while (reserved.has(`${slugBase}-${suffix}`)) {
      suffix += 1;
    }
    slug = `${slugBase}-${suffix}`;
  }

  const { data, error } = await client
    .from('games')
    .insert({
      slug,
      name,
      description: description || null,
      status: 'draft',
      created_by: createdBy,
      sort_order: 0,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as GameRow;
}

export async function updateGameById(id: string, draft: { name: string; description: string }) {
  const name = toSafeText(draft.name);
  const description = toSafeText(draft.description);

  if (!name) {
    throw new Error('A game name is required.');
  }

  const client = getClient();
  const { data, error } = await client
    .from('games')
    .update({
      name,
      description: description || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as GameRow;
}

export async function publishGame(id: string): Promise<GameLifecycleResponse> {
  const client = getClient();
  return callGameLifecycleRpc({ rpc: (name, args) => client.rpc(name, args) }, 'publish', id);
}

export async function unpublishGame(id: string): Promise<GameLifecycleResponse> {
  const client = getClient();
  return callGameLifecycleRpc({ rpc: (name, args) => client.rpc(name, args) }, 'unpublish', id);
}

export async function archiveGame(id: string): Promise<GameLifecycleResponse> {
  const client = getClient();
  return callGameLifecycleRpc({ rpc: (name, args) => client.rpc(name, args) }, 'archive', id);
}

export async function deleteGameById(id: string) {
  const client = getClient();
  const { error } = await client.from('games').delete().eq('id', id);
  if (error) throw error;
}

function normalizeDifficulty(value: 'Easy' | 'Medium' | 'Hard' | null | undefined): ContentDifficulty {
  const normalized = value?.toLowerCase();
  if (normalized === 'medium') return 'medium';
  if (normalized === 'hard') return 'hard';
  return 'easy';
}

export async function createLevel(draft: {
  gameId: string;
  title: string;
  description: string;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  time: number;
  maxHints: number;
}) {
  const title = toSafeText(draft.title);
  if (!title) throw new Error('A level title is required.');

  const client = getClient();
  const createdBy = await getCurrentUserId();
  const { data: existingKeys, error: keyError } = await client.from('levels').select('level_key');
  if (keyError) throw keyError;

  const levelKey = buildLegacyCompatibleLevelKey(title, (existingKeys ?? []).map((row) => row.level_key));
  const difficulty = normalizeDifficulty(draft.difficulty);

  const { data, error } = await client
    .from('levels')
    .insert({
      game_id: draft.gameId,
      level_key: levelKey,
      difficulty,
      title,
      description: toSafeText(draft.description) || null,
      status: 'draft',
      max_duration_seconds: Number.isFinite(draft.time) && draft.time > 0 ? draft.time : 120,
      max_hints: Math.min(Math.max(Math.round(draft.maxHints), 0), 3),
      created_by: createdBy,
      sort_order: 0,
      published_at: null,
    })
    .select('*')
    .single();

  if (error) throw error;
  return data as LevelRow;
}

export async function updateLevelById(
  id: string,
  draft: {
    gameId: string;
    title: string;
    description: string;
    difficulty: 'Easy' | 'Medium' | 'Hard';
    time: number;
    maxHints: number;
  },
) {
  const title = toSafeText(draft.title);
  if (!title) throw new Error('A level title is required.');

  const client = getClient();
  const difficulty = normalizeDifficulty(draft.difficulty);
  const maxDurationSeconds = Number.isFinite(draft.time) && draft.time > 0 ? draft.time : 120;
  const maxHints = Math.min(Math.max(Math.round(draft.maxHints), 0), 3);
  const { data: currentLevel, error: currentLevelError } = await client
    .from('levels')
    .select('game_id, difficulty, title, max_duration_seconds, max_hints, status')
    .eq('id', id)
    .single();

  if (currentLevelError) throw currentLevelError;
  if (currentLevel.status === 'published' && hasPublishedRuntimeFieldChanges(currentLevel, {
    game_id: draft.gameId,
    difficulty,
    title,
    max_duration_seconds: maxDurationSeconds,
    max_hints: maxHints,
  })) {
    throw new Error('Unpublish this level before changing its game, difficulty, title, duration, or hint limit.');
  }

  const { data, error } = await client
    .from('levels')
    .update({
      game_id: draft.gameId,
      difficulty,
      title,
      description: toSafeText(draft.description) || null,
      max_duration_seconds: maxDurationSeconds,
      max_hints: maxHints,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as LevelRow;
}

export async function publishLevel(id: string): Promise<LevelLifecycleResponse> {
  const client = getClient();
  const { data: level, error: levelError } = await client
    .from('levels')
    .select('game_id')
    .eq('id', id)
    .maybeSingle();
  if (levelError) throw levelError;
  if (!level) throw new Error('This level is unavailable and cannot be published.');

  const { data: parentGame, error: gameError } = await client
    .from('games')
    .select('status')
    .eq('id', level.game_id)
    .maybeSingle();
  if (gameError) throw gameError;
  const parentGameBlockReason = getParentGamePublishBlockReason(parentGame?.status);
  if (parentGameBlockReason) throw new Error(parentGameBlockReason);

  return callLevelLifecycleRpc({ rpc: (name, args) => client.rpc(name, args) }, 'publish', id);
}

export async function unpublishLevel(id: string): Promise<LevelLifecycleResponse> {
  const client = getClient();
  return callLevelLifecycleRpc({ rpc: (name, args) => client.rpc(name, args) }, 'unpublish', id);
}

export async function archiveLevel(id: string): Promise<LevelLifecycleResponse> {
  const client = getClient();
  return callLevelLifecycleRpc({ rpc: (name, args) => client.rpc(name, args) }, 'archive', id);
}

export async function restoreLevel(id: string): Promise<LevelLifecycleResponse> {
  const client = getClient();
  return callLevelLifecycleRpc({ rpc: (name, args) => client.rpc(name, args) }, 'restore', id);
}

export async function deleteLevelById(id: string) {
  const client = getClient();
  const { data: level, error: levelError } = await client
    .from('levels')
    .select('status')
    .eq('id', id)
    .single();
  if (levelError) throw levelError;
  if (level.status === 'published') {
    throw new Error('Unpublish or archive this level before deleting it.');
  }

  const { error } = await client.from('levels').delete().eq('id', id);
  if (error?.code === '23503') {
    throw new Error('This level has runtime history or a published identity. Archive it instead of deleting it.');
  }
  if (error) throw error;
}

export async function createLevelSpot(draft: {
  levelId: string;
  spotKey: string;
  label: string;
  shape: 'circle' | 'rectangle';
  xNorm: number;
  yNorm: number;
  widthNorm: number | null;
  heightNorm: number | null;
  radiusNorm: number | null;
  toleranceNorm: number;
  scoreValue: number;
  sortOrder: number;
  active: boolean;
}) {
  const label = toSafeText(draft.label);
  const spotKey = toSafeText(draft.spotKey);
  if (!label) throw new Error('A spot label is required.');
  if (!spotKey) throw new Error('A spot key is required.');
  validateLevelSpotDraft(draft);

  const client = getClient();
  await ensureLevelsUnpublished(client, [draft.levelId]);

  const payload = {
    level_id: draft.levelId,
    spot_key: spotKey,
    label,
    shape: draft.shape,
    x_norm: draft.xNorm,
    y_norm: draft.yNorm,
    width_norm: draft.widthNorm,
    height_norm: draft.heightNorm,
    radius_norm: draft.radiusNorm,
    tolerance_norm: draft.toleranceNorm,
    score_value: draft.scoreValue,
    sort_order: draft.sortOrder,
    is_active: draft.active,
  };

  const { data, error } = await client
    .from('level_spots')
    .insert(payload)
    .select('*')
    .single();

  if (error) throw error;
  return data as LevelSpotRow;
}

function validateLevelSpotDraft(draft: {
  shape: 'circle' | 'rectangle';
  xNorm: number;
  yNorm: number;
  widthNorm: number | null;
  heightNorm: number | null;
  radiusNorm: number | null;
  toleranceNorm: number;
  scoreValue: number;
  sortOrder: number;
}) {
  const isNormalized = (value: number) => Number.isFinite(value) && value >= 0 && value <= 1;

  if (!isNormalized(draft.xNorm) || !isNormalized(draft.yNorm)) {
    throw new Error('Spot position must be between 0 and 1 on both axes.');
  }

  if (draft.shape === 'rectangle') {
    if (!draft.widthNorm || !draft.heightNorm || !isNormalized(draft.widthNorm) || !isNormalized(draft.heightNorm)) {
      throw new Error('Rectangle width and height must be greater than 0 and no more than 1.');
    }
    if (draft.radiusNorm !== null) throw new Error('Rectangle spots cannot have a radius.');
  } else {
    if (!draft.radiusNorm || !isNormalized(draft.radiusNorm)) {
      throw new Error('Circle radius must be greater than 0 and no more than 1.');
    }
    if (draft.widthNorm !== null || draft.heightNorm !== null) {
      throw new Error('Circle spots cannot have rectangle dimensions.');
    }
  }

  if (!Number.isFinite(draft.toleranceNorm) || draft.toleranceNorm < 0 || draft.toleranceNorm > 0.25) {
    throw new Error('Spot tolerance must be between 0 and 0.25.');
  }
  if (!Number.isInteger(draft.scoreValue) || draft.scoreValue < 0) {
    throw new Error('Spot score value must be a non-negative whole number.');
  }
  if (!Number.isInteger(draft.sortOrder) || draft.sortOrder < 0) {
    throw new Error('Spot sort order must be a non-negative whole number.');
  }
}

async function ensureLevelsUnpublished(client: ReturnType<typeof getClient>, levelIds: string[]) {
  const uniqueLevelIds = [...new Set(levelIds)];
  const { data, error } = await client
    .from('levels')
    .select('id, status')
    .in('id', uniqueLevelIds);

  if (error) throw error;
  if (data.length !== uniqueLevelIds.length) {
    throw new Error('One or more levels assigned to this spot are unavailable.');
  }
  if (data.some((level) => level.status === 'published')) {
    throw new Error('Unpublish the associated level before adding, editing, or removing spots.');
  }
}

async function getSpotLevelId(client: ReturnType<typeof getClient>, id: string) {
  const { data, error } = await client
    .from('level_spots')
    .select('level_id')
    .eq('id', id)
    .single();

  if (error) throw error;
  if (!data.level_id) throw new Error('The spot has no level reference and cannot be changed.');
  return data.level_id as string;
}

export async function updateLevelSpotById(
  id: string,
  draft: {
    levelId: string;
    label: string;
    shape: 'circle' | 'rectangle';
    xNorm: number;
    yNorm: number;
    widthNorm: number | null;
    heightNorm: number | null;
    radiusNorm: number | null;
    toleranceNorm: number;
    scoreValue: number;
    sortOrder: number;
    active: boolean;
  },
) {
  const label = toSafeText(draft.label);
  if (!label) throw new Error('A spot label is required.');
  validateLevelSpotDraft(draft);

  const client = getClient();
  const currentLevelId = await getSpotLevelId(client, id);
  await ensureLevelsUnpublished(client, [currentLevelId, draft.levelId]);
  const { data, error } = await client
    .from('level_spots')
    .update({
      level_id: draft.levelId,
      label,
      shape: draft.shape,
      x_norm: draft.xNorm,
      y_norm: draft.yNorm,
      width_norm: draft.widthNorm,
      height_norm: draft.heightNorm,
      radius_norm: draft.radiusNorm,
      tolerance_norm: draft.toleranceNorm,
      score_value: draft.scoreValue,
      sort_order: draft.sortOrder,
      is_active: draft.active,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as LevelSpotRow;
}

export async function deactivateLevelSpot(id: string) {
  const client = getClient();
  const levelId = await getSpotLevelId(client, id);
  await ensureLevelsUnpublished(client, [levelId]);
  const { data, error } = await client
    .from('level_spots')
    .update({ is_active: false, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as LevelSpotRow;
}

export async function reactivateLevelSpot(id: string) {
  const client = getClient();
  const levelId = await getSpotLevelId(client, id);
  await ensureLevelsUnpublished(client, [levelId]);
  const { data, error } = await client
    .from('level_spots')
    .update({ is_active: true, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw error;
  return data as LevelSpotRow;
}

export async function deleteLevelSpotById(id: string) {
  const client = getClient();
  const levelId = await getSpotLevelId(client, id);
  await ensureLevelsUnpublished(client, [levelId]);
  const { error } = await client.from('level_spots').delete().eq('id', id);
  if (error?.message.includes('cannot be inserted, updated, or deleted while a level is published')) {
    throw new Error('Unpublish the associated level before removing spots.');
  }
  if (error) throw error;
}
