import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { buddyOptions, type BuddyOption } from '../data/buddies';
import { supabase, supabaseConfigError } from '../supabaseClient';
import { getPublishedGames, getPublishedLevels } from '../services/playerContent';
import { resolveLevelIdentity, type GameRow, type LevelIdentity, type LevelRow } from '../services/content';
import { getCompletedLevelIdentityKey, getGameRunReadinessNotice, resolveHistoryIdentity, type DynamicGameplayGateState } from '../services/compatibilityContracts';
import { readDynamicGameplayGateState } from '../services/dynamicGameplayGate';

export type DifficultyMode = 'easy' | 'medium' | 'hard';
export { buddyOptions };
export type { BuddyOption };

export type Level = {
  id: string;
  identity: LevelIdentity;
  gameId?: string;
  difficulty: DifficultyMode;
  title: string;
  subtitle: string;
  description: string;
  differences: number;
  time: number;
  maxHints: number;
  stars: number;
  cleared: boolean;
  bestScore: number;
  image: string;
};

export type PlayerGame = Pick<GameRow, 'id' | 'slug' | 'name' | 'description'>;

export type HistoryEntry = {
  id: string;
  identity: LevelIdentity;
  playableLevelId: string | null;
  title: string;
  difficulty: string;
  date: string;
  score: number | null;
  result: string | null;
  status: 'Cleared' | 'Lost' | 'Unknown';
};

function formatHistoryDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

export type GameProfile = {
  username: string;
  displayName: string;
  selectedBuddy: string;
  levelsCompleted: number;
  totalLevels: number;
  bestScore: number;
  totalPlays: number;
  avgTime: number;
  statsNotice: string | null;
};

const selectedBuddyStorageKey = 'spot-and-seek:selected-buddy:';

function readStoredBuddy(userId: string) {
  try {
    const buddy = window.localStorage.getItem(`${selectedBuddyStorageKey}${userId}`);
    return buddyOptions.some((option) => option.id === buddy) ? buddy : null;
  } catch {
    return null;
  }
}

function storeBuddy(userId: string, buddy: string) {
  try {
    window.localStorage.setItem(`${selectedBuddyStorageKey}${userId}`, buddy);
  } catch {
    return;
  }
}

type ProfileRunRow = {
  level_id: string | null;
  content_level_id?: string | null;
  rule_version_id?: string | null;
  elapsed_active_seconds: number | string;
  status: string;
};

type HistorySessionRow = {
  id: string;
  level_id: string | null;
  content_level_id?: string | null;
  level_key?: string | null;
  rule_version_id?: string | null;
  score: number | null;
  result: string | null;
  played_at: string;
};

function isMissingDynamicIdentityColumns(error: { code?: string; message: string }) {
  return error.code === '42703'
    || error.code === 'PGRST204'
    || /column .* does not exist|could not find.*column.*schema cache/i.test(error.message);
}

async function fetchProfileRunRows(userId: string) {
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');

  const dynamicResult = await supabase
    .from('game_runs')
    .select('level_id, content_level_id, rule_version_id, elapsed_active_seconds, status')
    .eq('user_id', userId)
    .in('status', ['won', 'lost']);

  if (!dynamicResult.error) {
    return { rows: (dynamicResult.data ?? []) as ProfileRunRow[], supportsDynamicIdentity: true };
  }
  if (!isMissingDynamicIdentityColumns(dynamicResult.error)) throw dynamicResult.error;

  const legacyResult = await supabase
    .from('game_runs')
    .select('level_id, elapsed_active_seconds, status')
    .eq('user_id', userId)
    .in('status', ['won', 'lost']);

  if (legacyResult.error) throw legacyResult.error;
  return { rows: (legacyResult.data ?? []) as ProfileRunRow[], supportsDynamicIdentity: false };
}

