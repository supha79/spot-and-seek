import { supabase, supabaseConfigError } from '../supabaseClient';
import type { GameRow, LevelRow, LevelSpotRow } from './content';
import { getPublishedGameplayAssetPairForLevel, type PublishedGameplayAssetPair } from './levelAssets';

export type PublishedLevelContent = {
  level: LevelRow;
  spots: LevelSpotRow[];
  originalImageUrl: string | null;
  comparisonImageUrl: string | null;
  assetPair: PublishedGameplayAssetPair;
  artworkNotice: string | null;
};

function getClient() {
  if (!supabase) {
    throw new Error(supabaseConfigError ?? 'Supabase is not configured.');
  }

  return supabase;
}

export async function getPublishedGames(): Promise<GameRow[]> {
  const { data, error } = await getClient()
    .from('games')
    .select('*')
    .eq('status', 'published')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Could not load published games: ${error.message}`);
  return (data ?? []) as GameRow[];
}

export async function getPublishedLevels(gameId: string): Promise<LevelRow[]> {
  const { data, error } = await getClient()
    .from('levels')
    .select('*, games!inner(status)')
    .eq('game_id', gameId)
    .eq('status', 'published')
    .eq('games.status', 'published')
    .order('sort_order', { ascending: true });

  if (error) throw new Error(`Could not load published levels: ${error.message}`);
  return (data ?? []) as LevelRow[];
}

function isNormalizedCoordinate(value: number) {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function validateSpotGeometry(spot: LevelSpotRow) {
  if (!isNormalizedCoordinate(spot.x_norm) || !isNormalizedCoordinate(spot.y_norm)) {
    throw new Error(`Spot "${spot.label}" has coordinates outside the normalized 0..1 range.`);
  }

  if (spot.shape === 'rectangle') {
    if (
      !spot.width_norm || !spot.height_norm
      || !isNormalizedCoordinate(spot.width_norm)
      || !isNormalizedCoordinate(spot.height_norm)
    ) {
      throw new Error(`Spot "${spot.label}" has invalid rectangle dimensions.`);
    }
    return;
  }

  if (spot.shape === 'circle') {
    if (!spot.radius_norm || !isNormalizedCoordinate(spot.radius_norm)) {
      throw new Error(`Spot "${spot.label}" has an invalid circle radius.`);
    }
    return;
  }

  throw new Error(`Spot "${spot.label}" uses an unsupported shape.`);
}

export async function getPublishedLevelContent(levelId: string): Promise<PublishedLevelContent> {
  const client = getClient();
  const { data: level, error: levelError } = await client
    .from('levels')
    .select('*, games!inner(status)')
    .eq('id', levelId)
    .eq('status', 'published')
    .eq('games.status', 'published')
    .maybeSingle();

  if (levelError) throw new Error(`Could not load the selected level: ${levelError.message}`);
  if (!level) throw new Error('This level is not available as published content.');

  const { data: spots, error: spotsError } = await client
    .from('level_spots')
    .select('*')
    .eq('level_id', levelId)
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (spotsError) throw new Error(`Could not load active level spots: ${spotsError.message}`);

  const activeSpots = (spots ?? []) as LevelSpotRow[];
  activeSpots.forEach(validateSpotGeometry);
  const assetPair = await getPublishedGameplayAssetPairForLevel(levelId);

  return {
    level: level as LevelRow,
    spots: activeSpots,
    originalImageUrl: assetPair.original.signed_url,
    comparisonImageUrl: assetPair.comparison.signed_url,
    assetPair,
    artworkNotice: null,
  };
}