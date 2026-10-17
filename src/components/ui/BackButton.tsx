import { Link, useLocation, useNavigate } from 'react-router-dom';

type BackButtonProps = {
  className?: string;
  label?: string;
  to?: string;
};

function getFallbackPath(pathname: string) {
  if (pathname.startsWith('/admin/questions/')) return '/admin/questions';
  if (pathname === '/admin/dashboard') return '/admin/games';
  if (pathname.startsWith('/admin/')) return '/admin/dashboard';

  if (pathname.startsWith('/dashboard/play/')) {
    const routeParam = pathname.slice('/dashboard/play/'.length).split('/')[0];
    return ['easy', 'medium', 'hard'].includes(routeParam) ? '/dashboard/play' : '/dashboard/easy-levels';
  }
  if (pathname.startsWith('/dashboard/history/')) return '/dashboard/history';
  if (pathname === '/dashboard/home') return '/dashboard/play';
  if (pathname.startsWith('/dashboard/')) return '/dashboard/home';

  if (pathname === '/register') return '/login';
  if (pathname === '/forgot-password') return '/login';
  if (pathname === '/reset-password') return '/forgot-password';
  return '/register';
}

export function BackButton({ className = '', label = 'Back', to }: BackButtonProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const buttonClassName = `inline-flex items-center gap-2 rounded-full bg-surface-container-lowest px-4 py-2 text-label-md text-on-surface-variant shadow-[0_4px_14px_rgba(43,139,198,0.08)] transition-colors hover:bg-surface-container-low focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${className}`;

  const handleBack = () => {
    const historyIndex = (window.history.state as { idx?: unknown } | null)?.idx;
    if (typeof historyIndex === 'number' && historyIndex > 0) {
      navigate(-1);
      return;
    }

    navigate(getFallbackPath(location.pathname), { replace: true });
  };

  if (to) {
    return (
      <Link to={to} aria-label={`Go to ${label}`} className={buttonClassName}>
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-primary-fixed text-primary">
          <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>
        </span>
        {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={handleBack}
      aria-label={label === 'Back' ? 'Go back' : `Go to ${label}`}
      className={buttonClassName}
    >
      <span aria-hidden="true" className="material-symbols-outlined text-[18px]">arrow_back</span>
      {label}
    </button>
  );
}

export default BackButton;