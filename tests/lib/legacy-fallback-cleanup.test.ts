import {
  removeFirebaseStorageRemotePattern,
  updateLegacyUrlComment,
} from '@/lib/legacy-fallback-cleanup';

const FIXTURE_WITH_FIREBASE = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@mui/material", "@mui/icons-material"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'firebasestorage.googleapis.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
`;

const FIXTURE_WITHOUT_FIREBASE = `import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["@mui/material", "@mui/icons-material"],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'api.dicebear.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'lh3.googleusercontent.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
`;

function countChar(source: string, char: string): number {
  return source.split(char).length - 1;
}

describe('removeFirebaseStorageRemotePattern', () => {
  test('firebasestorage.googleapis.com のエントリを含む場合、changed: true でエントリを除去した文字列を返す', () => {
    const result = removeFirebaseStorageRemotePattern(FIXTURE_WITH_FIREBASE);

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('firebasestorage.googleapis.com');
    // 他のエントリは残る
    expect(result.content).toContain('api.dicebear.com');
    expect(result.content).toContain('lh3.googleusercontent.com');
    // 配列・オブジェクトの括弧バランスが保たれている（構文破壊がないことのサニティチェック）
    expect(countChar(result.content, '{')).toBe(countChar(result.content, '}'));
    expect(countChar(result.content, '[')).toBe(countChar(result.content, ']'));
    // 連続するカンマ（削除処理による構文破壊）が生成されていない
    expect(result.content).not.toMatch(/,\s*,/);
    // 期待される完全な出力文字列と一致することを確認
    expect(result.content).toBe(FIXTURE_WITHOUT_FIREBASE);
  });

  test('firebasestorage.googleapis.com のエントリを含まない場合、changed: false かつ内容は変化しない', () => {
    const result = removeFirebaseStorageRemotePattern(FIXTURE_WITHOUT_FIREBASE);

    expect(result.changed).toBe(false);
    expect(result.content).toBe(FIXTURE_WITHOUT_FIREBASE);
  });

  test('ダブルクォートの hostname にも対応する', () => {
    const doubleQuoteFixture = `images: {
  remotePatterns: [
    {
      protocol: "https",
      hostname: "firebasestorage.googleapis.com",
      port: "",
      pathname: "/**",
    },
    {
      protocol: "https",
      hostname: "api.dicebear.com",
      port: "",
      pathname: "/**",
    },
  ],
},
`;
    const result = removeFirebaseStorageRemotePattern(doubleQuoteFixture);

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('firebasestorage.googleapis.com');
    expect(result.content).toContain('api.dicebear.com');
  });

  test('冪等性: 既にクリーンな内容に対して2回実行しても changed: false のまま内容は変化しない', () => {
    const first = removeFirebaseStorageRemotePattern(FIXTURE_WITH_FIREBASE);
    expect(first.changed).toBe(true);

    const second = removeFirebaseStorageRemotePattern(first.content);
    expect(second.changed).toBe(false);
    expect(second.content).toBe(first.content);

    const third = removeFirebaseStorageRemotePattern(second.content);
    expect(third.changed).toBe(false);
    expect(third.content).toBe(second.content);
  });
});

const STORAGE_TS_FIXTURE = `/**
 * 指定された公開URLの画像を物理削除する (クレンジング用)
 * @param imageUrl 削除対象画像の公開URL
 */
export async function deleteImage(imageUrl: string): Promise<void> {
  if (!imageUrl) return;

  // Supabase Storage の公開URLパターンに一致しない場合（旧 Firebase URL・外部アバター等）は何もしない
  const parsed = parseSupabasePublicUrl(imageUrl);
  if (!parsed) {
    return;
  }

  const supabase = createClient();
`;

const STORAGE_PATH_TS_FIXTURE = `const SUPABASE_PUBLIC_URL_PATTERN = /\\/storage\\/v1\\/object\\/public\\/([^/]+)\\/(.+)$/;

/**
 * Supabase Storage の公開URLパターンからバケットとオブジェクトパスを抽出する
 * 一致しない場合（旧 Firebase Storage URL・外部URL等）は null を返す
 */
export function parseSupabasePublicUrl(url: string): BucketAndPath | null {
  const match = url.match(SUPABASE_PUBLIC_URL_PATTERN);
  if (!match) {
    return null;
  }
`;

const NO_LEGACY_COMMENT_FIXTURE = `export function noop(): void {
  // このコメントは対象パターンを含まない
  return;
}
`;

describe('updateLegacyUrlComment', () => {
  test('storage.ts の「旧 Firebase URL・外部アバター等」（Storageを含まない表記）を統一表現に置換する', () => {
    const result = updateLegacyUrlComment(STORAGE_TS_FIXTURE);

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('旧 Firebase URL・外部アバター等');
    expect(result.content).toContain(
      'Supabase 以外の外部URL（Dicebearデフォルトアバター等）'
    );
    // 周辺のガード節（ロジック自体）は変更されない
    expect(result.content).toContain('if (!parsed) {\n    return;\n  }');
    expect(result.content).toContain(
      'const parsed = parseSupabasePublicUrl(imageUrl);'
    );
  });

  test('storage-path.ts の「旧 Firebase Storage URL・外部URL等」（Storageを含む表記）を統一表現に置換する', () => {
    const result = updateLegacyUrlComment(STORAGE_PATH_TS_FIXTURE);

    expect(result.changed).toBe(true);
    expect(result.content).not.toContain('旧 Firebase Storage URL・外部URL等');
    expect(result.content).toContain(
      'Supabase 以外の外部URL（Dicebearデフォルトアバター等）'
    );
    // 周辺のロジック（null 判定）は変更されない
    expect(result.content).toContain('if (!match) {\n    return null;\n  }');
  });

  test('いずれの異表記も含まない場合、changed: false かつ内容はバイト単位で変化しない', () => {
    const result = updateLegacyUrlComment(NO_LEGACY_COMMENT_FIXTURE);

    expect(result.changed).toBe(false);
    expect(result.content).toBe(NO_LEGACY_COMMENT_FIXTURE);
  });
});
