/**
 * Next.js ミドルウェア: モデレーション・管理者ルート保護
 *
 * `/admin/*` および `/community/merge`, `/community/genres` へのアクセスを、
 * セッション Cookie に保存された moderationTier に基づいて制限する。
 *
 * 権限要件:
 * - `/admin/moderation`: admin または senior_moderator
 * - `/community/merge`: moderator 以上
 * - `/community/genres`: 認証済みユーザー（申請タブ）、モデレータ以上（投票タブはページ側で制御）
 *
 * 注意: Next.js middleware は Firebase Auth SDK を直接利用できないため、
 * ページマウント時の useAuth によるクライアントサイドガードと組み合わせて二重保護を実施する。
 *
 * Requirements: 1.1, 2.1
 * Boundary: RouteGuard
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/** moderationTier の優先順位マップ */
const TIER_RANK: Record<string, number> = {
  newcomer: 0,
  contributor: 1,
  moderator: 2,
  senior_moderator: 3,
};

/**
 * Cookie に保存された moderationTier の値が、要求ティア以上かを確認する
 */
function hasSufficientTier(
  cookieTier: string | undefined,
  requiredTier: string
): boolean {
  if (!cookieTier) return false;
  const currentRank = TIER_RANK[cookieTier] ?? -1;
  const requiredRank = TIER_RANK[requiredTier] ?? 999;
  return currentRank >= requiredRank;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Cookie からユーザー認証情報を取得
  const uid = request.cookies.get('quizeum_uid')?.value;
  const moderationTier = request.cookies.get('quizeum_tier')?.value;
  const isBanned = request.cookies.get('quizeum_banned')?.value === 'true';

  // -------------------------------------------------------------------
  // BAN ユーザーの強制リダイレクト
  // -------------------------------------------------------------------
  if (isBanned && pathname !== '/banned') {
    const bannedUrl = new URL('/banned', request.url);
    return NextResponse.redirect(bannedUrl);
  }

  // -------------------------------------------------------------------
  // /admin/moderation: 管理者またはシニアモデレータのみ
  // -------------------------------------------------------------------
  if (pathname.startsWith('/admin/moderation')) {
    const isAdminOrSenior =
      moderationTier === 'senior_moderator' ||
      request.cookies.get('quizeum_role')?.value === 'admin';

    if (!uid || !isAdminOrSenior) {
      // 未認証または権限不足の場合は /not-found にリダイレクト（404相当）
      const notFound = new URL('/not-found', request.url);
      return NextResponse.redirect(notFound);
    }
  }

  // /admin/users: 管理者のみ (Req 1.1)
  if (pathname.startsWith('/admin/users')) {
    const isAdmin = request.cookies.get('quizeum_role')?.value === 'admin';
    if (!uid || !isAdmin) {
      const notFound = new URL('/not-found', request.url);
      return NextResponse.redirect(notFound);
    }
  }

  // -------------------------------------------------------------------
  // /community/merge: moderator 以上のみ
  // -------------------------------------------------------------------
  if (pathname.startsWith('/community/merge')) {
    if (!uid || !hasSufficientTier(moderationTier, 'moderator')) {
      const notFound = new URL('/not-found', request.url);
      return NextResponse.redirect(notFound);
    }
  }

  // -------------------------------------------------------------------
  // /community/genres: 認証済みユーザーのみ（投票タブはページ側で追加制限）
  // -------------------------------------------------------------------
  if (pathname.startsWith('/community/genres')) {
    const isAdmin = request.cookies.get('quizeum_role')?.value === 'admin';
    if (!uid || !isAdmin) {
      const notFound = new URL('/not-found', request.url);
      return NextResponse.redirect(notFound);
    }
  }

  // -------------------------------------------------------------------
  // 認証必須ルートへのアクセス制限 (bookmarks, notifications, creator/dashboard)
  // -------------------------------------------------------------------
  const authRequiredPaths = ['/bookmarks', '/notifications', '/creator/dashboard', '/profile/edit'];
  const requiresAuth = authRequiredPaths.some(
    (p) => pathname === p || pathname.startsWith(p + '/')
  );

  if (requiresAuth && !uid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl, 307);
  }

  // -------------------------------------------------------------------
  // クイズ編集: 認証済みユーザーのみ（所有者チェックはページ側）
  // -------------------------------------------------------------------
  if (/^\/quiz\/[^/]+\/edit$/.test(pathname) && !uid) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api|images|.*\\..*).*)',
  ],
};
