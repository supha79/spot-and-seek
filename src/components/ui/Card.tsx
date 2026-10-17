import type { CSSProperties, ReactNode } from 'react';

export type CardSize = 'sm' | 'lg';

export type CardProps = {
  children: ReactNode;
  className?: string;
  size?: CardSize;
  style?: CSSProperties;
};

const sizeClasses: Record<CardSize, string> = {
  sm: 'rounded-md',
  lg: 'rounded-lg',
};

export function Card({ children, className = '', size = 'lg', style }: CardProps) {
  return (
    <div
      className={`bg-surface-container-lowest border border-outline-variant ${sizeClasses[size]} ${className}`}
      style={{
        boxShadow: '0 8px 24px -4px rgba(43,139,198,0.08), 0 2px 6px 0 rgba(43,139,198,0.04)',
        ...style,
      }}
    >
      {children}
    </div>
  );
}

export default Card;
