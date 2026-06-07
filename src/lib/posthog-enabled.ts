/** 本番ビルド（`next build`）以外では PostHog を初期化しない */
export function isPostHogEnabled(): boolean {
  if (process.env.NODE_ENV !== 'production') return false;
  if (process.env.NEXT_PUBLIC_ENV === 'test') return false;
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim()) return false;
  return true;
}
