import { Navigate, Route, Routes } from 'react-router-dom';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import BuddyPicker from '../pages/player/BuddyPicker';
import ChooseDifficulty from '../pages/player/ChooseDifficulty';
import EasyLevels from '../pages/player/EasyLevels';
import History from '../pages/player/History';
import Home from '../pages/player/Home';
import HowToPlay from '../pages/player/HowToPlay';
import LevelComplete from '../pages/game/LevelComplete';
import TimesUp from '../pages/game/TimesUp';
import PlayView from '../pages/player/PlayView';
import PlayerLayout from '../components/layout/PlayerLayout';
import Profile from '../pages/player/Profile';
import ProtectedRoute from './ProtectedRoute';
import AdminRoute from './AdminRoute';
import AdminLayout from '../components/layout/AdminLayout';
import AdminDashboard from '../pages/admin/AdminDashboard';
import ManageGames from '../pages/admin/ManageGames';
import ManageLevels from '../pages/admin/ManageLevels';
import Questions from '../pages/admin/Questions';
import QuestionEditor from '../pages/admin/QuestionEditor';
import NotFound from '../pages/NotFound';

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <PlayerLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard/home" replace />} />
        <Route path="home" element={<Home />} />
        <Route path="play" element={<ChooseDifficulty />} />
        <Route path="easy-levels" element={<EasyLevels />} />
        <Route path="play/:routeParam" element={<PlayView />} />
        <Route path="play/:levelId/complete" element={<LevelComplete />} />
        <Route path="play/:levelId/times-up" element={<TimesUp />} />
        <Route path="history" element={<History />} />
        <Route path="how-to-play" element={<HowToPlay />} />
        <Route path="profile" element={<Profile />} />
        <Route path="buddy" element={<BuddyPicker />} />
      </Route>

      <Route
        path="/admin"
        element={
          <AdminRoute>
            <AdminLayout />
          </AdminRoute>
        }
      >
        <Route index element={<Navigate to="/admin/dashboard" replace />} />
        <Route path="dashboard" element={<AdminDashboard />} />
        <Route path="games" element={<ManageGames />} />
        <Route path="levels" element={<ManageLevels />} />
        <Route path="questions" element={<Questions />} />
        <Route path="questions/new" element={<QuestionEditor />} />
        <Route path="questions/:id/edit" element={<QuestionEditor />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

export default AppRouter;
