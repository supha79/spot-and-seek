export const popOutDurationMs = 180;

export function waitForPopOut() {
  if (typeof window === 'undefined' || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => window.setTimeout(resolve, popOutDurationMs));
}