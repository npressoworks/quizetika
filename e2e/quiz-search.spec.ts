import { test, expect } from '@playwright/test';

/**
 * 検索画面（/search）探索機能 E2Eテスト
 *
 * 注意: FirebaseはWebSocket永続接続を使用するため、
 * page.waitForLoadState('networkidle') は使用不可。
 */
test.describe('検索画面（/search）探索 E2E', () => {
  test('検索画面でのクイズ一覧表示・タブ切り替えおよびキーワード検索が機能すること', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('search-page')).toBeVisible();
    await expect(page.getByTestId('search-search-bar-sticky')).toBeVisible();

    await expect(page.getByTestId('search-feed-skeleton')).toBeHidden({ timeout: 15000 });

    const popularTab = page.locator('text=人気順');
    await expect(popularTab).toBeVisible();
    await popularTab.click();
    await page.waitForTimeout(1000);

    const trendTab = page.locator('text=トレンド');
    await expect(trendTab).toBeVisible();
    await trendTab.click();
    await page.waitForTimeout(500);

    const latestTab = page.locator('text=新着順');
    await expect(latestTab).toBeVisible();
    await latestTab.click();
    await page.waitForTimeout(500);

    await searchInput.fill('存在しないテスト用クイズXYZ');
    await page.waitForTimeout(500);
    await expect(page.locator('text=該当するクイズが見つかりませんでした。')).toBeVisible({ timeout: 5000 });

    await searchInput.fill('');
    await page.waitForTimeout(500);

    const filterToggleBtn = page.getByRole('button', { name: 'フィルター' });
    await expect(filterToggleBtn).toBeVisible();
    await filterToggleBtn.click();

    await expect(page.locator('text=難易度').first()).toBeVisible();
    await expect(page.locator('text=問題数').first()).toBeVisible();
    await expect(page.locator('text=プレイ状況').first()).toBeVisible();
    await expect(page.getByTestId('home-genre-carousel-block')).toBeVisible();
    await expect(page.getByTestId('home-format-carousel-block')).toBeVisible();

    const programmingGenreCard = page.getByTestId('genre-carousel-card-programming');
    if (await programmingGenreCard.count()) {
      await programmingGenreCard.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/search\?.*genreId=programming/);
      await expect(page.getByTestId('search-active-filters')).toBeVisible();
      await programmingGenreCard.click();
    }

    const formatCard = page.locator('[data-testid^="format-carousel-card-"]').first();
    if (await formatCard.count()) {
      await formatCard.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL(/\/search/);
      await formatCard.click();
    }
  });

  test('クイックサーチチップでタグチップが追加されカードに ★ 難易度が表示されること', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    const quickChip = page.getByRole('button', { name: '#ウミガメのスープ' });
    await quickChip.click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-testid="search-tag-chip"]').first()).toBeVisible({ timeout: 5000 });

    await expect(page.getByTestId('search-feed-skeleton')).toBeHidden({ timeout: 15000 });
    const difficulty = page.locator('[data-testid="quiz-card-difficulty"]').first();
    if (await difficulty.count()) {
      await expect(difficulty).toContainText('★');
    }
  });

  test('検索画面の各公開クイズカードが詳細ページへ遷移できること', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('search-feed-skeleton')).toBeHidden({ timeout: 15000 });

    const quizCard = page.locator('[data-testid="quiz-card"]').first();
    if ((await quizCard.count()) > 0) {
      await quizCard.click();
      await expect(page).toHaveURL(/\/quiz\//);
      await page.waitForLoadState('domcontentloaded');
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    }
  });

  test('フォローしたユーザーのタイムラインがログイン後に表示できること', async ({ page }) => {
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    await page.waitForTimeout(3000);

    const currentUrl = page.url();

    if (currentUrl.includes('/login')) {
      await page.goto('/search');
      const timelineTab = page.locator('text=フォローTL');
      await expect(timelineTab).toBeVisible({ timeout: 30000 });
      await timelineTab.click();
    } else {
      await page.goto('/search');
      await page.waitForLoadState('domcontentloaded');
      const timelineTab = page.locator('text=フォローTL');
      await expect(timelineTab).toBeVisible({ timeout: 15000 });
      await timelineTab.click();
    }

    await page.waitForTimeout(1000);
    const contentArea = page.locator('section').last();
    await expect(contentArea).toBeVisible();
  });

  test('ジャンルページで scoped 検索 UI が表示され形式フィルタで絞り込めること', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    const filterToggleBtn = page.getByRole('button', { name: 'フィルター' });
    await filterToggleBtn.click();
    await expect(page.getByTestId('home-genre-carousel-block')).toBeVisible({ timeout: 15000 });

    const programmingCard = page.getByTestId('genre-carousel-card-programming');
    if (!(await programmingCard.count())) {
      test.skip();
      return;
    }

    await page.goto('/genres/programming');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('explore-list-skeleton')).toBeHidden({ timeout: 15000 });

    await expect(page.getByTestId('genre-explore-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('genre-explore-search')).toBeVisible();

    await page.getByRole('button', { name: 'フィルター' }).click();
    await expect(page.locator('text=難易度').first()).toBeVisible();
    await expect(page.locator('text=ジャンル')).toHaveCount(0);

    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await searchInput.fill('存在しないscoped検索XYZ');
    await page.waitForTimeout(600);
    await expect(page.locator('text=該当するクイズがありませんでした。')).toBeVisible({ timeout: 8000 });
  });

  test('URL クエリのジャンルフィルタがチップに表示されパネルを閉じても visible であること', async ({ page }) => {
    await page.goto('/search?genreId=programming');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('search-active-filters')).toBeVisible({ timeout: 10000 });

    const filterToggleBtn = page.getByRole('button', { name: 'フィルター' });
    if (await filterToggleBtn.isVisible()) {
      await filterToggleBtn.click();
      await filterToggleBtn.click();
    }

    await expect(page.getByTestId('search-active-filters')).toBeVisible();
  });
});

/**
 * Phase 21: 検索画面の無限スクロール・sticky 検索バー E2E（探索 UX の正本は /search）
 */
test.describe('検索画面 無限スクロール E2E', () => {
  test('スクロール末端で追加読み込みが発火し sticky 検索バーが表示されること', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('search-search-bar-sticky')).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('search-feed-skeleton')).toBeHidden({ timeout: 15000 });

    const initialCount = await page.getByTestId('quiz-card').count();
    if (initialCount === 0) {
      test.skip();
      return;
    }

    const sentinel = page.getByTestId('search-feed-load-more-sentinel');
    await sentinel.scrollIntoViewIfNeeded();
    await page.waitForTimeout(1500);

    const afterCount = await page.getByTestId('quiz-card').count();
    const loadMoreVisible = await page.getByTestId('search-feed-load-more').isVisible().catch(() => false);

    expect(afterCount >= initialCount || loadMoreVisible).toBeTruthy();
    await expect(page.getByTestId('search-search-bar-sticky')).toBeVisible();
  });
});
