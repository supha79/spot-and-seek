export function AmbientBackground() {
  return (
    <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -left-12 top-4 h-64 w-64 rounded-full bg-secondary-container/40 blur-3xl" />
      <div className="absolute right-10 top-16 h-72 w-72 rounded-full bg-tertiary-container/30 blur-3xl" />
      <div className="absolute bottom-4 left-1/4 h-64 w-64 rounded-full bg-primary-container/30 blur-3xl" />

      <div className="absolute left-[18%] top-[12%] text-primary-container animate-pulse">
        <svg width="34" height="34" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l2.6 6.8L22 9.5l-5.4 4.8 1.6 7.2-6.2-3.8-6.2 3.8 1.6-7.2L2 9.5l7.4-.7L12 2z" />
        </svg>
      </div>

      <div className="absolute right-[20%] top-[28%] text-tertiary-container animate-bounce" style={{ animationDuration: '3s' }}>
        <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 0L14.5 9.5L24 12L14.5 14.5L12 24L9.5 14.5L0 12L9.5 9.5L12 0Z" />
        </svg>
      </div>

      <div className="absolute bottom-[18%] right-[28%] text-secondary-container animate-ping" style={{ animationDuration: '4s' }}>
        <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M12 2l2.6 6.8L22 9.5l-5.4 4.8 1.6 7.2-6.2-3.8-6.2 3.8 1.6-7.2L2 9.5l7.4-.7L12 2z" />
        </svg>
      </div>
    </div>
  );
}

export default AmbientBackground;
