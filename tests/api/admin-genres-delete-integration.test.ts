import { NextRequest } from 'next/server';
import { randomUUID } from 'node:crypto';
import { Client } from 'pg';
import { createDbClient } from '../../e2e/db-client';

/**
 * ジャンル削除・影響確認API 統合テスト (Task 5.1)
 *
 * tests/api/admin-genres-usage.test.ts / admin-genres-delete.test.ts は
 * Supabase クライアント全体をモック化した単体テストであり、認可(401/403)・
 * エラーマッピング(404/400)は既にカバー済み。
 *
 * このテストは、ローカル Supabase (Docker: supabase_db_quizetika) に実際に接続し、
 * `delete_genre_with_reassignment` RPC を含む一連のAPI処理を実DBに対して実行して、
 * DB状態（quizzes.canonical_genre_id の更新、metadata_genres レコードの削除）を
 * 直接検証する。
 *
 * 認可境界について:
 *   `verifySupabaseAccessToken` はサーバーサイドの Cookie 連携クライアント
 *   (`next/headers` の `cookies()`) を内部で使用しており、Next.js のリクエスト
 *   スコープ外（本テストのように route handler を直接 import して呼び出す場合）
 *   では常に例外を送出し null を返す仕様であることを事前調査で確認済み。
 *   そのため `extractBearerToken` / `verifySupabaseAccessToken` のみをモックし、
 *   Bearer トークンの値をそのまま検証済みユーザーIDとして扱う（テスト用の実ユーザー
 *   IDを直接渡す）。認可ロジック本体（`isAdminUser` による admin 判定、
 *   `users` テーブルの実データ参照）と、それ以降の Supabase 管理クライアント経由の
 *   DB操作・RPC呼び出しはすべて実際のローカル Supabase に対して実行する。
 */

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? 'http://127.0.0.1:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU';

jest.mock('@/lib/supabase/auth-verify', () => ({
  extractBearerToken: (request: NextRequest) => {
    const header = request.headers.get('Authorization');
    if (!header) return null;
    const parts = header.split(' ');
    if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') return null;
    return parts[1];
  },
  // テスト用: Bearer トークンの値をそのまま検証済みユーザーIDとして扱う。
  // 'invalid-token' は検証失敗（未認証）をシミュレートするための予約値。
  verifySupabaseAccessToken: async (token: string | null) => {
    if (!token || token === 'invalid-token') return null;
    return token;
  },
}));

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DELETE } = require('@/app/api/admin/genres/[id]/route') as typeof import('@/app/api/admin/genres/[id]/route');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { GET } = require('@/app/api/admin/genres/[id]/usage/route') as typeof import('@/app/api/admin/genres/[id]/usage/route');

const RUN_ID = randomUUID().slice(0, 8);
const ADMIN_USER_ID = randomUUID();
const NON_ADMIN_USER_ID = randomUUID();
const AUTHOR_USER_ID = randomUUID();

const GENRE_SOURCE_WITH_QUIZZES = `it-src-quiz-${RUN_ID}`;
const GENRE_TARGET = `it-target-${RUN_ID}`;
const GENRE_EMPTY = `it-empty-${RUN_ID}`;
const GENRE_REASSIGN_REQUIRED = `it-reassign-req-${RUN_ID}`;
const GENRE_INVALID_TARGET_SOURCE = `it-invalid-target-${RUN_ID}`;
const GENRE_NONEXISTENT_TARGET_ID = `it-nonexistent-target-${RUN_ID}`;

const GENRE_IDS = [
  GENRE_SOURCE_WITH_QUIZZES,
  GENRE_TARGET,
  GENRE_EMPTY,
  GENRE_REASSIGN_REQUIRED,
  GENRE_INVALID_TARGET_SOURCE,
];

let db: Client;

