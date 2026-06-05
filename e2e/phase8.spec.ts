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

async function selectFirstGenre(page: Page) {
  const genreSelect = page.getByTestId('genre-editor-select');
  await expect(genreSelect).toBeEnabled({ timeout: 15000 });
  const firstGenre = genreSelect.locator('option[value]:not([value=""])').first();
  await expect(firstGenre).toBeAttached({ timeout: 15000 });
  const value = await firstGenre.getAttribute('value');
  expect(value).toBeTruthy();
  await genreSelect.selectOption(value!);
}

async function publishMinimalQuiz(page: Page, title: string) {
  await ensureLoggedIn(page);
  await page.goto('/quiz/create');
  await expect(
    page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()
  ).toBeVisible({ timeout: 15000 });

  await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(title);
  await page
    .locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]')
    .fill('Phase 8 E2E 自動生成クイズ');

  await selectFirstGenre(page);

  const qTextarea = page.locator('textarea[placeholder*="useState"]').first();
  await expect(qTextarea).toBeVisible({ timeout: 15000 });
  await qTextarea.fill('Reactのフックでステート管理を行うのは？');

  const choiceInputs = page
    .locator('input[type="checkbox"]')
    .locator('..')
    .locator('input[type="text"]');
  await choiceInputs.nth(0).fill('useState');
  await choiceInputs.nth(1).fill('useEffect');
  await choiceInputs.nth(2).fill('useContext');
  await choiceInputs.nth(3).fill('useRef');

  await page
    .locator('textarea[placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"]')
    .first()
    .fill('正解は useState です。');

  const publishBtn = page.getByRole('button', { name: '公開' });
  await expect(publishBtn).toBeVisible();
  await publishBtn.click();

  await expect(page).toHaveURL(/\/quiz\/[^/]+\/success/, { timeout: 30000 });
}

