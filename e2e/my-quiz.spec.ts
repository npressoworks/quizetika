import { test, expect } from '@playwright/test';

test.describe('マイクイズ', () => {
  test('未ログイン時はログインへリダイレクトされる', async ({ page }) => {
    await page.goto('/my-quiz');
    await expect(page).toHaveURL(/\/login/);
  });

  test('ログイン後にマイクイズページが表示される', async ({ page }) => {
    await page.goto('/');
    const loginBtn = page.locator('#e2e-test-login-btn');
    if (!(await loginBtn.isVisible())) {
      test.skip();
      return;
    }
    await loginBtn.click();
    await page.goto('/my-quiz');
    await expect(page.getByTestId('my-quiz-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('my-quiz-start-play')).toBeVisible();
  });
});
