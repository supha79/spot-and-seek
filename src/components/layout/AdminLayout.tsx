import { useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { BackButton } from '../ui/BackButton';
import { LogoutConfirmationModal } from '../ui/LogoutConfirmationModal';
import { Logo } from '../ui/Logo';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/games', label: 'Games', icon: 'sports_esports' },
  { to: '/admin/levels', label: 'Levels', icon: 'layers' },
  { to: '/admin/questions', label: 'Questions', icon: 'quiz' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, authError, isLoading } = useAuth();
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setLogoutModalOpen(false);
      navigate('/login', { replace: true });
    } catch {
      return;
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant/50 bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-auto" />
            <div className="hidden rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed md:block">Admin</div>
          </div>

          <nav aria-label="Admin sections" className="hidden items-center gap-1 rounded-full bg-surface-container-lowest p-1 shadow-[0_4px_16px_rgba(43,139,198,0.06)] lg:flex">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-1 rounded-full px-2 py-2 text-label-md transition-all ${
                    isActive ? 'bg-primary-container text-on-primary-container shadow-[0_4px_0_#2B8BC6]' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-surface-container-low px-3 py-2 text-label-md text-on-surface-variant xl:block">
              {user?.username ?? 'Admin'}
            </div>
            {authError ? <span role="alert" className="text-sm text-error">{authError}</span> : null}
            <button type="button" onClick={() => setLogoutModalOpen(true)} disabled={isLoading} className="ui-pressable rounded-full bg-primary-container px-4 py-2 text-label-md text-on-primary-container shadow-[0_4px_0_#2B8BC6]">
              Log out
            </button>
          </div>
        </div>
        <nav aria-label="Admin navigation" className="mx-auto mt-2 grid w-full max-w-screen-2xl grid-cols-2 gap-1 px-4 pb-2 sm:grid-cols-4 sm:px-6 lg:hidden">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-w-0 items-center justify-center rounded-full px-1 py-2 text-center text-label-sm transition-colors ${
                  isActive ? 'bg-primary-container text-on-primary-container' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                }`
              }
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </header>

      <LogoutConfirmationModal
        isOpen={logoutModalOpen}
        onClose={() => setLogoutModalOpen(false)}
        onConfirm={handleLogout}
        isLoading={isLoading}
        authError={authError}
      />

      <main className="mx-auto w-full max-w-screen-2xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
          {location.pathname !== '/admin/dashboard' ? <BackButton className="mb-4" /> : null}
          <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
