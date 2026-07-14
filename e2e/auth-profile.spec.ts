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
    
    // 6. ログイン成功後にサイドバーまたはヘッダーのプロフィールが表示されることを確認
    const navProfile = page.getByTestId('nav-profile');
    if (await navProfile.isVisible({ timeout: 10000 })) {
      await navProfile.click();
    } else {
      const headerProfileBtn = page.getByTestId('header-profile-btn');
      await expect(headerProfileBtn).toBeVisible({ timeout: 10000 });
      await headerProfileBtn.click();
      await page.locator('[data-testid="header-profile-popup"] >> text=プロフィール').click();
    }
    
    // 9. プロフィール画面（/profile/[userId]）へ遷移することを確認
    await expect(page).toHaveURL(/\/profile\//);
    
    // 10. プロフィール「編集」ボタンをクリック
    const editProfileBtn = page.locator('text=編集');
    // もし編集ボタンがあればクリックし、プロフィールの変更テストを実行する
    if (await editProfileBtn.isVisible()) {
      await editProfileBtn.click();
      
      // 表示名入力フィールドの編集
      const displayNameInput = page.locator('#displayName');
      await expect(displayNameInput).toBeVisible();
      const currentName = await displayNameInput.inputValue();
      const newName = `E2Eテストユーザー_${Date.now().toString().slice(-4)}`;
      
      await displayNameInput.fill(newName);
      
      // 自己紹介入力フィールドの編集
      const bioInput = page.locator('#bio');
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
    const sidebarProfileBtn = page.getByTestId('sidebar-profile-btn');
    if (await sidebarProfileBtn.isVisible()) {
      await sidebarProfileBtn.click();
    } else {
      const headerProfileBtn = page.getByTestId('header-profile-btn');
      await headerProfileBtn.click();
    }
    
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

    const navProfile = page.getByTestId('nav-profile');
    if (await navProfile.isVisible({ timeout: 10000 })) {
      await navProfile.click();
    } else {
      const headerProfileBtn = page.getByTestId('header-profile-btn');
      await expect(headerProfileBtn).toBeVisible({ timeout: 10000 });
      await headerProfileBtn.click();
      await page.locator('[data-testid="header-profile-popup"] >> text=プロフィール').click();
    }
    await expect(page).toHaveURL(/\/profile\//);

    const historyTab = page.locator('[data-testid="profile-tab-history"]');
    await expect(historyTab).toBeVisible();
    await historyTab.click();

    const historySection = page.locator('[data-testid="play-history-section"]');
    await expect(historySection).toBeVisible();

    // 読み込み完了を待つ
    await expect(page.locator('text=プレイ履歴を読み込み中...')).not.toBeVisible({ timeout: 15000 });

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

  test('作成したクイズの検索と無限スクロール、共通QuizCardの表示', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // 1. ログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible();
    await e2eLoginBtn.click();
    await expect(page).toHaveURL('/');

    // 2. プロフィールへ遷移
    const navProfile = page.getByTestId('nav-profile');
    if (await navProfile.isVisible({ timeout: 10000 })) {
      await navProfile.click();
    } else {
      const headerProfileBtn = page.getByTestId('header-profile-btn');
      await expect(headerProfileBtn).toBeVisible({ timeout: 10000 });
      await headerProfileBtn.click();
      await page.locator('[data-testid="header-profile-popup"] >> text=プロフィール').click();
    }
    await expect(page).toHaveURL(/\/profile\//);

    // 3. 検索入力欄と「もっと見る」ボタンが表示されていることを確認
    const searchInput = page.getByTestId('profile-quiz-search-input');
    await expect(searchInput).toBeVisible();
    const moreBtn = page.getByTestId('profile-feed-load-more-button');
    await expect(moreBtn).toBeVisible();

    // 4. 共通QuizCard（data-testid="quiz-card"）が1ページ目の上限（20件）表示されていることを確認
    const cards = page.getByTestId('quiz-card');
    await expect(cards).toHaveCount(20);

    // 5. 検索の検証: 「クイズ_10」で検索し、該当カードのみ表示されること
    await searchInput.fill('クイズ_10');
    // キーワードフィルタ後の件数は1件のはず
    await expect(cards).toHaveCount(1);
    await expect(page.locator('text=[AD_TEST] クイズ_10')).toBeVisible();
    await expect(page.getByText('[AD_TEST] クイズ_1', { exact: true })).not.toBeVisible();

    // 「もっと見る」ボタンは非表示になるはず（件数が少ないため）
    await expect(moreBtn).not.toBeVisible();

    // 6. 検索キーワードクリア
    await searchInput.fill('');
    await expect(cards).toHaveCount(20);
    await expect(moreBtn).toBeVisible();

    // 7. 無限スクロール遷移の検証: 「もっと見る」をクリック
    const firstCard = cards.first();
    const firstCardTitle = await firstCard.locator('h3').textContent();
    expect(firstCardTitle).toBeTruthy();

    await moreBtn.click();

    // 追加フェッチされて件数が増加することを確認
    await expect(async () => {
      const newCount = await cards.count();
      expect(newCount).toBeGreaterThan(20);
    }).toPass({ timeout: 5000 });
    await expect(moreBtn).not.toBeVisible(); // 全件フェッチ完了したので非表示

    await context.close();
  });

  test('好きなジャンルの設定と表示の検証 (Phase 28)', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    // 1. ログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible();
    await e2eLoginBtn.click();
    await expect(page).toHaveURL('/');

    // 2. プロフィールへ遷移
    const navProfile = page.getByTestId('nav-profile');
    if (await navProfile.isVisible({ timeout: 10000 })) {
      await navProfile.click();
    } else {
      const headerProfileBtn = page.getByTestId('header-profile-btn');
      await expect(headerProfileBtn).toBeVisible({ timeout: 10000 });
      await headerProfileBtn.click();
      await page.locator('[data-testid="header-profile-popup"] >> text=プロフィール').click();
    }
    await expect(page).toHaveURL(/\/profile\//);

    // 3. 好きなジャンル表示領域が存在することを確認
    const favoriteGenres = page.getByTestId('profile-favorite-genres');
    await expect(favoriteGenres).toBeVisible();
    
    // 未設定の場合は「登録する」リンク、設定済みの場合は「プロフィールの編集」ボタンから編集画面へ遷移
    const registerLink = favoriteGenres.locator('text=登録する');
    if (await registerLink.isVisible()) {
      await registerLink.click();
    } else {
      const editBtn = page.locator('text=プロフィールの編集');
      await editBtn.click();
    }
    await expect(page).toHaveURL(/\/profile\/edit/);

    // 5. 好きなジャンル選択UI（data-testid="profile-genre-select"）が存在することを確認
    const genreSelect = page.getByTestId('profile-genre-select');
    await expect(genreSelect).toBeVisible();

    // 既に「歴史・地理」のチップがある場合は、一度削除して綺麗な状態からテストを行う
    const historyRemoveBtn = page.getByTestId('profile-genre-remove-history-geography');
    if (await historyRemoveBtn.isVisible()) {
      await historyRemoveBtn.click();
    }

    // 検索インプット（data-testid="profile-genre-search-input"）を取得
    const searchInput = page.getByTestId('profile-genre-search-input');
    await expect(searchInput).toBeVisible();

    // 「歴史」と入力してサジェストをトリガー
    await searchInput.fill('歴史');

    // サジェストの「歴史・地理」が表示されるのを待ってクリック
    const suggestItem = page.getByTestId('profile-genre-suggest-history-geography');
    await expect(suggestItem).toBeVisible({ timeout: 10000 });
    await suggestItem.click();

    // チップが追加されたことを確認
    const addedChip = page.getByTestId('profile-genre-chip-history-geography');
    await expect(addedChip).toBeVisible();

    // 「保存」ボタンをクリック
    const saveBtn = page.locator('text=保存');
    await saveBtn.click();

    // 6. マイプロフィール詳細へ戻り、設定したジャンルのチップが表示されていることを確認
    await expect(page).toHaveURL(/\/profile\//);
    await expect(favoriteGenres).toBeVisible();
    await expect(favoriteGenres.locator('text=歴史・地理')).toBeVisible();

    // 7. 他人プロフィールでの非表示検証 (ジャンルが未設定の別ユーザーへ遷移)
    const profileUrl = page.url();
    const uidMatch = profileUrl.match(/\/profile\/([^/?]+)/);
    expect(uidMatch).toBeTruthy();
    const otherUid = uidMatch![1] === 'other-user-e2e' ? 'another-user' : 'other-user-e2e';
    await page.goto(`/profile/${otherUid}`);
    
    // 他人のプロフィールでジャンル未設定の場合はセクション自体が表示されないこと
    await expect(page.getByTestId('profile-favorite-genres')).toHaveCount(0);

    await context.close();
  });
});
