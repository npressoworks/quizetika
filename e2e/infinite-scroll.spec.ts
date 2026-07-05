import { test, expect } from '@playwright/test';

test.describe('ハイブリッド無限スクロール & 広告インライン挿入 E2E', () => {

  test.beforeEach(async ({ page }) => {
    page.on('console', (msg) => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    page.on('pageerror', (err) => {
      console.log(`[BROWSER UNCAUGHT EXCEPTION] ${err.stack || err.message}`);
    });
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.removeItem('e2e-mock-pro-user');
      window.localStorage.removeItem('e2e-mock-ads-disabled');
      window.localStorage.removeItem('e2e-mock-force-video-ad');
      // テスト環境でダミー広告カードを表示するためのフラグ
      window.localStorage.setItem('e2e-mock-ads', 'true');
    });
  });

  test('検索画面：初期表示20件＋もっと見るボタン表示、クリック後に追加取得および10件ごとの広告インライン挿入', async ({ page }) => {
    await page.goto('/search');
    await page.waitForLoadState('domcontentloaded');

    // スケルトンが消えるのを待つ
    await expect(page.getByTestId('search-feed-skeleton')).toBeHidden({ timeout: 15000 });

    // 初期表示ではクイズカードが20件のみ表示されていることを確認
    const initialCards = page.locator('[data-testid="quiz-card"]');
    await expect(initialCards).toHaveCount(20, { timeout: 10000 });

    // 初期表示で「もっと見る」ボタンが可視であること（20件以上のクイズがある場合）
    const loadMoreBtn = page.getByTestId('search-feed-load-more-button');
    await expect(loadMoreBtn).toBeVisible();

    // 広告ダミーカード（10件ごとなので、初期20件なら 2個表示されるはず）
    const adsBefore = page.locator('[data-testid="ad-card-dummy"]');
    await expect(adsBefore).toHaveCount(2);

    // 「もっと見る」ボタンをクリックして追加ロード
    await loadMoreBtn.click();

    // 追加ロード後、20件より多く表示されること（正確な件数はエミュレーターのデータ量による）
    await expect(initialCards).not.toHaveCount(20, { timeout: 10000 });

    // 追加後のカード数が 20件より多いことを確認
    const afterCount = await initialCards.count();
    expect(afterCount).toBeGreaterThan(20);
  });

  test('プロフィール画面：初期表示20件＋もっと見るボタン表示、クリック後に追加取得および10件ごとの広告インライン挿入', async ({ page }) => {
    // ナビゲーションのプロフィールリンクから実際のログインユーザーUIDを取得
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    // サイドバーのプロフィールリンクURLからUIDを抽出
    const profileLink = page.locator('nav a[href^="/profile/"]').first();
    await expect(profileLink).toBeVisible({ timeout: 10000 });
    const profileHref = await profileLink.getAttribute('href');
    const actualUid = profileHref?.split('/profile/')[1] ?? '';

    // 実際のUIDのプロフィールページへ遷移
    await page.goto(`/profile/${actualUid}`);
    await page.waitForLoadState('domcontentloaded');

    // スケルトンが消え、マイページが表示されるのを待つ
    await expect(page.getByTestId('profile-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('profile-page-container')).toBeVisible({ timeout: 15000 });

    // クイズ一覧が表示されるのを待つ
    const initialCards = page.locator('[data-testid="quiz-card"]');
    await expect(initialCards.first()).toBeVisible({ timeout: 10000 });

    // 初期表示は 20件であること（global-setupで25件がシードされているため）
    await expect(initialCards).toHaveCount(20, { timeout: 10000 });

    // プロフィール画面の「もっと見る」ボタンが存在すること
    const loadMoreBtn = page.getByTestId('profile-feed-load-more-button');
    await expect(loadMoreBtn).toBeVisible();

    // 広告カードは 2個（20件に対して）
    const adsBefore = page.locator('[data-testid="ad-card-dummy"]');
    await expect(adsBefore).toHaveCount(2);

    // 「もっと見る」ボタンをクリックして追加ロード
    await loadMoreBtn.click();

    // 追加ロード後、20件より多く表示されること
    // (他のE2Eテストが同一ユーザーで作成したクイズも累積するため、正確な総件数はテスト実行順序に依存する)
    await expect(initialCards).not.toHaveCount(20, { timeout: 10000 });
    const afterCount = await initialCards.count();
    expect(afterCount).toBeGreaterThan(20);
  });
});
