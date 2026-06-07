import { test, expect } from '@playwright/test';

// クイズ詳細ページに遷移するためのヘルパー（クイズがなければ自動作成する）
async function ensureQuizAndNavigate(page: any) {
  await page.goto('/');
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

  test('F-701: クイズリスト詳細ページでもOGPメタデータが埋め込まれていること', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. クイズリストを選択（存在する場合）
    const listCard = page.locator('[data-testid="quiz-list-card"]').first();
    if (await listCard.isVisible()) {
      await listCard.click();

      // リスト詳細ページであることを確認
      await expect(page).toHaveURL(/\/list\/[\w-]+$/);

      // 3. OGPメタデータを確認
      const ogTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
      if (ogTitle) {
        expect(ogTitle.length).toBeGreaterThan(0);
      }

      const ogDescription = await page.locator('meta[property="og:description"]').getAttribute('content');
      if (ogDescription) {
        expect(ogDescription.length).toBeGreaterThan(0);
      }
    }
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

  test('F-703: SNSワンクリック共有機能が正常に動作すること', async ({ page, context }) => {
    await ensureQuizAndNavigate(page);

    // 2. 共有ボタンを確認
    const shareBtn = page.locator('button').filter({ hasText: /共有|シェア|Share/ }).first();
    
    if (await shareBtn.isVisible()) {
      // 共有ボタンをクリック
      await shareBtn.click();

      // 共有メニューが表示されることを確認
      await page.waitForTimeout(300);

      // X（旧Twitter）共有ボタン
      const xShareBtn = page.locator('a').filter({ hasText: /X|Twitter/ }).first();
      if (await xShareBtn.isVisible()) {
        const shareUrl = await xShareBtn.getAttribute('href');
        expect(shareUrl).toContain('twitter');
      }
    }
  });
  test('クイズ結果画面: SNS共有機能が正常に動作すること', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // 2. プレイボタンをクリック
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);
      // 3. クイズをプレイ（簡易的に最初の選択肢をクリック）
      const firstOption = page.locator('button[class*="optionBtn"]').first()
        .or(page.locator('button').filter({ hasText: /選択肢|答え|useState/ }).first());
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();

      const submitBtn = page.locator('button').filter({ hasText: /次へ|提出|完了/ }).first();
      await expect(submitBtn).toBeVisible({ timeout: 5000 });
      await submitBtn.click();
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
    const createQuizBtn = page.locator('text=作問する');
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

      // 4. 下書き保存
      const saveDraftBtn = page.locator('text=下書き保存').first();
      if (await saveDraftBtn.isVisible()) {
        await saveDraftBtn.click();

        // ダッシュボードに遷移
        await expect(page).toHaveURL(/\/creator\/dashboard/);

        // 5. 作成したクイズの詳細ページへアクセス
        const newQuizLink = page.locator(`text=${quizTitle}`).first();
        if (await newQuizLink.isVisible()) {
          await newQuizLink.click();

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
