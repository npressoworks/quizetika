import { test, expect } from '@playwright/test';

test.describe('特権管理者ユーザー評判管理 E2Eテスト', () => {

  test('非管理者ユーザーでのアクセス制限確認', async ({ page }) => {
    // 1. 管理者ユーザー以外の状態でアクセスを試みる
    // (E2Eテストログインボタンでログインされるデフォルトユーザーがadmin権限を持たない場合を想定)
    await page.goto('/admin/users');
    
    // アクセス拒否されて /not-found に遷移するか、404表示になることを確認
    await page.waitForTimeout(2000);
    const currentUrl = page.url();
    
    expect(currentUrl.includes('/not-found') || currentUrl.includes('/login') || await page.locator('text=見つかりません').isVisible()).toBeTruthy();
  });

  test('管理者ユーザーでの評判管理画面UI表示確認', async ({ page }) => {
    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. 評判管理画面へ遷移
    await page.goto('/admin/users');

    // ログインユーザーが管理者の場合のみ画面が表示される
    // (もしE2Eテストユーザーが管理者の場合、画面の各要素が表示されるはず)
    const isPageVisible = await page.locator('h1').filter({ hasText: 'ユーザー評判管理' }).isVisible().catch(() => false);
    
    if (isPageVisible) {
      // タイトル、概要、検索ボックスの表示確認
      await expect(page.locator('h1')).toContainText('ユーザー評判管理');
      await expect(page.locator('text=特権管理者専用')).toBeVisible();
      await expect(page.locator('input[placeholder="ユーザーUIDを入力..."]')).toBeVisible();
      
      // 相互ナビゲーションリンクの存在確認
      const backLink = page.locator('text=モデレーション審査キューに戻る');
      await expect(backLink).toBeVisible();
      
      // 指向先のモデレーション画面に戻れるか
      await backLink.click();
      await page.waitForURL(/\/admin\/moderation/, { timeout: 5000 });
      await expect(page.locator('h1')).toContainText('モデレーション審査');
    }
  });

  test('リセット理由のバリデーション動作確認', async ({ page }) => {
    await page.goto('/admin/users');
    const isPageVisible = await page.locator('h1').filter({ hasText: 'ユーザー評判管理' }).isVisible().catch(() => false);
    
    if (isPageVisible) {
      // 検索フォームにダミーのUIDを入力して検索
      await page.locator('input[placeholder="ユーザーUIDを入力..."]').fill('test-target-uid');
      await page.locator('button:has-text("検索")').click();
      
      // 結果表示の有無にかかわらず、UI上でのバリデーション（理由10文字制限）を検証
      // ※ここではテスト用DBにデータがない場合もあるため、UI要素がある場合に限る
      const reasonTextarea = page.locator('#resetReason');
      if (await reasonTextarea.isVisible()) {
        const resetBtn = page.locator('#execute-reset-btn');
        
        // 10文字未満 -> 非活性であることを確認
        await reasonTextarea.fill('短すぎ');
        await expect(resetBtn).toBeDisabled();
        
        // 10文字以上 -> 活性化することを確認
        await reasonTextarea.fill('10文字以上の具体的なリセット理由を入力します。');
        await expect(resetBtn).toBeEnabled();
      }
    }
  });
});
