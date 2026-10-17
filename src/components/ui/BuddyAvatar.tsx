export type BuddyAvatarProps = {
  emoji: string;
  accent: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  decorative?: boolean;
  label?: string;
};

const sizeClasses = {
  sm: 'h-8 w-8 text-xl',
  md: 'h-12 w-12 text-2xl',
  lg: 'h-16 w-16 text-3xl',
  xl: 'h-20 w-20 text-4xl',
};

export function BuddyAvatar({ emoji, accent, size = 'md', decorative = false, label = 'Selected buddy' }: BuddyAvatarProps) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : label}
      aria-hidden={decorative || undefined}
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-white shadow-sm ${accent} ${sizeClasses[size]}`}
    >
      {emoji}
    </span>
  );
}

export default BuddyAvatar;