import { test, expect } from '@playwright/test';

test.describe('AI チャットアシスタント E2E', () => {
  test('無料ユーザーにはチャットボタンが表示されない', async ({ page }) => {
    await page.goto('/quiz/create');
    await page.waitForLoadState('domcontentloaded');
    
    // 無料ユーザーなので Upsell は表示されるが、チャット起動ボタンは表示されない
    await expect(page.getByTestId('ai-chat-assistant-button')).toHaveCount(0);
  });

  test.describe('Pro ユーザーのシナリオ', () => {
    test.beforeEach(async ({ page }) => {
      page.on('console', msg => console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`));
      page.on('pageerror', err => console.log(`[BROWSER ERROR] ${err.message}`));

      // Pro ユーザーのモック設定
      await page.addInitScript(() => {
        window.localStorage.setItem(
          'e2e-mock-pro-user',
          JSON.stringify({
            subscriptionTier: 'pro',
            subscriptionStatus: 'active',
          })
        );
      });

      // API モック
      await page.route('**/api/quiz/ai-authoring-usage*', async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            questions: { limit: 100, usedToday: 0, remainingToday: 100 },
            thumbnail: { limit: 20, usedToday: 0, remainingToday: 20 },
            chat: { limit: 100, usedToday: 5, remainingToday: 95 },
          }),
        });
      });

      await page.route('**/api/quiz/ai-chat-authoring', async (route) => {
        // Vercel AI SDK の Data Stream 形式のテキスト応答をモック
        const chunks = [
          `data: ${JSON.stringify({ type: 'text-start', id: 'msg-assistant' })}`,
          `data: ${JSON.stringify({ type: 'text-delta', id: 'msg-assistant', delta: 'かしこまりました。チェック処理を実行します。' })}`,
          `data: ${JSON.stringify({ type: 'text-end', id: 'msg-assistant' })}`,
        ];
        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          headers: {
            'x-vercel-ai-data-stream': 'v1',
          },
          body: chunks.join('\n\n') + '\n\n',
        });
      });
    });

    test('チャット起動ボタンからパネルを開閉できること', async ({ page }) => {
      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      const chatBtn = page.getByTestId('ai-chat-assistant-button');
      await expect(chatBtn).toBeVisible({ timeout: 15000 });

      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      await expect(chatPanel).toHaveAttribute('data-open', 'false');

      // クリックで展開
      await chatBtn.click();
      await expect(chatPanel).toHaveAttribute('data-open', 'true');

      // 閉じるボタンで収納
      const closeBtn = page.getByTestId('ai-chat-close-button');
      await closeBtn.click();
      await expect(chatPanel).toHaveAttribute('data-open', 'false');
    });

    test('「AIで作問開始」ボタン押下時にウェルカムメッセージが表示されること', async ({ page }) => {
      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      // エディタ上の「AIで作問開始」ボタンをクリック
      const startBtn = page.getByRole('button', { name: 'AIで作問開始' });
      await expect(startBtn).toBeVisible();
      await startBtn.click();

      // チャットパネルが開き、ウェルカムメッセージが表示されていること
      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      await expect(chatPanel).toHaveAttribute('data-open', 'true');
      await expect(page.getByText('クイズ作問アシスタントです！どのようなテーマや難易度')).toBeVisible();
    });

    test('「全問包括チェック」ボタン押下時に自動でメッセージが送信され、AIの応答が表示されること', async ({ page }) => {
      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      // 「全問包括チェック」をクリック
      const checkBtn = page.getByRole('button', { name: '全問包括チェック' });
      await expect(checkBtn).toBeVisible();
      await checkBtn.click();

      // チャットパネルが開き、自動でメッセージ送信および AI のストリーム応答が完了していること
      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      await expect(chatPanel).toHaveAttribute('data-open', 'true');
      
      // 自動送信されたユーザープロンプトの存在
      await expect(page.getByText('すべての問題の包括チェック')).toBeVisible();
      
      // AI からのストリーム応答（モックデータ）の存在
      await expect(page.getByText('かしこまりました。チェック処理を実行します。')).toBeVisible();
    });
  });
});
