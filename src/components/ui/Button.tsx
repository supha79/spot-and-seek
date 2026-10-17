import type { MouseEventHandler, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'ghost';
export type ButtonSize = 'md' | 'lg';

export type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  leftIcon?: string;
  rightIcon?: string;
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  children: ReactNode;
  className?: string;
  type?: 'button' | 'submit' | 'reset';
};

const sizeClasses: Record<ButtonSize, string> = {
  md: 'px-5 py-3 text-body-md',
  lg: 'px-6 py-4 text-body-lg',
};

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    'bg-primary-container text-on-primary-container border border-transparent shadow-[0_6px_0_#2B8BC6]',
  secondary:
    'bg-secondary-fixed text-on-secondary-fixed border border-transparent shadow-[0_6px_0_#2BA678]',
  tertiary:
    'bg-tertiary-fixed text-on-tertiary-fixed border border-transparent shadow-[0_6px_0_#E85B88]',
  ghost:
    'bg-white text-on-surface-variant border-2 border-surface-container-low shadow-[0_4px_0_#E1EDF2]',
};

export function Button({
  variant = 'primary',
  size = 'md',
  leftIcon,
  rightIcon,
  disabled = false,
  onClick,
  children,
  className = '',
  type = 'button',
}: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`
        relative inline-flex items-center justify-center gap-2 rounded-full font-label-md tracking-wide
        transition-[transform,box-shadow,background-color,color] duration-150 ease-out active:scale-[0.97]
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2
        disabled:active:scale-100 select-none overflow-hidden motion-reduce:transition-none motion-reduce:active:transform-none
        ${sizeClasses[size]} ${variantClasses[variant]} ${className}
        ${disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}
      `}
      aria-disabled={disabled}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 rounded-t-full bg-white/25" />
      {leftIcon ? (
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] leading-none relative z-10">
          {leftIcon}
        </span>
      ) : null}
      <span className="relative z-10">{children}</span>
      {rightIcon ? (
        <span aria-hidden="true" className="material-symbols-outlined text-[20px] leading-none relative z-10">
          {rightIcon}
        </span>
      ) : null}
    </button>
  );
}

export default Button;
