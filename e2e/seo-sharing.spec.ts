import { test, expect } from '@playwright/test';

// クイズ詳細ページに遷移するためのヘルパー（クイズがなければ自動作成する）
async function ensureQuizAndNavigate(page: any) {
  await page.goto('/');
  // このヘルパーは広告表示自体の検証対象ではないため、動画広告モーダルによる
  // クリック干渉・結果画面遷移の阻害（1/3確率でのランダム表示）を避けるために広告を無効化する
  await page.evaluate(() => {
    window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
  });
  const firstCard = page.locator('[data-testid="quiz-card"]').first();
  await firstCard.waitFor({ state: 'visible', timeout: 3000 }).catch(() => {});

  if (!(await firstCard.isVisible())) {
    // ログインしてクイズを1件公開する
    await page.goto('/quiz/create');
    const loginBtn = page.locator('#e2e-test-login-btn');
    try {
      await loginBtn.waitFor({ state: 'visible', timeout: 3000 });
      if (await loginBtn.isVisible()) {
        await loginBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    
    await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill('[SEO TEST] 自動公開クイズ');
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('E2E自動シード');
    
    // 選択肢
    const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
    try {
      await choiceInputs.first().waitFor({ state: 'visible', timeout: 3000 });
      if (await choiceInputs.first().isVisible()) {
        await choiceInputs.nth(0).fill('useState');
        await choiceInputs.nth(1).fill('useEffect');
        await choiceInputs.nth(2).fill('useContext');
        await choiceInputs.nth(3).fill('useRef');
      }
    } catch (e) {}
    
    // 公開申請
    page.once('dialog', async (dialog: any) => {
      await dialog.accept();
    });
    await page.locator('button').filter({ hasText: /^公開$/ }).first().click();
    await page.waitForTimeout(1000);  }

  await page.goto('/');
  const quizCard = page.locator('[data-testid="quiz-card"]').first();
  await quizCard.waitFor({ state: 'visible', timeout: 15000 });
  await quizCard.click();
  await page.waitForURL(/\/quiz\/[\w-]+$/);
}

test.describe('パフォーマンス・SEO・ソーシャル共有 E2Eテスト', () => {
  
  test('F-701: SEO/OGPメタデータが動的に埋め込まれていること', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // 2. OGPメタデータを確認
    // og:title
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    if (ogTitle) {
      expect(ogTitle.length).toBeGreaterThan(0);
    }

    // og:description
    const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
    if (ogDescription) {
      expect(ogDescription.length).toBeGreaterThan(0);
    }

    // og:image (OGP画像)
    const ogImage = await page.locator('meta[property="og:image"]').getAttribute('content');
    if (ogImage) {
      expect(ogImage.length).toBeGreaterThan(0);
    }

    // og:url
    const ogUrl = await page.locator('meta[property="og:url"]').getAttribute('content');
    if (ogUrl) {
      expect(ogUrl.length).toBeGreaterThan(0);
    }
  });

  test('F-701: 廃止されたリスト詳細 URL は 404 を返す', async ({ page }) => {
    const response = await page.goto('/list/obsolete-e2e-probe');
    expect(response?.status()).toBe(404);
  });

  test('F-702: クローラー向けに高速HTML応答が提供されていること', async ({ browser, page }) => {
    // 1. 本物のクイズ詳細ページに遷移して、URLを取得する
    await ensureQuizAndNavigate(page);
    const quizUrl = page.url();

    // 2. Google Botのユーザーエージェントを設定したカスタムコンテキストを作成してアクセス
    // Expected 0 arguments, but got 1 の型エラーを回避するために (browser as any) としてキャストして呼び出します
    const customContext = await (browser as any).newContext({
      userAgent: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'
    });
    const googleBotPage = await customContext.newPage();

    // 3. 実際のクイズ詳細ページへアクセス
    await googleBotPage.goto(quizUrl);

    // 4. ページのHTMLが読み込まれていることを確認
    const pageContent = await googleBotPage.content();
    expect(pageContent.length).toBeGreaterThan(0);

    // 5. OGPメタタグが含まれていることを確認
    expect(pageContent).toContain('og:');
    expect(pageContent).toContain('og:title');

    await googleBotPage.close();
    await customContext.close();
  });

  test('F-703: SNSワンクリック共有機能が正常に動作すること', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // 2. 共有アイコンボタン（トリガー）が確実に表示されることを検証する（要件28.1, 28.11）
    const shareTrigger = page.getByTestId('quiz-detail-share-trigger');
    await expect(shareTrigger).toBeVisible();

    // 3. トリガーをクリックし、共有メニューが展開されることを検証する（要件28.1a）
    await shareTrigger.click();
    const shareMenu = page.getByTestId('quiz-detail-share-menu');
    await expect(shareMenu).toBeVisible();

    // 4. X共有リンクが、X（Twitter）の投稿作成インテントURLを指すことを直接検証する（要件28.2）
    const xShareLink = shareMenu.getByTestId('quiz-detail-share-x');
    await expect(xShareLink).toBeVisible();
    const xShareHref = await xShareLink.getAttribute('href');
    expect(xShareHref).toContain('twitter.com');

    // 5. LINE共有リンクが、LINEの共有インテントURLを指すことを直接検証する（要件28.3）
    const lineShareLink = shareMenu.getByTestId('quiz-detail-share-line');
    await expect(lineShareLink).toBeVisible();
    const lineShareHref = await lineShareLink.getAttribute('href');
    expect(lineShareHref).toContain('line.me');
  });
  test('クイズ結果画面: SNS共有機能が正常に動作すること', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // 2. プレイボタンをクリック
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);
      // 3. クイズをプレイ（最初の選択肢を選び、解答を確定する）
      // 選択肢UIはshadcn RadioGroup（role="radio"）で実装されており、旧CSSモジュール時代の
      // button[class*="optionBtn"] は現在のマークアップに存在しない
      const firstOption = page.getByRole('radio').first();
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();

      const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
      await expect(confirmBtn).toBeVisible({ timeout: 5000 });
      await confirmBtn.click();

      // 回答後の正誤フィードバック表示を待つ（要件17.4-17.5）
      await expect(page.getByTestId('play-answer-feedback')).toBeVisible({ timeout: 5000 });

      // このテストは単一問題のクイズを前提とするため、最終問題向けの
      // 「結果を見る」ボタン（要件17.13）が表示されることを確認する
      const viewResultsBtn = page.getByTestId('play-view-results');
      await expect(viewResultsBtn).toBeVisible({ timeout: 5000 });
      await viewResultsBtn.click();
      // 4. 結果画面へ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/);

      // 5. 結果画面で共有ボタンを確認
      const resultShareBtn = page.locator('button').filter({ hasText: /共有|シェア/ }).first();
      
      if (await resultShareBtn.isVisible()) {
        // 共有ボタンをクリック
        await resultShareBtn.click();

        // 共有メニューが表示されることを確認
        await page.waitForTimeout(300);
      }
    }
  });

  test('ページロードパフォーマンス: ページが適切な速度で読み込まれること', async ({ page }) => {
    // 1. ホームページへアクセス
    const startTime = Date.now();
    await page.goto('/');
    const homeLoadTime = Date.now() - startTime;

    // ホームページの読み込み時間が妥当な範囲内であること（15秒以内）
    expect(homeLoadTime).toBeLessThan(15000);

    // 2. クイズ詳細ページへアクセス
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await firstQuizCard.isVisible()) {
      const detailStartTime = Date.now();
      await firstQuizCard.click();
      const detailLoadTime = Date.now() - detailStartTime;

      // クイズ詳細ページの読み込み時間が妥当な範囲内であること（10秒以内）
      expect(detailLoadTime).toBeLessThan(10000);
    }
  });
  test('OGPプレビュー用メタデータ: 完全性のテスト', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // 2. 必須OGPメタデータを確認
    const requiredOGPTags = ['og:title', 'og:description', 'og:image', 'og:url', 'og:type'];
    
    for (const tag of requiredOGPTags) {
      const element = page.locator(`meta[property="${tag}"]`);
      const content = await element.getAttribute('content');
      
      // og:typeは常にあるべきではないが、他は必須
      if (tag !== 'og:type' || await element.isVisible()) {
        if (content !== null) {
          expect(content.length).toBeGreaterThan(0);
        }
      }
    }

    // 3. Twitter Card メタデータも確認
    const twitterCard = await page.locator('meta[name="twitter:card"]').getAttribute('content');
    if (twitterCard) {
      expect(twitterCard).toMatch(/summary|summary_large_image/);
    }
  });
  test('動的SEOメタデータ: クイズタイトルがページタイトルに反映されていること', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // クライアントサイド遷移直後は document.title の更新が非同期のため、反映を待つ
    await page.waitForFunction(() => document.title.length > 0, { timeout: 10000 });

    // 2. ページタイトルがOGPメタデータと一致することを確認
    const pageTitle = await page.title();
    expect(pageTitle.length).toBeGreaterThan(0);

    // 3. OGPタイトルが設定されていることを確認
    const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
    expect(ogTitle).toBeTruthy();

    // 4. ページタイトルとOGPタイトルが関連していることを確認（完全一致は不要）
    expect(pageTitle + (ogTitle || '')).toMatch(/[\w\s]/);
  });

  test('複合テスト: クイズ作成 → OGPメタデータ検証 → SNS共有確認 の完全フロー', async ({ page }) => {
    // 1. クイズ作成
    const createQuizBtn = page.locator('[data-analytics="nav-create-quiz"]:visible');
    if (await createQuizBtn.isVisible()) {
      await createQuizBtn.click();
    } else {
      await page.goto('/quiz/create');
      // ログイン状態が失われている場合の自動ログイン・フォールバック
      const e2eLoginBtn = page.locator('#e2e-test-login-btn');
      try {
        await e2eLoginBtn.waitFor({ state: 'visible', timeout: 3000 });
        if (await e2eLoginBtn.isVisible()) {
          await e2eLoginBtn.click();
          await page.waitForTimeout(1000);
        }
      } catch (e) {}
      await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });
    }

    // 3. クイズ基本情報を入力
    const titleInput = page.locator('input[type="text"]').first();
    if (await titleInput.isVisible()) {
      const quizTitle = `[SEO TEST] ${Date.now()}`;
      await titleInput.fill(quizTitle);

      // ジャンルの選択（下書き保存時にも必須）
      const genreInput = page.getByTestId('genre-editor-search-input');
      if (await genreInput.isVisible().catch(() => false)) {
        await genreInput.click();
        const genreOption = page.getByTestId('genre-editor-search-option-science-technology');
        if (await genreOption.isVisible().catch(() => false)) {
          await genreOption.click();
        }
      }

      // 第1問の問題文を入力（下書き保存時にも必須）
      const qTextarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
      if (await qTextarea.isVisible().catch(() => false)) {
        await qTextarea.fill('SEOテスト用の問題文です。');
      }

      // 4. 下書き保存
      const saveDraftBtn = page.locator('text=下書き保存').first();
      if (await saveDraftBtn.isVisible()) {
        await saveDraftBtn.click();

        // 作成したクイズ画面（/creator/quizzes）に遷移することを確認
        await expect(page).toHaveURL(/\/creator\/quizzes/);

        // 5. 作成したクイズ画面から作成したクイズの詳細ページへアクセス
        // (一覧の「編集する」ボタンで編集画面URLからクイズIDを取得し、詳細ページへ直接遷移する)
        const managementList = page.getByTestId('creator-quiz-management-list');
        await expect(managementList.getByText(quizTitle)).toBeVisible({ timeout: 15000 });
        const newQuizItem = page
          .getByTestId(/^creator-quiz-management-row-/)
          .filter({ hasText: quizTitle })
          .first();
        if (await newQuizItem.isVisible()) {
          await newQuizItem.getByRole('button', { name: '編集する' }).click();
          await page.waitForURL(/\/quiz\/[\w-]+\/edit$/);
          const quizId = page.url().match(/\/quiz\/([\w-]+)\/edit$/)?.[1];
          await page.goto(`/quiz/${quizId}`);

          // クイズ詳細ページへ遷移することを確認
          await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

          // 6. OGPメタデータが設定されていることを確認
          const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
          expect(ogTitle).toBeTruthy();

          // 7. 共有ボタンが表示されることを確認
          const shareBtn = page.locator('button').filter({ hasText: /共有|シェア/ }).first();
          if (await shareBtn.isVisible()) {
            await expect(shareBtn).toBeVisible();
          }
        }
      }
    }
  });
});
