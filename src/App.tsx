import { AdminDataProvider } from './context/AdminDataContext';
import { AuthProvider } from './context/AuthContext';
import { GameDataProvider } from './context/GameDataContext';
import AppRouter from './routes/AppRouter';

export default function App() {
  return (
    <AuthProvider>
      <GameDataProvider>
        <AdminDataProvider>
          <AppRouter />
        </AdminDataProvider>
      </GameDataProvider>
    </AuthProvider>
  );
}
