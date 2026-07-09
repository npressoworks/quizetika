import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSafeRedirectPath } from '@/lib/safe-redirect-path';

/**
 * GET /api/auth/callback
 * OAuth (Google/X/Azure AD) サインイン後の PKCE コード交換エンドポイント。
 * signInWithGoogle 等の redirectTo で指定される。
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const redirectPath = getSafeRedirectPath(searchParams.get('redirect'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectPath}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
}
