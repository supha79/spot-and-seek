type BrandMascotProps = {
  className?: string;
};

export function BrandMascotArtwork() {
  return (
    <g transform="translate(4, 4)">
      <ellipse cx="28" cy="56" rx="18" ry="4" fill="#E2EDF2" />
      <path d="M40 38 L54 52 C56 54 56 57 54 59 C52 61 49 61 47 59 L33 45 Z" fill="#7CC8F0" stroke="#2B8BC6" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="26" cy="26" r="22" fill="#FFFFFF" stroke="#7CC8F0" strokeWidth="6" />
      <circle cx="26" cy="26" r="17" fill="#EBF7FD" />
      <ellipse cx="20" cy="24" rx="2.5" ry="3.5" fill="#23414F" />
      <ellipse cx="32" cy="24" rx="2.5" ry="3.5" fill="#23414F" />
      <circle cx="21" cy="23" r="1" fill="#FFFFFF" />
      <circle cx="33" cy="23" r="1" fill="#FFFFFF" />
      <ellipse cx="16" cy="28" rx="3" ry="1.8" fill="#FFC2D4" opacity="0.8" />
      <ellipse cx="36" cy="28" rx="3" ry="1.8" fill="#FFC2D4" opacity="0.8" />
      <path d="M23 28 Q26 31 29 28" stroke="#23414F" strokeWidth="2" strokeLinecap="round" fill="none" />
      <path d="M16 16 L17 18 L19 19 L17 20 L16 22 L15 20 L13 19 L15 18 Z" fill="#FFD166" />
    </g>
  );
}

export function BrandMascot({ className = '' }: BrandMascotProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 64 64"
      className={className}
      aria-hidden="true"
    >
      <BrandMascotArtwork />
    </svg>
  );
}

export default BrandMascot;