import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';

export type AdminDifficulty = 'Easy' | 'Medium' | 'Hard';

export type AdminGame = {
  id: string;
  name: string;
  description: string;
  status: 'Active' | 'Draft';
  levels: number;
  createdAt: string;
  image: string;
  rating: number;
  averageTime: string;
};

export type AdminLevel = {
  id: string;
  title: string;
  difficulty: AdminDifficulty;
  emoji: string;
  time: number;
  questions: number;
  active: boolean;
  gameId: string;
};

export type AdminQuestion = {
  id: string;
  levelId: string;
  levelName: string;
  difficulty: AdminDifficulty;
  title: string;
  note: string;
  active: boolean;
  differences: number;
  createdAt: string;
  imageA: string;
  imageB: string;
};

type AdminDataContextValue = {
  games: AdminGame[];
  levels: AdminLevel[];
  questions: AdminQuestion[];
  addGame: (draft: { name: string; description: string }) => void;
  updateGame: (id: string, draft: { name: string; description: string }) => void;
  deleteGame: (id: string) => void;
  addLevel: (draft: Omit<AdminLevel, 'id'>) => void;
  updateLevel: (id: string, draft: Omit<AdminLevel, 'id'>) => void;
  deleteLevel: (id: string) => void;
  addQuestion: (draft: Omit<AdminQuestion, 'id' | 'createdAt'>) => void;
  updateQuestion: (id: string, draft: Omit<AdminQuestion, 'id' | 'createdAt'>) => void;
  deleteQuestion: (id: string) => void;
};

const initialGames: AdminGame[] = [
  {
    id: 'game-1',
    name: 'Spot & Seek — Find the Differences',
    description: 'เกมจับผิดภาพแนว Cozy สบายตาสำหรับฝึกสายตาและความจำ พร้อมชุดภาพน่ารักประจำฤดูกาล',
    status: 'Active',
    levels: 9,
    createdAt: '1 Sep 2024',
    image: '',
    rating: 4.9,
    averageTime: '2m 45s',
  },
  {
    id: 'game-2',
    name: 'Spot & Seek — Cozy Seasonal Festivals',
    description: 'ชุดภาพเทศกาลอบอุ่นหัวใจ เพิ่มด่านใหม่ประจำเทศกาลใบไม้ผลิ เตรียมพร้อมปล่อยสัปดาห์หน้า',
    status: 'Draft',
    levels: 6,
    createdAt: '15 Sep 2024',
    image: '',
    rating: 4.7,
    averageTime: '3m 10s',
  },
];

const initialLevels: AdminLevel[] = [
  { id: 'level-1', title: 'Cozy Cat Corner', difficulty: 'Easy', emoji: '🐱', time: 120, questions: 3, active: true, gameId: 'game-1' },
  { id: 'level-2', title: 'Afternoon Tea Corner', difficulty: 'Easy', emoji: '🫖', time: 120, questions: 3, active: true, gameId: 'game-1' },
  { id: 'level-3', title: 'Balloon Hills', difficulty: 'Easy', emoji: '🎈', time: 120, questions: 3, active: false, gameId: 'game-1' },
  { id: 'level-4', title: 'Breezy Windmill Hill', difficulty: 'Medium', emoji: '🌾', time: 90, questions: 3, active: true, gameId: 'game-1' },
  { id: 'level-5', title: 'Sunny Picnic Meadow', difficulty: 'Medium', emoji: '🧺', time: 90, questions: 3, active: true, gameId: 'game-1' },
  { id: 'level-6', title: 'Starlit Night Market', difficulty: 'Hard', emoji: '🌙', time: 60, questions: 3, active: true, gameId: 'game-1' },
];

