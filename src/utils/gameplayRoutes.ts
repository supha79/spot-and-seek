import type { DifficultyMode } from '../context/GameDataContext';

export function getDifficultyLevelsRoute(difficulty: DifficultyMode | null) {
  if (difficulty === 'easy') return '/dashboard/easy-levels';
  if (difficulty === 'medium' || difficulty === 'hard') return `/dashboard/play/${difficulty}`;
  return '/dashboard/play';
}