import { test, expect } from '@playwright/test';

test.describe('リスト探索', () => {
  test('/lists 直接アクセスで公開タブと検索バーが表示される', async ({ page }) => {
    await page.goto('/lists');
    await expect(page.getByTestId('lists-page-container')).toBeVisible();
    await expect(page.getByTestId('lists-tab-public')).toBeVisible();
    await expect(page.getByTestId('lists-search-input')).toBeVisible();
  });

  test('公開タブでカードまたは空状態が表示される', async ({ page }) => {
    await page.goto('/lists');
    await expect(page.getByTestId('lists-tab-public')).toBeVisible();
    const card = page.getByTestId('lists-discovery-card').first();
    const empty = page.getByTestId('lists-empty-state');
    await expect(card.or(empty)).toBeVisible({ timeout: 15000 });
  });
});
