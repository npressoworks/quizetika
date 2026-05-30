import { test as setup, expect } from '@playwright/test';

/**
 * 認証状態をセットアップするファイル
 * このファイルは全テストに先立って実行され、Firebase認証後の状態を保存します
 */

// 認証状態を保存するパス
const authFile = 'playwright/.auth/user.json';

setup('authenticate user', async ({ page }) => {
  // 1. ログイン画面に遷移
  await page.goto('/login');

  // 2. E2E用のログインボタンをクリック
  // (アプリケーションのテストログイン機能を使用)
  const e2eLoginBtn = page.locator('#e2e-test-login-btn');
  
  // ボタンが表示されるまで待機
  await expect(e2eLoginBtn).toBeVisible({ timeout: 10000 });
  await e2eLoginBtn.click();

  // 3. ログイン完了のインジケータを待つ
  // ホームページへのリダイレクトを確認
  await expect(page).toHaveURL('/', { timeout: 15000 });
  
  // ページが完全に読み込まれるまで待機 (Firebaseの永続接続があるため networkidle ではなく domcontentloaded を使用)
  await page.waitForLoadState('domcontentloaded');

  // 4. Firebase Authのトークン（LocalStorage/Cookie/IndexedDB）を含む状態を保存
  await page.context().storageState({ path: authFile });
});