async function goToMyProfileListsTab(page: Page) {
  await page.locator('header img').first().click();
  await page.locator('text=マイページ').click();
  await expect(page).toHaveURL(/\/profile\//);
  await page.locator('button').filter({ hasText: '作成したリスト' }).click();
  await expect(page.getByTestId('profile-lists-panel')).toBeVisible();
}

test.describe('Phase 8 E2E スモーク', () => {
  test('11.10: ブックマーク画面で3タブを切り替えられること', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/bookmarks');
    await expect(page.getByTestId('bookmarks-tabs')).toBeVisible();
    await page.getByTestId('bookmarks-tab-quiz').click();
    await page.getByTestId('bookmarks-tab-list').click();
    await page.getByTestId('bookmarks-tab-question').click();
    await expect(page.locator('h1').filter({ hasText: 'お気に入りブックマーク一覧' })).toBeVisible();
  });

  test('6.10: 設問リストを新規作成し編集画面へ遷移すること', async ({ page }) => {
    page.on('dialog', async (dialog) => await dialog.accept());
    await ensureLoggedIn(page);
    await page.goto('/list/create');

    const listTitle = `[TEST] E2E設問リスト_${Date.now().toString().slice(-4)}`;
    await page.locator('input[type="text"]').first().fill(listTitle);
    await page.getByTestId('list-type-question').check();
    await page.locator('text=リストを保存する').first().click();

    await expect(page).toHaveURL(/\/list\/[^/]+\/edit/);
    await expect(page.getByTestId('question-list-attach-panel')).toBeVisible();
  });

  test('8.6: プロフィールでリスト種別バッジとフィルタが機能すること', async ({ page }) => {
    page.on('dialog', async (dialog) => await dialog.accept());
    await ensureLoggedIn(page);

    const suffix = Date.now().toString().slice(-4);

    await page.goto('/list/create');
    await page.locator('input[type="text"]').first().fill(`[TEST] E2Eクイズリスト_${suffix}`);
    await page.getByTestId('list-type-quiz').check();
    const addQuizBtn = page.locator('text=追加').first();
    if (await addQuizBtn.isVisible()) {
      await addQuizBtn.click();
    }
    await page.locator('text=リストを保存する').first().click();
    await expect(page).toHaveURL(/\/list\/(?!create)[^/]+$/);

    await page.goto('/list/create');
    await page.locator('input[type="text"]').first().fill(`[TEST] E2E設問リスト_${suffix}`);
    await page.getByTestId('list-type-question').check();
    await page.locator('text=リストを保存する').first().click();
    await expect(page).toHaveURL(/\/list\/[^/]+\/edit/);

    await goToMyProfileListsTab(page);
    const cards = page.getByTestId('profile-list-card');
    await expect(cards.first()).toBeVisible();
    await expect(page.getByTestId('profile-list-type-badge').first()).toBeVisible();

    await page.getByTestId('profile-list-filter-question').click();
    await expect(cards.first()).toBeVisible();
    await expect(page.getByTestId('profile-list-type-badge').first()).toHaveText('設問リスト');

    await page.getByTestId('profile-list-filter-quiz').click();
    await expect(page.getByTestId('profile-list-type-badge').first()).toHaveText('クイズリスト');
  });

  test('6.10: 参照リンクパネルから過去クイズの設問をリンクできること', async ({ page }) => {
    page.on('dialog', async (dialog) => await dialog.accept());
    const sourceTitle = `[TEST] E2E参照元_${Date.now().toString().slice(-4)}`;
    await publishMinimalQuiz(page, sourceTitle);

    await page.goto('/quiz/create');
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(
      `[TEST] E2E参照先_${Date.now().toString().slice(-4)}`
    );
    await page
      .locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]')
      .fill('参照リンク検証用');
    await selectFirstGenre(page);
    const panel = page.getByTestId('author-quiz-reference-panel');
    await expect(panel).toBeVisible();
    await panel.locator('summary').click();

    await page.getByTestId('reference-search-keyword').fill(sourceTitle.slice(-8));
    const quizRow = page.locator('[data-testid^="reference-quiz-"]').first();
    await expect(quizRow).toBeVisible({ timeout: 15000 });
    await quizRow.click();
    await expect(page.getByText('設問読み込み中...')).toBeHidden({ timeout: 15000 });

    const linkBtn = page.locator('[data-testid^="link-reference-"]').first();
    await expect(linkBtn).toBeVisible({ timeout: 15000 });
    await linkBtn.click();
    await expect(page.getByTestId('reference-question-badge').first()).toBeVisible();
  });

  test('11.10: 設問リストから連続プレイを完走できること', async ({ page }) => {
    page.on('dialog', async (dialog) => await dialog.accept());
    const quizTitle = `[TEST] E2E設問リストプレイ_${Date.now().toString().slice(-4)}`;
    await publishMinimalQuiz(page, quizTitle);

    await page.goto('/list/create');
    const listTitle = `[TEST] E2EQLPlay_${Date.now().toString().slice(-4)}`;
    await page.locator('input[type="text"]').first().fill(listTitle);
    await page.getByTestId('list-type-question').check();
    await page.locator('text=リストを保存する').first().click();
    await expect(page).toHaveURL(/\/list\/([^/]+)\/edit/);
    await expect(page.getByTestId('question-list-attach-panel')).toBeVisible();
    const editUrl = page.url();
    const listIdMatch = editUrl.match(/\/list\/([^/]+)\/edit/);
    expect(listIdMatch).toBeTruthy();
    const listId = listIdMatch![1];

    const attachBtn = page.locator('[data-testid^="attach-question-"]').first();
    await expect(attachBtn).toBeVisible({ timeout: 30000 });
    await attachBtn.click();
    await expect(page.getByText('まだ設問がありません')).toBeHidden({ timeout: 15000 });

    await page.goto(`/list/${listId}`);
    await expect(page.getByText(/収録設問一覧 \(1問\)/)).toBeVisible({ timeout: 15000 });
    const playStartBtn = page.getByTestId('question-list-play-start');
    await expect(playStartBtn).toBeEnabled({ timeout: 10000 });
    await playStartBtn.click();
    await expect(page).toHaveURL(/\/play/);

    const correctOption = page.getByRole('radiogroup').getByText('useState', { exact: true });
    await expect(correctOption).toBeVisible({ timeout: 10000 });
    await correctOption.click();

    const submitAnswerBtn = page.getByRole('button', { name: '解答を確定する' });
    await expect(submitAnswerBtn).toBeEnabled({ timeout: 5000 });
    await submitAnswerBtn.click();

    const viewResultBtn = page.locator('text=結果を確認する');
    await expect(viewResultBtn).toBeVisible();
    await viewResultBtn.click();
    await expect(page).toHaveURL(/\/result/, { timeout: 15000 });
    await expect(page.getByRole('heading', { name: /パーフェクト達成/ })).toBeVisible({
      timeout: 15000,
    });
  });

  test('8.11: クイズリスト作成とブックマーク登録が動作すること（回帰）', async ({ page }) => {
    page.on('dialog', async (dialog) => await dialog.accept());
    await ensureLoggedIn(page);
    await page.goto('/list/create');

    const listTitle = `[TEST] E2E回帰リスト_${Date.now().toString().slice(-4)}`;
    await page.locator('input[type="text"]').first().fill(listTitle);
    const addQuizBtn = page.locator('text=追加').first();
    if (await addQuizBtn.isVisible()) {
      await addQuizBtn.click();
    }
    await page.locator('text=リストを保存する').first().click();
    await expect(page).toHaveURL(/\/list\/(?!create)[^/]+$/);
    await expect(page.locator(`text=${listTitle}`)).toBeVisible();

    await page.goto('/bookmarks');
    await page.getByTestId('bookmarks-tab-list').click();
    await expect(page.getByTestId('bookmarks-tabs')).toBeVisible();
  });
});
