import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase } from '../supabaseClient';
import { countUnmappedSpotReferences } from '../services/compatibilityContracts';
import {
  archiveGame,
  archiveLevel,
  createGame,
  createLevel,
  createLevelSpot,
  deactivateLevelSpot,
  deleteGameById,
  deleteLevelById,
  deleteLevelSpotById,
  fetchContentCatalog,
  publishGame,
  publishLevel,
  reactivateLevelSpot,
  unpublishGame,
  unpublishLevel,
  updateGameById,
  updateLevelById,
  updateLevelSpotById,
  type ContentStatus,
  type LevelRow,
  type LevelSpotRow,
} from '../services/content';

export type AdminDifficulty = 'Easy' | 'Medium' | 'Hard';

export type AdminGame = {
  id: string;
  name: string;
  description: string;
  status: ContentStatus;
  levels: number;
  createdAt: string;
};

export type AdminLevel = {
  id: string;
  title: string;
  description: string;
  difficulty: AdminDifficulty;
  emoji: string;
  time: number;
  maxHints: number;
  questions: number;
  status: ContentStatus;
  gameId: string;
};

type AdminLevelDraft = Omit<AdminLevel, 'id' | 'questions' | 'status'>;

export type AdminQuestion = {
  id: string;
  levelId: string;
  levelName: string;
  difficulty: AdminDifficulty;
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
  createdAt: string;
};

type AdminSpotDraft = Omit<AdminQuestion, 'id' | 'levelName' | 'difficulty' | 'createdAt'>;

type AdminDataContextValue = {
  games: AdminGame[];
  levels: AdminLevel[];
  questions: AdminQuestion[];
  isLoading: boolean;
  error: string | null;
  catalogWarnings: string[];
  clearError: () => void;
  refreshCatalog: () => Promise<void>;
  addGame: (draft: { name: string; description: string }) => Promise<void>;
  updateGame: (id: string, draft: { name: string; description: string }) => Promise<void>;
  deleteGame: (id: string) => Promise<void>;
  publishGame: (id: string) => Promise<void>;
  unpublishGame: (id: string) => Promise<void>;
  archiveGame: (id: string) => Promise<void>;
  addLevel: (draft: AdminLevelDraft) => Promise<void>;
  updateLevel: (id: string, draft: AdminLevelDraft) => Promise<void>;
  deleteLevel: (id: string) => Promise<void>;
  publishLevel: (id: string) => Promise<void>;
  unpublishLevel: (id: string) => Promise<void>;
  archiveLevel: (id: string) => Promise<void>;
  addQuestion: (draft: AdminSpotDraft) => Promise<void>;
  updateQuestion: (id: string, draft: AdminSpotDraft) => Promise<void>;
  deleteQuestion: (id: string) => Promise<void>;
  deactivateQuestion: (id: string) => Promise<void>;
  reactivateQuestion: (id: string) => Promise<void>;
};

const difficultyOrder: Record<string, AdminDifficulty> = {
  easy: 'Easy',
  medium: 'Medium',
  hard: 'Hard',
};

const emojiByDifficulty: Record<AdminDifficulty, string> = {
  Easy: '🐱',
  Medium: '🌾',
  Hard: '🌙',
};

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === 'string') return error;
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }
  return 'An unexpected error occurred.';
}

export type ContentMutationResult =
  | { status: 'save_failed'; error: unknown }
  | { status: 'saved_and_refreshed' }
  | { status: 'saved_refresh_failed'; error: unknown };

export async function persistContentMutation(
  save: () => Promise<unknown>,
  refresh: () => Promise<void>,
): Promise<ContentMutationResult> {
  try {
    await save();
  } catch (error) {
    return { status: 'save_failed', error };
  }

  try {
    await refresh();
  } catch (error) {
    return { status: 'saved_refresh_failed', error };
  }

  return { status: 'saved_and_refreshed' };
}

function formatAdminDate(value: string | null | undefined) {
  if (!value) return 'Just now';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Just now' : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
}

function normalizeDifficulty(value: string | null | undefined): AdminDifficulty {
  return difficultyOrder[value?.toLowerCase() ?? 'easy'] ?? 'Easy';
}

function mapLevelEmoji(levelTitle: string, difficulty: AdminDifficulty) {
  const title = levelTitle.toLowerCase();

  if (title.includes('cat')) return '🐱';
  if (title.includes('tea')) return '🫖';
  if (title.includes('balloon')) return '🎈';
  if (title.includes('windmill') || title.includes('breezy')) return '🌾';
  if (title.includes('picnic') || title.includes('sunny')) return '🧺';
  if (title.includes('night') || title.includes('starlit')) return '🌙';

  return emojiByDifficulty[difficulty] ?? '🌙';
}

function mapLevelRows(levels: LevelRow[], groupedSpots: Map<string, LevelSpotRow[]>) {
  return levels.map((level) => {
    const difficulty = normalizeDifficulty(level.difficulty);

    return {
      id: level.id,
      title: level.title,
      description: level.description ?? '',
      difficulty,
      emoji: mapLevelEmoji(level.title, difficulty),
      time: level.max_duration_seconds ?? 120,
      maxHints: level.max_hints ?? 3,
      questions: groupedSpots.get(level.id)?.length ?? 0,
      status: level.status,
      gameId: level.game_id,
    } satisfies AdminLevel;
  });
}

