import { test, expect } from '@playwright/test';

test.describe('Responsive Navigation Layout', () => {
  test('PC viewport (1200px) shows sidebar and hides mobile headers', async ({ page }) => {
    // PCサイズに設定
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');

    // サイドバーが表示され、ヘッダーとボトムナビが非表示であることを検証
    const sidebar = page.locator('aside'); // sidebar.tsx uses <aside className="...">
    await expect(sidebar).toBeVisible();

    const header = page.locator('header'); // header.tsx uses <header className="...">
    await expect(header).toBeHidden();

    const bottomNav = page.locator('nav').filter({ has: page.locator('[data-testid="bottom-nav-home"]') });
    // または CSS クラスや display: none で非表示であることを検証
    await expect(bottomNav).toBeHidden();
  });

  test('Mobile viewport (375px) shows bottom-nav and mobile header, hides sidebar', async ({ page }) => {
    // モバイルサイズに設定
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    // サイドバーが非表示であることを検証
    const sidebar = page.locator('aside');
    await expect(sidebar).toBeHidden();

    // モバイルヘッダーが表示されていること
    const header = page.locator('header');
    await expect(header).toBeVisible();

    // ボトムナビが表示されていること
    const bottomNav = page.locator('nav').filter({ has: page.locator('[data-testid="bottom-nav-home"]') });
    await expect(bottomNav).toBeVisible();
  });

  test('PC sidebar search navigates to /search with correct active state', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');

    const homeLink = page.getByTestId('nav-home');
    const searchLink = page.getByTestId('nav-search');

    await expect(homeLink).toHaveAttribute('class', /active/);
    await expect(searchLink).not.toHaveAttribute('class', /active/);

    await searchLink.click();
    await expect(page).toHaveURL(/\/search(?:\?.*)?$/);

    await expect(searchLink).toHaveAttribute('class', /active/);
    await expect(homeLink).not.toHaveAttribute('class', /active/);
  });

  test('Mobile bottom nav search navigates to /search with correct active state', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');

    const homeLink = page.getByTestId('bottom-nav-home');
    const searchLink = page.getByTestId('bottom-nav-search');

    await expect(homeLink).toHaveAttribute('class', /active/);

    await searchLink.click();
    await expect(page).toHaveURL(/\/search(?:\?.*)?$/);

    await expect(searchLink).toHaveAttribute('class', /active/);
    await expect(homeLink).not.toHaveAttribute('class', /active/);
  });

  test('Phase 26: 廃止された /lists は 404 を返す', async ({ page }) => {
    const response = await page.goto('/lists');
    expect(response?.status()).toBe(404);
  });

  test('Phase 23: Mobile header popup navigates to /my-quiz', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    const loginBtn = page.locator('#e2e-test-login-btn');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    }
    const profileBtn = page.getByTestId('header-profile-btn');
    if (!(await profileBtn.isVisible())) {
      test.skip();
      return;
    }
    await profileBtn.click();
    await page.getByTestId('header-nav-my-quiz').click();
    await expect(page).toHaveURL(/\/my-quiz/);
  });

  test('Phase 27: Admin menu is visible and active on /admin for Admin User', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/login');
    
    const loginBtn = page.locator('#e2e-test-login-btn');
    if (await loginBtn.isVisible()) {
      await loginBtn.click();
    }
    
    await page.waitForURL(/\/$/);

    const adminLink = page.getByTestId('nav-admin');
    await expect(adminLink).toBeVisible();
    await expect(adminLink).not.toHaveClass(/active/);

    await adminLink.click();
    await expect(page).toHaveURL(/\/admin/);
    await expect(adminLink).toHaveClass(/active/);
  });

  test('Phase 27: Admin popup links are visible for Admin User', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');
    
    const loginBtn = page.locator('#e2e-test-login-btn');
    if (await loginBtn.isVisible()) {
      await page.goto('/login');
      await loginBtn.click();
      await page.waitForURL(/\/$/);
    }

    const profileBtn = page.getByTestId('sidebar-profile-btn');
    await expect(profileBtn).toBeVisible();
    await profileBtn.click();
    
    const adminPopupLink = page.getByTestId('sidebar-admin-link');
    await expect(adminPopupLink).toBeVisible();

    await page.setViewportSize({ width: 375, height: 800 });
    await page.goto('/');
    
    const mobileProfileBtn = page.getByTestId('header-profile-btn');
    await expect(mobileProfileBtn).toBeVisible();
    await mobileProfileBtn.click();
    
    const mobileAdminPopupLink = page.getByTestId('header-admin-link');
    await expect(mobileAdminPopupLink).toBeVisible();
  });

  test('Phase 27: Admin menu is hidden for Guest (Not Logged In)', async ({ page }) => {
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');
    
    const adminLink = page.getByTestId('nav-admin');
    await expect(adminLink).toBeHidden();
  });

  test('Play page (/quiz/[id]/play) hides all navigation elements on all viewports', async ({ page }) => {
    // プレイ画面にアクセス (テスト用の仮クイズID)
    await page.goto('/quiz/test-quiz-id/play');

    // デスクトップ
    await page.setViewportSize({ width: 1200, height: 800 });
    await expect(page.locator('aside')).toBeHidden();
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('nav').filter({ has: page.locator('[data-testid="bottom-nav-home"]') })).toBeHidden();

    // モバイル
    await page.setViewportSize({ width: 375, height: 800 });
    await expect(page.locator('aside')).toBeHidden();
    await expect(page.locator('header')).toBeHidden();
    await expect(page.locator('nav').filter({ has: page.locator('[data-testid="bottom-nav-home"]') })).toBeHidden();
  });

  test('Phase 28: PC sidebar collapse toggle, avatar popup, and profile nav link', async ({ browser }) => {
    // このテストは末尾で実際にログアウト操作を行う。共有デフォルトの page
    // (auth.setup.ts が保存した storageState = 全テスト共有の認証セッション) で
    // ログアウトすると、そのセッション自体がサーバー側で失効し、同一セッションを
    // 前提とする後続の全テストが軒並みログアウト状態になってしまう。
    // そのため独立した未認証コンテキストを作成し、このテスト専用に再ログインする
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // PCサイズに設定
    await page.setViewportSize({ width: 1200, height: 800 });
    await page.goto('/');

    const toggleBtn = page.getByTestId('sidebar-toggle-btn');
    const sidebar = page.locator('aside');
    // LayoutWrapperのコンテナ
    const wrapper = page.locator('div.relative.flex.min-h-screen');

    // 初期状態は通常表示 (275px)
    await expect(sidebar).toHaveClass(/lg:w-\[275px\]/);
    await expect(wrapper).toHaveClass(/lg:pl-\[275px\]/);

    // トグルボタンをクリックして折りたたむ
    await toggleBtn.click();
    // ミニ表示 (70px) になること
    await expect(sidebar).toHaveClass(/lg:w-\[70px\]/);
    await expect(wrapper).toHaveClass(/lg:pl-\[70px\]/);

    // 再度トグルボタンをクリックして通常に戻る
    await toggleBtn.click();
    await expect(sidebar).toHaveClass(/lg:w-\[275px\]/);
    await expect(wrapper).toHaveClass(/lg:pl-\[275px\]/);

    // ログイン状態での検証 (このコンテキストは未認証で開始しているため必ずログインする)
    await page.goto('/login');
    const loginBtn = page.locator('#e2e-test-login-btn');
    await expect(loginBtn).toBeVisible();
    await loginBtn.click();
    await page.waitForURL(/\/$/);

    // 1. 主要メニューのプロフィールリンクの検証
    const profileNavLink = page.getByTestId('nav-profile');
    await expect(profileNavLink).toBeVisible();
    await profileNavLink.click();
    await expect(page).toHaveURL(/\/profile\/[a-zA-Z0-9_-]+$/);

    // 2. フッターアバターのポップアップ（ドロップダウン）検証
    await page.goto('/');
    const profileBtn = page.getByTestId('sidebar-profile-btn');
    await expect(profileBtn).toBeVisible();
    
    // クリックすると直接遷移するのではなくドロップダウンが表示されること
    await profileBtn.click();
    const settingsLink = page.getByTestId('sidebar-settings-link');
    await expect(settingsLink).toBeVisible();

    // ログアウトボタンを取得してクリック
    const logoutBtn = page.getByRole('menuitem', { name: 'ログアウト' });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // ログアウト後にホームにリダイレクトされ、ログインボタンが表示されていること
    await page.waitForURL(/\/$/);
    await expect(page.locator('aside a:has-text("ログイン")')).toBeVisible();

    await context.close();
  });
});

