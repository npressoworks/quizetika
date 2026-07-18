import { test, expect } from '@playwright/test';

test.describe('クイズカバー画像アップロード E2Eテスト', () => {
  test('ユーザーはローカル画像を選択し、1.91:1 (OGP規格) でトリミングしてカバー画像として設定できること', async ({ page }) => {
    // 1. 作問ページへ直接遷移
    await page.goto('/quiz/create');

    // 2. 基本情報を入力
    await page.locator('input[placeholder="例: 世界の国旗と首都クイズ"]').fill('E2Eテスト用のクイズタイトル');
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('これは画像アップロードテストの説明文です。');

    // ジャンルを選択
    const genreInput = page.getByTestId('genre-editor-search-input');
    await expect(genreInput).toBeVisible();
    await genreInput.focus();
    await genreInput.fill('ゲーム');
    const dropdown = page.getByTestId('genre-editor-search-dropdown');
    await expect(dropdown).toBeVisible();
    const firstOption = dropdown.locator('[data-testid^="genre-editor-search-option-"]').first();
    await expect(firstOption).toBeVisible();
    await firstOption.click();

    // 3. アップロード選択エリアが表示されていることを確認
    const uploadArea = page.locator('text=画像を選択 / ドロップ');
    await expect(uploadArea).toBeVisible();

    // 4. ダミーのPNG画像ファイル (1px x 1px) をセット
    const dummyImageBuffer = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      'base64'
    );

    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: 'test-image.png',
      mimeType: 'image/png',
      buffer: dummyImageBuffer,
    });

    // 5. トリミングモーダルが表示されることを確認
    const cropperDialog = page.locator('text=トリミング');
    await expect(cropperDialog).toBeVisible();

    // 6. 「確定」ボタンをクリックしてトリミングを確定
    const confirmBtn = page.locator('button:has-text("確定")');
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 7. モーダルが非表示になり、サムネイルプレビューが表示されることを確認
    await expect(cropperDialog).not.toBeVisible();

    const previewImage = page.locator('img[alt="Thumbnail preview"]');
    await expect(previewImage).toBeVisible();

    // 8. プレビュー画像の src にローカルの一時 Object URL (blob:) が設定されていることを検証
    const src = await previewImage.getAttribute('src');
    expect(src).not.toBeNull();
    expect(src).toContain('blob:');

    // 9. 必須項目を入力して下書き保存し、遅延アップロードが成功することを確認する
    // 問題文の入力
    const q1Textarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
    await expect(q1Textarea).toBeVisible();
    await q1Textarea.fill('E2Eテスト質問本文です');

    // 選択肢の入力
    const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
    await expect(choiceInputs.first()).toBeVisible();
    await choiceInputs.nth(0).fill('選択肢A');
    await choiceInputs.nth(1).fill('選択肢B');
    await choiceInputs.nth(2).fill('選択肢C');
    await choiceInputs.nth(3).fill('選択肢D');

    // ダイアログハンドラーの登録
    let dialogMessage = '';
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // 下書き保存をクリック
    const saveDraftBtn = page.locator('text=下書き保存');
    await expect(saveDraftBtn).toBeVisible();
    await saveDraftBtn.click();

    // アラートメッセージと、作成したクイズ画面（/creator/quizzes）への遷移が完了したことを確認
    await expect.poll(() => dialogMessage).toContain('下書きを保存しました');
    await expect(page).toHaveURL(/\/creator\/quizzes/);
  });

  test('ユーザーが容量10MB以上の画像を選択した場合にバリデーションエラーが表示されること', async ({ page }) => {
    await page.goto('/quiz/create');

    const fileInput = page.locator('input[type="file"]');

    // 10.1MBのダミーバッファを生成して入力
    const largeBuffer = Buffer.alloc(10.1 * 1024 * 1024);
    await fileInput.setInputFiles({
      name: 'large-image.png',
      mimeType: 'image/png',
      buffer: largeBuffer,
    });

    // エラーメッセージ「ファイルサイズは 10MB 以下にしてください。」が表示されることを確認
    const errorMsg = page.locator('text=ファイルサイズは 10MB 以下にしてください。');
    await expect(errorMsg).toBeVisible();

    // モーダルが立ち上がっていないことを確認
    const cropperDialog = page.locator('text=トリミング');
    await expect(cropperDialog).not.toBeVisible();
  });
});
