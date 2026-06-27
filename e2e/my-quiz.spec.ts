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
    await page.goto('/');
    const loginBtn = page.locator('#e2e-test-login-btn');
    if (!(await loginBtn.isVisible())) {
      test.skip();
      return;
    }
    await loginBtn.click();
    await page.goto('/my-quiz');
    await expect(page.getByTestId('my-quiz-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('my-quiz-source-own')).toBeVisible();
    await expect(page.getByTestId('my-quiz-source-bookmarked-quiz')).toBeVisible();
    await expect(page.getByTestId('my-quiz-source-bookmarked-question')).toBeVisible();
    await expect(page.getByTestId('my-quiz-source-bookmarked-list')).toHaveCount(0);
    await expect(page.getByTestId('my-quiz-start-play')).toBeVisible();
  });
});
