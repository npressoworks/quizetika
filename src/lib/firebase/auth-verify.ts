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
 * @param mockUid (非推奨) 過去の互換性のための引数。エミュレータ移行に伴い使用されません
 * @returns 検証済みの Firebase UID。検証失敗時は null
 */
export async function verifyFirebaseIdToken(token: string | null, mockUid?: string): Promise<string | null> {
  if (!token) {
    console.error('[auth-verify] IDトークンが提供されていません。');
    return null;
  }

  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!apiKey) {
    console.error('[auth-verify] NEXT_PUBLIC_FIREBASE_API_KEY が環境変数に設定されていません。');
    return null;
  }

  const isTestEnv = process.env.NEXT_PUBLIC_ENV === 'test';
  const emulatorHost = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';

  try {
    // E2Eテスト環境（またはエミュレータ環境）の場合は、Auth Emulator の検証APIエンドポイントを使用
    let url = `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
    if (isTestEnv || process.env.FIREBASE_AUTH_EMULATOR_HOST) {
      url = `http://${emulatorHost}/identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`;
      console.log(`[auth-verify] エミュレータ環境のため、Auth Emulator (${url}) でトークンを検証します。`);
    }

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
