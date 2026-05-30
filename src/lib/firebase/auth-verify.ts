import { NextRequest } from 'next/server';

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
 * Firebase IDトークンをサーバーサイドで安全に検証し、検証済みのUIDを返却する
 * 
 * @param token Firebase IDトークン
 * @param mockUid E2Eテスト環境で検証をバイパスする際に使用するフォールバックUID
 * @returns 検証済みの Firebase UID。検証失敗時は null
 */
export async function verifyFirebaseIdToken(token: string | null, mockUid?: string): Promise<string | null> {
  const isTestEnv = process.env.NEXT_PUBLIC_ENV === 'test';

  // E2Eテスト環境での動作：トークン検証をバイパスし、申告されたモックUIDをそのまま検証済みとする
  if (isTestEnv) {
    console.log('[auth-verify] E2Eテスト環境のため、IDトークンの検証をバイパスします。');
    return mockUid || 'e2e-test-uid-123456';
  }

  if (!token) {
    console.error('[auth-verify] IDトークンが提供されていません。');
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error('[auth-verify] NEXT_PUBLIC_FIREBASE_API_KEY が環境変数に設定されていません。');
    return null;
  }

  try {
    const url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ idToken: token }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('[auth-verify] トークン検証APIがエラーを返しました:', errorData);
      return null;
    }

    const data = await response.json();
    const verifiedUid = data.users?.[0]?.localId;

    if (!verifiedUid) {
      console.error('[auth-verify] トークンは有効ですが、UID(localId)が応答に含まれていません。');
      return null;
    }

    return verifiedUid;
  } catch (error) {
    console.error('[auth-verify] トークンの検証中に予期しないエラーが発生しました:', error);
    return null;
  }
}
