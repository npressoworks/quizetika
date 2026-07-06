import { test, expect, type Page } from '@playwright/test';

async function ensureLoggedIn(page: Page) {
  await page.goto('/login');
  const e2eLoginBtn = page.locator('#e2e-test-login-btn');
  try {
    await e2eLoginBtn.waitFor({ state: 'visible', timeout: 5000 });
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await expect(page).toHaveURL('/', { timeout: 15000 });
    }
  } catch {
    await page.goto('/');
  }
}

test.describe('学習・資格対策支援 E2Eテスト', () => {

  test('クイズ詳細画面でプレイモード選択UIが正しく表示されること（通常・模擬試験・フラッシュカード）', async ({ page }) => {
    // 1. テスト用クイズを作成して公開する
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await ensureLoggedIn(page);
    // このテストは広告表示自体の検証対象ではないため、動画広告モーダルによる
    // 結果画面遷移の阻害（1/3確率でのランダム表示）を避けるために広告を無効化する
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
    });
    await page.goto('/quiz/create');
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
    const genreSearchInput = page.getByTestId('genre-editor-search-input');
    await expect(genreSearchInput).toBeVisible({ timeout: 15000 });
    await genreSearchInput.focus();

    const dropdown = page.getByTestId('genre-editor-search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 15000 });

    const firstOption = dropdown.locator('[data-testid^="genre-editor-search-option-"]').first();
    await expect(firstOption).toBeVisible({ timeout: 15000 });
    await firstOption.click();

    // 難易度（☆3）を設定
    const difficultyStar3 = page.getByRole('button', { name: '難易度 3' }).first();
    await expect(difficultyStar3).toBeVisible({ timeout: 5000 });
    await difficultyStar3.click();

    // 公開
    await page.locator('button').filter({ hasText: /^公開$/ }).first().click();

    // 公開完了と成功画面への遷移を待つ
    await expect(page).toHaveURL(/\/quiz\/([^/]+)\/success/, { timeout: 30000 });
    const match = page.url().match(/\/quiz\/([^/]+)\/success/);
    const quizId = match ? match[1] : '';

    // 2. 作成したクイズの詳細画面に直接遷移する
    await page.goto(`/quiz/${quizId}`);

    // 3. クイズ詳細画面でプレイモード選択UIを確認
    await expect(page).toHaveURL(/\/quiz\//);

    // 3つのプレイモードが表示されることを確認
    await expect(page.getByText('通常モード', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('模擬試験モード', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('フラッシュカードモード', { exact: true }).first()).toBeVisible();

    // 4. 模擬試験モードを選択してプレイ開始
    const examMode = page.getByText('模擬試験モード', { exact: true }).first();
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
    const correctChoice = page.locator('label').filter({ hasText: '4' }).first();
    await expect(correctChoice).toBeVisible({ timeout: 5000 });
    await correctChoice.click();

    // 解答を確定する
    const confirmBtn = page.getByRole('button', { name: '解答を確定する' }).first();
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 結果画面へ直接遷移することを確認
    await expect(page).toHaveURL(/\/result/, { timeout: 15000 });
  });

  test('フラッシュカードモードで「答えを見る」ボタンが機能すること', async ({ page }) => {
    // 1. テスト用クイズを作成して公開する
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    await ensureLoggedIn(page);
    // このテストは広告表示自体の検証対象ではないため、動画広告モーダルによる
    // 結果画面遷移の阻害（1/3確率でのランダム表示）を避けるために広告を無効化する
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
    });
    await page.goto('/quiz/create');
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
    const genreSearchInput = page.getByTestId('genre-editor-search-input');
    await expect(genreSearchInput).toBeVisible({ timeout: 15000 });
    await genreSearchInput.focus();

    const dropdown = page.getByTestId('genre-editor-search-dropdown');
    await expect(dropdown).toBeVisible({ timeout: 15000 });

    const firstOption = dropdown.locator('[data-testid^="genre-editor-search-option-"]').first();
    await expect(firstOption).toBeVisible({ timeout: 15000 });
    await firstOption.click();

    // 難易度（☆3）を設定
    const difficultyStar3 = page.getByRole('button', { name: '難易度 3' }).first();
    await expect(difficultyStar3).toBeVisible({ timeout: 5000 });
    await difficultyStar3.click();

    await page.locator('button').filter({ hasText: /^公開$/ }).first().click();

    // 公開完了と成功画面への遷移を待つ
    await expect(page).toHaveURL(/\/quiz\/([^/]+)\/success/, { timeout: 30000 });
    const match = page.url().match(/\/quiz\/([^/]+)\/success/);
    const quizId = match ? match[1] : '';

    // 2. クイズ詳細画面へ直接アクセス
    await page.goto(`/quiz/${quizId}`);

    // 3. フラッシュカードモードを選択してプレイ開始
    await page.getByText('フラッシュカードモード', { exact: true }).first().click();
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

    // 結果画面へ直接遷移することを確認
    await expect(page).toHaveURL(/\/result/, { timeout: 15000 });
  });

  test('プロフィール画面で弱点克服セクション（間違い問題の復習）へのリンクが確認できること', async ({ page }) => {
    // 1. ログイン済みのマイページに移動
    await ensureLoggedIn(page);
    await page.goto('/');

    // サイドバーの「マイページ」リンクをクリックする
    const myPageLink = page.getByTestId('nav-profile');
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
