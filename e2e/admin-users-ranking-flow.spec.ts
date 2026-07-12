import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';
import { readE2eFixtureIds } from './fixture-ids';

/**
 * 通報ランキング一覧 → 行選択 → 検索タブへの自動切替 → ティア引き下げ実行 までの
 * 一連のE2Eフローを検証する（Requirements 9.7, 10.3, 10.6）。
 *
 * `get_reported_users_ranking` は quizzes.flags_count と user_reports の合算で
 * ランキングを算出するため、対象ユーザーが著者のダミークイズへ極端に大きい
 * flags_count を直接シードし、ページネーションの1ページ目（先頭）に
 * 確実に出現させることでテストの安定性を担保する。
 */

const TARGET_EMAIL = 'e2e-report-target@example.com';
const TARGET_DISPLAY_NAME = 'e2e-report-target';
const QUIZ_TITLE_PREFIX = '[REPORT_RANK_TEST]';

let targetUid: string;

test.describe('通報ランキング → ティア引き下げ E2Eテスト', () => {
  test.beforeAll(async () => {
    const db = createDbClient();
    await db.connect();
    try {
      const { userId: adminUid } = readE2eFixtureIds();
      // global-setup.ts が作成済みの E2Eテストユーザーを admin ロールで再確認する
      // （このファイル単体で実行された場合も admin 権限を保証するための防御的な再upsert）
      await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminUid]);

      // 通報ランキングの対象となるテストユーザーを投入（現在ティアーは moderator に固定し、
      // 引き下げ先の選択肢 newcomer / contributor が確実に存在する状態にする）。
      const targetResult = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, display_name, avatar_url, bio, moderation_tier, is_banned, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, '', 'moderator', false, now())
         ON CONFLICT (email) DO UPDATE SET
           moderation_tier = 'moderator',
           is_banned = false,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          TARGET_EMAIL,
          TARGET_DISPLAY_NAME,
          'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-report-target',
        ]
      );
      targetUid = targetResult.rows[0].id;

      // 既存のテスト用ダミークイズを削除してから再投入（再実行時の重複防止）
      await db.query(
        `DELETE FROM quizzes WHERE author_id = $1 AND title LIKE $2`,
        [targetUid, `${QUIZ_TITLE_PREFIX}%`]
      );

      // flags_count を極端に大きい値でシードし、通報ランキングの先頭（1ページ目）に
      // 確実に出現させる（他のE2Eテストで生成され得るデータ量に依存しないため）。
      await db.query(
        `INSERT INTO quizzes (
           author_id, author_name, title, description, difficulty, genre,
           canonical_genre_id, status, visibility, question_count, play_count, format, flags_count
         ) VALUES ($1, $2, $3, $4, 3, '趣味・カルチャー', 'hobby-culture', 'published', 'public', 1, 0, 'multiple-choice', 999999)`,
        [
          targetUid,
          TARGET_DISPLAY_NAME,
          `${QUIZ_TITLE_PREFIX} 通報ランキングE2Eテスト用ダミークイズ`,
          'E2E通報ランキングテスト用のダミークイズです。',
        ]
      );
    } finally {
      await db.end();
    }
  });

  test.afterAll(async () => {
    const db = createDbClient();
    await db.connect();
    try {
      if (targetUid) {
        // シードしたダミークイズのみ後片付けする（ユーザー行自体は次回実行時に再利用・再upsertする）。
        await db.query(
          `DELETE FROM quizzes WHERE author_id = $1 AND title LIKE $2`,
          [targetUid, `${QUIZ_TITLE_PREFIX}%`]
        );
      }
    } finally {
      await db.end();
    }
  });

  test('ランキング表示→行選択→タブ切替→ティア引き下げ実行→成功表示まで一気通貫で完了すること', async ({
    page,
  }) => {
    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. ユーザー評判管理画面へ遷移
    await page.goto('/admin/users');

    const isPageVisible = await page
      .locator('h1')
      .filter({ hasText: 'ユーザー評判管理' })
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    expect(isPageVisible).toBeTruthy();

    // 3. 「通報ランキング」タブへ切り替える
    await page.locator('#tab-reported').click();

    // 4. スケルトン表示が消えて一覧が表示されるのを待つ
    const skeleton = page.getByTestId('admin-reported-users-skeleton');
    await skeleton.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // 5. シードした対象ユーザーの行を見つけてクリックする（先頭に来るはずだが、UIDテキストで確実に特定する）
    const targetRow = page.locator('tr', { hasText: targetUid });
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    await targetRow.click();

    // 6. 「検索」タブへ自動的に切り替わり、対象ユーザーの詳細が表示されること（Requirement 9.7）
    await expect(page.locator('#tab-search')).toHaveAttribute('data-active', '', { timeout: 10000 });
    await expect(page.locator(`text=UID: ${targetUid}`)).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Moderator (一般モデレータ)').first()).toBeVisible();

    // 7. ティア引き下げ操作: 下位ティアーを選択し、10文字以上の理由を入力して確認・実行する
    await page.locator('[data-testid="tier-downgrade-select"]').click();
    await page.locator('[data-testid="tier-downgrade-option-contributor"]').click();

    const reasonTextarea = page.locator('#tierDowngradeReason');
    await reasonTextarea.fill('E2Eテストによるティア引き下げ検証のための理由です。');

    const downgradeBtn = page.locator('[data-testid="execute-tier-downgrade-btn"]');
    await expect(downgradeBtn).toBeEnabled();
    await downgradeBtn.click();

    const confirmBtn = page.getByTestId('confirm-action-btn');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // 8. 成功メッセージが表示され、表示中のティアーが更新されること（Requirements 10.3, 10.6）
    await expect(page.locator('text=ユーザーの権限ティアーを引き下げました。')).toBeVisible({
      timeout: 10000,
    });
    await expect(page.locator('text=Contributor (貢献者)').first()).toBeVisible({ timeout: 10000 });
  });
});
