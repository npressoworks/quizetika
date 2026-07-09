import { createClient } from './client';

const supabaseClient = createClient();

/** OAuth 完了後の遷移先を callback URL に付与する */
function buildOAuthRedirectTo(redirectPath?: string) {
  const callbackUrl = new URL('/api/auth/callback', window.location.origin);
  if (redirectPath) {
    callbackUrl.searchParams.set('redirect', redirectPath);
  }
  return callbackUrl.toString();
}

/**
 * Google ログインを開始する (OAuth)
 */
export async function signInWithGoogle(redirectPath?: string) {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: buildOAuthRedirectTo(redirectPath),
    },
  });
  return { data, error };
}

/**
 * Twitter / X ログインを開始する (OAuth)
 */
export async function signInWithTwitter(redirectPath?: string) {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: buildOAuthRedirectTo(redirectPath),
    },
  });
  return { data, error };
}

/**
 * Microsoft ログインを開始する (OAuth)
 */
export async function signInWithMicrosoft(redirectPath?: string) {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile',
      redirectTo: buildOAuthRedirectTo(redirectPath),
    },
  });
  return { data, error };
}

/**
 * メールアドレスとパスワードでログインする (テスト用)
 */
export async function signInWithEmail(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });
  return { data, error };
}

/**
 * メールアドレスとパスワードで新規会員登録する (テスト用)
 */
export async function signUpWithEmail(email: string, password: string) {
  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
  });
  return { data, error };
}

/**
 * ログアウトを実行する
 *
 * scope: 'local' を指定し、このブラウザ/デバイスのセッションのみを終了する。
 * デフォルトの scope: 'global' は同一ユーザーの全セッション（他デバイス）の
 * リフレッシュトークンを一括失効させてしまうため、通常のログアウトボタンには適さない
 * （BANによる強制ログアウトなど、全セッション終了が意図的に必要な場合を除く）。
 */
export async function signOut() {
  const { error } = await supabaseClient.auth.signOut({ scope: 'local' });
  return { error };
}

/**
 * 現在の Supabase セッションから API リクエスト用のアクセストークンを取得する
 */
export async function getSupabaseAccessToken(): Promise<string | null> {
  const { data: { session } } = await supabaseClient.auth.getSession();
  return session?.access_token ?? null;
}