async function fetchHistorySessionRows(userId: string) {
  if (!supabase) throw new Error(supabaseConfigError ?? 'Supabase is not configured.');

  const dynamicResult = await supabase
    .from('game_sessions')
    .select('id, level_id, content_level_id, level_key, rule_version_id, score, result, played_at')
    .eq('user_id', userId)
    .order('played_at', { ascending: false });

  if (!dynamicResult.error) {
    return { rows: (dynamicResult.data ?? []) as HistorySessionRow[], supportsDynamicIdentity: true };
  }
  if (!isMissingDynamicIdentityColumns(dynamicResult.error)) throw dynamicResult.error;

  const legacyResult = await supabase
    .from('game_sessions')
    .select('id, level_id, score, result, played_at')
    .eq('user_id', userId)
    .order('played_at', { ascending: false });

  if (legacyResult.error) throw legacyResult.error;
  return { rows: (legacyResult.data ?? []) as HistorySessionRow[], supportsDynamicIdentity: false };
}

export const difficultyOptions = [
  {
    id: 'easy',
    name: 'Easy',
    description: 'A relaxed warm-up.',
    accent: 'secondary',
    highlight: false,
  },
  {
    id: 'medium',
    name: 'Medium',
    description: 'A little more detail and a sharper eye.',
    accent: 'primary',
    highlight: true,
  },
  {
    id: 'hard',
    name: 'Hard',
    description: 'Dense layouts and a sharper challenge.',
    accent: 'tertiary',
    highlight: false,
  },
] as const;

type GameDataContextValue = {
  games: PlayerGame[];
  dynamicGameplayGateState: DynamicGameplayGateState;
  refreshDynamicGameplayGate: () => Promise<void>;
  gamesLoading: boolean;
  gamesError: string | null;
  refreshGames: () => Promise<void>;
  selectedGameId: string | null;
  selectGame: (gameId: string) => void;
  profile: GameProfile;
  profileLoading: boolean;
  profileAvailable: boolean;
  profileError: string | null;
  refreshProfile: () => void;
  history: HistoryEntry[];
  historyLoading: boolean;
  historyError: string | null;
  historyNotice: string | null;
  refreshHistory: () => void;
  levels: Level[];
  levelsLoading: boolean;
  levelsError: string | null;
  refreshLevels: () => Promise<void>;
  buddyOptions: BuddyOption[];
  selectedBuddy: string;
  setSelectedBuddy: (buddy: string) => void;
};

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);
function mapPublishedLevel(level: LevelRow): Level {
  const identity = resolveLevelIdentity({
    contentLevelId: level.id,
    levelKey: level.level_key,
  });

  return {
    id: level.id,
    identity,
    gameId: level.game_id,
    difficulty: level.difficulty,
    title: level.title,
    subtitle: level.subtitle ?? '',
    description: level.description ?? '',
    differences: 0,
    time: level.max_duration_seconds ?? 0,
    maxHints: level.max_hints ?? 3,
    stars: 0,
    cleared: false,
    bestScore: 0,
    image: '',
  };
}

