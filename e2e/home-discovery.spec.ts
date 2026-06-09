import { test, expect } from '@playwright/test';

/**
 * Phase 22: ディスカバリーホーム E2E
 * Firebase は networkidle 不可のため domcontentloaded + testid 待機を使用する。
 */
test.describe('ディスカバリーホーム E2E', () => {
  test('トップに3セクションが表示され検索 UI はないこと', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('home-discovery-trending')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('home-discovery-genres')).toBeVisible();
    await expect(page.getByTestId('home-discovery-latest')).toBeVisible();

    await expect(page.getByTestId('search-page')).toHaveCount(0);
    await expect(page.locator('input[placeholder*="クイズを検索"]')).toHaveCount(0);
    await expect(page.getByText('新着順')).toHaveCount(0);
  });

  test('おすすめクイズのもっと見るでトレンドタブの検索画面へ遷移すること', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('discovery-see-more-trending')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('discovery-see-more-trending').click();

    await expect(page).toHaveURL(/\/search\?tab=trending/);
    await expect(page.getByTestId('search-page')).toBeVisible();
    await expect(page.getByText('トレンド')).toBeVisible();
  });

  test('新着クイズのもっと見るで新着タブの検索画面へ遷移すること', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('discovery-see-more-latest')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('discovery-see-more-latest').click();

    await expect(page).toHaveURL(/\/search\?(?:tab=latest|.*tab=latest)/);
    await expect(page.getByTestId('search-page')).toBeVisible();
  });

  test('おすすめジャンルのもっと見るでフィルタ展開付き検索画面へ遷移すること', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('discovery-see-more-genres')).toBeVisible({ timeout: 15000 });
    await page.getByTestId('discovery-see-more-genres').click();

    await expect(page).toHaveURL(/\/search\?openFilters=1/);
    await expect(page.getByTestId('home-genre-carousel-block')).toBeVisible({ timeout: 5000 });
  });

  test('ジャンルカードクリックで検索画面にジャンルフィルタが付くこと', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('home-discovery-genres')).toBeVisible({ timeout: 15000 });

    const genreCard = page.getByTestId('genre-carousel-card-programming');
    if ((await genreCard.count()) === 0) {
      test.skip();
      return;
    }

    await genreCard.click();
    await expect(page).toHaveURL(/\/search\?genreId=programming/);
    await expect(page.getByTestId('search-active-filters')).toBeVisible({ timeout: 5000 });
  });
});
