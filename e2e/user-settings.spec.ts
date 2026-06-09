import { test, expect } from '@playwright/test';

test.describe('ユーザー設定', () => {
  test('/settings でテーマ切替 UI が表示される', async ({ page }) => {
    await page.goto('/settings');
    await expect(page.getByTestId('settings-page-container')).toBeVisible();
    await expect(page.getByTestId('settings-theme-toggle')).toBeVisible();
  });

  test('ライト選択で data-theme と localStorage が更新される', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'ライト' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
    const stored = await page.evaluate(() => localStorage.getItem('quizeum-theme'));
    expect(stored).toBe('light');
  });

  test('リロード後もライトテーマが維持される', async ({ page }) => {
    await page.goto('/settings');
    await page.getByRole('button', { name: 'ライト' }).click();
    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
