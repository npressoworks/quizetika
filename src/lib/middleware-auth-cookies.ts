import type { User } from '@/types';

export const MIDDLEWARE_AUTH_COOKIE_NAMES = [
  'quizetika_uid',
  'quizetika_tier',
  'quizetika_role',
  'quizetika_banned',
] as const;

const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

function cookieAttributes(): string {
  const secure =
    typeof window !== 'undefined' && window.location.protocol === 'https:'
      ? '; Secure'
      : '';
  return `; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax${secure}`;
}

function expireCookie(name: string): void {
  document.cookie = `${name}=; path=/; max-age=0; SameSite=Lax`;
}

export function isAdminUser(user: User): boolean {
  if ((user.moderationTier as string) === 'admin') return true;
  const role = (user as User & { role?: string }).role;
  return role === 'admin';
}

/** middleware.ts が参照する認証 Cookie を Firebase セッションと同期する */
export function syncMiddlewareAuthCookies(
  user: User | null,
  uid: string | null
): void {
  if (typeof document === 'undefined') return;

  if (!uid) {
    clearMiddlewareAuthCookies();
    return;
  }

  const attrs = cookieAttributes();
  document.cookie = `quizetika_uid=${encodeURIComponent(uid)}${attrs}`;

  if (!user) {
    expireCookie('quizetika_tier');
    expireCookie('quizetika_role');
    expireCookie('quizetika_banned');
    return;
  }

  document.cookie = `quizetika_tier=${encodeURIComponent(user.moderationTier)}${attrs}`;

  if (isAdminUser(user)) {
    document.cookie = `quizetika_role=admin${attrs}`;
  } else {
    expireCookie('quizetika_role');
  }

  if (user.isBanned === true) {
    document.cookie = `quizetika_banned=true${attrs}`;
  } else {
    expireCookie('quizetika_banned');
  }
}

export function clearMiddlewareAuthCookies(): void {
  if (typeof document === 'undefined') return;
  for (const name of MIDDLEWARE_AUTH_COOKIE_NAMES) {
    if (name === 'quizetika_banned') continue;
    expireCookie(name);
  }
}
