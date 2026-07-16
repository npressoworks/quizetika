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

      // Pro ユーザーのモック設定とクリップボードのモック化
      await page.addInitScript(() => {
        window.localStorage.setItem(
          'e2e-mock-pro-user',
          JSON.stringify({
            subscriptionTier: 'pro',
            subscriptionStatus: 'active',
          })
        );
        Object.defineProperty(navigator, 'clipboard', {
          value: {
            writeText: async () => Promise.resolve(),
          },
          configurable: true,
        });
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

    test('マークダウン表示とリンク・コピーボタンの動作検証', async ({ page }) => {
      // API モックの上書き (マークダウンを含むレスポンス)
      await page.route('**/api/quiz/ai-chat-authoring', async (route) => {
        const chunks = [
          `data: ${JSON.stringify({ type: 'text-start', id: 'msg-assistant' })}`,
          `data: ${JSON.stringify({
            type: 'text-delta',
            id: 'msg-assistant',
            delta: 'これが **太字** で、[外部リンク](https://example.com) です。\n- リスト1\n- リスト2\n\n```javascript\nconst test = 123;\n```'
          })}`,
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

      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      // チャット起動
      const startBtn = page.getByRole('button', { name: 'AIで作問開始' });
      await startBtn.click();

      // チャット送信
      const input = page.locator('textarea[placeholder="AIに指示を送る..."]');
      await input.fill('テストメッセージ');
      await page.keyboard.press('Enter');

      // AI の応答待ち (モックが即座に解決)
      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      const bubble = chatPanel.locator('[class*="bubbleAssistant"]').last();
      await expect(bubble).toBeVisible();

      // マークダウン要素 (太字、リスト) の検証
      const strong = bubble.locator('strong');
      await expect(strong).toHaveText('太字');
      
      const li = bubble.locator('li');
      await expect(li).toHaveCount(2);

      // リンクが target="_blank" かつ rel="noopener noreferrer" の検証
      const link = bubble.locator('a');
      await expect(link).toHaveAttribute('href', 'https://example.com');
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer');

      // コピーボタンの検証
      const pre = bubble.locator('pre');
      await expect(pre).toBeVisible();
      
      const copyBtn = pre.locator('button');
      await expect(copyBtn).toHaveText('コピー');

      // コピーボタンをクリックして動作検証
      await copyBtn.click();
      await expect(copyBtn).toHaveText('コピー完了');
    });

    test('承認フロー: AIが問題一括生成ツールを呼び出した際にプレビューが表示され、承認するとエディタに反映されること', async ({ page }) => {
      // ツール呼び出し（generateBulkQuestions）をモックしたAPIレスポンス
      await page.route('**/api/quiz/ai-chat-authoring', async (route) => {
        const body = route.request().postDataJSON();
        const messages = body?.messages || [];
        console.log("MOCK API POST BODY: " + JSON.stringify(body));
        const hasToolResult = messages.some((m: any) =>
          m.toolInvocations?.some((ti: any) => ti.state === 'result')
        );

        let chunks: string[];
        if (hasToolResult) {
          chunks = [
            `data: ${JSON.stringify({ type: 'text-start', id: 'msg-assistant-tool-res' })}`,
            `data: ${JSON.stringify({ type: 'text-delta', id: 'msg-assistant-tool-res', delta: '問題を反映しました。' })}`,
            `data: ${JSON.stringify({ type: 'text-end', id: 'msg-assistant-tool-res' })}`,
          ];
        } else {
          chunks = [
            `data: ${JSON.stringify({ type: 'text-start', id: 'msg-assistant-tool' })}`,
            `data: ${JSON.stringify({ type: 'text-delta', id: 'msg-assistant-tool', delta: 'クイズ問題を一括作成します。' })}`,
            `data: ${JSON.stringify({
              type: 'tool-input-available',
              toolCallId: 'call-bulk-1',
              toolName: 'generateBulkQuestions',
              input: {
                questions: [
                  {
                    type: 'multiple-choice',
                    questionText: '日本の首都はどこですか？E2Eテスト',
                    explanation: '日本の首都は東京です。',
                    choices: [
                      { id: 'choice-1', choiceText: '東京', isCorrect: true },
                      { id: 'choice-2', choiceText: '大阪', isCorrect: false }
                    ]
                  }
                ]
              }
            })}`,
            `data: ${JSON.stringify({ type: 'text-end', id: 'msg-assistant-tool' })}`,
          ];
        }

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          headers: {
            'x-vercel-ai-data-stream': 'v1',
          },
          body: chunks.join('\n\n') + '\n\n',
        });
      });

      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      // AIで作問開始をクリックしてチャットを開く
      const startBtn = page.getByRole('button', { name: 'AIで作問開始' });
      await startBtn.click();

      // チャットに入力して送信
      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      const input = chatPanel.locator('textarea');
      await input.fill('首都に関する問題を1問作成して');
      await page.keyboard.press('Enter');

      // チャットパネル上に「generateBulkQuestionsの承認待ち…」というラベルが表示されること
      await expect(page.getByText('問題の一括生成の承認待ち…')).toBeVisible({ timeout: 10000 });

      // 提案プレビュー内に「日本の首都はどこですか？E2Eテスト」が表示されていること
      await expect(page.getByText('日本の首都はどこですか？E2Eテスト')).toBeVisible();

      // 二重送信防止ガード: 送信インプットと送信ボタンが disabled になっていること
      await expect(input).toBeDisabled();
      const sendBtn = page.getByRole('button', { name: 'メッセージを送信' });
      await expect(sendBtn).toBeDisabled();

      // 「フォームに反映する」ボタンをクリック
      const approveBtn = page.getByRole('button', { name: 'フォームに反映する' });
      await approveBtn.click();

      // 「問題の一括生成を反映しました」にステータスが変わること
      await expect(page.getByText('問題の一括生成を反映しました')).toBeVisible();

      // 送信インプットが再び enabled になること
      await expect(input).toBeEnabled();

      // エディタ（画面上）に問題が反映され、追加された問題テキストが画面に表示されていることを確認
      await expect(page.locator('body')).toContainText('日本の首都はどこですか？E2Eテスト');
    });

    test('承認フロー: AIが問題一括生成ツールを呼び出した際に却下するとエディタに反映されないこと', async ({ page }) => {
      // ツール呼び出し（generateBulkQuestions）をモックしたAPIレスポンス
      await page.route('**/api/quiz/ai-chat-authoring', async (route) => {
        const body = route.request().postDataJSON();
        const messages = body?.messages || [];
        const hasToolResult = messages.some((m: any) =>
          m.toolInvocations?.some((ti: any) => ti.state === 'result')
        );

        let chunks: string[];
        if (hasToolResult) {
          chunks = [
            `data: ${JSON.stringify({ type: 'text-start', id: 'msg-assistant-tool-rej-res' })}`,
            `data: ${JSON.stringify({ type: 'text-delta', id: 'msg-assistant-tool-rej-res', delta: 'キャンセルされました。' })}`,
            `data: ${JSON.stringify({ type: 'text-end', id: 'msg-assistant-tool-rej-res' })}`,
          ];
        } else {
          chunks = [
            `data: ${JSON.stringify({ type: 'text-start', id: 'msg-assistant-tool-reject' })}`,
            `data: ${JSON.stringify({ type: 'text-delta', id: 'msg-assistant-tool-reject', delta: 'クイズ問題を一括作成します。' })}`,
            `data: ${JSON.stringify({
              type: 'tool-input-available',
              toolCallId: 'call-bulk-2',
              toolName: 'generateBulkQuestions',
              input: {
                questions: [
                  {
                    type: 'multiple-choice',
                    questionText: '却下される問題テキスト',
                    explanation: '説明です。',
                    choices: [
                      { id: 'choice-1', choiceText: '選択肢A', isCorrect: true },
                      { id: 'choice-2', choiceText: '選択肢B', isCorrect: false }
                    ]
                  }
                ]
              }
            })}`,
            `data: ${JSON.stringify({ type: 'text-end', id: 'msg-assistant-tool-reject' })}`,
          ];
        }

        await route.fulfill({
          status: 200,
          contentType: 'text/plain',
          headers: {
            'x-vercel-ai-data-stream': 'v1',
          },
          body: chunks.join('\n\n') + '\n\n',
        });
      });

      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      // AIで作問開始をクリックしてチャットを開く
      const startBtn = page.getByRole('button', { name: 'AIで作問開始' });
      await startBtn.click();

      // チャットに入力して送信
      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      const input = chatPanel.locator('textarea');
      await input.fill('却下する問題を作成して');
      await page.keyboard.press('Enter');

      // プレビューの表示を待つ
      await expect(page.getByText('問題の一括生成の承認待ち…')).toBeVisible({ timeout: 10000 });
      await expect(page.getByText('却下される問題テキスト')).toBeVisible();

      // 「キャンセル」ボタンをクリック
      const rejectBtn = page.getByRole('button', { name: 'キャンセル' });
      await rejectBtn.click();

      // 「問題の一括生成をキャンセルしました」にステータスが変わること
      await expect(page.getByText('問題の一括生成をキャンセルしました')).toBeVisible();

      // 送信インプットが再び enabled になること
      await expect(input).toBeEnabled();

      // エディタに問題が反映されていない（画面上に見つからない）ことを確認
      await expect(page.locator('body')).not.toContainText('却下される問題テキスト');
    });

    test('Phase 3: モバイル幅ではチャットパネルが全画面表示になり、閉じるボタンがヘッダーにのみ存在すること (Requirements 1.8, 1.9)', async ({ page }) => {
      // モバイル相当のビューポート幅（CSS 側 @media (max-width: 768px) の閾値内）に設定
      await page.setViewportSize({ width: 375, height: 812 });

      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      // チャット起動ボタンからパネルを開く
      const chatBtn = page.getByTestId('ai-chat-assistant-button');
      await expect(chatBtn).toBeVisible({ timeout: 15000 });
      await chatBtn.click();

      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      await expect(chatPanel).toHaveAttribute('data-open', 'true');

      // パネルが画面全体を覆う全画面表示になっていること（幅がビューポート幅とほぼ一致）
      const panelBox = await chatPanel.boundingBox();
      expect(panelBox).not.toBeNull();
      expect(panelBox!.width).toBeGreaterThanOrEqual(370);

      // 閉じるボタンはヘッダー上部にのみ存在し、表示されていること
      const closeBtn = page.getByTestId('ai-chat-close-button');
      await expect(closeBtn).toBeVisible();
      await expect(closeBtn).toHaveCount(1);

      // フローティング起動ボタンは全画面表示中は非表示（display: none）になり、
      // ヘッダー以外に重複した閉じる操作が存在しないことを保証する (Requirement 1.9)
      await expect(chatBtn).not.toBeVisible();

      // 閉じるボタンでパネルを閉じられること
      await closeBtn.click();
      await expect(chatPanel).toHaveAttribute('data-open', 'false');
    });

    test('Phase 3 回帰: デスクトップ幅では従来どおりスライドインパネルとフローティングボタンが維持されること', async ({ page }) => {
      // デスクトップ相当のビューポート幅（CSS 側ブレークポイント 768px を超える）に設定
      await page.setViewportSize({ width: 1280, height: 800 });

      await page.goto('/quiz/create');
      await page.waitForLoadState('domcontentloaded');

      const chatBtn = page.getByTestId('ai-chat-assistant-button');
      await expect(chatBtn).toBeVisible({ timeout: 15000 });
      await chatBtn.click();

      const chatPanel = page.getByTestId('ai-chat-assistant-panel');
      await expect(chatPanel).toHaveAttribute('data-open', 'true');

      // デスクトップ幅では全画面ではなく右側スライドインパネル（固定幅 500px）として表示されること
      const panelBox = await chatPanel.boundingBox();
      expect(panelBox).not.toBeNull();
      expect(panelBox!.width).toBeLessThan(1280);

      // フローティングボタンはパネル表示中も引き続き表示されている（閉じるボタンとして機能）こと（回帰確認）
      await expect(chatBtn).toBeVisible();

      // フローティングボタン経由でも閉じられること（従来の挙動）
      await chatBtn.click();
      await expect(chatPanel).toHaveAttribute('data-open', 'false');
    });
  });
});

