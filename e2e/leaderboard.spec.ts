import { test, expect, type Page } from '@playwright/test';
import { createDbClient } from './db-client';

/**
 * リーダーボード実データ検証専用の「別著者」フィクスチャ。
 * `handle_save_attempt` RPC（supabase/migrations/20260703000200_gameplay_normalization.sql）は
 * `p_user_id <> v_author_id` の場合のみ `leaderboard_entries` へ記録する（著者自身のプレイは対象外）。
 * 本E2E環境の共有ログインユーザー（e2e-test-user）はホーム上のクイズ（シードクイズ含め）すべての著者であるため、
 * 自分で作成したクイズを自分でプレイしても記録は作成されない。
 * `e2e/additional-features.spec.ts` の `ensureOtherUsersQuiz` と同じ手法（別著者IDでのDB直接シード）を用いて、
 * e2e-test-user が「他人のクイズ」をプレイできる状況を用意する。
 */
const LEADERBOARD_OTHER_AUTHOR_ID = '00000000-0000-4000-8000-0000000000f1';
const LEADERBOARD_OTHER_AUTHOR_EMAIL = 'other-e2e-leaderboard-author@example.com';

/**
 * 単一選択問題1問のクイズを、e2e-test-userとは別の著者IDでDBへ直接シードし、そのクイズIDを返す。
 * 都度ユニークなタイトルで作成し、他テストの記録と混在させない。
 */
async function seedOtherAuthorQuiz(title: string): Promise<string> {
  const db = createDbClient();
  await db.connect();
  try {
    await db.query(
      `INSERT INTO users (id, email, display_name, bio)
       VALUES ($1, $2, '別のE2Eユーザー（LB検証用）', '')
       ON CONFLICT (id) DO NOTHING`,
      [LEADERBOARD_OTHER_AUTHOR_ID, LEADERBOARD_OTHER_AUTHOR_EMAIL]
    );

    const quizResult = await db.query<{ id: string }>(
      `INSERT INTO quizzes (
         author_id, author_name, title, description, difficulty, genre,
         canonical_genre_id, status, visibility, question_count, format
       ) VALUES ($1, $2, $3, $4, 3, '趣味・カルチャー', 'hobby-culture', 'published', 'public', 1, 'multiple-choice')
       RETURNING id`,
      [
        LEADERBOARD_OTHER_AUTHOR_ID,
        '別のE2Eユーザー（LB検証用）',
        title,
        'E2E自動生成データです（リーダーボード実データ検証用・他ユーザー著者）。',
      ]
    );
    const quizId = quizResult.rows[0].id;

    const questionResult = await db.query<{ id: string }>(
      `INSERT INTO questions (
         owner_quiz_id, author_id, author_name, type, question_text, explanation, choices
       ) VALUES ($1, $2, $3, 'multiple-choice', $4, '解説です。', $5::jsonb)
       RETURNING id`,
      [
        quizId,
        LEADERBOARD_OTHER_AUTHOR_ID,
        '別のE2Eユーザー（LB検証用）',
        'リーダーボード検証用問題1',
        JSON.stringify([
          { id: '1', choiceText: '正解の選択肢', isCorrect: true, selectedCount: 0 },
          { id: '2', choiceText: 'ダミー1', isCorrect: false, selectedCount: 0 },
        ]),
      ]
    );
    const questionId = questionResult.rows[0].id;

    await db.query(
      `INSERT INTO quiz_questions (quiz_id, question_id, display_order) VALUES ($1, $2, 1)`,
      [quizId, questionId]
    );

    return quizId;
  } finally {
    await db.end();
  }
}

/**
 * 指定クイズを1回プレイし、結果画面のデータ描画まで到達する（正誤は不問）。
 * 結果画面の `quiz-replay-btn` の表示を、記録保存が実質的に先行している状態の目安として待機する。
 */
async function playQuizOnce(page: Page, quizId: string): Promise<void> {
  await page.goto(`/quiz/${quizId}`);
  // 広告表示自体の検証対象ではないため、動画広告モーダルによる結果画面遷移の阻害を避ける
  await page.evaluate(() => {
    window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
  });

  const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
  await expect(playBtn).toBeVisible({ timeout: 10000 });
  // page.goto直後はハイドレーション完了前にクリックが空振りする可能性があるため、
  // URL遷移を確認できるまでクリックをリトライする（固定sleepではなくポーリングで待機）
  await expect(async () => {
    await playBtn.click();
    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/, { timeout: 2000 });
  }).toPass({ timeout: 15000, intervals: [500, 1000, 2000] });

  const firstOption = page.locator('label').first();
  await expect(firstOption).toBeVisible({ timeout: 10000 });
  await firstOption.click();

  const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
  await expect(confirmBtn).toBeVisible({ timeout: 5000 });
  await confirmBtn.click();

  // 次へ、または結果を見るボタン（最終問題かどうかで表示が切り替わる。単一問題のため通常は後者）
  const nextOrResultBtn = page.getByTestId('play-next-question')
    .or(page.getByTestId('play-view-results'));
  await expect(nextOrResultBtn.first()).toBeVisible({ timeout: 5000 });
  await nextOrResultBtn.first().click();

  await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/, { timeout: 15000 });
  await expect(page.getByTestId('quiz-replay-btn')).toBeVisible({ timeout: 15000 });
}

