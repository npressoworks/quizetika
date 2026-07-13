import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';
import { readE2eFixtureIds } from './fixture-ids';

/**
 * 検索タブ: 対象ユーザー検索 → 通報数リセット実行 → 成功表示 → 件数更新確認、
 * および未処理通報が0件のユーザーでの操作非活性化確認 までの一連のE2Eフローを検証する
 * （Requirements 12.3, 12.6, 12.7）。
 *
 * `handle_reset_user_reports` / `get_user_open_report_count` は user_reports.status='open'
 * の行のみを対象とするため、対象ユーザーへ異なる reporter_id で2件の open 通報を直接シードし、
 * 「未処理の直接通報: 2件」表示 → リセット実行 → 「未処理の直接通報: 0件」表示への更新を検証する。
 * 併せて、user_reports 行を一切持たない別ユーザーで通報数リセット操作が非活性であることを確認する。
 *
 * 対象UIDは e2e-admin-users-ranking-flow.spec.ts / e2e-admin-users-banned-flow.spec.ts の
 * シードユーザーとは異なるメールアドレスを用いて衝突を避ける。
 */

const TARGET_EMAIL = 'e2e-reset-reports-target@example.com';
const TARGET_DISPLAY_NAME = 'e2e-reset-reports-target';
const ZERO_EMAIL = 'e2e-reset-reports-zero@example.com';
const ZERO_DISPLAY_NAME = 'e2e-reset-reports-zero';

let targetUid: string;
let zeroUid: string;

