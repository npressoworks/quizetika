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
});
