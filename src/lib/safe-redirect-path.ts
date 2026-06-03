/**
 * Open redirect を防ぎつつ、ログイン後の戻り先パスを解決する。
 */
export function getSafeRedirectPath(
  redirect: string | null | undefined,
  fallback = '/'
): string {
  if (!redirect) return fallback;
  if (!redirect.startsWith('/') || redirect.startsWith('//')) return fallback;
  return redirect;
}
