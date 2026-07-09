import { test, expect } from '@playwright/test';
import { readE2eFixtureIds } from './fixture-ids';

const { quizIds } = readE2eFixtureIds();
const adTestQuizId = quizIds[0];

test.describe('広告機能 E2Eテスト', () => {

  // 各テスト開始前にLocalStorageモックなどをリセット
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

  test('無料ユーザー：検索画面において10件のクイズカードごとに1件のインライン広告（PRバッジ付き）が表示されること', async ({ page }) => {
    // 検索画面へ遷移（キーワードなしで全件取得）
    await page.goto('/search');

    // クイズカードが読み込まれるのを待つ
    const quizCards = page.locator('[data-testid="quiz-card"], [data-testid="ad-card-dummy"]');
    await expect(quizCards.first()).toBeVisible({ timeout: 15000 });

    // インライン広告（ダミーカード）が表示されることを確認
    const dummyAd = page.locator('[data-testid="ad-card-dummy"]').first();
    await expect(dummyAd).toBeVisible({ timeout: 15000 });

    // PRバッジが表示されていることを確認 (strict mode違反を避けるため .first() を適用)
    await expect(dummyAd.locator('text=PR').first()).toBeVisible();
  });

  test('有料ユーザー（Proプラン）：広告スクリプトがロードされず、クイズ一覧にも広告カードが表示されないこと', async ({ page }) => {
    // 有料会員のモックをLocalStorageに設定
    await page.evaluate(() => {
      window.localStorage.setItem(
        'e2e-mock-pro-user',
        JSON.stringify({
          subscriptionTier: 'pro',
          subscriptionStatus: 'active'
        })
      );
    });

    // 検索画面へ遷移
    await page.goto('/search');

    // クイズカードが読み込まれるのを待つ
    const quizCards = page.getByTestId('quiz-card');
    await expect(quizCards.first()).toBeVisible({ timeout: 15000 });

    // 有料プランなので広告カードは非表示であることを確認
    const dummyAd = page.locator('[data-testid="ad-card-dummy"]');
    await expect(dummyAd).not.toBeVisible();

    const realAd = page.locator('[data-testid="ad-card-real"]');
    await expect(realAd).not.toBeVisible();

    // Google AdSense 外部スクリプトの script タグが存在しないことを確認
    const adsenseScript = page.locator('script[src*="pagead2.googlesyndication.com"]');
    await expect(adsenseScript).not.toBeAttached();
  });

  test('無料ユーザー：クイズ完了時に動画広告モーダルが1/3確率（強制フラグ使用）で表示され、5秒経過後にスキップして結果画面へ遷移できること', async ({ page }) => {
    // 1. クイズ新規作成画面にアクセスして自動ログイン
    await page.goto('/quiz/create');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn.isVisible()) {
        await e2eLoginBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    // 2. シード済みのクイズ詳細ページへ遷移
    await page.goto(`/quiz/${adTestQuizId}`);

    // 動画広告の強制フラグを設定
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-force-video-ad', 'true');
    });

    // 3. クイズをプレイ開始
    // （Phase 37: 通常形式クイズのプレイボタンは単一の「プレイ」表記に統一された）
    const startPlayBtn = page.getByRole('button', { name: 'プレイ', exact: true });
    await expect(startPlayBtn).toBeVisible({ timeout: 15000 });
    await startPlayBtn.click();

    // プレイ画面へ遷移したことを確認し、正解の選択肢を選択して解答を確定
    await expect(page).toHaveURL(/\/play/);
    const optionLabel = page.locator('label').filter({ hasText: '正解' }).first();
    await expect(optionLabel).toBeVisible({ timeout: 15000 });
    await optionLabel.click();

    const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 結果表示ボタンをクリックして遷移をトリガー
    const viewResultsBtn = page.locator('[data-testid="play-view-results"]');
    await expect(viewResultsBtn).toBeVisible({ timeout: 10000 });
    await viewResultsBtn.click();

    // 動画広告モーダルが表示されることを確認
    const videoAdModal = page.locator('[data-testid="video-ad-modal"]');
    await expect(videoAdModal).toBeVisible({ timeout: 5000 });

    // スキップボタンが最初は非活性（disabled）であることを確認
    const skipBtn = page.locator('[data-testid="ad-skip-btn"]');
    await expect(skipBtn).toBeDisabled();

    // 5秒待機する
    await page.waitForTimeout(5500);

    // スキップボタンが活性化（enabled）されていることを確認
    await expect(skipBtn).toBeEnabled({ timeout: 5000 });

    // スキップボタンをクリックして結果画面に遷移するのを待つ
    await skipBtn.click();
    await expect(page).toHaveURL(/\/result/);
  });

  test('有料ユーザー（Proプラン）：クイズ完了時に動画広告モーダルが表示されず、直接結果画面へ遷移すること', async ({ page }) => {
    // 1. クイズ新規作成画面にアクセスして自動ログイン
    await page.goto('/quiz/create');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn.isVisible()) {
        await e2eLoginBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    // 2. 有料プランおよび動画広告の強制フラグをモック
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-force-video-ad', 'true');
      window.localStorage.setItem(
        'e2e-mock-pro-user',
        JSON.stringify({
          subscriptionTier: 'pro',
          subscriptionStatus: 'active'
        })
      );
    });

    // 3. シード済みのクイズ詳細ページへ遷移
    await page.goto(`/quiz/${adTestQuizId}`);

    // 4. クイズをプレイ開始
    // （Phase 37: 通常形式クイズのプレイボタンは単一の「プレイ」表記に統一された）
    const startPlayBtn = page.getByRole('button', { name: 'プレイ', exact: true });
    await expect(startPlayBtn).toBeVisible({ timeout: 15000 });
    await startPlayBtn.click();

    // プレイ画面で解答を選択して確定
    await expect(page).toHaveURL(/\/play/);
    const optionLabel = page.locator('label').filter({ hasText: '正解' }).first();
    await expect(optionLabel).toBeVisible({ timeout: 15000 });
    await optionLabel.click();

    const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 結果表示ボタンをクリック
    const viewResultsBtn = page.locator('[data-testid="play-view-results"]');
    await expect(viewResultsBtn).toBeVisible({ timeout: 10000 });
    await viewResultsBtn.click();

    // 動画広告モーダルが表示されず、直接結果画面へ遷移することを確認
    const videoAdModal = page.locator('[data-testid="video-ad-modal"]');
    await expect(videoAdModal).not.toBeVisible();
    await expect(page).toHaveURL(/\/result/, { timeout: 10000 });
  });
});
