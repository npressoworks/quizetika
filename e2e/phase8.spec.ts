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

  const qTextarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
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

test.describe('Phase 8 E2E スモーク', () => {
  test('11.10: ブックマーク画面で2タブを切り替えられること', async ({ page }) => {
    await ensureLoggedIn(page);
    await page.goto('/bookmarks');
    await expect(page.getByTestId('bookmarks-tabs')).toBeVisible();
    await expect(page.getByTestId('bookmarks-tab-quiz')).toBeVisible();
    await expect(page.getByTestId('bookmarks-tab-question')).toBeVisible();
    await expect(page.getByTestId('bookmarks-tab-list')).toHaveCount(0);
    await page.getByTestId('bookmarks-tab-question').click();
    await expect(page.locator('h1').filter({ hasText: 'ブックマーク' })).toBeVisible();
  });

  test('6.10: 参照リンクパネルから過去クイズの問題をリンクできること', async ({ page }) => {
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
    await expect(page.getByText('問題読み込み中...')).toBeHidden({ timeout: 15000 });

    const linkBtn = page.locator('[data-testid^="link-reference-"]').first();
    await expect(linkBtn).toBeVisible({ timeout: 15000 });
    await linkBtn.click();
    await expect(page.getByTestId('reference-question-badge').first()).toBeVisible();
  });
});
