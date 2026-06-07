import { test, expect } from '@playwright/test';

/**
 * Phase 19: Streaming / Suspense スケルトン表示 E2E
 *
 * 各画面でスケルトン testid がロード完了後に非表示となり、実データが表示されることを検証する。
 * Firebase は networkidle 不可のため domcontentloaded + testid 待機を使用する。
 */
test.describe('Streaming / Suspense スケルトン E2E', () => {

  test('クイズ詳細画面で詳細・リーダーボードのスケルトンが消えコンテンツが表示されること', async ({ page }) => {
    let navigatedToDetail = false;

    await page.goto('/genres/programming');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('explore-list-skeleton')).toBeHidden({ timeout: 15000 });

    const playBtn = page.getByTestId('play-btn').first();
    if ((await playBtn.count()) > 0) {
      await playBtn.click();
      navigatedToDetail = true;
    } else {
      await page.goto('/');
      await expect(page.getByTestId('home-feed-skeleton')).toBeHidden({ timeout: 15000 });
      const homePlayBtn = page.getByTestId('play-btn').first();
      if ((await homePlayBtn.count()) > 0) {
        await homePlayBtn.click();
        navigatedToDetail = true;
      }
    }

    if (!navigatedToDetail) {
      await page.goto('/quiz/e2e-streaming-detail-probe');
    }

    await expect(page.getByTestId('quiz-detail-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('leaderboard-skeleton')).toBeHidden({ timeout: 15000 });

    const leaderboard = page.getByTestId('quiz-leaderboard');
    const notFound = page.locator('text=クイズが見つかりませんでした');
    await expect(leaderboard.or(notFound).first()).toBeVisible({ timeout: 15000 });
  });

  test('クイズ結果画面で結果スケルトンが消えエラーまたはサマリーが表示されること', async ({ page }) => {
    let quizId = 'e2e-streaming-result-probe';

    await page.goto('/genres/programming');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('explore-list-skeleton')).toBeHidden({ timeout: 15000 });

    const playBtn = page.getByTestId('play-btn').first();
    if ((await playBtn.count()) > 0) {
      await playBtn.click();
      const quizUrl = page.url();
      quizId = quizUrl.split('/quiz/')[1]?.split('/')[0] || quizId;
    }

    await page.goto(`/quiz/${quizId}/result`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('quiz-result-skeleton')).toBeHidden({ timeout: 15000 });

    const errorHeading = page.locator('h2').filter({ hasText: /結果|見つかりません/ });
    const summaryHeading = page.locator('text=お疲れ様でした');
    await expect(errorHeading.or(summaryHeading).first()).toBeVisible({ timeout: 15000 });
  });

  test('弱点克服画面で review-skeleton が消えジャンル選択が表示されること', async ({ page }) => {
    await page.goto('/quiz/review');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('review-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('review-page-container')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('review-genre-selector')).toBeVisible();
  });

  test('ブックマーク画面で bookmarks-skeleton が消え3タブが表示されること', async ({ page }) => {
    await page.goto('/bookmarks');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('bookmarks-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('bookmarks-tabs')).toBeVisible({ timeout: 15000 });
  });

  test('通知画面で notifications-skeleton が消え通知ページが表示されること', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('notifications-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('notifications-page-container')).toBeVisible({ timeout: 15000 });
  });

  test('未認証時に /bookmarks および /notifications へのアクセスがログインへリダイレクトされること', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    for (const path of ['/bookmarks', '/notifications']) {
      const response = await page.goto(path);
      expect(response?.status()).toBeLessThan(400);
      await expect(page).toHaveURL(/\/login/);
      const redirect = new URL(page.url()).searchParams.get('redirect');
      expect(redirect).toBe(path);
    }

    await context.close();
  });
});
