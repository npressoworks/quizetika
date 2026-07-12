import { createClient } from '@supabase/supabase-js';
import { writeFileSync } from 'node:fs';
import initialGenresData from '../src/data/initial_genres.json';
import type { Database } from '../src/lib/supabase/database.types';
import { FIXTURE_IDS_PATH, type E2eFixtureIds } from './fixture-ids';
import { createDbClient } from './db-client';

/** `initial_genres.json` の1件分（src/services/seedInitialGenresAdmin.ts と同一形状） */
interface InitialGenreSeed {
  id: string;
  displayName: string;
  description?: string;
  iconImageUrl: string | null;
  canonicalId: string | null;
  mergedGenreIds: string[];
  isActive: boolean;
}

const E2E_EMAIL = 'e2e-test-user@example.com';
const E2E_PASSWORD = 'e2e-test-password-999';
const AD_TEST_QUIZ_COUNT = 25;

// 公開範囲（限定公開・非公開）アクセス制御 E2E 用の追加アカウント
const VIS_AUTHOR_EMAIL = 'e2e-vis-author@example.com';
const VIS_AUTHOR_PASSWORD = 'e2e-vis-author-password-999';
const VIS_FOLLOWER_EMAIL = 'e2e-vis-follower@example.com';
const VIS_FOLLOWER_PASSWORD = 'e2e-vis-follower-password-999';
const VIS_STRANGER_EMAIL = 'e2e-vis-stranger@example.com';
const VIS_STRANGER_PASSWORD = 'e2e-vis-stranger-password-999';

