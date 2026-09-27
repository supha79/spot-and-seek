import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

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
  const [selectedBuddy, setSelectedBuddy] = useState('Bunny');
  const [history, setHistory] = useState<HistoryEntry[]>(defaultHistory);

  const profile = useMemo<GameProfile>(
    () => ({
      username: 'mint_saki',
      displayName: 'mint_saki',
      selectedBuddy,
      levelsCompleted: 4,
      totalLevels: 9,
      bestScore: 2450,
      totalPlays: 12,
      avgTime: 48,
    }),
    [selectedBuddy],
  );

  const clearHistory = () => setHistory([]);
  const restoreHistory = () => setHistory(defaultHistory);

  const value = useMemo(
    () => ({
      profile,
      history,
      levels: levelCatalog,
      buddyOptions,
      selectedBuddy,
      setSelectedBuddy,
      clearHistory,
      restoreHistory,
    }),
    [history, profile, selectedBuddy],
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