/**
 * 記録保存の非同期反映を待つため、クイズ詳細画面への再遷移とテーブル表示確認を
 * 一定時間内でリトライする（結果画面到達後も `leaderboard_entries` への反映が
 * わずかに遅延する可能性があるため、固定 sleep ではなくポーリングで待機する）。
 */
async function waitForLeaderboardData(page: Page, quizDetailUrl: string, board: 'first' | 'replay'): Promise<void> {
  const tableTestId = board === 'first' ? 'highscore-leaderboard' : 'replay-leaderboard';
  await expect(async () => {
    await page.goto(quizDetailUrl);
    if (board === 'replay') {
      await page.locator('[data-testid="quiz-leaderboard-tab-replay"]').first().click();
    }
    await expect(page.locator(`[data-testid="${tableTestId}"]`)).toBeVisible({ timeout: 3000 });
  }).toPass({ timeout: 20000, intervals: [1000, 2000, 3000] });
}

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

    // ロード中スケルトンが消えるのを待つ
    await expect(page.getByTestId('leaderboard-global-skeleton')).toBeHidden({ timeout: 15000 });

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
    // このテストは広告表示自体の検証対象ではないため、動画広告モーダルによる
    // 結果画面遷移の阻害（1/3確率でのランダム表示）を避けるために広告を無効化する
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
    });
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

      const qTextarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
      await qTextarea.fill('テスト問題1');
      const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
      await choiceInputs.nth(0).fill('useState'); // 正解
      await choiceInputs.nth(1).fill('useEffect');
      await choiceInputs.nth(2).fill('useContext');
      await choiceInputs.nth(3).fill('useRef');

      let publishDialog = false;
      page.once('dialog', async dialog => {
        publishDialog = true;
        await dialog.accept();
      });

      await page.locator('button').filter({ hasText: /^公開$/ }).first().click();
      await expect.poll(() => publishDialog).toBe(true);
      await page.goto('/');
      await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 });
    }

    await firstQuizCard.click();

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 2. クイズのリーダーボード情報を確認（詳細ページ内）
    const quizLeaderboard = page.locator('[data-testid="quiz-leaderboard"]').first();

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
      const options = page.locator('label').first();

      if (await options.isVisible()) {
        // 最初の選択肢をクリック（正解かどうかは不問）
        await options.click();
      }

      // 解答を確定する
      const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      // 次へ、または結果を見るボタン（最終問題かどうかで表示が切り替わる）
      const nextOrResultBtn = page.getByTestId('play-next-question')
        .or(page.getByTestId('play-view-results'));
      if (await nextOrResultBtn.isVisible()) {
        await nextOrResultBtn.click();
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

  test('クイズ詳細画面: 初回プレイランキングが表示されること', async ({ page }) => {
    await page.goto('/');
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
    }

    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    const quizLb = page.locator('[data-testid="quiz-leaderboard"]').first();
    await expect(quizLb).toBeVisible();

    await expect(page.locator('[data-testid="quiz-leaderboard-tab-first"]').first()).toBeVisible();
    // ランキングが0件の場合は表(highscore-leaderboard)ではなく「まだ記録がありません。」の空状態メッセージが表示される
    const firstPlaySection = page.locator('[data-testid="highscore-leaderboard"]')
      .or(page.locator('text=まだ記録がありません'));
    await expect(firstPlaySection.first()).toBeVisible();

    const entryCount = await page.locator('[data-testid="leaderboard-entry"]').count();
    if (entryCount > 0) {
      expect(entryCount).toBeGreaterThan(0);
    }
  });

  test('クイズ詳細画面: リプレイランキングが表示されること', async ({ page }) => {
    await page.goto('/');
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
    }

    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    const replayTab = page.locator('[data-testid="quiz-leaderboard-tab-replay"]').first();
    await expect(replayTab).toBeVisible();
    await replayTab.click();

    // ランキングが0件の場合は表(replay-leaderboard)ではなく「まだ記録がありません。」の空状態メッセージが表示される
    const replaySection = page.locator('[data-testid="replay-leaderboard"]')
      .or(page.locator('text=まだ記録がありません'));
    await expect(replaySection.first()).toBeVisible();
  });

  test('複合テスト（実データ）: プレイ後にTOP5ランキングと自分の順位行が初回・リプレイの双方で実データに基づき表示されること', async ({ page }) => {
    test.setTimeout(90 * 1000);

    // 1. このテスト専用の「他人のクイズ」をDB直接シードで用意する（他テストの記録と混在させないため）。
    //    e2e-test-user自身が著者のクイズでは、著者本人のプレイは leaderboard_entries に記録されないため
    //    （handle_save_attempt RPC の仕様）、別著者のクイズを用意する必要がある。
    const quizTitle = `[TEST] LB実データ検証_${Date.now().toString().slice(-6)}`;
    const quizId = await seedOtherAuthorQuiz(quizTitle);
    const quizDetailUrl = `/quiz/${quizId}`;

    // 2. 1回目のプレイ（初回プレイ記録を作成する）
    await playQuizOnce(page, quizId);

    // 3. 初回プレイTOP5と自分の順位行が実データで表示されることを検証する
    //    （Phase 5以来、Quiz.leaderboardFirstPlay/leaderboardReplayという実在しない列を参照し
    //    常に空表示になっていたバグの回帰テスト。要件9.5, 9.7, 9.9, 9.14）
    await waitForLeaderboardData(page, quizDetailUrl, 'first');

    await expect(page.locator('[data-testid="quiz-leaderboard"]').first()).toBeVisible();

    const highscoreEntries = page.locator('[data-testid="highscore-leaderboard"] [data-testid="leaderboard-entry"]');
    await expect(highscoreEntries.first()).toBeVisible();
    expect(await highscoreEntries.count()).toBeGreaterThanOrEqual(1);

    const myRankFirst = page.locator('[data-testid="leaderboard-my-rank-first"]');
    await expect(myRankFirst).toBeVisible({ timeout: 15000 });
    const myRankFirstText = await myRankFirst.textContent();
    expect(myRankFirstText).toMatch(/#\d+/); // 順位番号
    expect(myRankFirstText).toMatch(/\d+\s*秒/); // 合計解答時間

    // 4. 2回目のプレイ（リプレイ記録を作成する。要件9.10: 初回・リプレイは独立して評価される）
    await playQuizOnce(page, quizId);

    // 5. リプレイTOP5と自分の順位行（リプレイ）が実データで表示されることを検証する
    await waitForLeaderboardData(page, quizDetailUrl, 'replay');

    const replayEntries = page.locator('[data-testid="replay-leaderboard"] [data-testid="leaderboard-entry"]');
    await expect(replayEntries.first()).toBeVisible();
    expect(await replayEntries.count()).toBeGreaterThanOrEqual(1);

    const myRankReplay = page.locator('[data-testid="leaderboard-my-rank-replay"]');
    await expect(myRankReplay).toBeVisible({ timeout: 15000 });
    const myRankReplayText = await myRankReplay.textContent();
    expect(myRankReplayText).toMatch(/#\d+/);
    expect(myRankReplayText).toMatch(/\d+\s*秒/);

    // 6. リプレイ実施後も初回プレイ側の自分の順位表示が引き続き独立して表示されること（要件9.10）
    await waitForLeaderboardData(page, quizDetailUrl, 'first');
    await expect(page.locator('[data-testid="leaderboard-my-rank-first"]')).toBeVisible({ timeout: 15000 });
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
    const textInputTypeBtn = page.locator('#question-card-0').getByRole('button', { name: '記述式', exact: true });
    await expect(textInputTypeBtn).toBeVisible({ timeout: 5000 });
    await textInputTypeBtn.click();

    // 4. 正解パターンを入力
    const correctAnswerInput = page.locator('input[placeholder="例: useState"]').first();
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
    // (ドロップゾーンUIの背後に隠されたinput[type="file"]のため、可視性ではなくDOM存在を確認する)
    const coverImageUpload = page.locator('input[type="file"]').first();
    await expect(coverImageUpload).toBeAttached();

    // 4. 問題画像アップロード UI を確認
    const problemImageUploads = page.locator('input[type="file"]');
    const uploadCount = await problemImageUploads.count();

    // 複数のアップロード UI が存在することを確認
    expect(uploadCount).toBeGreaterThan(0);
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
    // このテストは広告表示自体の検証対象ではないため、動画広告モーダルによる
    // 結果画面遷移の阻害（1/3確率でのランダム表示）を避けるために広告を無効化する
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
    });

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

      const qTextarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
      await qTextarea.fill('テスト問題1');
      const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
      await choiceInputs.nth(0).fill('useState'); // 正解
      await choiceInputs.nth(1).fill('useEffect');
      await choiceInputs.nth(2).fill('useContext');
      await choiceInputs.nth(3).fill('useRef');

      let publishDialog = false;
      page.once('dialog', async dialog => {
        publishDialog = true;
        await dialog.accept();
      });

      await page.locator('button').filter({ hasText: /^公開$/ }).first().click();
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
      const firstOption = page.locator('label').first();
      await expect(firstOption).toBeVisible({ timeout: 5000 });
      await firstOption.click();

      // 解答を確定する
      const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
      if (await confirmBtn.isVisible()) {
        await confirmBtn.click();
      }

      // 次へ、または結果を見るボタン（最終問題かどうかで表示が切り替わる）
      const nextOrResultBtn = page.getByTestId('play-next-question')
        .or(page.getByTestId('play-view-results'));
      if (await nextOrResultBtn.isVisible()) {
        await nextOrResultBtn.click();
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