function buildDeleteRequest(id: string, body: Record<string, unknown>, token: string | null): NextRequest {
  return new NextRequest(`http://localhost/api/admin/genres/${id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
}

function buildUsageRequest(id: string, token: string | null): NextRequest {
  return new NextRequest(`http://localhost/api/admin/genres/${id}/usage`, {
    method: 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

function buildParams(id: string): { params: Promise<{ id: string }> } {
  return { params: Promise.resolve({ id }) };
}

async function insertQuizForGenre(genreId: string): Promise<string> {
  const quizId = randomUUID();
  await db.query(
    `INSERT INTO quizzes (id, author_id, author_name, title, description, difficulty, genre, canonical_genre_id)
     VALUES ($1, $2, $3, $4, $5, 3, $6, $6)`,
    [quizId, AUTHOR_USER_ID, 'integration-test-author', `it-quiz-${quizId}`, 'integration test quiz', genreId]
  );
  return quizId;
}

beforeAll(async () => {
  db = createDbClient();
  await db.connect();

  await db.query(
    `INSERT INTO users (id, email, display_name, role, moderation_tier)
     VALUES ($1, $2, 'it-author', NULL, NULL)`,
    [AUTHOR_USER_ID, `it-author-${RUN_ID}@example.test`]
  );
  await db.query(
    `INSERT INTO users (id, email, display_name, role, moderation_tier)
     VALUES ($1, $2, 'it-admin', 'admin', 'admin')`,
    [ADMIN_USER_ID, `it-admin-${RUN_ID}@example.test`]
  );
  await db.query(
    `INSERT INTO users (id, email, display_name, role, moderation_tier)
     VALUES ($1, $2, 'it-non-admin', NULL, 'senior_moderator')`,
    [NON_ADMIN_USER_ID, `it-non-admin-${RUN_ID}@example.test`]
  );

  for (const id of GENRE_IDS) {
    await db.query(
      `INSERT INTO metadata_genres (id, display_name, is_active) VALUES ($1, $2, TRUE)`,
      [id, `統合テスト用ジャンル ${id}`]
    );
  }
});

afterAll(async () => {
  // 自己クリーニング: テストが作成したデータのみを明示的に削除する。
  await db.query(`DELETE FROM quizzes WHERE author_id = $1`, [AUTHOR_USER_ID]);
  await db.query(`DELETE FROM metadata_genres WHERE id = ANY($1::text[])`, [GENRE_IDS]);
  await db.query(`DELETE FROM users WHERE id = ANY($1::uuid[])`, [
    [AUTHOR_USER_ID, ADMIN_USER_ID, NON_ADMIN_USER_ID],
  ]);
  await db.end();
});

describe('GET /api/admin/genres/:id/usage (integration)', () => {
  test('非管理者からのリクエストは403で拒否される', async () => {
    const res = await GET(buildUsageRequest(GENRE_EMPTY, NON_ADMIN_USER_ID), buildParams(GENRE_EMPTY));
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');
  });

  test('未認証リクエストは401で拒否される', async () => {
    const res = await GET(buildUsageRequest(GENRE_EMPTY, 'invalid-token'), buildParams(GENRE_EMPTY));
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  test('管理者は実DBに紐づくクイズ件数を取得できる', async () => {
    const quizId1 = await insertQuizForGenre(GENRE_SOURCE_WITH_QUIZZES);
    const quizId2 = await insertQuizForGenre(GENRE_SOURCE_WITH_QUIZZES);

    const res = await GET(
      buildUsageRequest(GENRE_SOURCE_WITH_QUIZZES, ADMIN_USER_ID),
      buildParams(GENRE_SOURCE_WITH_QUIZZES)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ quizCount: 2 });

    // このシナリオで挿入したクイズは後続の削除系テストで再利用するため、
    // ここでは削除せず quizId を確認のみ行う。
    expect(quizId1).not.toBe(quizId2);
  });

  test('存在しないジャンルIDは404を返す', async () => {
    const missingId = `it-missing-${RUN_ID}`;
    const res = await GET(buildUsageRequest(missingId, ADMIN_USER_ID), buildParams(missingId));
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('not-found');
  });
});

describe('DELETE /api/admin/genres/:id (integration)', () => {
  test('非管理者からのリクエストは403で拒否され、DBは変更されない', async () => {
    const res = await DELETE(
      buildDeleteRequest(GENRE_EMPTY, { reassignToGenreId: GENRE_TARGET }, NON_ADMIN_USER_ID),
      buildParams(GENRE_EMPTY)
    );
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error).toBe('forbidden');

    const { rows } = await db.query('SELECT id FROM metadata_genres WHERE id = $1', [GENRE_EMPTY]);
    expect(rows).toHaveLength(1);
  });

  test('未認証リクエストは401で拒否される', async () => {
    const res = await DELETE(
      buildDeleteRequest(GENRE_EMPTY, {}, 'invalid-token'),
      buildParams(GENRE_EMPTY)
    );
    const body = await res.json();

    expect(res.status).toBe(401);
    expect(body.error).toBe('unauthorized');
  });

  test('紐づくクイズが存在するジャンルを削除すると、対象クイズが再割当て先へ更新され、対象ジャンルが削除される', async () => {
    // GENRE_SOURCE_WITH_QUIZZES には前のテストで2件のクイズを紐づけ済み。
    const res = await DELETE(
      buildDeleteRequest(
        GENRE_SOURCE_WITH_QUIZZES,
        { reassignToGenreId: GENRE_TARGET },
        ADMIN_USER_ID
      ),
      buildParams(GENRE_SOURCE_WITH_QUIZZES)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, reassignedCount: 2 });

    const { rows: genreRows } = await db.query('SELECT id FROM metadata_genres WHERE id = $1', [
      GENRE_SOURCE_WITH_QUIZZES,
    ]);
    expect(genreRows).toHaveLength(0);

    const { rows: quizRows } = await db.query<{ genre: string; canonical_genre_id: string }>(
      'SELECT genre, canonical_genre_id FROM quizzes WHERE author_id = $1',
      [AUTHOR_USER_ID]
    );
    expect(quizRows).toHaveLength(2);
    for (const row of quizRows) {
      expect(row.genre).toBe(GENRE_TARGET);
      expect(row.canonical_genre_id).toBe(GENRE_TARGET);
    }
  });

  test('紐づくクイズが存在しないジャンルは再割当て先未指定でも削除でき、reassignedCount: 0 が返る', async () => {
    const res = await DELETE(
      buildDeleteRequest(GENRE_EMPTY, {}, ADMIN_USER_ID),
      buildParams(GENRE_EMPTY)
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ success: true, reassignedCount: 0 });

    const { rows } = await db.query('SELECT id FROM metadata_genres WHERE id = $1', [GENRE_EMPTY]);
    expect(rows).toHaveLength(0);
  });

  test('紐づくクイズが存在するのに再割当て先未指定の場合、400 reassign-required を返しDBは変更されない', async () => {
    const quizId = await insertQuizForGenre(GENRE_REASSIGN_REQUIRED);

    const res = await DELETE(
      buildDeleteRequest(GENRE_REASSIGN_REQUIRED, {}, ADMIN_USER_ID),
      buildParams(GENRE_REASSIGN_REQUIRED)
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('reassign-required');

    const { rows: genreRows } = await db.query('SELECT id FROM metadata_genres WHERE id = $1', [
      GENRE_REASSIGN_REQUIRED,
    ]);
    expect(genreRows).toHaveLength(1);

    const { rows: quizRows } = await db.query<{ genre: string }>(
      'SELECT genre FROM quizzes WHERE id = $1',
      [quizId]
    );
    expect(quizRows[0].genre).toBe(GENRE_REASSIGN_REQUIRED);
  });

  test('存在しない再割当て先IDを指定した場合、400 invalid-reassign-target を返しDBは変更されない', async () => {
    const quizId = await insertQuizForGenre(GENRE_INVALID_TARGET_SOURCE);

    const res = await DELETE(
      buildDeleteRequest(
        GENRE_INVALID_TARGET_SOURCE,
        { reassignToGenreId: GENRE_NONEXISTENT_TARGET_ID },
        ADMIN_USER_ID
      ),
      buildParams(GENRE_INVALID_TARGET_SOURCE)
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toBe('invalid-reassign-target');

    const { rows: genreRows } = await db.query('SELECT id FROM metadata_genres WHERE id = $1', [
      GENRE_INVALID_TARGET_SOURCE,
    ]);
    expect(genreRows).toHaveLength(1);

    const { rows: quizRows } = await db.query<{ genre: string }>(
      'SELECT genre FROM quizzes WHERE id = $1',
      [quizId]
    );
    expect(quizRows[0].genre).toBe(GENRE_INVALID_TARGET_SOURCE);
  });

  test('存在しないジャンルIDを削除しようとすると404を返す', async () => {
    const missingId = `it-missing-delete-${RUN_ID}`;
    const res = await DELETE(
      buildDeleteRequest(missingId, {}, ADMIN_USER_ID),
      buildParams(missingId)
    );
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error).toBe('genre-not-found');
  });
});