function mapSpotRows(levels: LevelRow[], spots: LevelSpotRow[]): AdminQuestion[] {
  const levelLookup = new Map(levels.map((level) => [level.id, level]));

  return spots
    .map((spot) => {
      if (!spot.level_id) return null;

      const level = levelLookup.get(spot.level_id);
      if (!level) return null;

      const difficulty = normalizeDifficulty(level.difficulty);
      const levelPosition = levels.findIndex((item) => item.id === level.id) + 1;

      return {
        id: spot.id,
        levelId: spot.level_id,
        levelName: `Level ${levelPosition} — ${level.title}`,
        difficulty,
        spotKey: spot.spot_key,
        label: spot.label,
        shape: spot.shape,
        xNorm: spot.x_norm,
        yNorm: spot.y_norm,
        widthNorm: spot.width_norm,
        heightNorm: spot.height_norm,
        radiusNorm: spot.radius_norm,
        toleranceNorm: spot.tolerance_norm ?? 0.03,
        scoreValue: spot.score_value ?? 0,
        sortOrder: spot.sort_order ?? 0,
        active: spot.is_active,
        createdAt: formatAdminDate(spot.created_at),
      } satisfies AdminQuestion;
    })
    .filter((question): question is AdminQuestion => question !== null);
}

const AdminDataContext = createContext<AdminDataContextValue | undefined>(undefined);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const catalogRequestId = useRef(0);
  const [games, setGames] = useState<AdminGame[]>([]);
  const [levels, setLevels] = useState<AdminLevel[]>([]);
  const [questions, setQuestions] = useState<AdminQuestion[]>([]);
  const [error, setError] = useState<string | null>(supabase ? null : 'Supabase is not configured.');
  const [catalogWarnings, setCatalogWarnings] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(Boolean(supabase));

  const refreshCatalog = async () => {
    const requestId = ++catalogRequestId.current;
    setIsLoading(true);
    if (!supabase) {
      setError('Supabase is not configured.');
      setGames([]);
      setLevels([]);
      setQuestions([]);
      setCatalogWarnings([]);
      setIsLoading(false);
      return;
    }

    if (!user?.emailConfirmedAt || !user.isAdmin) {
      setError(null);
      setGames([]);
      setLevels([]);
      setQuestions([]);
      setCatalogWarnings([]);
      setIsLoading(false);
      return;
    }

    try {
      const { games: gameRows, levels: levelRows, spots: spotRows } = await fetchContentCatalog();
      if (requestId !== catalogRequestId.current) return;
      const groupedSpots = new Map<string, LevelSpotRow[]>();
      const unmappedSpotCount = countUnmappedSpotReferences(levelRows.map((level) => level.id), spotRows);

      for (const spot of spotRows) {
        if (!spot.level_id) continue;

        const existing = groupedSpots.get(spot.level_id) ?? [];
        existing.push(spot);
        groupedSpots.set(spot.level_id, existing);
      }

      const mappedLevels = mapLevelRows(levelRows, groupedSpots);
      const mappedGames: AdminGame[] = gameRows.map((game) => ({
        id: game.id,
        name: game.name,
        description: game.description ?? '',
        status: game.status,
        levels: mappedLevels.filter((level) => level.gameId === game.id).length,
        createdAt: formatAdminDate(game.created_at),
      }));
      const mappedQuestions: AdminQuestion[] = mapSpotRows(levelRows, spotRows);

      setGames(mappedGames);
      setLevels(mappedLevels);
      setQuestions(mappedQuestions);
      setCatalogWarnings(unmappedSpotCount > 0
        ? [`${unmappedSpotCount} spot(s) are omitted because their level reference is missing or does not match a catalog level. No records were changed.`]
        : []);
      setError(null);
    } catch (caughtError) {
      if (requestId !== catalogRequestId.current) return;
      const message = getErrorMessage(caughtError);
      setError(message);
      setGames([]);
      setLevels([]);
      setQuestions([]);
      setCatalogWarnings([]);
      throw new Error(message);
    } finally {
      if (requestId === catalogRequestId.current) setIsLoading(false);
    }
  };

  useEffect(() => {
    void refreshCatalog().catch(() => undefined);
  }, [user?.emailConfirmedAt, user?.id, user?.isAdmin]);

  const clearError = () => setError(null);

  const runContentMutation = async (save: () => Promise<unknown>) => {
    const result = await persistContentMutation(save, refreshCatalog);
    if (result.status === 'save_failed') {
      throw new Error(getErrorMessage(result.error));
    }
    if (result.status === 'saved_refresh_failed') {
      setError(`Saved successfully, but the catalog could not be refreshed: ${getErrorMessage(result.error)}`);
      return;
    }
    setError(null);
  };

  const addGame = async (draft: { name: string; description: string }) => {
    const name = draft.name.trim();
    if (!name) {
      throw new Error('A game name is required.');
    }

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Create game is unavailable until the project is configured.');
      }

      await runContentMutation(() => createGame(draft));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const updateGame = async (id: string, draft: { name: string; description: string }) => {
    const name = draft.name.trim();
    if (!name) {
      throw new Error('A game name is required.');
    }

    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Update game is unavailable until the project is configured.');
      }

      await runContentMutation(() => updateGameById(id, draft));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const deleteGame = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Delete game is unavailable until the project is configured.');
      }

      await runContentMutation(() => deleteGameById(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const publishGameRecord = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Publish is unavailable until the project is configured.');
      }

      await runContentMutation(() => publishGame(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const unpublishGameRecord = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Unpublish is unavailable until the project is configured.');
      }

      await runContentMutation(() => unpublishGame(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const archiveGameRecord = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Archive is unavailable until the project is configured.');
      }

      await runContentMutation(() => archiveGame(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const addLevel = async (draft: AdminLevelDraft) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Create level is unavailable until the project is configured.');
      }

      await runContentMutation(() => createLevel({
        gameId: draft.gameId,
        title: draft.title,
        description: draft.description,
        difficulty: draft.difficulty,
        time: draft.time,
        maxHints: draft.maxHints,
      }));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const updateLevel = async (id: string, draft: AdminLevelDraft) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Update level is unavailable until the project is configured.');
      }

      await runContentMutation(() => updateLevelById(id, {
        gameId: draft.gameId,
        title: draft.title,
        description: draft.description,
        difficulty: draft.difficulty,
        time: draft.time,
        maxHints: draft.maxHints,
      }));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const deleteLevel = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Delete level is unavailable until the project is configured.');
      }

      await runContentMutation(() => deleteLevelById(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const publishLevelRecord = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Publish level is unavailable until the project is configured.');
      }

      await runContentMutation(() => publishLevel(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const unpublishLevelRecord = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Unpublish level is unavailable until the project is configured.');
      }

      await runContentMutation(() => unpublishLevel(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const archiveLevelRecord = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Archive level is unavailable until the project is configured.');
      }

      await runContentMutation(() => archiveLevel(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const addQuestion = async (draft: AdminSpotDraft) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Add question is unavailable until the project is configured.');
      }

      await runContentMutation(() => createLevelSpot({
        levelId: draft.levelId,
        spotKey: draft.spotKey,
        label: draft.label,
        shape: draft.shape,
        xNorm: draft.xNorm,
        yNorm: draft.yNorm,
        widthNorm: draft.widthNorm,
        heightNorm: draft.heightNorm,
        radiusNorm: draft.radiusNorm,
        toleranceNorm: draft.toleranceNorm,
        scoreValue: draft.scoreValue,
        sortOrder: draft.sortOrder,
        active: draft.active,
      }));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const updateQuestion = async (id: string, draft: AdminSpotDraft) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Update question is unavailable until the project is configured.');
      }

      await runContentMutation(() => updateLevelSpotById(id, {
        levelId: draft.levelId,
        label: draft.label,
        shape: draft.shape,
        xNorm: draft.xNorm,
        yNorm: draft.yNorm,
        widthNorm: draft.widthNorm,
        heightNorm: draft.heightNorm,
        radiusNorm: draft.radiusNorm,
        toleranceNorm: draft.toleranceNorm,
        scoreValue: draft.scoreValue,
        sortOrder: draft.sortOrder,
        active: draft.active,
      }));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const deleteQuestion = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Delete question is unavailable until the project is configured.');
      }

      await runContentMutation(() => deleteLevelSpotById(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const deactivateQuestion = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Deactivate question is unavailable until the project is configured.');
      }

      await runContentMutation(() => deactivateLevelSpot(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const reactivateQuestion = async (id: string) => {
    try {
      if (!supabase) {
        throw new Error('Supabase is not configured. Reactivate question is unavailable until the project is configured.');
      }

      await runContentMutation(() => reactivateLevelSpot(id));
    } catch (caughtError) {
      const message = getErrorMessage(caughtError);
      setError(message);
      throw new Error(message);
    }
  };

  const value = useMemo<AdminDataContextValue>(
    () => ({
      games,
      levels,
      questions,
      isLoading,
      error,
      catalogWarnings,
      clearError,
      refreshCatalog,
      addGame,
      updateGame,
      deleteGame,
      publishGame: publishGameRecord,
      unpublishGame: unpublishGameRecord,
      archiveGame: archiveGameRecord,
      addLevel,
      updateLevel,
      deleteLevel,
      publishLevel: publishLevelRecord,
      unpublishLevel: unpublishLevelRecord,
      archiveLevel: archiveLevelRecord,
      addQuestion,
      updateQuestion,
      deleteQuestion,
      deactivateQuestion,
      reactivateQuestion,
    }),
    [games, levels, questions, isLoading, error, catalogWarnings],
  );

  return <AdminDataContext.Provider value={value}>{children}</AdminDataContext.Provider>;
}

export function useAdminData() {
  const context = useContext(AdminDataContext);

  if (!context) {
    throw new Error('useAdminData must be used within an AdminDataProvider.');
  }

  return context;
}

export default AdminDataContext;