export function GameDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [games, setGames] = useState<PlayerGame[]>([]);
  const [dynamicGameplayGateState, setDynamicGameplayGateState] = useState<DynamicGameplayGateState>('unknown');
  const [gamesLoading, setGamesLoading] = useState(true);
  const [gamesError, setGamesError] = useState<string | null>(null);
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);
  const [levels, setLevels] = useState<Level[]>([]);
  const [levelsLoading, setLevelsLoading] = useState(true);
  const [levelsError, setLevelsError] = useState<string | null>(null);
  const [selectedBuddy, setSelectedBuddy] = useState('Bunny');
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyOwnerId, setHistoryOwnerId] = useState<string | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyNotice, setHistoryNotice] = useState<string | null>(null);
  const [historyRevision, setHistoryRevision] = useState(0);
  const [profileData, setProfileData] = useState<GameProfile | null>(null);
  const [profileOwnerId, setProfileOwnerId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const gamesRequestId = useRef(0);
  const levelRequestId = useRef(0);
  const dynamicGameplayGateRequestId = useRef(0);
  const refreshProfile = useCallback(() => setProfileRevision((revision) => revision + 1), []);
  const refreshHistory = useCallback(() => setHistoryRevision((revision) => revision + 1), []);
  const refreshDynamicGameplayGate = useCallback(async () => {
    const requestId = ++dynamicGameplayGateRequestId.current;
    setDynamicGameplayGateState('unknown');
    const client = supabase;
    if (!user || !client) return;

    const state = await readDynamicGameplayGateState({
      rpc: (name, args) => client.rpc(name, args),
    });
    if (requestId === dynamicGameplayGateRequestId.current) setDynamicGameplayGateState(state);
  }, [user?.id]);

  const refreshGames = useCallback(async () => {
    const requestId = ++gamesRequestId.current;
    if (!user?.emailConfirmedAt) {
      levelRequestId.current += 1;
      setGames([]);
      setSelectedGameId(null);
      setLevels([]);
      setLevelsLoading(false);
      setLevelsError(null);
      setGamesError(null);
      setGamesLoading(false);
      return;
    }

    setGamesLoading(true);
    setGamesError(null);

    try {
      const rows = await getPublishedGames();
      if (requestId !== gamesRequestId.current) return;
      setGames(rows.map(({ id, slug, name, description }) => ({ id, slug, name, description })));
      setSelectedGameId((currentId) => rows.some((game) => game.id === currentId) ? currentId : rows[0]?.id ?? null);
    } catch (error) {
      if (requestId !== gamesRequestId.current) return;
      setGames([]);
      setSelectedGameId(null);
      levelRequestId.current += 1;
      setLevels([]);
      setLevelsLoading(false);
      setLevelsError(null);
      setGamesError(error instanceof Error ? error.message : 'Could not load published games.');
    } finally {
      if (requestId === gamesRequestId.current) setGamesLoading(false);
    }
  }, [user?.emailConfirmedAt, user?.id]);

  const refreshLevels = useCallback(async () => {
    const requestId = ++levelRequestId.current;
    if (!user?.emailConfirmedAt || !selectedGameId) {
      setLevels([]);
      setLevelsLoading(false);
      setLevelsError(null);
      return;
    }

    setLevelsLoading(true);
    setLevelsError(null);

    try {
      const rows = await getPublishedLevels(selectedGameId);
      if (requestId === levelRequestId.current) setLevels(rows.map(mapPublishedLevel));
    } catch (error) {
      if (requestId === levelRequestId.current) {
        setLevels([]);
        setLevelsError(error instanceof Error ? error.message : 'Could not load published levels.');
      }
    } finally {
      if (requestId === levelRequestId.current) setLevelsLoading(false);
    }
  }, [selectedGameId, user?.emailConfirmedAt, user?.id]);

  const selectGame = useCallback((gameId: string) => {
    if (!games.some((game) => game.id === gameId)) return;
    levelRequestId.current += 1;
    setLevels([]);
    setLevelsLoading(true);
    setLevelsError(null);
    setSelectedGameId(gameId);
  }, [games]);

  useEffect(() => {
    void refreshGames();
  }, [refreshGames]);

  useEffect(() => {
    if (!user) {
      dynamicGameplayGateRequestId.current += 1;
      setDynamicGameplayGateState('unknown');
      return;
    }
    void refreshDynamicGameplayGate();
  }, [refreshDynamicGameplayGate, user]);

  useEffect(() => {
    void refreshLevels();
  }, [refreshLevels]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setProfileData(null);
      setSelectedBuddy('Bunny');
      setProfileLoading(false);
      setProfileError(null);
      return () => {
        isMounted = false;
      };
    }

    if (!supabase) {
      setProfileLoading(false);
      setProfileError(supabaseConfigError ?? 'Supabase is not configured.');
      return () => {
        isMounted = false;
      };
    }

    setProfileLoading(true);
    setProfileError(null);
    setProfileData(null);
    setProfileOwnerId(null);

    void Promise.all([
      supabase
        .from('profiles')
        .select('username, selected_buddy, best_score, total_plays')
        .eq('id', user.id)
        .maybeSingle(),
      fetchProfileRunRows(user.id),
    ])
      .then(([profileResult, runsResult]) => {
        if (!isMounted) return;
        if (profileResult.error) throw profileResult.error;
        if (!profileResult.data) throw new Error('Your player profile was not found.');

        const { rows: runs, supportsDynamicIdentity } = runsResult;
        const completedLevelIdentities = new Set<string>();
        let incompleteWonRunCount = 0;
        for (const run of runs) {
          if (run.status !== 'won') continue;

          const identityKey = getCompletedLevelIdentityKey(run);
          if (identityKey) completedLevelIdentities.add(identityKey);
          else incompleteWonRunCount += 1;
        }
        const averageSeconds = runs.length
          ? Math.round(runs.reduce((total, run) => total + Number(run.elapsed_active_seconds), 0) / runs.length)
          : 0;
        const statsNotices = [];
        if (!supportsDynamicIdentity) {
          statsNotices.push('This backend does not expose dynamic run identity fields. Completed stages count is limited to Legacy runs.');
        }
        if (incompleteWonRunCount > 0) {
          statsNotices.push(`${incompleteWonRunCount} won run(s) have incomplete level identity and are not included in completed stages.`);
        }
        const buddy = profileResult.data.selected_buddy;

        setSelectedBuddy(buddy);
        storeBuddy(user.id, buddy);
        setProfileData({
          username: profileResult.data.username,
          displayName: profileResult.data.username,
          selectedBuddy: buddy,
          levelsCompleted: completedLevelIdentities.size,
          totalLevels: levels.length,
          bestScore: profileResult.data.best_score,
          totalPlays: profileResult.data.total_plays,
          avgTime: averageSeconds,
          statsNotice: statsNotices.length ? statsNotices.join(' ') : null,
        });
        setProfileOwnerId(user.id);
        setProfileLoading(false);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setProfileError(error instanceof Error ? error.message : 'Could not load your profile.');
        setProfileLoading(false);
      });

    return () => {
      isMounted = false;
    };
  }, [levels.length, profileRevision, user?.id, user?.username]);

  useEffect(() => {
    let isMounted = true;

    if (!user) {
      setHistory([]);
      setHistoryOwnerId(null);
      setHistoryLoading(false);
      setHistoryError(null);
      setHistoryNotice(null);
      return () => {
        isMounted = false;
      };
    }

    if (levelsLoading) {
      setHistoryLoading(true);
      return () => {
        isMounted = false;
      };
    }

    setHistory([]);
    setHistoryOwnerId(user.id);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryNotice(null);

    if (!supabase) {
      setHistoryLoading(false);
      setHistoryError(supabaseConfigError ?? 'Supabase is not configured.');
      setHistoryNotice(null);
      return () => {
        isMounted = false;
      };
    }

    void (async () => {
      try {
        const { rows, supportsDynamicIdentity } = await fetchHistorySessionRows(user.id);
        if (!isMounted) return;

        const mappedSessions = rows.map((session) => ({ session, ...resolveHistoryIdentity(session) }));
        const incompleteIdentityCount = mappedSessions.filter(({ isComplete }) => !isComplete).length;
        const historyNotices = [];
        if (!supportsDynamicIdentity) {
          historyNotices.push('This backend does not expose dynamic history identity fields. Legacy history is shown; dynamic history may be incomplete.');
        }
        if (incompleteIdentityCount > 0) {
          historyNotices.push(`${incompleteIdentityCount} history record(s) have incomplete level identity; available identifiers are shown without inferred details.`);
        }
        setHistoryNotice(historyNotices.length ? historyNotices.join(' ') : null);

        setHistory(mappedSessions.map(({ session, identity, isComplete }) => {
          const level = isComplete && identity.contentLevelId
            ? levels.find((item) => item.identity.contentLevelId === identity.contentLevelId && item.identity.levelKey === identity.levelKey)
            : isComplete && identity.legacyLevelId
              ? levels.find((item) => item.identity.legacyLevelId === identity.legacyLevelId)
              : undefined;
          return {
            id: session.id,
            identity,
            playableLevelId: level && !getGameRunReadinessNotice(level.identity, dynamicGameplayGateState) ? level.id : null,
            title: level?.title ?? 'Level details unavailable',
            difficulty: level?.difficulty ?? 'Not available',
            date: formatHistoryDate(session.played_at),
            score: session.score,
            result: session.result,
            status: session.result === 'win' ? 'Cleared' : session.result === 'loss' ? 'Lost' : 'Unknown',
          };
        }));
      } catch (error: unknown) {
        if (!isMounted) return;
        setHistory([]);
        setHistoryError(error instanceof Error ? error.message : 'Could not load game history.');
      } finally {
        if (isMounted) setHistoryLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [historyRevision, levels, levelsLoading, user?.id]);

  const updateSelectedBuddy = async (buddy: string) => {
    if (!buddyOptions.some((option) => option.id === buddy)) return;
    const previousBuddy = selectedBuddy;
    setSelectedBuddy(buddy);
    setProfileError(null);

    try {
      if (!supabase || !user) {
        throw new Error(supabaseConfigError ?? 'Sign in to save your buddy.');
      }
      const { error } = await supabase
        .from('profiles')
        .update({ selected_buddy: buddy })
        .eq('id', user.id);
      if (error) throw error;
      storeBuddy(user.id, buddy);
      setProfileData((current) => current ? { ...current, selectedBuddy: buddy } : current);
    } catch (error) {
      setSelectedBuddy((current) => current === buddy ? previousBuddy : current);
      setProfileError(error instanceof Error ? error.message : 'Could not save your buddy.');
    }
  };

  const ownedProfileData = profileOwnerId === user?.id ? profileData : null;
  const visibleBuddy = profileOwnerId === user?.id
    ? selectedBuddy
    : user ? readStoredBuddy(user.id) ?? 'Bunny' : 'Bunny';
  const profile = useMemo<GameProfile>(() => ownedProfileData ?? ({
    username: user?.username ?? '',
    displayName: user?.username ?? '',
    selectedBuddy: visibleBuddy,
    levelsCompleted: 0,
    totalLevels: levels.length,
    bestScore: 0,
    totalPlays: 0,
    avgTime: 0,
    statsNotice: null,
  }), [levels.length, ownedProfileData, user?.username, visibleBuddy]);

  const activeUserId = user?.id ?? null;
  const visibleHistory = historyOwnerId === activeUserId ? history : [];
  const visibleHistoryLoading = activeUserId !== null
    && (historyOwnerId !== activeUserId || historyLoading);
  const visibleHistoryError = historyOwnerId === activeUserId ? historyError : null;
  const visibleHistoryNotice = historyOwnerId === activeUserId ? historyNotice : null;

  const value = useMemo(
    () => ({
      games,
      dynamicGameplayGateState,
      refreshDynamicGameplayGate,
      gamesLoading,
      gamesError,
      refreshGames,
      selectedGameId,
      selectGame,
      profile,
      profileLoading,
      profileAvailable: profileOwnerId === user?.id && profileData !== null,
      profileError,
      refreshProfile,
      history: visibleHistory,
      historyLoading: visibleHistoryLoading,
      historyError: visibleHistoryError,
      historyNotice: visibleHistoryNotice,
      refreshHistory,
      levels,
      levelsLoading,
      levelsError,
      refreshLevels,
      buddyOptions,
      selectedBuddy: visibleBuddy,
      setSelectedBuddy: updateSelectedBuddy,
    }),
    [dynamicGameplayGateState, games, gamesError, gamesLoading, levels, levelsError, levelsLoading, profile, profileData, profileError, profileLoading, profileOwnerId, refreshDynamicGameplayGate, refreshGames, refreshHistory, refreshLevels, refreshProfile, selectGame, selectedGameId, user?.id, visibleBuddy, visibleHistory, visibleHistoryError, visibleHistoryLoading, visibleHistoryNotice],
  );

  return <GameDataContext.Provider value={value}>{children}</GameDataContext.Provider>;
}

export function useGameData() {
  const context = useContext(GameDataContext);

  if (!context) {
    throw new Error('useGameData must be used within a GameDataProvider.');
  }

  return context;
}

export default GameDataContext;
