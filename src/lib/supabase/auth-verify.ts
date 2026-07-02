import { NextRequest } from 'next/server';
import { createClient } from './server';

/**
 * HTTPリクエストの Authorization ヘッダーから Bearer トークンを抽出するヘルパー
 */
export function extractBearerToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) return null;
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    return null;
  }
  return parts[1];
}

/**
 * Supabase アクセストークンをサーバーサイドで安全に検証し、検証済みのUIDを返却する
 * 
 * @param token Supabase アクセストークン (JWT)
 * @returns 検証済みの Supabase User ID。検証失敗時は null
 */
export async function verifySupabaseAccessToken(token: string | null): Promise<string | null> {
  if (!token) {
    console.error('[auth-verify] アクセストークンが提供されていません。');
    return null;
  }

  try {
    const supabase = await createClient();
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error) {
      console.error('[auth-verify] トークン検証中にエラーが発生しました:', error);
      return null;
    }

    if (!user) {
      console.error('[auth-verify] トークンは有効ですが、ユーザーオブジェクトが応答に含まれていません。');
      return null;
    }

    return user.id;
  } catch (error) {
    console.error('[auth-verify] トークンの検証中に予期しないエラーが発生しました:', error);
    return null;
  }
}
