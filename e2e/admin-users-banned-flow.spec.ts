import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';
import { readE2eFixtureIds } from './fixture-ids';

/**
 * BAN管理タブ: BAN日時範囲での絞り込み → UNBAN実行 → 一覧からの消失 までの
 * 一連のE2Eフローを検証する（Requirements 11.4, 11.7）。
 *
 * `get_banned_users` RPC は `banned_at`（TIMESTAMPTZ）を日付範囲（`type="date"`の
 * `bannedFrom`/`bannedTo` 入力、YYYY-MM-DD文字列）でフィルタするため、
 * フィルタ対象（範囲内）とフィルタ除外対象（範囲外）の2ユーザーをシードし、
 * 絞り込みが実際に範囲外ユーザーを除外することを証明する。
 */

const TARGET_EMAIL = 'e2e-ban-target@example.com';
const TARGET_DISPLAY_NAME = 'e2e-ban-target';
const OUT_OF_RANGE_EMAIL = 'e2e-ban-outrange@example.com';
const OUT_OF_RANGE_DISPLAY_NAME = 'e2e-ban-outrange';

function toDateOnly(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

let targetUid: string;
let outOfRangeUid: string;

// 絞り込み対象（範囲内）: 3日前にBANされた
const targetBannedAt = daysAgo(3);
// 絞り込み除外対象（範囲外）: 60日前にBANされた
const outOfRangeBannedAt = daysAgo(60);

// フィルタ範囲: 5日前 〜 今日（targetのみを含み、60日前のoutOfRangeは除外する）
const filterFrom = toDateOnly(daysAgo(5));
const filterTo = toDateOnly(daysAgo(0));

test.describe('BAN管理タブ: 日時絞り込み → UNBAN実行 E2Eテスト', () => {
  test.beforeAll(async () => {
    const db = createDbClient();
    await db.connect();
    try {
      const { userId: adminUid } = readE2eFixtureIds();
      // global-setup.ts が作成済みの E2Eテストユーザーを admin ロールで再確認する
      // （このファイル単体で実行された場合も admin 権限を保証するための防御的な再upsert）
      await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [adminUid]);

      const targetResult = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, display_name, avatar_url, bio, is_banned, banned_reason, banned_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, '', TRUE, $4, $5, now())
         ON CONFLICT (email) DO UPDATE SET
           is_banned = TRUE,
           banned_reason = EXCLUDED.banned_reason,
           banned_at = EXCLUDED.banned_at,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          TARGET_EMAIL,
          TARGET_DISPLAY_NAME,
          'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-ban-target',
          'E2Eテストによる絞り込み対象のBAN理由です。',
          targetBannedAt.toISOString(),
        ]
      );
      targetUid = targetResult.rows[0].id;

      const outOfRangeResult = await db.query<{ id: string }>(
        `INSERT INTO users (id, email, display_name, avatar_url, bio, is_banned, banned_reason, banned_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, '', TRUE, $4, $5, now())
         ON CONFLICT (email) DO UPDATE SET
           is_banned = TRUE,
           banned_reason = EXCLUDED.banned_reason,
           banned_at = EXCLUDED.banned_at,
           updated_at = EXCLUDED.updated_at
         RETURNING id`,
        [
          OUT_OF_RANGE_EMAIL,
          OUT_OF_RANGE_DISPLAY_NAME,
          'https://api.dicebear.com/7.x/bottts/svg?seed=e2e-ban-outrange',
          'E2Eテストによる絞り込み除外対象のBAN理由です。',
          outOfRangeBannedAt.toISOString(),
        ]
      );
      outOfRangeUid = outOfRangeResult.rows[0].id;

      // 既存の監査ログを削除してから再投入（再実行時の重複防止）
      await db.query(`DELETE FROM admin_logs WHERE target_uid = ANY($1::uuid[])`, [
        [targetUid, outOfRangeUid],
      ]);
      await db.query(
        `INSERT INTO admin_logs (target_uid, executor_id, action, reason)
         VALUES ($1, $2, 'ban', 'E2Eテストによる絞り込み対象のBAN理由です。'),
                ($3, $2, 'ban', 'E2Eテストによる絞り込み除外対象のBAN理由です。')`,
        [targetUid, adminUid, outOfRangeUid]
      );
    } finally {
      await db.end();
    }
  });

  test.afterAll(async () => {
    const db = createDbClient();
    await db.connect();
    try {
      // target はテスト自身のUNBAN操作によって is_banned/banned_reason/banned_at が
      // 既にリセットされているはずだが、テスト失敗時の防御的な後片付けとして両ユーザーとも
      // 明示的にリセットしておく（他のE2Eテスト（admin-users.spec.ts等）が
      // is_banned=false を前提としないよう、また一覧汚染を避けるため）。
      if (targetUid) {
        await db.query(
          `UPDATE users SET is_banned = FALSE, banned_reason = NULL, banned_at = NULL, updated_at = now()
           WHERE id = $1`,
          [targetUid]
        );
      }
      if (outOfRangeUid) {
        await db.query(
          `UPDATE users SET is_banned = FALSE, banned_reason = NULL, banned_at = NULL, updated_at = now()
           WHERE id = $1`,
          [outOfRangeUid]
        );
      }
      const uids = [targetUid, outOfRangeUid].filter(Boolean);
      if (uids.length > 0) {
        await db.query(`DELETE FROM admin_logs WHERE target_uid = ANY($1::uuid[])`, [uids]);
      }
    } finally {
      await db.end();
    }
  });

  test('BAN日時範囲で絞り込み → 範囲外ユーザーが除外される → UNBAN実行で一覧から消える', async ({
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

    // 3. 「BAN管理」タブへ切り替える
    await page.locator('#tab-banned').click();

    // 4. スケルトン表示が消えて一覧が表示されるのを待つ
    const skeleton = page.getByTestId('admin-banned-users-skeleton');
    await skeleton.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});

    // 5. フィルタ未適用の状態で、シードした対象（範囲内）・範囲外の両行が表示されること
    const targetRow = page.locator('tr', { hasText: targetUid });
    const outOfRangeRow = page.locator('tr', { hasText: outOfRangeUid });
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    await expect(outOfRangeRow).toBeVisible({ timeout: 10000 });

    // 6. BAN日時範囲フィルタ（開始・終了）を適用する（Requirement 11.4）
    await page.locator('#bannedFrom').fill(filterFrom);
    await page.locator('#bannedTo').fill(filterTo);

    // 7. 絞り込み結果として、対象（範囲内）の行のみが表示され、範囲外の行は除外されること
    await expect(targetRow).toBeVisible({ timeout: 10000 });
    await expect(outOfRangeRow).not.toBeVisible({ timeout: 10000 });

    // 8. 対象行の「解除」ボタンをクリックし、確認ダイアログでUNBANを実行する
    const unbanBtn = targetRow.getByRole('button', { name: '解除' });
    await unbanBtn.click();

    const confirmBtn = page.getByTestId('confirm-action-btn');
    await expect(confirmBtn).toBeVisible({ timeout: 5000 });
    await confirmBtn.click();

    // 9. UNBAN成功後、対象行が一覧から消えること（Requirement 11.7）
    await expect(targetRow).not.toBeVisible({ timeout: 10000 });
  });
});
