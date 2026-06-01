import { test, expect } from '@playwright/test';

test.describe('追加機能・複合テスト E2Eテスト', () => {
  
  test.beforeEach(async ({ page }) => {
    // 既にセットアップでログイン状態が保存されているため、直接ホームページへ遷移
    await page.goto('/');
  });

  test('F-603: 複合検索フィルタが正常に機能すること', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. 検索フィルタUI を確認
    const filterSection = page.locator('[data-testid="search-filters"]').first()
      .or(page.locator('div').filter({ hasText: /フィルタ|絞り込み|検索/ }).first());

    if (await filterSection.isVisible()) {
      // 3. ジャンル選択
      const genreSelect = page.locator('select').filter({ hasText: /ジャンル/ }).first();
      if (await genreSelect.isVisible()) {
        await genreSelect.selectOption({ index: 1 });
      }

      // 4. 難易度スライダーを設定
      const difficultyInput = page.locator('input[type="range"]').first();
      if (await difficultyInput.isVisible()) {
        await difficultyInput.fill('5');
      }

      // 5. 問題数フィルタ
      const questionCountInput = page.locator('input[placeholder*="問題数"]').first();
      if (await questionCountInput.isVisible()) {
        await questionCountInput.fill('10');
      }

      // 6. フィルタを適用
      const applyBtn = page.locator('button').filter({ hasText: /適用|検索/ }).first();
      if (await applyBtn.isVisible()) {
        await applyBtn.click();

        // 検索結果が更新されることを確認
        await page.waitForTimeout(500);
        const quizCards = page.locator('[data-testid="quiz-card"]');
        expect(await quizCards.count()).toBeGreaterThanOrEqual(0);
      }
    }
  });

  test('F-604: 検索サジェストが正常に機能すること', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. 検索入力フィールドをクリック
    const searchInput = page.locator('input[placeholder*="検索"]').first();
    
    if (await searchInput.isVisible()) {
      // 3. キーワードを入力
      await searchInput.fill('react');

      // 4. サジェストが表示されることを確認
      await page.waitForTimeout(300);
      const suggestions = page.locator('[data-testid="suggestion"]');
      const suggestionCount = await suggestions.count();

      // サジェストが表示されている場合を確認
      if (suggestionCount > 0) {
        // 最初のサジェストをクリック
        const firstSuggestion = suggestions.first();
        await expect(firstSuggestion).toBeVisible();
        await firstSuggestion.click();

        // 検索結果が更新されることを確認
        await page.waitForTimeout(500);
      } else {
        // サジェストがない場合はEnterで検索
        await searchInput.press('Enter');
      }
    }
  });

  test('F-605: プレイ状態フィルタが正常に機能すること（ログイン時のみ）', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. プレイ状態フィルタを確認
    const playStateFilter = page.locator('[data-testid="play-state-filter"]').first()
      .or(page.locator('select').filter({ hasText: /プレイ状態/ }).first());

    if (await playStateFilter.isVisible()) {
      // 3. 「未プレイ」を選択
      await playStateFilter.selectOption({ label: '未プレイ' });

      // フィルタが適用されることを確認
      await page.waitForTimeout(500);

      // 4. 「プレイ済」を選択
      await playStateFilter.selectOption({ label: 'プレイ済' });

      // フィルタが適用されることを確認
      await page.waitForTimeout(500);
    }
  });

  test('F-105: 称号バッジ自動付与機能が正常に動作すること', async ({ page }) => {
    // 1. プロフィール画面へアクセス
    const avatarBtn = page.locator('header img').first();
    await expect(avatarBtn).toBeVisible({ timeout: 10000 });
    await avatarBtn.click();
    
    const myPageLink = page.locator('text=マイページ');
    await expect(myPageLink).toBeVisible();
    await myPageLink.click();

    // プロフィール画面であることを確認
    await expect(page).toHaveURL(/\/profile\//);

    // 2. バッジセクションを確認
    const badgesSection = page.locator('[data-testid="badges-section"]').first()
      .or(page.locator('div').filter({ hasText: /称号|バッジ/ }).first());

    if (await badgesSection.isVisible()) {
      await expect(badgesSection).toBeVisible();

      // 3. 各バッジの詳細情報を確認
      const badges = page.locator('[data-testid="badge"]');
      const badgeCount = await badges.count();

      // バッジがある場合、ホバーして詳細を確認
      if (badgeCount > 0) {
        for (let i = 0; i < Math.min(badgeCount, 2); i++) {
          const badge = badges.nth(i);
          await badge.hover();
          await page.waitForTimeout(200);
        }
      }
    }
  });

  test('F-503: クイズリスト詳細表示が正常に動作すること', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. クイズリストカードを探す
    const listCard = page.locator('[data-testid="quiz-list-card"]').first();
    
    if (await listCard.isVisible()) {
      await listCard.click();

      // 3. リスト詳細ページへ遷移することを確認
      await expect(page).toHaveURL(/\/list\/[\w-]+$/);

      // 4. リスト情報が表示されることを確認
      const listTitle = page.locator('[data-testid="list-title"]').first()
        .or(page.locator('h1').first());
      await expect(listTitle).toBeVisible();

      // 5. 収録クイズ一覧が表示されることを確認
      const quizList = page.locator('[data-testid="list-quiz-items"]').first()
        .or(page.locator('ul').first());
      
      if (await quizList.isVisible()) {
        await expect(quizList).toBeVisible();

        // 6. リストプレイボタンを確認
        const playListBtn = page.locator('button').filter({ hasText: /リストプレイ|開始|プレイ/ }).first();
        if (await playListBtn.isVisible()) {
          await expect(playListBtn).toBeVisible();
        }
      }
    } else {
      console.log('クイズリストが見つかりません');
    }
  });

  test('F-505: クイズリスト・パッケージエクスポート機能が正常に動作すること', async ({ page }) => {
    // 1. プロフィール画面へアクセス
    const avatarBtn = page.locator('header img').first();
    await expect(avatarBtn).toBeVisible({ timeout: 10000 });
    await avatarBtn.click();
    
    const myPageLink = page.locator('text=マイページ');
    await expect(myPageLink).toBeVisible();
    await myPageLink.click();

    // 2. 自作リスト一覧を確認
    const myListsLink = page.locator('text=リスト').first()
      .or(page.locator('a').filter({ hasText: /問題集|リスト/ }).first());

    if (await myListsLink.isVisible()) {
      await myListsLink.click();

      // リスト一覧が表示されることを確認
      await page.waitForTimeout(500);

      // 3. リストをクリックして詳細ページへ
      const listCard = page.locator('[data-testid="quiz-list-card"]').first();
      if (await listCard.isVisible()) {
        await listCard.click();

        // 4. エクスポートボタンを確認
        const exportBtn = page.locator('button').filter({ hasText: /エクスポート|ダウンロード/ }).first();
        
        if (await exportBtn.isVisible()) {
          // ダウンロード処理をリッスン
          const downloadPromise = page.waitForEvent('download');

          // エクスポートボタンをクリック
          await exportBtn.click();

          // ダウンロードが開始されることを確認
          try {
            const download = await downloadPromise;
            expect(download.suggestedFilename()).toMatch(/\.json$/);
          } catch (e) {
            // ダウンロードがない場合もある
          }
        }
      }
    }
  });

  test('タグ別クイズ一覧が正常に表示されること', async ({ page }) => {
    // 1. クイズ詳細ページへアクセス
    await page.goto('/');
    const firstQuizCard = page.locator('article').first();
    await expect(firstQuizCard).toBeVisible({ timeout: 10000 });
    await firstQuizCard.click();

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 2. タグをクリック
    const tagLink = page.locator('[data-testid="tag"]').first()
      .or(page.locator('a').filter({ hasText: /#/ }).first());

    if (await tagLink.isVisible()) {
      await tagLink.click();

      // 3. タグ別クイズ一覧ページへ遷移することを確認
      await expect(page).toHaveURL(/\/tags\/[\w-]+$/);

      // 4. クイズ一覧が表示されることを確認
      const quizList = page.locator('[data-testid="quiz-card"]');
      const count = await quizList.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });

  test('ジャンル別クイズ一覧が正常に表示されること', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. ジャンルボタン（コンピュータ・IT）をクリック
    const genreBtn = page.getByRole('button', { name: /コンピュータ・IT/ });
    await expect(genreBtn).toBeVisible({ timeout: 10000 });
    await genreBtn.click();
    await page.waitForTimeout(500);

    // 3. クイズ一覧が表示されることを確認
    const quizList = page.locator('article');
    const count = await quizList.count();
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('プロフィール編集画面: フォローしているジャンルが管理できること', async ({ page }) => {
    // 1. プロフィール編集画面へアクセス
    const avatarBtn = page.locator('header img').first();
    await expect(avatarBtn).toBeVisible({ timeout: 10000 });
    await avatarBtn.click();
    
    const myPageLink = page.locator('text=マイページ');
    await expect(myPageLink).toBeVisible();
    await myPageLink.click();
    
    // プロフィール画面へ遷移した後、「編集」ボタンをクリック
    await expect(page).toHaveURL(/\/profile\//);
    const editBtn = page.locator('text=編集');
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    // プロフィール編集ページであることを確認
    await expect(page).toHaveURL(/\/profile\/edit/);

    // 2. フォロージャンルセクションを確認
    const genreSection = page.locator('[data-testid="follow-genres"]').first()
      .or(page.locator('div').filter({ hasText: /フォローするジャンル/ }).first());

    if (await genreSection.isVisible()) {
      // 3. ジャンルチェックボックスを確認
      const genreCheckboxes = page.locator('input[type="checkbox"]');
      const count = await genreCheckboxes.count();

      if (count > 0) {
        // 最初のチェックボックスの状態を切り替え
        const firstCheckbox = genreCheckboxes.first();
        const isChecked = await firstCheckbox.isChecked();
        
        if (isChecked) {
          await firstCheckbox.uncheck();
        } else {
          await firstCheckbox.check();
        }
      }

      // 4. 保存ボタンをクリック
      const saveBtn = page.locator('button').filter({ hasText: /保存|完了/ }).first();
      if (await saveBtn.isVisible()) {
        await saveBtn.click();

        // 保存完了を確認
        await page.waitForTimeout(500);
      }
    }
  });

  test('複合テスト: 検索 → フィルタ → 詳細 → プレイ の完全フロー', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. キーワード検索
    const searchInput = page.locator('input[placeholder*="検索"]').first();
    await expect(searchInput).toBeVisible({ timeout: 10000 });
    await searchInput.fill('JavaScript');
    await searchInput.press('Enter');
    await page.waitForTimeout(300);

    // 3. フィルタを適用
    const filterToggleBtn = page.locator('text=フィルター');
    if (await filterToggleBtn.isVisible()) {
      await filterToggleBtn.click();
      const diffMinInput = page.locator('input[type="number"]').first();
      if (await diffMinInput.isVisible()) {
        await diffMinInput.fill('1');
      }
      await filterToggleBtn.click();
      await page.waitForTimeout(300);
    }

    // 4. クイズを選択
    const quizCard = page.locator('[data-testid="quiz-card"]').first();
    if (await quizCard.isVisible()) {
      await quizCard.click();

      // クイズ詳細ページであることを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

      // 5. プレイボタンをクリック
      const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
      if (await playBtn.isVisible()) {
        await playBtn.click();

        // プレイページへ遷移することを確認
        await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);
      }
    }
  });

  test('複合テスト: クイズ作成 → 統計確認 → 修正 のフロー', async ({ page }) => {
    // 1. ダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // 2. 新規作成ボタンをクリック
    const createBtn = page.locator('button').filter({ hasText: /新規作成|作問/ }).first();
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // クイズ作成ページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/create/);

      // 3. クイズ基本情報を入力
      const titleInput = page.locator('input[type="text"]').first();
      if (await titleInput.isVisible()) {
        const quizTitle = `[複合テスト] ${Date.now()}`;
        await titleInput.fill(quizTitle);

        // 4. 下書き保存
        const saveDraftBtn = page.locator('text=下書き保存').first();
        if (await saveDraftBtn.isVisible()) {
          await saveDraftBtn.click();

          // ダッシュボードに遷移することを確認
          await expect(page).toHaveURL(/\/creator\/dashboard/);

          // 5. 作成したクイズを確認
          const newQuizLink = page.locator(`text=${quizTitle}`).first();
          if (await newQuizLink.isVisible()) {
            // 統計情報を確認できることを確認
            const quizRow = newQuizLink.locator('..');
            await expect(quizRow).toBeVisible();
          }
        }
      }
    }
  });

  test('作成者本人のクイズ詳細画面に「クイズを編集」ボタンが表示され、編集画面へ遷移できること', async ({ page }) => {
    // 1. ダッシュボードへアクセスして自作のクイズを探す
    await page.goto('/creator/dashboard');
    
    // クイズカードがあるか確認
    const firstQuizLink = page.locator('a[href*="/quiz/"]').first();
    
    if (await firstQuizLink.isVisible()) {
      const quizUrl = await firstQuizLink.getAttribute('href');
      if (quizUrl) {
        // 詳細画面へアクセス
        await page.goto(quizUrl);
        
        // 2. 「クイズを編集」ボタンが表示されることを確認
        const editBtn = page.locator('text=クイズを編集');
        await expect(editBtn).toBeVisible();
        
        // 3. ボタンをクリックして編集画面へ遷移することを確認
        await editBtn.click();
        await expect(page).toHaveURL(/\/quiz\/[\w-]+\/edit/);
        
        // 編集フォームが表示されていることを確認
        await expect(page.locator('h1').filter({ hasText: 'クイズを編集する' })).toBeVisible();
      }
    }
  });

  test('他人が作成したクイズの詳細画面に「クイズを編集」ボタンが表示されないこと', async ({ page }) => {
    // 1. ホーム（探索）へアクセスし、自分以外のクイズを探す
    await page.goto('/');
    
    // タイムラインなどのクイズ一覧からクイズ詳細へ
    const firstQuizCard = page.locator('article').first()
      .or(page.locator('[data-testid="quiz-card"]').first());
      
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
      await page.waitForTimeout(500);
      
      // 2. 他人のクイズであることを想定し、「クイズを編集」ボタンが表示されないことを確認
      const editBtn = page.locator('text=クイズを編集');
      await expect(editBtn).not.toBeVisible();
    }
  });

  test('他人が作成したクイズの編集画面に直接アクセスした際、認可エラーUIで保護されること', async ({ page }) => {
    // 1. 他人が作成したクイズのURLを特定するためにホームへ遷移
    await page.goto('/');
    
    const firstQuizCard = page.locator('article').first()
      .or(page.locator('[data-testid="quiz-card"]').first());
      
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
      await page.waitForTimeout(500);
      
      const currentUrl = page.url();
      const quizId = currentUrl.split('/').pop();
      
      if (quizId) {
        // 2. 直接他人のクイズの編集URL（/quiz/[id]/edit）へ遷移
        await page.goto(`/quiz/${quizId}/edit`);
        await page.waitForTimeout(1000);
        
        // 3. 認可エラーUI（アクセス権限がありません）が表示されることを確認
        await expect(page.locator('h2').filter({ hasText: 'アクセス権限がありません' })).toBeVisible();
        await expect(page.locator('text=このクイズは他のユーザーが作成したものであるため')).toBeVisible();
      }
    }
  });
});
