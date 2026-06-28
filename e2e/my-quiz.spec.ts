import { test, expect } from '@playwright/test';

test.describe('カスタムクイズ', () => {
  test('未ログイン時はログインへリダイレクトされる', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto('/my-quiz');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('ログイン後にカスタムクイズページが表示される', async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });

    await page.goto('/my-quiz');
    await expect(page.getByTestId('my-quiz-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('my-quiz-source-own')).toBeVisible();
    await expect(page.getByTestId('my-quiz-source-bookmarked-quiz')).toBeVisible();
    await expect(page.getByTestId('my-quiz-source-bookmarked-question')).toBeVisible();
    await expect(page.getByTestId('my-quiz-source-bookmarked-list')).toHaveCount(0);
    await expect(page.getByTestId('my-quiz-start-play')).toBeVisible();

    // 自作クイズのリストが取得できることを確認
    // e2e-test-user の所有するクイズ問題「問題_1 の本文」が表示されていること
    await expect(page.locator('text=問題_1 の本文')).toBeVisible({ timeout: 10000 });
  });
});
