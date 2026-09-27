type PlaceholderIllustrationProps = {
  className?: string;
  label?: string;
};

export default function PlaceholderIllustration({ className = '', label = 'image' }: PlaceholderIllustrationProps) {
  return (
    <div className={`flex items-center justify-center rounded-[20px] border border-dashed border-outline-variant bg-surface-container-low text-on-surface-variant ${className}`}>
      <div className="flex flex-col items-center justify-center gap-2 text-center">
        <span className="material-symbols-outlined text-[32px]">image</span>
        <span className="text-label-sm uppercase tracking-wider text-on-surface-variant/80">{label}</span>
        {/* TODO: replace with real illustration asset. */}
      </div>
    </div>
  );
}
