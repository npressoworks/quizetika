import { test, expect } from '@playwright/test';

test.describe('トップページ右サイドバー（法的・サポートリンク）E2E', () => {
  
  test('PC表示時（大画面）で右サイドバーが正しく描画されること', async ({ page }) => {
    // PC用の解像度に設定
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.getByTestId('home-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });

    // 各種リンクと著作権表示の存在を確認
    await expect(page.getByTestId('sidebar-terms-link')).toBeVisible();
    await expect(page.getByTestId('sidebar-privacy-link')).toBeVisible();
    await expect(page.getByTestId('sidebar-contact-link')).toBeVisible();
    await expect(page.getByTestId('sidebar-copyright')).toBeVisible();
  });

  test('モバイル表示時（小画面）でもサイドバー（フッターリンク）が描画されること', async ({ page }) => {
    // スマホ用の解像度に設定
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const sidebar = page.getByTestId('home-sidebar');
    await expect(sidebar).toBeVisible({ timeout: 10000 });
  });

  test('利用規約リンクをクリックして /terms に遷移し、規約文書が表示されること', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('sidebar-terms-link').click();
    await expect(page).toHaveURL(/\/terms/);

    const termsContent = page.getByTestId('terms-content');
    await expect(termsContent).toBeVisible({ timeout: 5000 });
    await expect(termsContent.getByText('利用規約', { exact: true })).toBeVisible();
    await expect(termsContent.getByText('禁止事項')).toBeVisible();
  });

  test('プライバシーポリシーリンクをクリックして /privacy に遷移し、ポリシー文書が表示されること', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    await page.getByTestId('sidebar-privacy-link').click();
    await expect(page).toHaveURL(/\/privacy/);

    const privacyContent = page.getByTestId('privacy-content');
    await expect(privacyContent).toBeVisible({ timeout: 5000 });
    await expect(privacyContent.getByText('プライバシーポリシー', { exact: true })).toBeVisible();
    await expect(privacyContent.getByText('情報の利用目的')).toBeVisible();
  });

  test('お問い合わせリンクをクリックして別タブでフォームが開くこと', async ({ page, context }) => {
    // 実際の外部フォーム（Googleフォーム）はサインインを要求する場合がありCIやE2E環境では
    // 不安定なため、実際に遷移させず href / target 属性のみを検証する
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const contactLink = page.getByTestId('sidebar-contact-link');
    await expect(contactLink).toHaveAttribute('target', '_blank');
    const href = await contactLink.getAttribute('href');
    expect(href).toMatch(/forms\.gle|forms\/d\/e/);
  });
});
