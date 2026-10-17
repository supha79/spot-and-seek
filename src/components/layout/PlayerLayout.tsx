import { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useGameData } from '../../context/GameDataContext';
import { Avatar } from '../ui/Avatar';
import { BackButton } from '../ui/BackButton';
import { BuddyAvatar } from '../ui/BuddyAvatar';
import { Logo } from '../ui/Logo';
import { LogoutConfirmationModal } from '../ui/LogoutConfirmationModal';

const navItems = [
  { to: '/dashboard/home', label: 'Home' },
  { to: '/dashboard/play', label: 'Play' },
  { to: '/dashboard/how-to-play', label: 'How to Play' },
  { to: '/dashboard/history', label: 'History' },
];

export function PlayerLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { logout, user, authError, isLoading } = useAuth();
  const { profile, profileLoading, buddyOptions } = useGameData();
  const selectedBuddy = buddyOptions.find((buddy) => buddy.id === profile.selectedBuddy) ?? buddyOptions[0];
  const [menuOpen, setMenuOpen] = useState(false);
  const [logoutModalOpen, setLogoutModalOpen] = useState(false);
  const hidesBackButton = [
    '/dashboard/home',
    '/dashboard/play',
    '/dashboard/easy-levels',
    '/dashboard/play/medium',
    '/dashboard/play/hard',
  ].includes(location.pathname);
  const showsHomeButton = location.pathname === '/dashboard/how-to-play'
    || location.pathname === '/dashboard/history'
    || location.pathname.startsWith('/dashboard/history/');

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
        <div className="mx-auto flex max-w-screen-2xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <Logo className="h-9 w-auto" />
          </div>

          <nav className="hidden items-center gap-2 rounded-full bg-surface-container-lowest p-1 shadow-[0_4px_16px_rgba(43,139,198,0.06)] lg:flex">
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
              <span className="material-symbols-outlined text-[18px] text-secondary" aria-hidden="true">pets</span>
              <span className="text-label-sm text-secondary">{profileLoading ? 'Loading buddy...' : selectedBuddy.name}</span>
            </div>

            <Avatar
              src={undefined}
              alt={`Account menu for ${user?.username || profile.displayName}${profileLoading ? '' : `; selected buddy ${selectedBuddy.name}`}`}
              size="md"
              fallbackContent={profileLoading
                ? <span className="material-symbols-outlined text-[20px] text-on-surface-variant" aria-hidden="true">person</span>
                : <BuddyAvatar emoji={selectedBuddy.emoji} accent={selectedBuddy.accent} size="md" />}
              onClick={() => setMenuOpen((current) => !current)}
              dropdownOpen={menuOpen}
              onDropdownClose={() => setMenuOpen(false)}
            >
              <div className="w-48 rounded-2xl border border-outline-variant bg-surface-container-lowest p-1.5 shadow-lg sm:w-52">
                <div className="mb-1 flex items-center gap-2 rounded-xl bg-primary-fixed/30 px-2 py-1.5">
                  <BuddyAvatar emoji={selectedBuddy.emoji} accent={selectedBuddy.accent} size="sm" decorative />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-label-sm text-on-surface">{user?.username || profile.displayName}</div>
                    <div className="text-body-sm text-on-surface-variant">{profileLoading ? 'กำลังโหลดโปรไฟล์...' : selectedBuddy.name}</div>
                  </div>
                  {user ? <span className="h-2 w-2 shrink-0 rounded-full bg-secondary" aria-label="Signed in" /> : null}
                </div>

                {[
                  { to: '/dashboard/profile', title: 'Profile', icon: 'person', tone: 'bg-primary-fixed text-on-primary-fixed-variant' },
                  { to: '/dashboard/history', title: 'History', icon: 'history', tone: 'bg-secondary-container text-on-secondary-container' },
                  { to: '/dashboard/how-to-play', title: 'How to Play', icon: 'menu_book', tone: 'bg-primary-fixed text-on-primary-fixed-variant' },
                ].map((item) => (
                  <Link key={item.to} to={item.to} onClick={() => setMenuOpen(false)} className="ui-pressable flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface-container-low">
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${item.tone}`}>
                      <span className="material-symbols-outlined text-[18px]" aria-hidden="true">{item.icon}</span>
                    </span>
                    <span className="min-w-0 text-label-sm text-on-surface">{item.title}</span>
                  </Link>
                ))}

                <div className="my-1 border-t border-outline-variant/60" />
                <button type="button" onClick={() => { setMenuOpen(false); setLogoutModalOpen(true); }} className="ui-pressable flex w-full items-center gap-2.5 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-error-container/50">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-error-container text-error">
                    <span className="material-symbols-outlined text-[18px]" aria-hidden="true">logout</span>
                  </span>
                  <span className="text-label-sm text-error">Log out</span>
                </button>
              </div>
            </Avatar>
          </div>
        </div>
        <nav aria-label="Player navigation" className="mx-auto mt-2 grid w-full max-w-screen-2xl grid-cols-2 gap-1 px-4 pb-2 sm:grid-cols-4 sm:px-6 lg:hidden">
          {navItems.map(({ to, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex min-w-0 items-center justify-center rounded-full px-2 py-2 text-center text-label-sm transition-colors ${
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
        {!hidesBackButton ? (
          <BackButton
            className="mb-4"
            label={showsHomeButton ? 'Home' : 'Back'}
            to={showsHomeButton ? '/dashboard/home' : undefined}
          />
        ) : null}
        <Outlet />
      </main>
    </div>
  );
}

export default PlayerLayout;
