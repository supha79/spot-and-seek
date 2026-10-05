import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { supabase, supabaseConfigError } from '../supabaseClient';

export type DifficultyMode = 'easy' | 'medium' | 'hard';

export type BuddyOption = {
  id: string;
  name: string;
  accent: string;
  label: string;
};

export type Level = {
  id: string;
  difficulty: DifficultyMode;
  title: string;
  subtitle: string;
  description: string;
  differences: number;
  time: number;
  stars: number;
  cleared: boolean;
  bestScore: number;
  image: string;
};

export type HistoryEntry = {
  id: string;
  title: string;
  difficulty: string;
  date: string;
  score: number;
  status: 'Cleared' | 'New';
};

export type GameProfile = {
  username: string;
  displayName: string;
  selectedBuddy: string;
  levelsCompleted: number;
  totalLevels: number;
  bestScore: number;
  totalPlays: number;
  avgTime: number;
};

const defaultHistory: HistoryEntry[] = [
  { id: 'hist-1', title: 'Cozy Cat Corner', difficulty: 'Easy', date: 'Today · 9:40 AM', score: 2450, status: 'Cleared' },
  { id: 'hist-2', title: 'Sunny Picnic', difficulty: 'Easy', date: 'Yesterday · 7:20 PM', score: 2100, status: 'Cleared' },
  { id: 'hist-3', title: 'Greenhouse Garden', difficulty: 'Medium', date: 'Tue · 6:05 PM', score: 1820, status: 'New' },
];

export const difficultyOptions = [
  {
    id: 'easy',
    name: 'Easy',
    subtitle: 'Comfort first',
    description: 'Soft visuals and fewer clues for a relaxed warm-up.',
    differences: 3,
    time: 120,
    accent: 'secondary',
    highlight: false,
  },
  {
    id: 'medium',
    name: 'Medium',
    subtitle: 'Balanced focus',
    description: 'A little more detail and a sharper eye for hidden changes.',
    differences: 5,
    time: 90,
    accent: 'primary',
    highlight: true,
  },
  {
    id: 'hard',
    name: 'Hard',
    subtitle: 'Expert eye',
    description: 'Dense layouts, tighter timing, and bigger score rewards.',
    differences: 7,
    time: 60,
    accent: 'tertiary',
    highlight: false,
  },
] as const;

export const buddyOptions: BuddyOption[] = [
  { id: 'Bunny', name: 'Bunny', accent: 'bg-primary-fixed/40', label: 'Bunny' },
  { id: 'Cat', name: 'Cat', accent: 'bg-tertiary-fixed/30', label: 'Cat' },
  { id: 'Bear', name: 'Bear', accent: 'bg-surface-container-high', label: 'Bear' },
  { id: 'Fox', name: 'Fox', accent: 'bg-secondary-fixed/30', label: 'Fox' },
  { id: 'Panda', name: 'Panda', accent: 'bg-secondary-container/40', label: 'Panda' },
  { id: 'Penguin', name: 'Penguin', accent: 'bg-primary-fixed/30', label: 'Penguin' },
  { id: 'Frog', name: 'Frog', accent: 'bg-secondary-container/40', label: 'Frog' },
  { id: 'Duck', name: 'Duck', accent: 'bg-tertiary-fixed/30', label: 'Duck' },
];

export const levelCatalog: Level[] = [
  {
    id: 'cozy-cat-corner',
    difficulty: 'easy',
    title: 'Cozy Cat Corner',
    subtitle: 'มุมเจ้าส้มหลับปุ๋ยยามเช้า',
    description: 'A sunny café nook with calm textures and gentle contrast.',
    differences: 3,
    time: 120,
    stars: 3,
    cleared: true,
    bestScore: 2450,
    image: '',
  },
  {
    id: 'sunny-picnic',
    difficulty: 'easy',
    title: 'Sunny Picnic',
    subtitle: 'ปิกนิกสุขสันต์บนเนินหญ้า',
    description: 'A breezy meadow scene with a few soft highlights to spot.',
    differences: 3,
    time: 120,
    stars: 2,
    cleared: true,
    bestScore: 2100,
    image: '',
  },
  {
    id: 'balloon-hills',
    difficulty: 'easy',
    title: 'Balloon Hills',
    subtitle: 'บอลลูนลอยฟ้าทุ่งดอกไม้',
    description: 'Fresh sky colors and playful details keep this one carefree.',
    differences: 3,
    time: 120,
    stars: 0,
    cleared: false,
    bestScore: 0,
    image: '',
  },
  {
    id: 'greenhouse-garden',
    difficulty: 'medium',
    title: 'Greenhouse Garden',
    subtitle: 'สวนกระจกกลางวัน',
    description: 'Many layered leaves and small objects are waiting to be found.',
    differences: 5,
    time: 90,
    stars: 3,
    cleared: true,
    bestScore: 1820,
    image: '',
  },
  {
    id: 'bakery-breeze',
    difficulty: 'medium',
    title: 'Bakery Breeze',
    subtitle: 'ร้านเบเกอรีอ่อนโยน',
    description: 'Look for tiny sign and pastry detail changes across a warm room.',
    differences: 5,
    time: 90,
    stars: 2,
    cleared: true,
    bestScore: 1640,
    image: '',
  },
  {
    id: 'night-train',
    difficulty: 'medium',
    title: 'Night Train',
    subtitle: 'รถไฟยามค่ำ',
    description: 'Minutes of calm detail scanning through a cozy train platform.',
    differences: 5,
    time: 90,
    stars: 0,
    cleared: false,
    bestScore: 0,
    image: '',
  },
  {
    id: 'stormy-shelf',
    difficulty: 'hard',
    title: 'Stormy Shelf',
    subtitle: 'ชั้นหนังสือฝนตก',
    description: 'Lots of layered props and a more competitive score chase.',
    differences: 7,
    time: 60,
    stars: 0,
    cleared: false,
    bestScore: 0,
    image: '',
  },
  {
    id: 'forest-fable',
    difficulty: 'hard',
    title: 'Forest Fable',
    subtitle: 'ป่าเทพนิยาย',
    description: 'Tiny wildlife accents hide among layered trees and lanterns.',
    differences: 7,
    time: 60,
    stars: 0,
    cleared: false,
    bestScore: 0,
    image: '',
  },
];

