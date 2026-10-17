import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter, useLocation } from 'react-router-dom';
import AdminLayout from '../../src/components/layout/AdminLayout';
import PlayerLayout from '../../src/components/layout/PlayerLayout';
import { BackButton } from '../../src/components/ui/BackButton';

const { useAuthMock, useGameDataMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useGameDataMock: vi.fn(),
}));

vi.mock('../../src/context/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('../../src/context/GameDataContext', () => ({
  useGameData: useGameDataMock,
}));

beforeEach(() => {
  useAuthMock.mockReturnValue({
    logout: vi.fn(),
    user: { username: 'Player' },
    authError: null,
    isLoading: false,
  });
  useGameDataMock.mockReturnValue({
    profile: { selectedBuddy: 'Bunny', displayName: 'Player' },
    buddyOptions: [{ id: 'Bunny', name: 'Bunny', emoji: '🐰', accent: 'bg-primary-fixed/40', label: 'Bunny' }],
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
});

function CurrentPath() {
  const location = useLocation();
  return <p data-testid="current-path">{location.pathname}</p>;
}

describe('responsive layout navigation', () => {
  it('keeps desktop player navigation and exposes every destination on mobile', () => {
    render(<MemoryRouter initialEntries={['/dashboard/home']}><PlayerLayout /></MemoryRouter>);

    const mobileNavigation = screen.getByRole('navigation', { name: 'Player navigation' });
    const desktopNavigation = screen.getAllByRole('navigation').find((navigation) => navigation !== mobileNavigation);

    expect(mobileNavigation.className).toContain('lg:hidden');
    expect(mobileNavigation.className).toContain('grid-cols-2');
    expect(desktopNavigation?.className).toContain('lg:flex');
    expect(within(mobileNavigation).getByRole('link', { name: 'Home' }).getAttribute('href')).toBe('/dashboard/home');
    expect(within(mobileNavigation).getByRole('link', { name: 'Play' }).getAttribute('href')).toBe('/dashboard/play');
    expect(within(mobileNavigation).getByRole('link', { name: 'How to Play' }).getAttribute('href')).toBe('/dashboard/how-to-play');
    expect(within(mobileNavigation).getByRole('link', { name: 'History' }).getAttribute('href')).toBe('/dashboard/history');
    expect(screen.getByRole('img', { name: 'Selected buddy' }).textContent).toBe('🐰');
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
  });

  it('keeps the account menu open during pointer handoff, then closes when the pointer leaves', async () => {
    vi.useFakeTimers();
    render(<MemoryRouter><PlayerLayout /></MemoryRouter>);

    const trigger = screen.getByRole('button', { name: /Account menu/ });
    const avatarRoot = trigger.parentElement!;
    fireEvent.click(trigger);
    expect(screen.getByRole('link', { name: /^Profile/ })).toBeTruthy();

    fireEvent.mouseLeave(avatarRoot);
    fireEvent.mouseEnter(avatarRoot);
    await act(async () => vi.advanceTimersByTimeAsync(220));
    expect(screen.getByRole('link', { name: /^Profile/ })).toBeTruthy();

    fireEvent.mouseLeave(avatarRoot);
    await act(async () => vi.advanceTimersByTimeAsync(220));
    expect(screen.queryByRole('link', { name: /^Profile/ })).toBeNull();
  });

  it('closes the account menu on Escape and outside pointer interaction', () => {
    render(<MemoryRouter><PlayerLayout /></MemoryRouter>);
    const trigger = screen.getByRole('button', { name: /Account menu/ });

    fireEvent.click(trigger);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('link', { name: /^Profile/ })).toBeNull();

    fireEvent.click(trigger);
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('link', { name: /^Profile/ })).toBeNull();
  });

  it('shows the styled logout confirmation and closes it with Cancel', () => {
    render(<MemoryRouter><PlayerLayout /></MemoryRouter>);
    fireEvent.click(screen.getByRole('button', { name: /Account menu/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Log out?' })).toBeTruthy();
    expect(within(dialog).getByText('ต้องการออกจากระบบใช่ไหม')).toBeTruthy();
    expect(within(dialog).getByText(/ความคืบหน้าและการค้นพบทั้งหมดของคุณ/)).toBeTruthy();
    expect(dialog.querySelector('svg')).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it.each(['/dashboard/how-to-play', '/dashboard/history'])('uses a Home link on %s', (path) => {
    render(
      <MemoryRouter initialEntries={[path]}>
        <PlayerLayout />
        <CurrentPath />
      </MemoryRouter>,
    );

    const homeLink = screen.getByRole('link', { name: 'Go to Home' });
    expect(homeLink.getAttribute('href')).toBe('/dashboard/home');
    expect(homeLink.querySelector('span')?.className).toContain('rounded-full');
    fireEvent.click(homeLink);
    expect(screen.getByTestId('current-path').textContent).toBe('/dashboard/home');
  });

  it('keeps desktop admin navigation and exposes all admin sections on mobile', () => {
    render(<MemoryRouter initialEntries={['/admin/dashboard']}><AdminLayout /></MemoryRouter>);

    const mobileNavigation = screen.getByRole('navigation', { name: 'Admin navigation' });
    const desktopNavigation = screen.getByRole('navigation', { name: 'Admin sections' });

    expect(mobileNavigation.className).toContain('lg:hidden');
    expect(mobileNavigation.className).toContain('grid-cols-2');
    expect(desktopNavigation?.className).toContain('lg:flex');
    expect(within(mobileNavigation).getByRole('link', { name: 'Dashboard' }).getAttribute('href')).toBe('/admin/dashboard');
    expect(within(mobileNavigation).getByRole('link', { name: 'Games' }).getAttribute('href')).toBe('/admin/games');
    expect(within(mobileNavigation).getByRole('link', { name: 'Levels' }).getAttribute('href')).toBe('/admin/levels');
    expect(within(mobileNavigation).getByRole('link', { name: 'Questions' }).getAttribute('href')).toBe('/admin/questions');
    expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
  });

  it('confirms admin logout in the shared modal before navigating to login', async () => {
    const logout = vi.fn().mockResolvedValue(undefined);
    useAuthMock.mockReturnValue({
      logout,
      user: { username: 'Admin' },
      authError: null,
      isLoading: false,
    });
    render(<MemoryRouter initialEntries={['/admin/dashboard']}><AdminLayout /><CurrentPath /></MemoryRouter>);

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByRole('heading', { name: 'Log out?' })).toBeTruthy();
    expect(within(dialog).getByText('ต้องการออกจากระบบใช่ไหม')).toBeTruthy();
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(logout).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'Log out' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Log out' }));
    await waitFor(() => expect(logout).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByTestId('current-path').textContent).toBe('/login'));
  });

  it('uses a safe section fallback when no browser history entry is available', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard/play/level-01']}>
        <BackButton />
        <CurrentPath />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole('button', { name: 'Go back' }));

    expect(screen.getByTestId('current-path').textContent).toBe('/dashboard/easy-levels');
  });
});