import { supabaseClient } from './client';

/**
 * Google ログインを開始する (OAuth)
 */
export async function signInWithGoogle() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    },
  });
  return { data, error };
}

/**
 * Twitter / X ログインを開始する (OAuth)
 */
export async function signInWithTwitter() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'twitter',
    options: {
      redirectTo: `${window.location.origin}/api/auth/callback`,
    },
  });
  return { data, error };
}

/**
 * Microsoft ログインを開始する (OAuth)
 */
export async function signInWithMicrosoft() {
  const { data, error } = await supabaseClient.auth.signInWithOAuth({
    provider: 'azure',
    options: {
      scopes: 'email profile',
      redirectTo: `${window.location.origin}/api/auth/callback`,
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
 */
export async function signOut() {
  const { error } = await supabaseClient.auth.signOut();
  return { error };
}
