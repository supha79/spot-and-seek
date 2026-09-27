import type { ReactNode } from 'react';

export type ChipVariant = 'primary' | 'secondary' | 'tertiary';

export type ChipProps = {
  variant?: ChipVariant;
  icon?: string;
  children: ReactNode;
  className?: string;
};

const variantClasses: Record<ChipVariant, string> = {
  primary: 'bg-primary-container text-on-primary-container',
  secondary: 'bg-secondary-container text-on-secondary-container',
  tertiary: 'bg-tertiary-container text-on-tertiary-container',
};

export function Chip({ variant = 'primary', icon, children, className = '' }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 font-label-sm text-label-sm ${variantClasses[variant]} ${className}`}
    >
      {icon ? <span className="material-symbols-outlined text-[16px] leading-none">{icon}</span> : null}
      <span>{children}</span>
    </span>
  );
}

export default Chip;
