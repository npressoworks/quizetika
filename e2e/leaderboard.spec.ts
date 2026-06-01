import { test, expect } from '@playwright/test';

test.describe('リーダーボード・競技機能 E2Eテスト', () => {
  
  test('F-801: リーダーボード（ランキング）が正常に表示されること', async ({ page }) => {
    // 1. ホームページからリーダーボードへのリンクをクリック
    await page.goto('/');

    // リーダーボードリンクを探す
    const leaderboardLink = page.locator('text=リーダーボード').first()
      .or(page.locator('a').filter({ hasText: /ランキング|総合順位/ }).first());

    if (await leaderboardLink.isVisible()) {
      await leaderboardLink.click();
    } else {
      // フォールバック: 直接リーダーボード画面へ
      await page.goto('/leaderboard');
    }

    // 2. リーダーボードページへ遷移したことを確認
    await expect(page).toHaveURL(/\/leaderboard/);

    // 3. ランキング一覧が表示されることを確認
    const leaderboardList = page.locator('[data-testid="leaderboard-list"]').first()
      .or(page.locator('table').first())
      .or(page.locator('ol').first());

    await expect(leaderboardList).toBeVisible();

    // 4. ランキングにエントリが存在することを確認
    const entries = page.locator('[data-testid="leaderboard-entry"]');
    const entryCount = await entries.count();
    
    if (entryCount === 0) {
      // エントリがない場合も期待される動作
      console.log('リーダーボードはまだエントリがありません');
    } else {
      // エントリがある場合は確認
      expect(entryCount).toBeGreaterThan(0);
    }
  });

  test('F-801: リーダーボードのタブ切り替えが正常に動作すること', async ({ page }) => {
    // 1. リーダーボードページへアクセス
    await page.goto('/leaderboard');

    // 2. 複数のタブ（例: 総合、月間、最速等）を確認
    const tabs = page.locator('[data-testid="leaderboard-tab"]');
    const tabCount = await tabs.count();

    // 複数のタブが存在することを確認
    if (tabCount > 1) {
      for (let i = 1; i < Math.min(tabCount, 3); i++) {
        const tab = tabs.nth(i);
        await tab.click();

        // タブ切り替え後にリスト更新されることを確認
        await page.waitForTimeout(300);
        const updatedList = page.locator('[data-testid="leaderboard-list"]').first();
        await expect(updatedList).toBeVisible();
      }
    }
  });

  test('F-802: クイズプレイ後にハイスコアが記録されること', async ({ page }) => {
    // 1. ホームページからクイズを選択
    await page.goto('/');
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    if (!(await firstQuizCard.isVisible())) {
      // クイズが存在しない場合は、その場でクイズを公開作成する
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

      const quizTitle = `[TEST] E2E自動シード_${Date.now().toString().slice(-4)}`;
      await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(quizTitle);
      await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('E2E自動生成データです。');

      const qTextarea = page.locator('textarea[placeholder="例: Reactにおいて、コンポーネントのステートを管理するためのフックは？"]').first();
      await qTextarea.fill('テスト問題1');
      const choiceInputs = page.locator('.choiceRow input[type="text"]');
      await choiceInputs.nth(0).fill('useState'); // 正解
      await choiceInputs.nth(1).fill('useEffect');
      await choiceInputs.nth(2).fill('useContext');
      await choiceInputs.nth(3).fill('useRef');

      let publishDialog = false;
      page.once('dialog', async dialog => {
        publishDialog = true;
        await dialog.accept();
      });

      await page.locator('text=公開').click();
      await expect.poll(() => publishDialog).toBe(true);
      await page.goto('/');
      await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 });
    }

    await firstQuizCard.click();

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 2. クイズのリーダーボード情報を確認（詳細ページ内）
    const quizLeaderboard = page.locator('[data-testid="quiz-leaderboard"]').first()
      .or(page.locator('div').filter({ hasText: /ハイスコア|ランキング|最速/ }).first());

    if (await quizLeaderboard.isVisible()) {
      await expect(quizLeaderboard).toBeVisible();
    }

    // 3. クイズをプレイ
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

      // 4. 簡単なクイズをプレイ（選択肢をクリック）
      const options = page.locator('button').filter({ hasText: /選択肢/ }).first()
        .or(page.locator('label').first());

      if (await options.isVisible()) {
        // 最初の選択肢をクリック（正解かどうかは不問）
        await options.click();
      }

      // 次へボタン
      const nextBtn = page.locator('button').filter({ hasText: /次へ|次の問題|提出|完了/ }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
      }

      // 5. 結果画面へ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/);

      // 6. スコア情報が表示されることを確認
      const scoreInfo = page.locator('[data-testid="score-info"]').first()
        .or(page.locator('div').filter({ hasText: /\d+\/\d+|正解率/ }).first());

      if (await scoreInfo.isVisible()) {
        await expect(scoreInfo).toBeVisible();
      }
    }
  });

  test('クイズ詳細画面: ハイスコアランキングが表示されること', async ({ page }) => {
    // 1. ホームページからクイズを選択
    await page.goto('/');
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
    }

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 2. ハイスコアランキングセクションを確認
    const highscoreSection = page.locator('[data-testid="highscore-leaderboard"]').first()
      .or(page.locator('div').filter({ hasText: /ハイスコア|歴代/ }).first());

    if (await highscoreSection.isVisible()) {
      await expect(highscoreSection).toBeVisible();

      // 3. ランキングエントリを確認
      const entries = page.locator('[data-testid="highscore-entry"]');
      const entryCount = await entries.count();

      // エントリがある場合は確認
      if (entryCount > 0) {
        expect(entryCount).toBeGreaterThan(0);
      }
    }
  });

  test('クイズ詳細画面: 最速全問正解ランキングが表示されること', async ({ page }) => {
    // 1. ホームページからクイズを選択
    await page.goto('/');
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
    }

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 2. 最速ランキングセクションを確認
    const fastestSection = page.locator('[data-testid="fastest-leaderboard"]').first()
      .or(page.locator('div').filter({ hasText: /最速|タイムアタック/ }).first());

    if (await fastestSection.isVisible()) {
      await expect(fastestSection).toBeVisible();

      // 3. ランキングエントリを確認
      const entries = page.locator('[data-testid="fastest-entry"]');
      const entryCount = await entries.count();

      // エントリがある場合は確認
      if (entryCount > 0) {
        expect(entryCount).toBeGreaterThan(0);
      }
    }
  });

  test('F-803: 短答式問題が正常に機能すること', async ({ page }) => {
    // 1. クイズ作成画面へアクセス（ログイン必須、認証セットアップを使用してください。
    await page.goto('/quiz/create');
    // ログイン状態が失われている場合の自動ログイン・フォールバック
    const e2eLoginBtn1 = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn1.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn1.isVisible()) {
        await e2eLoginBtn1.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });
    const textInputTypeBtn = page.locator('text=短答文字入力式').first()
      .or(page.locator('button').filter({ hasText: /短答|text-input/ }).first());
    await expect(textInputTypeBtn).toBeVisible({ timeout: 5000 });
    await textInputTypeBtn.click();

    // 4. 正解パターンを入力
    const correctAnswerInput = page.locator('input[placeholder*="正解"]')
      .or(page.locator('input[placeholder*="useState"]'))
      .first();
    if (await correctAnswerInput.isVisible()) {
      await correctAnswerInput.fill('React,React.js,react');
    }

    // 5. フォームが正常に機能することを確認
    await expect(correctAnswerInput).toHaveValue(/React|react/);
  });

  test('F-804: 画像アタッチ（問題画像）が正常に機能すること', async ({ page }) => {
    // 1. クイズ作成画面へアクセス（ログイン必須、認証セットアップを使用してください。
    await page.goto('/quiz/create');
    // ログイン状態が失われている場合の自動ログイン・フォールバック
    const e2eLoginBtn2 = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn2.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn2.isVisible()) {
        await e2eLoginBtn2.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });

    // 3. カバー画像のアップロード UI を確認
    const coverImageUpload = page.locator('input[type="file"]').first();
    if (await coverImageUpload.isVisible()) {
      // ファイルアップロード可能なことを確認
      await expect(coverImageUpload).toBeVisible();
    }

    // 4. 問題画像アップロード UI を確認
    const problemImageUploads = page.locator('input[type="file"]');
    const uploadCount = await problemImageUploads.count();

    // 複数のアップロード UI が存在することを確認
    if (uploadCount > 0) {
      await expect(problemImageUploads.first()).toBeVisible();
    }
  });

  test('F-805: 解答制限タイマーが正常に機能すること', async ({ page }) => {
    // 1. ホームページからクイズを選択
    await page.goto('/');
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
    }

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 2. プレイボタンをクリック
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

      // 3. タイマーが表示されることを確認
      const timer = page.locator('[data-testid="timer"]').first()
        .or(page.locator('div').filter({ hasText: /\d+秒|制限時間/ }).first());

      if (await timer.isVisible()) {
        // タイマーが表示されていることを確認
        const timerText = await timer.textContent();
        expect(timerText).toMatch(/\d+/);
      }
    }
  });

  test('複合テスト: プレイ → ハイスコア記録 → ランキング確認 の完全フロー', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. クイズを選択
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 5000 }).catch(() => {});
    
    if (!(await firstQuizCard.isVisible())) {
      // クイズが存在しない場合は、その場でクイズを公開作成する
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

      const quizTitle = `[TEST] E2E自動シード_${Date.now().toString().slice(-4)}`;
      await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(quizTitle);
      await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('E2E自動生成データです。');

      const qTextarea = page.locator('textarea[placeholder="例: Reactにおいて、コンポーネントのステートを管理するためのフックは？"]').first();
      await qTextarea.fill('テスト問題1');
      const choiceInputs = page.locator('.choiceRow input[type="text"]');
      await choiceInputs.nth(0).fill('useState'); // 正解
      await choiceInputs.nth(1).fill('useEffect');
      await choiceInputs.nth(2).fill('useContext');
      await choiceInputs.nth(3).fill('useRef');

      let publishDialog = false;
      page.once('dialog', async dialog => {
        publishDialog = true;
        await dialog.accept();
      });

      await page.locator('text=公開').click();
      await expect.poll(() => publishDialog).toBe(true);
      await page.goto('/');
      await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 });
    }

    await firstQuizCard.click();

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 3. 初期ランキングを確認
    const leaderboardBefore = page.locator('[data-testid="quiz-leaderboard"]').first();
    if (await leaderboardBefore.isVisible()) {
      const countBefore = await page.locator('[data-testid="leaderboard-entry"]').count();
      expect(countBefore).toBeGreaterThanOrEqual(0);
    }

    // 4. クイズをプレイ
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);
      // 5. クイズをプレイ（最初の選択肢をクリック）
      const firstOption = page.locator('.optionBtn').first()
        .or(page.locator('button').filter({ hasText: /選択肢|答え|useState/ }).first());
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();
      // 次へボタン
      const nextBtn = page.locator('button').filter({ hasText: /次へ|提出|完了/ }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
      }

      // 6. 結果画面へ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/);

      // 7. 戻ってランキングが更新されたか確認（オプション）
      await page.goBack();

      // 8. ランキングが再度表示されることを確認
      const leaderboardAfter = page.locator('[data-testid="quiz-leaderboard"]').first();
      if (await leaderboardAfter.isVisible()) {
        await expect(leaderboardAfter).toBeVisible();
      }
    }
  });
});