type GameDataContextValue = {
  profile: GameProfile;
  profileLoading: boolean;
  profileAvailable: boolean;
  profileError: string | null;
  refreshProfile: () => void;
  history: HistoryEntry[];
  levels: Level[];
  buddyOptions: BuddyOption[];
  selectedBuddy: string;
  setSelectedBuddy: (buddy: string) => void;
  clearHistory: () => void;
  restoreHistory: () => void;
};

const GameDataContext = createContext<GameDataContextValue | undefined>(undefined);

export function GameDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [selectedBuddy, setSelectedBuddy] = useState('Bunny');
  const [history, setHistory] = useState<HistoryEntry[]>(defaultHistory);
  const [profileData, setProfileData] = useState<GameProfile | null>(null);
  const [profileOwnerId, setProfileOwnerId] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileRevision, setProfileRevision] = useState(0);
  const refreshProfile = useCallback(() => setProfileRevision((revision) => revision + 1), []);

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

    void Promise.all([
      supabase
        .from('profiles')
        .select('username, selected_buddy, best_score, total_plays')
        .eq('id', user.id)
        .maybeSingle(),
      supabase
        .from('game_runs')
        .select('level_id, elapsed_active_seconds, status')
        .eq('user_id', user.id)
        .in('status', ['won', 'lost']),
    ])
      .then(([profileResult, runsResult]) => {
        if (!isMounted) return;
        if (profileResult.error) throw profileResult.error;
        if (runsResult.error) throw runsResult.error;
        if (!profileResult.data) throw new Error('Your player profile was not found.');

        const runs = runsResult.data ?? [];
        const completedLevelIds = new Set(
          runs.filter((run) => run.status === 'won').map((run) => run.level_id),
        );
        const averageSeconds = runs.length
          ? Math.round(runs.reduce((total, run) => total + Number(run.elapsed_active_seconds), 0) / runs.length)
          : 0;
        const buddy = profileResult.data.selected_buddy;

        setSelectedBuddy(buddy);
        setProfileData({
          username: profileResult.data.username,
          displayName: profileResult.data.username,
          selectedBuddy: buddy,
          levelsCompleted: completedLevelIds.size,
          totalLevels: levelCatalog.length,
          bestScore: profileResult.data.best_score,
          totalPlays: profileResult.data.total_plays,
          avgTime: averageSeconds,
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
  }, [profileRevision, user?.id, user?.username]);

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
      setProfileData((current) => current ? { ...current, selectedBuddy: buddy } : current);
    } catch (error) {
      setSelectedBuddy((current) => current === buddy ? previousBuddy : current);
      setProfileError(error instanceof Error ? error.message : 'Could not save your buddy.');
    }
  };

  const ownedProfileData = profileOwnerId === user?.id ? profileData : null;
  const visibleBuddy = profileOwnerId === user?.id ? selectedBuddy : 'Bunny';
  const profile = useMemo<GameProfile>(() => ownedProfileData ?? ({
    username: user?.username ?? '',
    displayName: user?.username ?? '',
    selectedBuddy: visibleBuddy,
    levelsCompleted: 0,
    totalLevels: levelCatalog.length,
    bestScore: 0,
    totalPlays: 0,
    avgTime: 0,
  }), [ownedProfileData, user?.username, visibleBuddy]);

  const clearHistory = () => setHistory([]);
  const restoreHistory = () => setHistory(defaultHistory);

  const value = useMemo(
    () => ({
      profile,
      profileLoading,
      profileAvailable: profileOwnerId === user?.id && profileData !== null,
      profileError,
      refreshProfile,
      history,
      levels: levelCatalog,
      buddyOptions,
      selectedBuddy: visibleBuddy,
      setSelectedBuddy: updateSelectedBuddy,
      clearHistory,
      restoreHistory,
    }),
    [history, profile, profileData, profileError, profileLoading, profileOwnerId, refreshProfile, user?.id, visibleBuddy],
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
