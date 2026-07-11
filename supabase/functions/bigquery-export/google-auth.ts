// google-auth.ts
// GCPサービスアカウント鍵(JSON)からRS256 JWTを自前署名(Web Crypto API)し、
// OAuth2トークンエンドポイント(https://oauth2.googleapis.com/token)へ
// jwt-bearerグラントでPOSTしてアクセストークンを取得する。
//
// - 依存ライブラリなし(google-auth-libraryはDenoで不安定なため不採用。research.md参照)。
// - fetchFn引数によりDenoグローバルに依存しない(Jestテスト可能)。
// - 取得したトークンはモジュールスコープでキャッシュし、有効期限内の再呼び出しでは
//   HTTP往復を発生させない(design.md「google-auth.ts」の要求どおり)。
//
// GoogleTokenProvider インターフェース(types.ts)を満たす。

import type { GoogleTokenProvider } from "./types.ts";

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
// tabledata.insertAll に必要な最小権限スコープ(最小権限の原則。design.md Security Considerations)
const BIGQUERY_INSERT_SCOPE = "https://www.googleapis.com/auth/bigquery.insertdata";
// トークンの実際の有効期限より手前で「期限切れ」とみなす安全マージン(秒)。
// エッジケース(有効期限ぎりぎりでのリクエスト送信)による失敗を避けるため。
const EXPIRY_SAFETY_MARGIN_SECONDS = 60;

interface ServiceAccountKey {
  client_email: string;
  private_key: string;
}

interface TokenEndpointResponse {
  access_token: string;
  expires_in: number;
}

// モジュールスコープの単一トークンキャッシュ。
// サービスアカウント鍵が呼び出しごとに変わりうるため、鍵の内容もキャッシュキーとして保持する。
interface TokenCacheEntry {
  saKeyJson: string;
  accessToken: string;
  // UNIXエポック秒(安全マージン適用後)。この時刻以降はキャッシュを無効とみなす。
  expiresAtEpochSeconds: number;
}

let tokenCache: TokenCacheEntry | null = null;

function nowEpochSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

function base64urlEncode(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  const base64 = btoa(binary);
  return base64.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function base64urlEncodeString(input: string): string {
  return base64urlEncode(new TextEncoder().encode(input));
}

function pemToDer(pem: string): ArrayBuffer {
  const base64Body = pem
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\r/g, "")
    .replace(/\n/g, "")
    .trim();
  const binary = atob(base64Body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function importPrivateKey(pem: string): Promise<CryptoKey> {
  const derBytes = pemToDer(pem);
  return crypto.subtle.importKey(
    "pkcs8",
    derBytes,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

async function buildSignedJwt(serviceAccount: ServiceAccountKey): Promise<string> {
  const issuedAt = nowEpochSeconds();
  const expiresAt = issuedAt + 3600;

  const header = { alg: "RS256", typ: "JWT" };
  const claims = {
    iss: serviceAccount.client_email,
    scope: BIGQUERY_INSERT_SCOPE,
    aud: TOKEN_ENDPOINT,
    exp: expiresAt,
    iat: issuedAt,
  };

  const encodedHeader = base64urlEncodeString(JSON.stringify(header));
  const encodedClaims = base64urlEncodeString(JSON.stringify(claims));
  const signingInput = `${encodedHeader}.${encodedClaims}`;

  const privateKey = await importPrivateKey(serviceAccount.private_key);
  const signatureBuffer = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    privateKey,
    new TextEncoder().encode(signingInput)
  );
  const encodedSignature = base64urlEncode(new Uint8Array(signatureBuffer));

  return `${signingInput}.${encodedSignature}`;
}

async function requestAccessToken(
  signedJwt: string,
  fetchFn: typeof fetch
): Promise<TokenEndpointResponse> {
  const body = new URLSearchParams({
    grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
    assertion: signedJwt,
  });

  const response = await fetchFn(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(
      `Google OAuth2 token request failed: ${response.status} ${errorText}`
    );
  }

  return (await response.json()) as TokenEndpointResponse;
}

export async function getAccessToken(
  saKeyJson: string,
  fetchFn: typeof fetch = fetch
): Promise<string> {
  const now = nowEpochSeconds();

  if (
    tokenCache &&
    tokenCache.saKeyJson === saKeyJson &&
    tokenCache.expiresAtEpochSeconds > now
  ) {
    return tokenCache.accessToken;
  }

  const serviceAccount = JSON.parse(saKeyJson) as ServiceAccountKey;
  const signedJwt = await buildSignedJwt(serviceAccount);
  const tokenResponse = await requestAccessToken(signedJwt, fetchFn);

  tokenCache = {
    saKeyJson,
    accessToken: tokenResponse.access_token,
    expiresAtEpochSeconds:
      now + tokenResponse.expires_in - EXPIRY_SAFETY_MARGIN_SECONDS,
  };

  return tokenResponse.access_token;
}

// GoogleTokenProvider インターフェースを満たすオブジェクト実装(index.ts等からの利用を想定)。
export const googleTokenProvider: GoogleTokenProvider = {
  getAccessToken,
};
