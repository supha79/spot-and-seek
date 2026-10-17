import { useParams } from 'react-router-dom';
import { difficultyOptions } from '../../context/GameDataContext';
import DifficultyLevels from './DifficultyLevels';
import GamePlay from '../game/GamePlay';

export default function PlayView() {
  const { routeParam = 'easy' } = useParams();
  const selectedOption = difficultyOptions.find((option) => option.id === routeParam);

  return selectedOption
    ? <DifficultyLevels difficulty={selectedOption.id} />
    : <GamePlay />;
}