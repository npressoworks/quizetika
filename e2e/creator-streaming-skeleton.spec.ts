import { test, expect } from '@playwright/test';

test.describe('クリエイター画面 Streaming / Suspense スケルトン E2E', () => {

  test('作家ダッシュボードで各スケルトンが消えコンテンツが表示されること', async ({ page }) => {
    await page.goto('/creator/dashboard');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.locator('h1').filter({ hasText: 'ダッシュボード' })).toBeVisible();

    // 「作家」タブへ切替えると各セクションがマウントされ、スケルトン表示を経てコンテンツが表示される
    await page.getByTestId('dashboard-tab-creator').click();

    await expect(page.getByTestId('stats-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('charts-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('feedback-list-skeleton')).toBeHidden({ timeout: 15000 });

    await expect(page.getByTestId('stats-section')).toBeVisible({ timeout: 15000 });
  });

  test('作成したクイズ画面（/creator/quizzes）で読み込みスケルトンが消えコンテンツが表示されること', async ({ page }) => {
    await page.goto('/creator/quizzes');
    await page.waitForLoadState('domcontentloaded');

    // Suspense フォールバックのスケルトンが表示され、その後コンテンツに切り替わることを確認
    await expect(page.getByTestId('creator-quiz-management-loading')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('creator-quiz-management-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('creator-quiz-management-list')).toBeVisible({ timeout: 15000 });
  });

  test('クイズ作成画面で quiz-editor-skeleton が消えエディタが表示されること', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('quiz-editor-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(
      page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()
    ).toBeVisible({ timeout: 15000 });
  });

  test('未認証時に /creator/dashboard および /quiz/test-id/edit がログインへリダイレクトされること', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    for (const path of ['/creator/dashboard', '/quiz/e2e-creator-edit-probe/edit']) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
      expect(new URL(page.url()).searchParams.get('redirect')).toBe(path);
    }

    await context.close();
  });
});
