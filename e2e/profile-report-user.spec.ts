import { test, expect, type Browser, type Page } from '@playwright/test';
import { readE2eFixtureIds } from './fixture-ids';
import { createDbClient } from './db-client';

/**
 * 一般ユーザーが他ユーザーのプロフィール画面から通報を送信するE2Eテスト（Requirements 8.1, 8.2, 8.3）。
 *
 * `e2e/global-setup.ts` が投入済みの公開範囲アクセス制御用アカウント（visibilityTest）を
 * そのまま「通報者」「通報対象」として再利用し、新規フィクスチャユーザーの追加投入は行わない。
 * - 通報者: visibilityTest.follower（無料プラン、一般ユーザー）
 * - 通報対象: visibilityTest.author（Proプラン、follower がフォロー済みの他ユーザー）
 */

const { visibilityTest } = readE2eFixtureIds();

async function loginAs(browser: Browser, email: string, password: string): Promise<Page> {
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await page.goto(
    `/login?e2eEmail=${encodeURIComponent(email)}&e2ePassword=${encodeURIComponent(password)}`
  );
  const e2eLoginBtn = page.locator('#e2e-test-login-btn');
  await expect(e2eLoginBtn).toBeVisible({ timeout: 10000 });
  await e2eLoginBtn.click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('ユーザー直接通報 E2Eテスト', () => {
  test.afterAll(async () => {
    // このテストで作成された通報レコードを後片付けする（通報ランキングE2Eテスト等への
    // 干渉を避けるための良い習慣。ranking側は flags_count=999999 の極端な値で先頭表示を
    // 保証しているため本来は必須ではないが、テストデータ衛生のため削除しておく）。
    const db = createDbClient();
    await db.connect();
    try {
      await db.query(
        `DELETE FROM user_reports WHERE reporter_id = $1 AND target_uid = $2`,
        [visibilityTest.follower.userId, visibilityTest.author.userId]
      );
    } finally {
      await db.end();
    }
  });

  test('他ユーザーのプロフィールから通報ダイアログを開き、理由入力→送信→成功メッセージ表示まで完了すること', async ({
    browser,
  }) => {
    const reporterPage = await loginAs(
      browser,
      visibilityTest.follower.email,
      visibilityTest.follower.password
    );

    // 1. 通報対象（他ユーザー）のプロフィール画面へ遷移
    await reporterPage.goto(`/profile/${visibilityTest.author.userId}`);

    // 2. 「ユーザーを通報」ボタンが表示されること（他人のプロフィールであるため）
    const reportBtn = reporterPage.getByTestId('profile-report-user-btn');
    await expect(reportBtn).toBeVisible({ timeout: 15000 });
    await reportBtn.click();

    // 3. 通報ダイアログが開き、カテゴリ選択・詳細入力欄が表示されること
    const dialog = reporterPage.getByTestId('report-user-dialog-content');
    await expect(dialog).toBeVisible({ timeout: 10000 });
    const categorySelect = reporterPage.getByTestId('report-user-category-select');
    const detailInput = reporterPage.getByTestId('report-user-detail-input');
    await expect(categorySelect).toBeVisible();
    await expect(detailInput).toBeVisible();

    // 4. カテゴリ未選択・詳細未入力のまま送信を試みると、インラインの検証エラーが表示され
    //    送信がブロックされること（Requirement 8.2）
    const submitBtn = reporterPage.getByTestId('report-user-submit-btn');
    await submitBtn.click();
    const validationError = reporterPage.getByTestId('report-user-validation-error');
    await expect(validationError).toBeVisible({ timeout: 5000 });
    await expect(reporterPage.getByTestId('report-user-success-message')).toHaveCount(0);

    // 5. カテゴリを選択し、詳細を入力して送信する
    await categorySelect.click();
    await reporterPage.getByTestId('report-user-category-option-harassment').click();
    await detailInput.fill('E2Eテストによるユーザー直接通報検証のための詳細内容です。');
    await submitBtn.click();

    // 6. 成功メッセージが表示されること（Requirement 8.3）
    await expect(reporterPage.getByTestId('report-user-success-message')).toBeVisible({
      timeout: 10000,
    });

    // 7. 成功メッセージ表示後、ダイアログが自動的に閉じてクリーンに消えること
    await expect(dialog).toBeHidden({ timeout: 10000 });
  });

  test('自分自身のプロフィール画面には「ユーザーを通報」ボタンが表示されないこと', async ({
    browser,
  }) => {
    const ownPage = await loginAs(
      browser,
      visibilityTest.follower.email,
      visibilityTest.follower.password
    );

    await ownPage.goto(`/profile/${visibilityTest.follower.userId}`);
    await expect(
      ownPage.getByRole('link', { name: 'プロフィールの編集' })
    ).toBeVisible({ timeout: 15000 });
    await expect(ownPage.getByTestId('profile-report-user-btn')).toHaveCount(0);
  });
});
