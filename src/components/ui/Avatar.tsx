import type { ReactNode } from 'react';

export type AvatarProps = {
  src?: string;
  alt?: string;
  size?: 'sm' | 'md' | 'lg';
  status?: 'online' | 'offline' | 'busy';
  onClick?: () => void;
  dropdownOpen?: boolean;
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
  onClick,
  dropdownOpen = false,
  children,
}: AvatarProps) {
  return (
    <div className="relative inline-block">
      <button
        type="button"
        onClick={onClick}
        className={`relative overflow-hidden rounded-full border-2 border-white bg-surface-container-low object-cover shadow-sm ${sizeMap[size]} ${onClick ? 'cursor-pointer' : 'cursor-default'}`}
        aria-label={alt}
      >
        {src ? (
          <img src={src} alt={alt} className="h-full w-full object-cover" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-body-md font-semibold text-on-surface-variant">
            A
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
