import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export function AdminRoute({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-surface text-on-surface">Loading...</div>;
  }

  if (!user || !user.isAdmin) {
    return <Navigate to="/dashboard/home" replace state={{ from: location }} />;
  }

  return <>{children}</>;
}

export default AdminRoute;
