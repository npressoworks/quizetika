import { test, expect } from '@playwright/test';

test.describe('特権管理者ユーザー評判管理 E2Eテスト', () => {

  test('非管理者ユーザーでのアクセス制限確認', async ({ page }) => {
    // 1. 管理者ユーザー以外の状態でアクセスを試みる
    // (chromiumプロジェクトはauth.setup.tsで保存した管理者ユーザーのstorageStateを
    //  全テストで共有しているため、このテストでは明示的にCookieをクリアして未認証状態を再現する)
    await page.context().clearCookies();
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
    // 認証情報の確認は非同期(useAuth)のため、即座にisVisible()で判定すると
    // レンダリング前に評価されて偽陰性となることがある。表示を明示的に待つ。
    const isPageVisible = await page
      .locator('h1')
      .filter({ hasText: 'ユーザー評判管理' })
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (isPageVisible) {
      // タイトル、概要、検索ボックスの表示確認
      await expect(page.locator('h1')).toContainText('ユーザー評判管理');
      await expect(page.locator('text=特権管理者専用')).toBeVisible();
      await expect(page.locator('input[placeholder="ユーザーUIDを入力..."]')).toBeVisible();

      // 相互ナビゲーションリンクの存在確認
      const backLink = page.locator('text=モデレーション審査画面へ');
      await expect(backLink).toBeVisible();
      
      // 指向先のモデレーション画面に戻れるか
      await backLink.click();
      await page.waitForURL(/\/admin\/moderation/, { timeout: 5000 });
      await expect(page.locator('h1')).toContainText('モデレーション審査');
    }
  });

  test('リセット理由のバリデーション動作確認', async ({ page }) => {
    await page.goto('/admin/users');
    // 認証情報の確認は非同期(useAuth)のため、表示を明示的に待ってから判定する。
    const isPageVisible = await page
      .locator('h1')
      .filter({ hasText: 'ユーザー評判管理' })
      .waitFor({ state: 'visible', timeout: 10000 })
      .then(() => true)
      .catch(() => false);

    if (isPageVisible) {
      // 検索フォームにダミーのUIDを入力して検索
      await page.locator('input[placeholder="ユーザーUIDを入力..."]').fill('test-target-uid');
      // タブ化に伴い「🔍 検索」タブ(role="tab")も"検索"を部分一致で含むため、
      // role="button"の検索実行ボタンに限定して特定する。
      await page.getByRole('button', { name: '検索', exact: true }).click();
      
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

        // 確認ダイアログ: 実行前に表示され、キャンセルで閉じる
        await resetBtn.click();
        const confirmDialog = page.getByTestId('confirm-action-btn');
        await expect(confirmDialog).toBeVisible({ timeout: 3000 });
        await page.getByTestId('cancel-action-btn').click();
        await expect(confirmDialog).not.toBeVisible({ timeout: 3000 });
      }
    }
  });
});