test.describe('検索タブ: 通報数リセット E2Eテスト', () => {
  test.beforeAll(async () => {
    const db = createDbClient();
    await db.connect();
    try {
      const { userId: adminUid, visibilityTest } = readE2eFixtureIds();
      // global-setup.ts が作成済みの E2Eテストユーザーを admin ロールで再確認する
      // （このファイル単体で実行された場合も admin 権限を保証するための防御的な再upsert）。
      await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminUid]);

      // 通報数リセットの対象となるテストユーザー（未処理通報2件を後段でシードする）
      const targetResult = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, display_name, avatar_url, bio, is_banned, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, '', false, now())
         ON CONFLICT (email) DO UPDATE SET
           is_banned = false,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          TARGET_EMAIL,
          TARGET_DISPLAY_NAME,
          'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-reset-reports-target',
        ]
      );
      targetUid = targetResult.rows[0].id;

      // 未処理通報が0件のまま維持されるテストユーザー（非活性化確認用、user_reports行は一切投入しない）
      const zeroResult = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, display_name, avatar_url, bio, is_banned, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, '', false, now())
         ON CONFLICT (email) DO UPDATE SET
           is_banned = false,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          ZERO_EMAIL,
          ZERO_DISPLAY_NAME,
          'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-reset-reports-zero',
        ]
      );
      zeroUid = zeroResult.rows[0].id;

      // 既存のシード通報・監査ログを削除してから再投入（再実行時の重複防止）
      await db.query(`DELETE FROM user_reports WHERE target_uid = ANY($1::uuid[])`, [
        [targetUid, zeroUid],
      ]);
      await db.query(`DELETE FROM admin_logs WHERE target_uid = ANY($1::uuid[])`, [
        [targetUid, zeroUid],
      ]);

      // target には異なる reporter_id で open 通報を2件シードする
      // （user_reports_open_unique は reporter_id, target_uid の組み合わせで一意のため、
      //   同一reporterからの複数open通報は不可能。adminUidとvisibilityTest.followerを別々の
      //   通報者として使用する）。
      await db.query(
        `INSERT INTO user_reports (reporter_id, target_uid, category, detail, status, created_at)
         VALUES ($1, $3, 'harassment', 'E2Eテストによるシード通報1です。', 'open', now()),
                ($2, $3, 'spam', 'E2Eテストによるシード通報2です。', 'open', now())`,
        [adminUid, visibilityTest.follower.userId, targetUid]
      );
    } finally {
      await db.end();
    }
  });

  test.afterAll(async () => {
    const db = createDbClient();
    await db.connect();
    try {
      const uids = [targetUid, zeroUid].filter(Boolean);
      if (uids.length > 0) {
        await db.query(`DELETE FROM user_reports WHERE target_uid = ANY($1::uuid[])`, [uids]);
        await db.query(`DELETE FROM admin_logs WHERE target_uid = ANY($1::uuid[])`, [uids]);
      }
    } finally {
      await db.end();
    }
  });

  test('対象ユーザー検索→通報数リセット実行→成功表示→件数更新まで一気通貫で完了すること', async ({
    page,
  }) => {
    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. ユーザー評判管理画面へ遷移（検索タブがデフォルト）
    await page.goto('/admin/users');

    const isPageVisible = await page
      .locator('h1')
      .filter({ hasText: 'ユーザー評判管理' })
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);
    expect(isPageVisible).toBeTruthy();

    // 3. 対象ユーザーのUIDで検索を実行する
    await page.locator('input[placeholder="ユーザーUIDを入力..."]').fill(targetUid);
    await page.getByRole('button', { name: '検索', exact: true }).click();

    await expect(page.locator(`text=UID: ${targetUid}`)).toBeVisible({ timeout: 10000 });

    // 4. 未処理の直接通報件数が2件と表示されること（Requirement 12.3）
    const openReportCount = page.getByTestId('open-report-count');
    await expect(openReportCount).toHaveText('未処理の直接通報: 2件', { timeout: 10000 });

    // 5. 通報数リセット実行ボタンが活性化していること（未処理通報が存在するため）
    const resetReportsBtn = page.locator('#execute-reset-reports-btn');
    await expect(resetReportsBtn).toBeDisabled();

    // 6. 10文字以上の理由を入力して実行し、確認ダイアログで実行を確定する
    const reasonTextarea = page.locator('#resetReportsReason');
    await reasonTextarea.fill('E2Eテストによる通報数リセット検証のための理由です。');
    await expect(resetReportsBtn).toBeEnabled();
    await resetReportsBtn.click();

    const confirmBtn = page.getByTestId('confirm-action-btn');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // 7. 成功メッセージが表示されること（Requirement 12.6）
    await expect(page.locator('text=ユーザーの通報数をリセットしました。')).toBeVisible({
      timeout: 10000,
    });

    // 8. 未処理の直接通報件数が0件に更新されること（Requirement 12.6）
    await expect(openReportCount).toHaveText('未処理の直接通報: 0件', { timeout: 10000 });

    // 9. 件数0件になったことで、操作自体が非活性化されること
    await expect(resetReportsBtn).toBeDisabled();
    await expect(page.getByTestId('reset-reports-disabled-message')).toBeVisible();
  });

  test('未処理通報が0件のユーザーでは通報数リセット操作が非活性であること（Requirement 12.7）', async ({
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

    // 3. 未処理通報が0件のユーザーのUIDで検索を実行する
    await page.locator('input[placeholder="ユーザーUIDを入力..."]').fill(zeroUid);
    await page.getByRole('button', { name: '検索', exact: true }).click();

    await expect(page.locator(`text=UID: ${zeroUid}`)).toBeVisible({ timeout: 10000 });

    // 4. 未処理の直接通報件数が0件と表示されること
    const openReportCount = page.getByTestId('open-report-count');
    await expect(openReportCount).toHaveText('未処理の直接通報: 0件', { timeout: 10000 });

    // 5. 非活性化メッセージが表示され、実行ボタンが非活性であること（Requirement 12.7）
    await expect(page.getByTestId('reset-reports-disabled-message')).toBeVisible();

    const resetReportsBtn = page.locator('#execute-reset-reports-btn');
    const reasonTextarea = page.locator('#resetReportsReason');
    await reasonTextarea.fill('E2Eテストによる非活性化確認のための理由です。');
    // 理由を10文字以上入力しても、未処理通報が0件である限り実行ボタンは非活性のまま
    await expect(resetReportsBtn).toBeDisabled();
  });
});
