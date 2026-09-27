import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Logo } from '../ui/Logo';

const navItems = [
  { to: '/admin/dashboard', label: 'Dashboard', icon: 'dashboard' },
  { to: '/admin/games', label: 'Games', icon: 'sports_esports' },
  { to: '/admin/levels', label: 'Levels', icon: 'layers' },
  { to: '/admin/questions', label: 'Questions', icon: 'quiz' },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="border-b border-outline-variant/50 bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-auto" />
            <div className="hidden rounded-full bg-secondary-fixed px-3 py-1 text-label-sm text-on-secondary-fixed md:block">Admin</div>
          </div>

          <nav className="hidden items-center gap-2 rounded-full bg-surface-container-lowest p-1 shadow-[0_4px_16px_rgba(43,139,198,0.06)] md:flex">
            {navItems.map(({ to, label, icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-full px-4 py-2 text-label-md transition-all ${
                    isActive ? 'bg-primary-container text-on-primary-container shadow-[0_4px_0_#2B8BC6]' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`
                }
              >
                <span className="material-symbols-outlined text-[18px]">{icon}</span>
                <span>{label}</span>
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden rounded-full bg-surface-container-low px-3 py-2 text-label-md text-on-surface-variant sm:block">
              {user?.username ?? 'Admin'}
            </div>
            <button type="button" onClick={handleLogout} className="rounded-full bg-primary-container px-4 py-2 text-label-md text-on-primary-container shadow-[0_4px_0_#2B8BC6] active:translate-y-1 active:shadow-[0_2px_0_#2B8BC6]">
              Log out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export default AdminLayout;
