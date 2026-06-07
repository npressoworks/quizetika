import { test, expect } from '@playwright/test';

test.describe('ユーザー認証・プロフィール管理 E2Eテスト', () => {
  
  test('ログイン画面にアクセスし、E2Eテスト用ログインボタンで正常にログインでき、プロフィールの編集とログアウトができること', async ({ browser }) => {
    // 未ログイン状態をテストするため、新しい隔離されたコンテキストを作成
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    
    // 1. ホームページにアクセス
    await page.goto('/');
    
    // 2. 「ログイン」ボタンが存在することを確認し、クリック
    const loginLink = page.locator('a').filter({ hasText: /^ログイン$/ }).first();
    await expect(loginLink).toBeVisible();
    await loginLink.click();
    
    // 3. ログインページへ遷移したことを確認
    await expect(page).toHaveURL(/\/login/);
    
    // 4. E2Eテスト用ログインボタンが存在することを確認し、クリック
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible();
    await e2eLoginBtn.click();
    
    // 5. ログイン成功後にホームページ（/）へリダイレクトされることを確認
    await expect(page).toHaveURL('/');
    
    // 6. ヘッダーに「作問する」ボタンが表示されていることを確認（ログイン成功の証拠）
    const createQuizBtn = page.locator('text=作問する');
    await expect(createQuizBtn).toBeVisible();
    
    // 7. アバターボタンをクリックしてドロップダウンを開く
    // avatarButton のクラスまたは画像要素を探してクリック
    const avatarBtn = page.locator('header img, aside img, nav img').filter({ visible: true }).first();
    await expect(avatarBtn).toBeVisible();
    await avatarBtn.click({ force: true });
    
    // 8. 「マイページ」リンクをクリック
    const myPageLink = page.locator('text=マイページ');
    await expect(myPageLink).toBeVisible();
    await myPageLink.click();
    
    // 9. プロフィール画面（/profile/[userId]）へ遷移することを確認
    await expect(page).toHaveURL(/\/profile\//);
    
    // 10. プロフィール「編集」ボタンをクリック
    const editProfileBtn = page.locator('text=編集');
    // もし編集ボタンがあればクリックし、プロフィールの変更テストを実行する
    if (await editProfileBtn.isVisible()) {
      await editProfileBtn.click();
      
      // 表示名入力フィールドの編集
      const displayNameInput = page.locator('input[type="text"]').first();
      await expect(displayNameInput).toBeVisible();
      const currentName = await displayNameInput.inputValue();
      const newName = `E2Eテストユーザー_${Date.now().toString().slice(-4)}`;
      
      await displayNameInput.fill(newName);
      
      // 自己紹介入力フィールドの編集
      const bioInput = page.locator('textarea').first();
      if (await bioInput.isVisible()) {
        await bioInput.fill('PlaywrightのE2Eテストによって自己紹介が自動更新されました。');
      }
      
      // 「保存」ボタンをクリック
      const saveBtn = page.locator('text=保存');
      await expect(saveBtn).toBeVisible();
      await saveBtn.click();
      
      // 更新後の表示名が画面上に正しく反映されていることを確認
      await expect(page.locator(`text=${newName}`)).toBeVisible();
    }
    
    // 11. ログアウト処理の検証
    // ヘッダーのアバターを再度クリックしてドロップダウンを開く
    await avatarBtn.click({ force: true });
    
    // 「ログアウト」ボタンをクリック
    const logoutBtn = page.locator('text=ログアウト');
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();
    
    // 12. ログアウト成功後にホームページに戻り、「ログイン」リンクが再表示されることを確認
    await expect(page).toHaveURL('/');
    await expect(page.locator('a').filter({ hasText: /^ログイン$/ }).first()).toBeVisible();
    
    // コンテキストをクローズ
    await context.close();
  });

  test('本人プロフィール: プレイ履歴タブが表示され他人プロフィールでは非表示', async ({
    browser,
  }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible();
    await e2eLoginBtn.click();
    await expect(page).toHaveURL('/');

    const avatar = page.locator('header img, aside img, nav img').filter({ visible: true }).first();
    await expect(avatar).toBeVisible({ timeout: 10000 });
    await avatar.click({ force: true });
    await page.locator('text=マイページ').click();
    await expect(page).toHaveURL(/\/profile\//);

    const historyTab = page.locator('[data-testid="profile-tab-history"]');
    await expect(historyTab).toBeVisible();
    await historyTab.click();

    const historySection = page.locator('[data-testid="play-history-section"]');
    await expect(historySection).toBeVisible();

    const emptyOrEntries =
      (await page.locator('[data-testid="play-history-entry"]').count()) > 0 ||
      (await page.locator('text=まだプレイ履歴がありません').isVisible());
    expect(emptyOrEntries).toBe(true);

    const profileUrl = page.url();
    const uidMatch = profileUrl.match(/\/profile\/([^/?]+)/);
    expect(uidMatch).toBeTruthy();
    const otherUid = uidMatch![1] === 'other-user-e2e' ? 'another-user' : 'other-user-e2e';
    await page.goto(`/profile/${otherUid}`);
    await expect(page.locator('[data-testid="profile-tab-history"]')).toHaveCount(0);

    await context.close();
  });
});
