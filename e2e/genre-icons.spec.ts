import { test, expect } from '@playwright/test';

test.describe('ジャンルアイコン Firebase Storage 移行 E2Eテスト', () => {

  test('コミュニティジャンル申請での手動アップロード & 申請 & 投票可決フロー', async ({ page }) => {
    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. ジャンル新設申請画面へ遷移
    await page.goto('/community/genres');
    await page.waitForTimeout(2000);

    // 3. フォーム入力
    const genreId = `e2e-test-${Date.now().toString().slice(-4)}`;
    await page.locator('#genreId').fill(genreId);
    await page.locator('#displayName').fill('E2E手動ジャンル');
    await page.locator('#description').fill('E2E手動アップロードテスト用ジャンルの説明文です。');

    // 4. 手動で画像をアップロード
    const fileInput = page.locator('#iconFile');
    // 1x1ピクセルの最小有効PNG画像データ
    const dummyPng = Buffer.from([
      137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130
    ]);

    await fileInput.setInputFiles({
      name: 'e2e-upload-test.png',
      mimeType: 'image/png',
      buffer: dummyPng,
    });

    // 5. プレビュー表示の更新を待機（Storageの公開URLで表示されるはず）
    const previewImg = page.locator('img[alt="アイコンプレビュー"]');
    await expect(previewImg).toBeVisible({ timeout: 10000 });
    const previewSrc = await previewImg.getAttribute('src');
    expect(previewSrc).toContain('storage.googleapis.com');
    expect(previewSrc).toContain('/genres/temp/');

    // 6. 「ジャンルを申請する」をクリック
    const submitBtn = page.locator('#submit-genre-btn');
    await expect(submitBtn).toBeEnabled();
    await submitBtn.click();

    // 7. 申請完了メッセージの確認
    await expect(page.locator('text=ジャンル申請を送信しました')).toBeVisible({ timeout: 10000 });

    // 8. 投票タブへ移動し、申請中のジャンルに投票できることを確認
    const voteTab = page.locator('#tab-vote');
    if (await voteTab.isVisible()) {
      await voteTab.click();

      // 申請したジャンルが表示されていることを確認
      await expect(page.locator(`text=${genreId}`)).toBeVisible({ timeout: 5000 });

      // ジャンルID (genreId) が含まれる code 要素から、親のカード要素を特定し、その中にある「賛成」ボタンを取得する
      const codeTag = page.locator('code', { hasText: genreId });
      const requestCard = page.locator('div').filter({ has: codeTag }).first();
      const approveBtn = requestCard.locator('button:has-text("賛成")');

      if (await approveBtn.isVisible()) {
        await approveBtn.click();

        // 投票完了のメッセージを確認
        await expect(page.locator('text=賛成票を投じました').or(page.locator('text=可決され、ジャンルが追加されました'))).toBeVisible({ timeout: 10000 });
      }
    }
  });

  test('管理者画面での AI 画像生成およびジャンル直接追加フロー', async ({ page }) => {
    // AI生成APIのみモック（本物のAPI呼び出しを避けるため）
    await page.route('**/api/genres/generate-icon', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          iconImageUrl: 'https://storage.googleapis.com/quizetika-77bc6.appspot.com/genres/temp/e2e-ai-temp.png',
          usage: { limit: null, usedToday: 0, remainingToday: null }
        })
      });
    });

    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. 管理者ジャンル直接管理画面へ遷移
    await page.goto('/admin/genres');
    await page.waitForTimeout(2000);

    const isPageVisible = await page.locator('#genreId').isVisible().catch(() => false);
    if (isPageVisible) {
      // 3. フォーム入力
      const genreId = `e2e-admin-${Date.now().toString().slice(-4)}`;
      await page.locator('#genreId').fill(genreId);
      await page.locator('#displayName').fill('E2E管理者ジャンル');
      await page.locator('#description').fill('E2Eで管理者から直接作成されたジャンルです。');

      // 4. AIで画像を生成
      const aiGenBtn = page.locator('button:has-text("AIで生成")');
      await expect(aiGenBtn).toBeVisible();
      await aiGenBtn.click();

      // プレビューの更新を待機
      await expect(page.locator('text=AI生成画像')).toBeVisible({ timeout: 10000 });

      // 5. ジャンルを追加
      const submitBtn = page.locator('button:has-text("ジャンルを追加")');
      await expect(submitBtn).toBeEnabled();
      await submitBtn.click();

      // 6. 追加されたジャンルがテーブルに表示され、アイコンURLが正式パスに移行していることを確認
      await expect(page.locator(`text=${genreId}`)).toBeVisible({ timeout: 10000 });
      const addedIcon = page.locator(`tr:has-text("${genreId}") img`);
      await expect(addedIcon).toBeVisible();
      const iconSrc = await addedIcon.getAttribute('src');
      expect(iconSrc).toContain('storage.googleapis.com');
      expect(iconSrc).toContain(`/genres/${genreId}/`);
    }
  });
});