const initialQuestions: AdminQuestion[] = [
  {
    id: 'question-1',
    levelId: 'level-1',
    levelName: 'Level 1 — Cozy Cat Corner',
    difficulty: 'Easy',
    title: 'Q1: Ginger Cat Collar Bell',
    note: 'จุดระฆังคอแมวสีทอง',
    active: true,
    differences: 3,
    createdAt: '20 Sep 2026',
    imageA: '',
    imageB: '',
  },
  {
    id: 'question-2',
    levelId: 'level-1',
    levelName: 'Level 1 — Cozy Cat Corner',
    difficulty: 'Easy',
    title: 'Q2: Morning Tea Cup Steam',
    note: 'ลวดลายควันแก้วชา',
    active: true,
    differences: 3,
    createdAt: '21 Sep 2026',
    imageA: '',
    imageB: '',
  },
  {
    id: 'question-3',
    levelId: 'level-4',
    levelName: 'Level 1 — Breezy Windmill Hill',
    difficulty: 'Medium',
    title: 'Q1: Picnic Basket Bread Roll',
    note: 'ชิ้นขนมปังในตะกร้าพักผ่อน',
    active: true,
    differences: 5,
    createdAt: '18 Sep 2026',
    imageA: '',
    imageB: ''
  },
];

const AdminDataContext = createContext<AdminDataContextValue | undefined>(undefined);

export function AdminDataProvider({ children }: { children: ReactNode }) {
  const [games, setGames] = useState<AdminGame[]>(initialGames);
  const [levels, setLevels] = useState<AdminLevel[]>(initialLevels);
  const [questions, setQuestions] = useState<AdminQuestion[]>(initialQuestions);

  const addGame = (draft: { name: string; description: string }) => {
    const name = draft.name.trim();
    if (!name) return;

    setGames((current) => [
      {
        id: `game-${Date.now()}`,
        name,
        description: draft.description.trim() || 'No description yet.',
        status: 'Draft',
        levels: 0,
        createdAt: 'Just now',
        image: initialGames[0].image,
        rating: 4.8,
        averageTime: '—',
      },
      ...current,
    ]);
  };

  const updateGame = (id: string, draft: { name: string; description: string }) => {
    setGames((current) =>
      current.map((game) =>
        game.id === id
          ? {
              ...game,
              name: draft.name.trim() || game.name,
              description: draft.description.trim() || game.description,
            }
          : game,
      ),
    );
  };

  const deleteGame = (id: string) => {
    setGames((current) => current.filter((game) => game.id !== id));
    setLevels((current) => current.filter((level) => level.gameId !== id));
    setQuestions((current) => current.filter((question) => !(levels.some((level) => level.id === question.levelId && level.gameId === id))));
  };

  const addLevel = (draft: Omit<AdminLevel, 'id'>) => {
    setLevels((current) => [{ ...draft, id: `level-${Date.now()}` }, ...current]);
  };

  const updateLevel = (id: string, draft: Omit<AdminLevel, 'id'>) => {
    setLevels((current) => current.map((level) => (level.id === id ? { ...level, ...draft } : level)));
  };

  const deleteLevel = (id: string) => {
    setLevels((current) => current.filter((level) => level.id !== id));
    setQuestions((current) => current.filter((question) => question.levelId !== id));
  };

  const addQuestion = (draft: Omit<AdminQuestion, 'id' | 'createdAt'>) => {
    setQuestions((current) => [
      {
        ...draft,
        id: `question-${Date.now()}`,
        createdAt: 'Just now',
      },
      ...current,
    ]);
  };

  const updateQuestion = (id: string, draft: Omit<AdminQuestion, 'id' | 'createdAt'>) => {
    setQuestions((current) =>
      current.map((question) => (question.id === id ? { ...question, ...draft } : question)),
    );
  };

  const deleteQuestion = (id: string) => {
    setQuestions((current) => current.filter((question) => question.id !== id));
  };

  const value = useMemo<AdminDataContextValue>(
    () => ({
      games,
      levels,
      questions,
      addGame,
      updateGame,
      deleteGame,
      addLevel,
      updateLevel,
      deleteLevel,
      addQuestion,
      updateQuestion,
      deleteQuestion,
    }),
    [games, levels, questions],
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
