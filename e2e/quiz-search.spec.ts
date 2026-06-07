import { test, expect } from '@playwright/test';

/**
 * クイズ検索・探索機能 E2Eテスト
 *
 * 注意: FirebaseはWebSocket永続接続を使用するため、
 * page.waitForLoadState('networkidle') は使用不可。
 * 代わりに 'domcontentloaded' または特定の要素の可視性で待機する。
 */
test.describe('クイズ検索・探索機能 E2Eテスト', () => {

  test('ホームページでのクイズ一覧表示・タブ切り替えおよびキーワード検索が機能すること', async ({ page }) => {
    // 1. ホームページにアクセス
    await page.goto('/');
    
    // DOM読み込み完了まで待機（networkidleはFirebaseで使用不可）
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible({ timeout: 5000 });
    await expect(page.getByTestId('explore-accordion-genre')).toBeVisible();
    await expect(page.getByTestId('explore-accordion-format')).toBeVisible();

    // フィードのロード完了を待つ
    await expect(page.getByTestId('home-feed-skeleton')).toBeHidden({ timeout: 15000 });
    
    // 2. 「人気順」タブに切り替える
    const popularTab = page.locator('text=人気順');
    await expect(popularTab).toBeVisible();
    await popularTab.click();
    await page.waitForTimeout(1000);
    
    // 3. 「トレンド」タブに切り替える
    const trendTab = page.locator('text=トレンド');
    await expect(trendTab).toBeVisible();
    await trendTab.click();
    await page.waitForTimeout(500);
    
    // 4. 「新着順」タブに戻す
    const latestTab = page.locator('text=新着順');
    await expect(latestTab).toBeVisible();
    await latestTab.click();
    await page.waitForTimeout(500);
    
    // 5. キーワード検索の動作確認（実在しないキーワードで検索）
    await searchInput.fill('存在しないテスト用クイズXYZ');
    await page.waitForTimeout(500);
    
    // 検索結果が「見つかりません」表示になることを確認
    await expect(page.locator('text=該当するクイズが見つかりませんでした。')).toBeVisible({ timeout: 5000 });
    
    // 6. 検索クリア
    await searchInput.fill('');
    await page.waitForTimeout(500);
    
    // 7. 複合検索フィルターパネルの開閉確認
    const filterToggleBtn = page.locator('text=フィルター');
    await expect(filterToggleBtn).toBeVisible();
    await filterToggleBtn.click();
    
    // フィルターパネルが表示されることを確認
    await expect(page.locator('text=難易度範囲 (1 - 10)').first()).toBeVisible();
    await expect(page.locator('text=問題数').first()).toBeVisible();
    await expect(page.locator('text=プレイ状況').first()).toBeVisible();
    
    // 8. 難易度の絞り込みを設定
    const diffMinInput = page.locator('input[type="number"]').first();
    const diffMaxInput = page.locator('input[type="number"]').nth(1);
    await diffMinInput.fill('3');
    await diffMaxInput.fill('7');
    
    // フィルターパネルを閉じる
    await filterToggleBtn.click();
    
    // 9. ジャンルアコーディオン・カルーセル絞り込み（/genres へ遷移しない）
    const genreAccordion = page.getByTestId('explore-accordion-genre');
    await expect(genreAccordion).toBeVisible({ timeout: 10000 });
    await genreAccordion.click();
    await page.waitForTimeout(300);

    const programmingGenreCard = page.getByTestId('genre-carousel-card-programming');
    if (await programmingGenreCard.count()) {
      await programmingGenreCard.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL('/');
      await programmingGenreCard.click();
    }

    // 10. 出題形式アコーディオン
    const formatAccordion = page.getByTestId('explore-accordion-format');
    await expect(formatAccordion).toBeVisible();
    await formatAccordion.click();
    await page.waitForTimeout(300);

    const formatCard = page.locator('[data-testid^="format-carousel-card-"]').first();
    if (await formatCard.count()) {
      await formatCard.click();
      await page.waitForTimeout(500);
      await expect(page).toHaveURL('/');
      await formatCard.click();
    }
  });

  test('クイックサーチチップでタグチップが追加されカードに ★ 難易度が表示されること', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });

    const quickChip = page.getByRole('button', { name: '#ウミガメのスープ' });
    await quickChip.click();
    await page.waitForTimeout(400);

    await expect(page.locator('[data-testid="search-tag-chip"]').first()).toBeVisible({ timeout: 5000 });

    const difficulty = page.locator('[data-testid="quiz-card-difficulty"]').first();
    if (await difficulty.count()) {
      await expect(difficulty).toContainText('★');
    }
  });

  test('クイズ一覧の各公開クイズカードが詳細ページへ遷移できること', async ({ page }) => {
    // 1. ホームページにアクセス
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');
    
    // 2. ページタイトルが設定されていることを確認
    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible({ timeout: 15000 });
    
    const pageTitle = await page.title();
    expect(pageTitle.length).toBeGreaterThan(0);
    
    // 3. クイズカードが存在する場合、最初のカードをクリックして詳細ページへ遷移することを確認
    const quizCard = page.locator('[data-testid="quiz-card"]').first();
    const hasCards = await quizCard.count();
    
    if (hasCards > 0) {
      await quizCard.click();
      // クイズ詳細ページへ遷移したことを確認
      await expect(page).toHaveURL(/\/quiz\//);
      await page.waitForLoadState('domcontentloaded');
      // 詳細ページにコンテンツが表示されることを確認
      await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });
    }
    // クイズが存在しない場合はスキップ（開発環境データなし時）
  });

  test('フォローしたユーザーのタイムラインがログイン後に表示できること', async ({ page }) => {
    // 1. ログインページへ遷移
    await page.goto('/login');
    await page.waitForLoadState('domcontentloaded');
    
    // AuthContextのロード時間を考慮した待機
    await page.waitForTimeout(3000);
    
    // 2. 現在のURLを確認
    const currentUrl = page.url();
    
    if (currentUrl.includes('/login')) {
      // 未ログイン状態: E2Eテスト用ログインボタンをクリック
      // 認証セットアップには、事前の認証処理を使用してください
      await page.goto('/');
      
      // 現在の状態で私的な検索タブの出現を待機
      // ログイン&リダイレクト成功を確認する。
      const timelineTab = page.locator('text=フォローTL');
      await expect(timelineTab).toBeVisible({ timeout: 30000 });
      await timelineTab.click();
    } else {
      // 既にログイン済みの場合: そのままホームへ遷移
      await page.goto('/');
      await page.waitForLoadState('domcontentloaded');
      
      const timelineTab = page.locator('text=フォローTL');
      await expect(timelineTab).toBeVisible({ timeout: 15000 });
      await timelineTab.click();
    }
    
    // 3. タイムラインが表示されること（フォローしているユーザーがいない場合は空表示でも可）
    await page.waitForTimeout(1000);
    const contentArea = page.locator('section').last();
    await expect(contentArea).toBeVisible();
  });

  test('ジャンルページで scoped 検索 UI が表示され形式フィルタで絞り込めること', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('domcontentloaded');

    const genreAccordion = page.getByTestId('explore-accordion-genre');
    await expect(genreAccordion).toBeVisible({ timeout: 15000 });
    await genreAccordion.click();

    const programmingCard = page.getByTestId('genre-carousel-card-programming');
    if (!(await programmingCard.count())) {
      test.skip();
      return;
    }

    await page.goto('/genres/programming');
    await page.waitForLoadState('domcontentloaded');

    // ロード中スケルトンが消えるのを待つ
    await expect(page.getByTestId('explore-list-skeleton')).toBeHidden({ timeout: 15000 });

    await expect(page.getByTestId('genre-explore-page')).toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('genre-explore-search')).toBeVisible();

    const filterToggleBtn = page.getByRole('button', { name: 'フィルター' });
    await filterToggleBtn.click();
    await expect(page.locator('text=難易度範囲 (1 - 10)')).toBeVisible();
    await expect(page.locator('text=ジャンル')).toHaveCount(0);

    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await searchInput.fill('存在しないscoped検索XYZ');
    await page.waitForTimeout(600);
    await expect(page.locator('text=該当するクイズがありませんでした。')).toBeVisible({ timeout: 8000 });
  });
});
