import { useEffect, useRef, type ReactNode } from 'react';

export type AvatarProps = {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'busy';
  fallbackContent?: ReactNode;
  onClick?: () => void;
  dropdownOpen?: boolean;
  onDropdownClose?: () => void;
  children?: ReactNode;
};

const sizeMap = {
  sm: 'h-8 w-8',
  md: 'h-12 w-12',
  lg: 'h-16 w-16',
};

const statusClasses = {
  online: 'bg-secondary',
  offline: 'bg-outline',
  busy: 'bg-tertiary',
};

export function Avatar({
  src,
  alt = 'User avatar',
  size = 'md',
  status,
  fallbackContent,
  onClick,
  dropdownOpen = false,
  onDropdownClose,
  children,
}: AvatarProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const closeTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (!dropdownOpen || !onDropdownClose) return;

    const closeOnOutsidePointer = (event: PointerEvent) => {
      if (event.target instanceof Node && !rootRef.current?.contains(event.target)) {
        onDropdownClose();
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDropdownClose();
    };

    document.addEventListener('pointerdown', closeOnOutsidePointer);
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      window.removeEventListener('keydown', closeOnEscape);
      if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    };
  }, [dropdownOpen, onDropdownClose]);

  const cancelScheduledClose = () => {
    if (closeTimerRef.current !== null) window.clearTimeout(closeTimerRef.current);
    closeTimerRef.current = null;
  };

  const scheduleMouseClose = () => {
    if (!dropdownOpen || !onDropdownClose) return;
    cancelScheduledClose();
    closeTimerRef.current = window.setTimeout(() => {
      closeTimerRef.current = null;
      onDropdownClose();
    }, 180);
  };

  return (
    <div ref={rootRef} className="relative inline-block" onMouseEnter={cancelScheduledClose} onMouseLeave={scheduleMouseClose}>
      <button
        type="button"
        onClick={onClick}
        className={`relative overflow-hidden rounded-full object-cover ${fallbackContent ? 'border-0 bg-transparent shadow-none' : 'border-2 border-white bg-surface-container-low shadow-sm'} ${sizeMap[size]} ${onClick ? 'ui-pressable cursor-pointer' : 'cursor-default'}`}
        aria-label={alt}
      >
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : fallbackContent ? (
          fallbackContent
        ) : (
          <span className="flex h-full w-full items-center justify-center text-body-md font-semibold text-on-surface-variant">
            <span className="material-symbols-outlined" aria-hidden="true">person</span>
          </span>
        )}
      </button>

      {status ? (
        <span className={`absolute bottom-0 right-0 block h-3 w-3 rounded-full border-2 border-white ${statusClasses[status]}`} />
      ) : null}

      {dropdownOpen && children ? <div className="absolute right-0 top-full z-10 mt-2">{children}</div> : null}
    </div>
  );
}

export default Avatar;
