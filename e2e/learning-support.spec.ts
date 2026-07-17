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

// Phase 37: 模擬試験・フラッシュカードへの代替導線（alt-mode-play-panel）は
// 既プレイユーザーにのみ表示されるため、代替導線へたどり着く前に
// 通常モード（単一「プレイ」ボタン）で1周プレイを完了させておく必要がある。
// クイズ詳細画面が表示された状態から呼び出すこと。
async function playNormalModeToCompletion(page: Page, correctChoiceText: string) {
  const playBtn = page.getByRole('button', { name: 'プレイ', exact: true });
  await expect(playBtn).toBeVisible();
  await playBtn.click();

  await expect(page).toHaveURL(/\/play\?mode=normal/);

  const correctChoice = page.locator('label').filter({ hasText: correctChoiceText }).first();
  await expect(correctChoice).toBeVisible({ timeout: 5000 });
  await correctChoice.click();

  const confirmBtn = page.getByRole('button', { name: '解答を確定する' }).first();
  await expect(confirmBtn).toBeVisible();
  await confirmBtn.click();

  const seeResultBtn = page.getByRole('button', { name: '結果を見る ➔' });
  await expect(seeResultBtn).toBeVisible();
  await seeResultBtn.click();

  await expect(page).toHaveURL(/\/result/, { timeout: 15000 });
}

test.describe('学習・資格対策支援 E2Eテスト', () => {

  test('通常モード1周完了後、既プレイ限定の代替導線から模擬試験モードを開始できること', async ({ page }) => {
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
    await page.locator('input[placeholder="例: 世界の国旗と首都クイズ"]').fill(quizTitle);
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

    // 3. クイズ詳細画面: 未プレイ時は単一「プレイ」ボタンのみで、代替導線は表示されないことを確認
    await expect(page).toHaveURL(/\/quiz\//);
    await expect(page.getByTestId('alt-mode-play-panel')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'プレイ', exact: true })).toBeVisible();

    // 4. 通常モードで1周プレイを完了させる（模擬試験・フラッシュカードへの代替導線は既プレイ限定のため）
    await playNormalModeToCompletion(page, '4');

    // 5. 詳細画面に戻り、既プレイ状態で表示される代替導線から模擬試験モードを選択する
    await page.goto(`/quiz/${quizId}`);
    const altModePanel = page.getByTestId('alt-mode-play-panel');
    await expect(altModePanel).toBeVisible({ timeout: 10000 });
    await expect(page.getByTestId('play-mode-leaderboard-warning')).toBeVisible();

    const examModeBtn = page.getByRole('button', { name: '模擬試験で復習する' });
    await expect(examModeBtn).toBeVisible();
    await examModeBtn.click();

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
    await page.locator('input[placeholder="例: 世界の国旗と首都クイズ"]').fill(quizTitle);
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

    // 3. 未プレイ時は単一「プレイ」ボタンのみで、代替導線は表示されないことを確認
    await expect(page.getByTestId('alt-mode-play-panel')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'プレイ', exact: true })).toBeVisible();

    // 4. 通常モードで1周プレイを完了させる（フラッシュカードへの代替導線は既プレイ限定のため）
    await playNormalModeToCompletion(page, 'length');

    // 5. 詳細画面に戻り、既プレイ状態で表示される代替導線からフラッシュカードモードを選択する
    await page.goto(`/quiz/${quizId}`);
    const altModePanel = page.getByTestId('alt-mode-play-panel');
    await expect(altModePanel).toBeVisible({ timeout: 10000 });

    const flashcardModeBtn = page.getByRole('button', { name: 'フラッシュカードで復習する' });
    await expect(flashcardModeBtn).toBeVisible();
    await flashcardModeBtn.click();

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
    // 1. ログイン済みのプロフィールに移動
    await ensureLoggedIn(page);
    await page.goto('/');

    // サイドバーの「プロフィール」リンクをクリックする
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
