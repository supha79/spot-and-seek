import { useState } from 'react';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGameData } from '../../context/GameDataContext';
import { Avatar } from '../ui/Avatar';
import { Button } from '../ui/Button';
import { Logo } from '../ui/Logo';
import { Modal } from '../ui/Modal';

const navItems = [
  { to: '/dashboard/home', label: 'Home' },
  { to: '/dashboard/play', label: 'Play' },
  { to: '/dashboard/how-to-play', label: 'How to Play' },
  { to: '/dashboard/history', label: 'History' },
];

export function PlayerLayout() {
  const navigate = useNavigate();
  const { logout, user, authError, isLoading } = useAuth();
  const { profile } = useGameData();
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await logout();
      setMenuOpen(false);
      setLogoutModalOpen(false);
      navigate('/login', { replace: true });
    } catch {
      return;
    }
  };

  return (
    <div className="min-h-screen bg-surface text-on-surface">
      <header className="sticky top-0 z-20 border-b border-outline-variant/40 bg-surface/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-auto" />
          </div>

          <nav className="hidden items-center gap-2 rounded-full bg-surface-container-lowest p-1 shadow-[0_4px_16px_rgba(43,139,198,0.06)] md:flex">
            {navItems.map(({ to, label }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `rounded-full px-5 py-2 text-label-md transition-all ${
                    isActive ? 'bg-primary-container text-on-primary-container shadow-[0_4px_0_#2B8BC6]' : 'text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface'
                  }`
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 rounded-full bg-surface-container-lowest px-3 py-2 shadow-[0_4px_14px_rgba(43,139,198,0.06)] sm:flex">
              <span className="text-label-sm text-secondary">{profile.selectedBuddy}</span>
              <span className="inline-block h-2 w-2 rounded-full bg-secondary" />
            </div>

            <Avatar
              src={undefined}
              alt="user avatar"
              size="md"
              status="online"
              onClick={() => setMenuOpen((current) => !current)}
              dropdownOpen={menuOpen}
            >
              <div className="w-44 rounded-2xl border border-outline-variant bg-surface-container-lowest p-2 shadow-lg">
                <div className="px-2 py-1 text-label-sm text-on-surface-variant">{user?.username || profile.displayName}</div>
                <Link to="/dashboard/profile" className="block rounded-xl px-2 py-2 text-label-md text-on-surface hover:bg-surface-container" onClick={() => setMenuOpen(false)}>
                  Profile
                </Link>
                <Link to="/dashboard/buddy" className="block rounded-xl px-2 py-2 text-label-md text-on-surface hover:bg-surface-container" onClick={() => setMenuOpen(false)}>
                  Pick buddy
                </Link>
                <button type="button" onClick={() => { setMenuOpen(false); setLogoutModalOpen(true); }} className="mt-1 w-full rounded-xl bg-primary-container px-2 py-2 text-left text-label-md text-on-primary-container hover:opacity-90">
                  Log out
                </button>
              </div>
            </Avatar>
          </div>
        </div>
      </header>

      <Modal isOpen={logoutModalOpen} onClose={() => setLogoutModalOpen(false)}>
        <div className="space-y-space-lg p-space-xl">
          <div className="text-center">
            <h2 className="text-headline-md text-on-surface">Log out?</h2>
            <p className="mt-2 text-body-md text-on-surface-variant">Are you sure you want to log out?</p>
            {authError ? <p role="alert" className="mt-2 text-sm text-error">{authError}</p> : null}
          </div>
          <div className="flex justify-end gap-3">
            <Button variant="ghost" onClick={() => setLogoutModalOpen(false)}>Cancel</Button>
            <Button variant="primary" onClick={handleLogout} disabled={isLoading}>Log out</Button>
          </div>
        </div>
      </Modal>

      <main className="mx-auto w-full max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}

export default PlayerLayout;
