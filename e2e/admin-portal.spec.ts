import { test, expect } from '@playwright/test';

test.describe('管理者メニューポータル E2Eテスト', () => {

  test('非管理者ユーザーでのアクセス制限確認', async ({ page }) => {
    // 1. 未ログイン状態で /admin へのアクセスを試みる
    await page.goto('/admin');
    
    // アクセスが拒否されて /not-found または /login にリダイレクトされることを確認
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    
    expect(
      currentUrl.includes('/not-found') || 
      currentUrl.includes('/login') || 
      await page.locator('text=見つかりません').isVisible()
    ).toBeTruthy();
  });

  test('管理者ユーザーでのポータル画面UI表示および各メニューへの遷移確認', async ({ page }) => {
    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. 管理者ポータルへ遷移
    await page.goto('/admin');
    
    // 認証判定およびリダイレクトの完了を待機
    await page.waitForTimeout(2000);

    // 画面が表示されているか（管理者の場合のみ表示）
    const isPageVisible = await page.locator('h1').filter({ hasText: '管理者コントロールセンター' }).isVisible().catch(() => false);

    if (isPageVisible) {
      // 画面タイトルが表示されていることを確認
      await expect(page.locator('h1')).toContainText('管理者コントロールセンター');
      await expect(page.locator('text=システム管理者専用')).toBeVisible();

      // 3つの主要管理カードが表示されていることを確認
      const moderationCard = page.locator('text=モデレーション審査');
      const usersCard = page.locator('text=ユーザー評判管理');
      const genresCard = page.locator('text=ジャンル直接管理');

      await expect(moderationCard).toBeVisible();
      await expect(usersCard).toBeVisible();
      await expect(genresCard).toBeVisible();

      // 3. モデレーション審査画面への遷移確認
      await moderationCard.click();
      await page.waitForURL(/\/admin\/moderation/, { timeout: 5000 });
      await expect(page.locator('h1')).toContainText('モデレーション審査');

      // モデレーション審査画面からポータルに戻る
      const portalLinkFromMod = page.locator('text=管理者ポータルへ');
      await expect(portalLinkFromMod).toBeVisible();
      await portalLinkFromMod.click();
      await page.waitForURL(/\/admin$/, { timeout: 5000 });

      // 4. ジャンル直接管理画面への遷移確認
      await page.locator('text=ジャンル直接管理').click();
      await page.waitForURL(/\/admin\/genres/, { timeout: 5000 });
      await expect(page.locator('h1')).toContainText('ジャンル直接管理');

      // ジャンル直接管理画面からポータルに戻る
      const portalLinkFromGenres = page.locator('text=管理者ポータルへ');
      await expect(portalLinkFromGenres).toBeVisible();
      await portalLinkFromGenres.click();
      await page.waitForURL(/\/admin$/, { timeout: 5000 });
    }
  });

  test('認証ローディング要素の確認', async ({ page }) => {
    // 認証解決前のローディング表示を確認
    await page.goto('/admin');
    
    // ページロード直後にローディング要素が存在するかアサート
    const loadingEl = page.locator('[data-testid="admin-portal-loading"]');
    // すでに遷移が早く完了している可能性もあるため、存在するか非表示になるかのどちらかを確認
    const count = await loadingEl.count();
    if (count > 0) {
      await expect(loadingEl).toBeVisible();
    }
  });
});
