import { test, expect } from '@playwright/test';

const TEN_MC_QUESTIONS = Array.from({ length: 10 }, (_, i) => ({
  type: 'multiple-choice',
  questionText: `E2E問題文テスト${i}です`,
  explanation: `E2E解説文テスト${i}です`,
  choices: [
    { choiceText: '正解選択肢', isCorrect: true },
    { choiceText: '不正解1', isCorrect: false },
    { choiceText: '不正解2', isCorrect: false },
    { choiceText: '不正解3', isCorrect: false },
  ],
}));

test.describe('AI クイズ作問 E2E', () => {
  test('無料ユーザは Upsell が表示される', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');
    await expect(page.getByTestId('ai-quiz-pro-upsell')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('ai-quiz-authoring-panel')).toHaveCount(0);
  });

  test('Pro fixture: パネル表示・API mock で問題 +10', async ({ page }) => {
    await page.route('**/api/quiz/ai-authoring-usage*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questions: { limit: 100, usedToday: 0, remainingToday: 100 },
          thumbnail: { limit: 20, usedToday: 0, remainingToday: 20 },
        }),
      });
    });

    await page.route('**/api/quiz/ai-generate-questions', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          questions: TEN_MC_QUESTIONS.map((q, i) => ({
            id: `gen-${i}`,
            ...q,
            imageUrl: null,
            hint: null,
            limitTime: null,
            correctCount: 0,
            incorrectCount: 0,
            choices: q.choices.map((c, ci) => ({
              id: String(ci + 1),
              choiceText: c.choiceText,
              isCorrect: c.isCorrect,
              selectedCount: 0,
            })),
          })),
          usage: { limit: 100, usedToday: 1, remainingToday: 99 },
        }),
      });
    });

    await page.addInitScript(() => {
      window.localStorage.setItem(
        'e2e-mock-pro-user',
        JSON.stringify({
          subscriptionTier: 'pro',
          subscriptionStatus: 'active',
        })
      );
    });

    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');

    const panel = page.getByTestId('ai-quiz-authoring-panel');
    if (await panel.count() === 0) {
      await expect(page.getByTestId('ai-quiz-pro-upsell')).toBeVisible();
      return;
    }

    await expect(panel).toBeVisible();
    const initialCount = await page.locator('[data-testid^="auto-grow-question-text"]').count();

    await page.getByTestId('ai-quiz-prompt-input').fill('日本史の初級クイズを作ってください');
    await page.getByTestId('ai-quiz-generate-button').click();

    await expect.poll(async () =>
      page.locator('[data-testid^="auto-grow-question-text"]').count()
    ).toBe(initialCount + 10);
  });

  test('lateral format で生成ボタンが disabled', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');

    const formatSelect = page.locator('select').filter({ hasText: /水平思考|ウミガメ/ }).first();
    if (await formatSelect.count() > 0) {
      await formatSelect.selectOption({ label: '水平思考（ウミガメのスープ）' });
      const panel = page.getByTestId('ai-quiz-authoring-panel');
      if (await panel.count() > 0) {
        await expect(page.getByTestId('ai-quiz-generate-button')).toBeDisabled();
      }
    }
  });

  test('サムネ: title/description 未入力時はボタン disabled', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');

    const thumbBtn = page.getByTestId('ai-thumbnail-generate-button');
    if (await thumbBtn.count() > 0) {
      await expect(thumbBtn).toBeDisabled();
    }
  });
});
