// google-auth.test.ts
// google-auth.ts の RS256 JWT組立→OAuth2トークン取得→モジュールスコープキャッシュを検証する。
// fetch注入(fetchFn)によりDenoグローバルに依存せずNode/Jestで実行できる。

import { generateKeyPairSync } from "crypto";
import { getAccessToken } from "../../../supabase/functions/bigquery-export/google-auth";

function buildFakeServiceAccountJson(): string {
  const { privateKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
    publicKeyEncoding: { type: "spki", format: "pem" },
    privateKeyEncoding: { type: "pkcs8", format: "pem" },
  });

  return JSON.stringify({
    client_email: "test-sa@example-project.iam.gserviceaccount.com",
    private_key: privateKey,
  });
}

function base64urlDecode(input: string): string {
  const padded = input.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(padded, "base64").toString("utf8");
}

describe("google-auth getAccessToken", () => {
  // モジュールスコープキャッシュはSA鍵の内容をキーの一部にしているため、
  // テストケース間の干渉を避けるためテストごとに異なる鍵を生成する。
  beforeEach(() => {
    jest.useRealTimers();
  });

  it("returns the access token from the mocked token endpoint and sends a well-formed JWT assertion", async () => {
    const saKeyJson = buildFakeServiceAccountJson();
    const mockFetch = jest.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      // JWT assertionの形状を検証する
      const body = String(init?.body ?? "");
      const params = new URLSearchParams(body);
      expect(params.get("grant_type")).toBe(
        "urn:ietf:params:oauth:grant-type:jwt-bearer"
      );
      const assertion = params.get("assertion");
      expect(assertion).toBeTruthy();

      const segments = (assertion ?? "").split(".");
      expect(segments).toHaveLength(3);

      const header = JSON.parse(base64urlDecode(segments[0]));
      expect(header).toEqual({ alg: "RS256", typ: "JWT" });

      const claims = JSON.parse(base64urlDecode(segments[1]));
      expect(claims.iss).toBe(
        "test-sa@example-project.iam.gserviceaccount.com"
      );
      expect(claims.scope).toBe(
        "https://www.googleapis.com/auth/bigquery.insertdata"
      );
      expect(claims.aud).toBe("https://oauth2.googleapis.com/token");
      expect(typeof claims.exp).toBe("number");
      expect(typeof claims.iat).toBe("number");

      return new Response(
        JSON.stringify({ access_token: "fake-access-token-1", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    });

    const token = await getAccessToken(
      saKeyJson,
      mockFetch as unknown as typeof fetch
    );

    expect(token).toBe("fake-access-token-1");
    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(String(url)).toBe("https://oauth2.googleapis.com/token");
  });

  it("does not perform a new HTTP round-trip on a second call within the cache window", async () => {
    const saKeyJson = buildFakeServiceAccountJson();
    const mockFetch = jest.fn(async () => {
      return new Response(
        JSON.stringify({ access_token: "fake-access-token-2", expires_in: 3600 }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const first = await getAccessToken(saKeyJson, mockFetch);
    const second = await getAccessToken(saKeyJson, mockFetch);

    expect(first).toBe("fake-access-token-2");
    expect(second).toBe("fake-access-token-2");
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it("performs a new HTTP round-trip after the cached token expires", async () => {
    const saKeyJson = buildFakeServiceAccountJson();
    jest.useFakeTimers({ doNotFake: ["nextTick"] });
    jest.setSystemTime(0);

    let callCount = 0;
    const mockFetch = jest.fn(async () => {
      callCount += 1;
      return new Response(
        JSON.stringify({
          access_token: `fake-access-token-expiry-${callCount}`,
          expires_in: 3600,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const first = await getAccessToken(saKeyJson, mockFetch);
    expect(first).toBe("fake-access-token-expiry-1");
    expect(mockFetch).toHaveBeenCalledTimes(1);

    // 3600秒 - 60秒の安全マージンを超えて進める(3601秒経過)
    jest.setSystemTime(3601 * 1000);

    const second = await getAccessToken(saKeyJson, mockFetch);
    expect(second).toBe("fake-access-token-expiry-2");
    expect(mockFetch).toHaveBeenCalledTimes(2);

    jest.useRealTimers();
  });
});
