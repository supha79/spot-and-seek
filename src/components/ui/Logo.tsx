import { BrandMascotArtwork } from './BrandMascot';

type LogoProps = {
  className?: string;
};

export function Logo({ className = 'h-10 w-auto' }: LogoProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 280 64"
      width="280"
      height="64"
      fill="none"
      className={className}
      role="img"
      aria-label="Spot and Seek logo"
    >
      <BrandMascotArtwork />
      <text x="74" y="38" fontFamily="'Prompt', sans-serif" fontSize="26" fontWeight="700" fill="#23414F">Spot</text>
      <text x="136" y="39" fontFamily="'Prompt', sans-serif" fontSize="28" fontWeight="700" fill="#FF85A2">&amp;</text>
      <text x="162" y="38" fontFamily="'Prompt', sans-serif" fontSize="26" fontWeight="700" fill="#23414F">Seek</text>
      <circle cx="236" cy="24" r="3.5" fill="#A8E6CF" />
      <circle cx="246" cy="34" r="2.5" fill="#FFC2D4" />
    </svg>
  );
}

export default Logo;
