import { test, expect } from '@playwright/test';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '../src/lib/supabase/database.types';
import { createDbClient } from './db-client';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL または SUPABASE_SERVICE_ROLE_KEY が設定されていません。');
  }
  return createClient<Database>(url, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

test.describe('クイズ作成済みユーザーの退会処理 E2E', () => {
  // グローバル認証状態をクリアして未ログイン状態でテストを開始
  test.use({ storageState: { cookies: [], origins: [] } });

  const testEmail = `e2e-withdrawal-${Date.now()}@example.com`;
  const testPassword = 'withdrawal-test-password-123';
  let testUid: string;
  let testQuizId: string;
  let dbClient: any;

  test.beforeAll(async () => {
    const supabase = getAdminClient();
    dbClient = createDbClient();
    await dbClient.connect();

    // 1. テスト用の一時ユーザーを作成
    const { data: created, error: createError } = await supabase.auth.admin.createUser({
      email: testEmail,
      password: testPassword,
      email_confirm: true,
    });
    if (createError || !created.user) {
      throw createError ?? new Error('E2E一時ユーザーの作成に失敗しました');
    }
    testUid = created.user.id;

    // 2. users テーブルにレコードを挿入
    await dbClient.query(
      `INSERT INTO users (id, email, display_name, avatar_url, bio, role, moderation_tier, is_banned, updated_at)
       VALUES ($1, $2, $3, $4, '', 'user', 'newcomer', false, $5)`,
      [testUid, testEmail, '退会テストユーザー', 'https://api.dicebear.com/7.x/bottts/svg?seed=test-withdrawal', new Date().toISOString()]
    );

    // 3. クイズを1件シード（クイズ作成済みユーザーにするため）
    const quizResult = await dbClient.query(
      `INSERT INTO quizzes (
         author_id, author_name, title, description, difficulty, genre,
         canonical_genre_id, status, visibility, question_count, play_count, format
       ) VALUES ($1, $2, $3, $4, 3, '趣味・カルチャー', 'hobby-culture', 'published', 'public', 1, 0, 'multiple-choice')
       RETURNING id`,
      [testUid, '退会テストユーザー', '退会テスト用のクイズ', 'このクイズは退会後も残るはずです。']
    );
    testQuizId = quizResult.rows[0].id;
  });

  test.afterAll(async () => {
    if (dbClient) {
      await dbClient.end();
    }
  });

  test('ログインし、退会処理を実行すると、クイズが匿名化されて残存し、Authから物理削除されること', async ({ page }) => {
    // alertなどのダイアログが発生した場合はログに記録して閉じる
    page.on('dialog', async (dialog) => {
      console.log(`[Dialog Alert Detected]: ${dialog.message()}`);
      if (dialog.type() === 'alert') {
        await dialog.accept();
      } else {
        await dialog.dismiss();
      }
    });

    // 退会APIのレスポンスを監視してログ出力
    page.on('response', async (response) => {
      if (response.url().includes('/api/user/delete-account')) {
        console.log(`[API Response Status]: ${response.status()}`);
        try {
          const body = await response.json();
          console.log(`[API Response Body]: ${JSON.stringify(body)}`);
        } catch (e) {
          const text = await response.text().catch(() => 'no text');
          console.log(`[API Response Text]: ${text}`);
        }
      }
    });

    // 1. 一時ユーザーでログイン画面に遷移（テスト専用のクエリパラメータを付与）
    await page.goto(`/login?e2eEmail=${encodeURIComponent(testEmail)}&e2ePassword=${encodeURIComponent(testPassword)}`);

    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible({ timeout: 10000 });
    await e2eLoginBtn.click();

    // ログイン完了（ホームページへの遷移）を待機
    await expect(page).toHaveURL('/', { timeout: 15000 });
    await page.waitForLoadState('domcontentloaded');

    // 2. 設定画面へ移動
    await page.goto('/settings');
    await expect(page.getByTestId('settings-page-container')).toBeVisible();

    // 3. 退会するボタンをクリック
    await page.getByTestId('settings-delete-account-button').click();

    // 4. 確認モーダルで「退会する」をクリック
    await page.getByTestId('settings-delete-account-confirm').click();

    // 5. 退会完了のアラートが表示されるトップページへのリダイレクトを待つ
    await expect(page).toHaveURL(/\/\?deleted=true/, { timeout: 20000 });
    await expect(page.getByTestId('deleted-success-alert')).toBeVisible();

    // 6. データベース上の状態を直接クエリして検証
    // (a) users レコードが匿名化されていること
    const userRes = await dbClient.query('SELECT * FROM users WHERE id = $1', [testUid]);
    expect(userRes.rows.length).toBe(1);
    const userRow = userRes.rows[0];
    expect(userRow.delete_status).toBe('deleted');
    expect(userRow.display_name).toBe('退会済ユーザー');
    expect(userRow.email).toBe(`deleted_${testUid}@example.com`);
    expect(userRow.avatar_url).toBeNull();
    expect(userRow.bio).toBe('');

    // (a-2) user_badges および user_genre_follows レコードが削除されていること
    const userBadgesRes = await dbClient.query('SELECT * FROM user_badges WHERE user_id = $1', [testUid]);
    expect(userBadgesRes.rows.length).toBe(0);

    const genreFollowsRes = await dbClient.query('SELECT * FROM user_genre_follows WHERE user_id = $1', [testUid]);
    expect(genreFollowsRes.rows.length).toBe(0);

    // (b) quizzes レコードが残存し、著者名が匿名化されていること
    const quizRes = await dbClient.query('SELECT * FROM quizzes WHERE id = $1', [testQuizId]);
    expect(quizRes.rows.length).toBe(1);
    const quizRow = quizRes.rows[0];
    expect(quizRow.author_id).toBe(testUid);
    expect(quizRow.author_name).toBe('退会済ユーザー');
    expect(quizRow.author_avatar).toBeNull();

    // (c) Supabase Auth 上からアカウントが物理削除されていること
    const supabase = getAdminClient();
    const { data: listResult, error: listError } = await supabase.auth.admin.listUsers();
    expect(listError).toBeNull();
    const authUser = listResult.users.find((u) => u.id === testUid);
    expect(authUser).toBeUndefined(); // 物理削除されているため見つからないこと
  });
});
