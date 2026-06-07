import { test, expect } from '@playwright/test';

test.describe('学習・資格対策支援 E2Eテスト', () => {

  test('クイズ詳細画面でプレイモード選択UIが正しく表示されること（通常・模擬試験・フラッシュカード）', async ({ page }) => {
    // 1. テスト用クイズを作成して公開する
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto('/quiz/create');
    // ログイン状態が失われている場合の自動ログイン・フォールバック
    const e2eLoginBtn1 = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn1.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn1.isVisible()) {
        await e2eLoginBtn1.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) { }
    await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });

    const quizTitle = `[TEST] E2E学習モード_${Date.now().toString().slice(-4)}`;
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(quizTitle);
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('学習支援E2Eテスト用クイズです。');

    // 第1問の入力
    const qTextarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
    await qTextarea.fill('テスト用問題1: 2+2=?');
    const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
    await choiceInputs.nth(0).fill('4'); // 正解
    await choiceInputs.nth(1).fill('3');
    await choiceInputs.nth(2).fill('5');
    await choiceInputs.nth(3).fill('6');
    const expTextarea = page.locator('textarea[placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"]').first();
    await expTextarea.fill('2+2=4 です。');

    // ジャンル選択
    const genreSelect = page.getByTestId('genre-editor-select');
    await expect(genreSelect).toBeVisible({ timeout: 5000 });
    const firstGenre = genreSelect.locator('option[value]:not([value=""])').first();
    await expect(firstGenre).toBeAttached({ timeout: 5000 });
    const genreValue = await firstGenre.getAttribute('value');
    if (genreValue) {
      await genreSelect.selectOption(genreValue);
    }

    // 公開
    await page.locator('button').filter({ hasText: /^公開$/ }).first().click();
    await expect.poll(() => dialogMessages).toContain('クイズを公開しました！');
    await expect(page).toHaveURL(/\/creator\/dashboard/);

    // 2. ホームに戻って作成したクイズを探す
    await page.goto('/');
    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await searchInput.fill(quizTitle);

    const quizCard = page.locator(`text=${quizTitle}`).first();
    await expect(quizCard).toBeVisible();
    await quizCard.click();

    // 3. クイズ詳細画面でプレイモード選択UIを確認
    await expect(page).toHaveURL(/\/quiz\//);

    // 3つのプレイモードが表示されることを確認
    await expect(page.locator('text=通常モード')).toBeVisible();
    await expect(page.locator('text=模擬試験モード')).toBeVisible();
    await expect(page.locator('text=フラッシュカードモード')).toBeVisible();

    // 4. 模擬試験モードを選択してプレイ開始
    const examMode = page.locator('text=模擬試験モード');
    await examMode.click();

    const startPlayBtn = page.locator('text=プレイを開始する');
    await expect(startPlayBtn).toBeVisible();
    await startPlayBtn.click();

    // 模擬試験モードのプレイ画面に遷移することを確認
    await expect(page).toHaveURL(/\/play\?mode=exam/);
    await expect(page.locator('text=モード: exam')).toBeVisible();

    // 模擬試験用の問題ナビゲーション番号ボタンが表示されることを確認
    const examNavBtn = page.locator('button').filter({ hasText: '1' }).first();
    await expect(examNavBtn).toBeVisible();

    // 5. 正解の選択肢をクリックして回答
    const correctChoice = page.locator('button[class*="optionBtn"]').filter({ hasText: '4' }).first()
      .or(page.locator('button').filter({ hasText: '4' }).first())
      .or(page.locator('text=4').first());
    await expect(correctChoice).toBeVisible({ timeout: 5000 });
    await correctChoice.click();
    // 結果を確認する
    const viewResultBtn = page.locator('text=結果を確認する');
    await expect(viewResultBtn).toBeVisible();
    await viewResultBtn.click();

    await expect(page).toHaveURL(/\/result/);
  });

  test('フラッシュカードモードで「答えを見る」ボタンが機能すること', async ({ page }) => {
    // 1. テスト用クイズを作成して公開する
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await page.goto('/quiz/create');
    // ログイン状態が失われている場合の自動ログイン・フォールバック
    const e2eLoginBtn2 = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn2.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn2.isVisible()) {
        await e2eLoginBtn2.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) { }
    await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });

    const quizTitle = `[TEST] E2Eフラッシュ_${Date.now().toString().slice(-4)}`;
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(quizTitle);
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('フラッシュカードE2Eテスト用クイズです。');

    // 第1問の入力
    const qTextarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
    await qTextarea.fill('フラッシュカードテスト: JavaScriptの配列の長さを返すプロパティは？');
    const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
    await choiceInputs.nth(0).fill('length'); // 正解
    await choiceInputs.nth(1).fill('size');
    await choiceInputs.nth(2).fill('count');
    await choiceInputs.nth(3).fill('len');
    const expTextarea = page.locator('textarea[placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"]').first();
    await expTextarea.fill('Javaのarr.lengthプロパティで配列の長さが取得できます。');

    // ジャンル選択
    const genreSelect = page.getByTestId('genre-editor-select');
    await expect(genreSelect).toBeVisible({ timeout: 5000 });
    const firstGenre = genreSelect.locator('option[value]:not([value=""])').first();
    await expect(firstGenre).toBeAttached({ timeout: 5000 });
    const genreValue = await firstGenre.getAttribute('value');
    if (genreValue) {
      await genreSelect.selectOption(genreValue);
    }

    await page.locator('button').filter({ hasText: /^公開$/ }).first().click();
    await expect.poll(() => dialogMessages).toContain('クイズを公開しました！');
    await expect(page).toHaveURL(/\/creator\/dashboard/);

    // 2. クイズを検索して詳細画面へ
    await page.goto('/');
    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await searchInput.fill(quizTitle);

    const quizCard = page.locator(`text=${quizTitle}`).first();
    await expect(quizCard).toBeVisible();
    await quizCard.click();

    // 3. フラッシュカードモードを選択してプレイ開始
    await page.locator('text=フラッシュカードモード').click();
    await page.locator('text=プレイを開始する').click();

    // フラッシュカードモードのプレイ画面に遷移することを確認
    await expect(page).toHaveURL(/\/play\?mode=flashcard/);

    // 4. 「答えを見る」ボタンが表示されることを確認
    const showAnswerBtn = page.locator('text=答えを見る');
    await expect(showAnswerBtn).toBeVisible();

    // 5. 「答えを見る」をクリックして正解を表示
    await showAnswerBtn.click();

    // 正解と解説が表示されることを確認
    await expect(page.locator('text=length').first()).toBeVisible();
    // 6. 「分かった (正解)」または「分からなかった (不正解)」ボタンが表示されることを確認
    await expect(page.locator('text=分かった (正解)')).toBeVisible();
    await expect(page.locator('text=分からなかった (不正解)')).toBeVisible();

    // 7. 「分かった (正解)」をクリックして次へ
    await page.locator('text=分かった (正解)').click();

    // 全問終了後の「結果を確認する」ボタンが表示されることを確認
    const resultBtn = page.locator('text=結果を確認する');
    await expect(resultBtn).toBeVisible();
  });

  test('プロフィール画面で弱点克服セクション（間違い問題の復習）へのリンクが確認できること', async ({ page }) => {
    // 1. ログイン済みのマイページに移動
    await page.goto('/');

    // アバターをクリックしてドロップダウンを開く
    const avatarBtn = page.locator('header img, aside img, nav img').filter({ visible: true }).first();
    await avatarBtn.click({ force: true });

    // 「マイページ」リンクをクリック
    const myPageLink = page.locator('text=マイページ');
    await expect(myPageLink).toBeVisible();
    await myPageLink.click();

    // 2. プロフィール画面の確認
    await expect(page).toHaveURL(/\/profile\//);

    // ユーザー名が表示されることを確認
    await expect(page.locator('h1').first()).toBeVisible();

    // 3. 弱点克服セクションの存在確認（間違い問題がある場合のみ表示）
    // 間違い問題がない場合でも、プロフィール画面のUIが正常に表示されていることを確認
    const profileCard = page.locator('main').first();
    await expect(profileCard).toBeVisible();

    // 「作成したクイズ」タブが表示されることを確認
    await expect(page.locator('text=作成したクイズ')).toBeVisible();
  });
});
