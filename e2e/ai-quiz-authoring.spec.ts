import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';
import { readE2eFixtureIds } from './fixture-ids';

test.describe('AI クイズ作問 E2E', () => {
  test('無料ユーザは Upsell が表示される', async ({ page }) => {
    // 共有E2Eテストユーザーは admin/senior_moderator であり、moderationTier による
    // AI作問無制限判定（hasUnlimitedAiQuestionsForUser）が常にバイパスされてしまうため、
    // このテストの間だけ一時的に moderation_tier を newcomer（無料相当）に降格する
    const db = createDbClient();
    await db.connect();
    const { userId } = readE2eFixtureIds();
    try {
      await db.query(`UPDATE users SET moderation_tier = 'newcomer' WHERE id = $1`, [userId]);

      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');
      await expect(page.getByTestId('ai-quiz-pro-upsell')).toBeVisible({ timeout: 15000 });
      // Pro/モデレータ限定のAIアシスタント起動ボタンは表示されないこと
      await expect(page.getByTestId('ai-chat-assistant-button')).toHaveCount(0);
    } finally {
      await db.query(`UPDATE users SET moderation_tier = 'senior_moderator' WHERE id = $1`, [userId]);
      await db.end();
    }
  });

  test('Pro fixture: AIアシスタントの起動ボタンとハイブリッド起動ボタンが表示される', async ({ page }) => {
    // 共有E2Eテストユーザーは senior_moderator のため hasUnlimitedAiQuestionsForUser が
    // 常にtrueとなり、Pro相当のAI作問導線（ハイブリッド起動ボタン・チャットアシスタント起動ボタン）が
    // 表示される。個別の生成・チェックフローの検証は e2e/ai-chat-assistant.spec.ts が担う
    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('ai-quiz-pro-upsell')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'AIで作問開始' })).toBeVisible();
    await expect(page.getByRole('button', { name: '全問包括チェック' })).toBeVisible();
    await expect(page.getByTestId('ai-chat-assistant-button')).toBeVisible();
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

  test('サムネ: title/description 未入力時はボタンは有効だが入力を促すメッセージが表示される', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');

    const thumbBtn = page.getByTestId('ai-thumbnail-generate-button');
    if (await thumbBtn.count() > 0) {
      await expect(thumbBtn).toBeEnabled();
      await thumbBtn.click();
      await expect(page.getByText('タイトルと説明文を入力するとサムネイルを生成できます')).toBeVisible();
    }
  });
});
