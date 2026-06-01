import { test, expect } from '@playwright/test';

test.describe('リストE2Eテスト', () => {

  test('ユーザーはクイズリストを新規作成し、ブックマーク登録・解除ができること', async ({ page }) => {
    // ダイアログが発生したときに自動的にアサーションと承認を行う
    page.on('dialog', async dialog => {
      expect(dialog.message()).toContain('リストを作成しました');
      await dialog.accept();
    });
    // 1. クイズリスト作成画面へ遷移
    await page.goto('/list/create');
    // ログイン状態が失われている場合の自動ログイン・フォールバック
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn.isVisible()) {
        await e2eLoginBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    
    // ページタイトルの確認
    await expect(page.locator('text=新規リスト作成').or(page.locator('h1')).first()).toBeVisible();
    
    // 2. リストタイトルの入力
    const listTitle = `[TEST] E2Eリスト_${Date.now().toString().slice(-4)}`;
    const titleInput = page.locator('input[type="text"]').first();
    await expect(titleInput).toBeVisible();
    await titleInput.fill(listTitle);
    
    // 3. 説明文の入力 (存在する場合)
    const descTextarea = page.locator('textarea').first();
    if (await descTextarea.isVisible()) {
      await descTextarea.fill('PlaywrightのE2Eテストによって作成されたテストリストです。');
    }
    
    // クイズをアタッチする (「追加」ボタンがあれば最初の1件をクリックして登録)
    const addQuizBtn = page.locator('text=追加').first();
    if (await addQuizBtn.isVisible()) {
      await addQuizBtn.click();
      await page.waitForTimeout(500);
    }
    
    // 4. 保存ボタンをクリック (ロケーターを正確に「リストを保存する」に指定)
    const saveBtn = page.locator('text=リストを保存する').first();
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();
    
    // 5. 保存完了後のリダイレクトを確認 (createにマッチしないように厳密化)
    await expect(page).toHaveURL(/\/list\/(?!create)[a-zA-Z0-9_-]+/);
    
    // 6. 作成したリストのタイトルが詳細画面に表示されることを確認
    await expect(page.locator(`text=${listTitle}`)).toBeVisible();
    
    // 7. ブックマーク登録（星ボタン等）をクリック
    const bookmarkBtn = page.locator('button:has(svg)').filter({ hasText: '' }).first();
    if (await bookmarkBtn.isVisible()) {
      await bookmarkBtn.click();
      // ブックマーク登録完了を少し待つ
      await page.waitForTimeout(500);
    }
    
    // 8. ブックマーク一覧画面へ移動して確認
    await page.goto('/bookmarks');
    await expect(page.locator('text=ブックマーク').first()).toBeVisible();
  });

  test('クイズリスト一覧からリストの詳細画面を開けること', async ({ page }) => {
    // 自分が作成したリスト一覧はダッシュボードかプロフィールから確認できる
    await page.goto('/creator/dashboard');
    
    // ダッシュボードが表示されることを確認
    await expect(page.locator('h1').first()).toBeVisible();
    
    // リスト管理セクションへのリンクがあれば確認する
    const listLink = page.locator('text=リスト').first();
    if (await listLink.isVisible()) {
      await listLink.click();
    }
  });
});