function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません。'
    );
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Supabase Auth 上にメールアドレスでユーザーを取得または新規作成する（`listUsers` を都度呼ぶため、まとめて複数回呼ぶ用途向け） */
async function getOrCreateAuthUser(
  supabase: ReturnType<typeof createAdminClient>,
  email: string,
  password: string
): Promise<string> {
  const { data: listResult, error: listError } = await supabase.auth.admin.listUsers();
  if (listError) {
    throw new Error(`E2Eテストユーザー(${email})の検索に失敗しました: ${listError.message}`);
  }
  const existingUser = listResult.users.find((u) => u.email === email);
  if (existingUser) {
    return existingUser.id;
  }
  const { data: created, error: createError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (createError || !created.user) {
    throw createError ?? new Error(`E2Eテストユーザー(${email})の作成に失敗しました`);
  }
  return created.user.id;
}

/**
 * E2E 実行前に Supabase ローカル環境へジャンルマスタ・E2Eテストユーザー・
 * 広告テスト用ダミークイズを投入する。Supabase の各テーブルは UUID 主キーのため、
 * Firestore時代の固定文字列IDは使えない。ここで払い出された実行時IDは
 * `.e2e-fixture-ids.json` に書き出し、他の e2e spec から `readE2eFixtureIds()` で参照する。
 */
export default async function globalSetup() {
  const supabase = createAdminClient();
  const db = createDbClient();
  await db.connect();

  try {
    const now = new Date().toISOString();

    // 1. E2Eテスト用ユーザーの取得または作成 (Supabase Auth)
    const { data: listResult, error: listError } = await supabase.auth.admin.listUsers();
    if (listError) {
      throw new Error(`E2Eテストユーザーの検索に失敗しました: ${listError.message}`);
    }
    const existingUser = listResult.users.find((u) => u.email === E2E_EMAIL);

    let e2eUid: string;
    if (existingUser) {
      e2eUid = existingUser.id;
    } else {
      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email: E2E_EMAIL,
        password: E2E_PASSWORD,
        email_confirm: true,
      });
      if (createError || !created.user) {
        throw createError ?? new Error('E2Eテストユーザーの作成に失敗しました');
      }
      e2eUid = created.user.id;
    }

    // 2. users テーブルへ admin ロールで upsert
    await db.query(
      `INSERT INTO users (id, email, display_name, avatar_url, bio, role, moderation_tier, is_banned, updated_at)
       VALUES ($1, $2, $3, $4, '', 'admin', 'senior_moderator', false, $5)
       ON CONFLICT (id) DO UPDATE SET
         role = EXCLUDED.role,
         moderation_tier = EXCLUDED.moderation_tier,
         is_banned = EXCLUDED.is_banned,
         updated_at = EXCLUDED.updated_at`,
      [e2eUid, E2E_EMAIL, 'e2e-test-user', `https://api.dicebear.com/7.x/bottts/svg?seed=${e2eUid}`, now]
    );

    // 3. ジャンルマスタの投入 (metadata_genres)
    const genres = initialGenresData as InitialGenreSeed[];
    for (const genre of genres) {
      await db.query(
        `INSERT INTO metadata_genres (id, display_name, description, icon_image_url, canonical_id, merged_genre_ids, is_active, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (id) DO UPDATE SET
           display_name = EXCLUDED.display_name,
           description = EXCLUDED.description,
           icon_image_url = EXCLUDED.icon_image_url,
           canonical_id = EXCLUDED.canonical_id,
           merged_genre_ids = EXCLUDED.merged_genre_ids,
           is_active = EXCLUDED.is_active,
           updated_at = EXCLUDED.updated_at`,
        [
          genre.id,
          genre.displayName,
          genre.description ?? '',
          genre.iconImageUrl,
          genre.canonicalId,
          genre.mergedGenreIds ?? [],
          genre.isActive,
          now,
        ]
      );
    }

    // 4. AI生成モック用のテスト画像を Supabase Storage に配置しておく
    try {
      const { error: uploadError } = await supabase.storage
        .from('genres')
        .upload('temp/e2e-ai-temp.png', Buffer.from('dummy image data'), {
          contentType: 'image/png',
          upsert: true,
        });
      if (uploadError) throw uploadError;
    } catch (err) {
      console.error('Storageモック画像の事前配置に失敗しました:', err);
    }

    // 5. 広告テスト用のダミークイズを25件シード（既存データは事前に削除）
    const existingQuizzesResult = await db.query<{ id: string }>(
      `SELECT id FROM quizzes WHERE author_id = $1 AND title LIKE '[AD_TEST]%'`,
      [e2eUid]
    );
    const existingQuizIds = existingQuizzesResult.rows.map((row) => row.id);
    if (existingQuizIds.length > 0) {
      // questions / quiz_questions は quizzes への ON DELETE CASCADE で連動削除される
      await db.query(`DELETE FROM quizzes WHERE id = ANY($1::uuid[])`, [existingQuizIds]);
      console.log(`[global-setup] 既存E2Eクイズ（${existingQuizIds.length}件）を削除しました。`);
    }

    const quizIds: string[] = [];
    const questionIds: string[] = [];

    for (let i = 1; i <= AD_TEST_QUIZ_COUNT; i++) {
      const quizResult = await db.query<{ id: string }>(
        `INSERT INTO quizzes (
           author_id, author_name, title, description, difficulty, genre,
           canonical_genre_id, status, visibility, question_count, play_count, format
         ) VALUES ($1, $2, $3, $4, 3, '趣味・カルチャー', 'hobby-culture', 'published', 'public', 1, $5, 'multiple-choice')
         RETURNING id`,
        [
          e2eUid,
          'e2e-test-user',
          `[AD_TEST] クイズ_${i}`,
          `E2E広告テスト用のダミークイズ ${i} です。`,
          10 + i,
        ]
      );
      const quizId = quizResult.rows[0].id;

      const questionResult = await db.query<{ id: string }>(
        `INSERT INTO questions (
           owner_quiz_id, author_id, author_name, type, question_text, explanation, choices
         ) VALUES ($1, $2, $3, 'multiple-choice', $4, '解説の内容です。', $5::jsonb)
         RETURNING id`,
        [
          quizId,
          e2eUid,
          'e2e-test-user',
          `問題_${i} の本文`,
          JSON.stringify([
            { id: '1', choiceText: '正解', isCorrect: true, selectedCount: 0 },
            { id: '2', choiceText: '不正解', isCorrect: false, selectedCount: 0 },
          ]),
        ]
      );
      const questionId = questionResult.rows[0].id;

      await db.query(
        `INSERT INTO quiz_questions (quiz_id, question_id, display_order) VALUES ($1, $2, 1)`,
        [quizId, questionId]
      );

      quizIds.push(quizId);
      questionIds.push(questionId);
    }

    // 6. 公開範囲（限定公開・非公開）アクセス制御 E2E 用のアカウント・フォロー関係・クイズを投入
    const visAuthorUid = await getOrCreateAuthUser(supabase, VIS_AUTHOR_EMAIL, VIS_AUTHOR_PASSWORD);
    const visFollowerUid = await getOrCreateAuthUser(supabase, VIS_FOLLOWER_EMAIL, VIS_FOLLOWER_PASSWORD);
    const visStrangerUid = await getOrCreateAuthUser(supabase, VIS_STRANGER_EMAIL, VIS_STRANGER_PASSWORD);

    // author は Pro プラン（role/moderation_tier は付与しない = 一般ユーザーとして可視性制御を検証する）
    await db.query(
      `INSERT INTO users (id, email, display_name, avatar_url, bio, subscription_tier, subscription_status, updated_at)
       VALUES ($1, $2, $3, $4, '', 'pro', 'active', $5)
       ON CONFLICT (id) DO UPDATE SET
         subscription_tier = EXCLUDED.subscription_tier,
         subscription_status = EXCLUDED.subscription_status,
         updated_at = EXCLUDED.updated_at`,
      [visAuthorUid, VIS_AUTHOR_EMAIL, 'e2e-vis-author', `https://api.dicebear.com/7.x/bottts/svg?seed=${visAuthorUid}`, now]
    );
    // follower / stranger は無料プランのまま（デフォルト値を維持するため display_name 等のみ upsert）
    await db.query(
      `INSERT INTO users (id, email, display_name, avatar_url, bio, updated_at)
       VALUES ($1, $2, $3, $4, '', $5)
       ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
      [visFollowerUid, VIS_FOLLOWER_EMAIL, 'e2e-vis-follower', `https://api.dicebear.com/7.x/bottts/svg?seed=${visFollowerUid}`, now]
    );
    await db.query(
      `INSERT INTO users (id, email, display_name, avatar_url, bio, updated_at)
       VALUES ($1, $2, $3, $4, '', $5)
       ON CONFLICT (id) DO UPDATE SET updated_at = EXCLUDED.updated_at`,
      [visStrangerUid, VIS_STRANGER_EMAIL, 'e2e-vis-stranger', `https://api.dicebear.com/7.x/bottts/svg?seed=${visStrangerUid}`, now]
    );

    // follower が author をフォロー済みの状態にする（follows は (follower_id, following_id) の複合主キー）
    await db.query(
      `INSERT INTO follows (follower_id, following_id) VALUES ($1, $2)
       ON CONFLICT (follower_id, following_id) DO NOTHING`,
      [visFollowerUid, visAuthorUid]
    );

    // 既存の可視性テスト用クイズを削除してから再投入（再実行時の重複防止）
    await db.query(
      `DELETE FROM quizzes WHERE author_id = ANY($1::uuid[]) AND title LIKE '[VIS_TEST]%'`,
      [[visAuthorUid, visStrangerUid]]
    );

    async function seedVisibilityTestQuiz(authorId: string, authorName: string, title: string): Promise<string> {
      const quizResult = await db.query<{ id: string }>(
        `INSERT INTO quizzes (
           author_id, author_name, title, description, difficulty, genre,
           canonical_genre_id, status, visibility, question_count, play_count, format
         ) VALUES ($1, $2, $3, $4, 3, '趣味・カルチャー', 'hobby-culture', 'published', 'public', 1, 0, 'multiple-choice')
         RETURNING id`,
        [authorId, authorName, title, `${title} の説明文です。`]
      );
      const quizId = quizResult.rows[0].id;

      const questionResult = await db.query<{ id: string }>(
        `INSERT INTO questions (
           owner_quiz_id, author_id, author_name, type, question_text, explanation, choices
         ) VALUES ($1, $2, $3, 'multiple-choice', $4, '解説の内容です。', $5::jsonb)
         RETURNING id`,
        [
          quizId,
          authorId,
          authorName,
          `${title} の問題文`,
          JSON.stringify([
            { id: '1', choiceText: '正解', isCorrect: true, selectedCount: 0 },
            { id: '2', choiceText: '不正解', isCorrect: false, selectedCount: 0 },
          ]),
        ]
      );
      const questionId = questionResult.rows[0].id;

      await db.query(
        `INSERT INTO quiz_questions (quiz_id, question_id, display_order) VALUES ($1, $2, 1)`,
        [quizId, questionId]
      );

      return quizId;
    }

    const visAuthorQuizId = await seedVisibilityTestQuiz(
      visAuthorUid,
      'e2e-vis-author',
      '[VIS_TEST] 限定公開・非公開テスト用クイズ'
    );
    const visStrangerQuizId = await seedVisibilityTestQuiz(
      visStrangerUid,
      'e2e-vis-stranger',
      '[VIS_TEST] Pro制限テスト用クイズ'
    );

    const fixtureIds: E2eFixtureIds = {
      userId: e2eUid,
      quizIds,
      questionIds,
      visibilityTest: {
        author: { email: VIS_AUTHOR_EMAIL, password: VIS_AUTHOR_PASSWORD, userId: visAuthorUid },
        follower: { email: VIS_FOLLOWER_EMAIL, password: VIS_FOLLOWER_PASSWORD, userId: visFollowerUid },
        stranger: { email: VIS_STRANGER_EMAIL, password: VIS_STRANGER_PASSWORD, userId: visStrangerUid },
        authorQuizId: visAuthorQuizId,
        strangerQuizId: visStrangerQuizId,
      },
    };
    writeFileSync(FIXTURE_IDS_PATH, JSON.stringify(fixtureIds, null, 2));
  } finally {
    await db.end();
  }
}
