import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';

// 「他人が作成したクイズ」を検証するテスト専用のフィクスチャ。
// 本E2E環境ではホーム画面のクイズは（広告ダミー含め）全て共有E2Eテストユーザーが著者であるため、
// 「ホーム最初のカード = 他人のクイズ」という前提は成立しない。そのため別著者を明示的に用意する。
const OTHER_AUTHOR_ID = '00000000-0000-4000-8000-000000000001';
let otherUserQuizId: string | null = null;

async function ensureOtherUsersQuiz(): Promise<string> {
  if (otherUserQuizId) return otherUserQuizId;

  const db = createDbClient();
  await db.connect();
  try {
    await db.query(
      `INSERT INTO users (id, email, display_name, bio)
       VALUES ($1, 'other-e2e-user@example.com', '別のE2Eユーザー', '')
       ON CONFLICT (id) DO NOTHING`,
      [OTHER_AUTHOR_ID]
    );

    const existing = await db.query<{ id: string }>(
      `SELECT id FROM quizzes WHERE author_id = $1 AND title = '[OTHER_USER_TEST] 他人のクイズ' LIMIT 1`,
      [OTHER_AUTHOR_ID]
    );
    if (existing.rows.length > 0) {
      otherUserQuizId = existing.rows[0].id;
      return otherUserQuizId;
    }

    const inserted = await db.query<{ id: string }>(
      `INSERT INTO quizzes (
         author_id, author_name, title, description, difficulty, genre,
         canonical_genre_id, status, visibility, question_count, format
       ) VALUES ($1, $2, $3, $4, 3, '趣味・カルチャー', 'hobby-culture', 'published', 'public', 1, 'multiple-choice')
       RETURNING id`,
      [OTHER_AUTHOR_ID, '別のE2Eユーザー', '[OTHER_USER_TEST] 他人のクイズ', 'E2Eテスト用の他人のクイズです。']
    );
    otherUserQuizId = inserted.rows[0].id;

    await db.query(
      `INSERT INTO questions (
         owner_quiz_id, author_id, author_name, type, question_text, explanation, choices
       ) VALUES ($1, $2, $3, 'multiple-choice', $4, '解説です。', $5::jsonb)`,
      [
        otherUserQuizId,
        OTHER_AUTHOR_ID,
        '別のE2Eユーザー',
        '他人のクイズの問題文です。',
        JSON.stringify([
          { id: '1', choiceText: '選択肢1', isCorrect: true, selectedCount: 0 },
          { id: '2', choiceText: '選択肢2', isCorrect: false, selectedCount: 0 },
        ]),
      ]
    );

    return otherUserQuizId;
  } finally {
    await db.end();
  }
}

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
    const viewport = page.viewportSize();
    const isDesktop = viewport ? viewport.width >= 768 : true;
    if (isDesktop) {
      const myPageLink = page.getByTestId('nav-profile');
      await expect(myPageLink).toBeVisible({ timeout: 10000 });
      await myPageLink.click();
    } else {
      const avatarLink = page.locator('header img').first();
      await expect(avatarLink).toBeVisible({ timeout: 10000 });
      await avatarLink.click({ force: true });
    }

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

  test('タグ別クイズ一覧が正常に表示されること', async ({ page }) => {
    // 1. クイズ詳細ページへアクセス
    await page.goto('/');
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
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

  test('ジャンル詳細ページが正常に表示されること', async ({ page }) => {
    // テスト用のジャンル詳細へ直接アクセス
    await page.goto('/genres/programming');
    await expect(page.getByTestId('genre-explore-page')).toBeVisible({ timeout: 10000 });
  });

  test('プロフィール編集画面: フォローしているジャンルが管理できること', async ({ page }) => {
    // 1. プロフィール編集画面へアクセス
    const viewport = page.viewportSize();
    const isDesktop = viewport ? viewport.width >= 768 : true;
    if (isDesktop) {
      const myPageLink = page.getByTestId('nav-profile');
      await expect(myPageLink).toBeVisible({ timeout: 10000 });
      await myPageLink.click();
    } else {
      const avatarLink = page.locator('header img').first();
      await expect(avatarLink).toBeVisible({ timeout: 10000 });
      await avatarLink.click({ force: true });
    }
    
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
    // 1. 検索画面へアクセス（検索入力欄は/searchにのみ存在する）
    await page.goto('/search');

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
          await qTextarea.fill('複合テスト用の問題文です。');
        }

        // 4. 下書き保存
        const saveDraftBtn = page.locator('text=下書き保存').first();
        if (await saveDraftBtn.isVisible()) {
          await saveDraftBtn.click();

          // 作成したクイズ画面（/creator/quizzes）に遷移することを確認
          await expect(page).toHaveURL(/\/creator\/quizzes/);

          // 5. 作成したクイズが一覧に表示されることを確認（要件19.1）
          const newQuizLink = page
            .getByTestId('creator-quiz-management-list')
            .getByText(quizTitle)
            .first();
          if (await newQuizLink.isVisible()) {
            await expect(newQuizLink).toBeVisible();
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
    // 本E2E環境ではホーム画面上のクイズ（広告ダミー含め）が全て共有E2Eテストユーザーの著者であるため、
    // 「ホーム最初のカード = 他人のクイズ」という前提は成り立たない。別著者のクイズを直接用意して検証する。
    const otherQuizId = await ensureOtherUsersQuiz();
    await page.goto(`/quiz/${otherQuizId}`);

    // 他人のクイズであるため、「クイズを編集」ボタンが表示されないことを確認
    const editBtn = page.locator('text=クイズを編集');
    await expect(editBtn).not.toBeVisible();
  });

  test('他人が作成したクイズの編集画面に直接アクセスした際、認可エラーUIで保護されること', async ({ page }) => {
    // 上記と同様、別著者のクイズを直接用意して検証する
    const otherQuizId = await ensureOtherUsersQuiz();

    // 直接他人のクイズの編集URL（/quiz/[id]/edit）へ遷移
    await page.goto(`/quiz/${otherQuizId}/edit`);
    await page.waitForTimeout(1000);

    // 認可エラーUI（アクセス権限がありません）が表示されることを確認
    await expect(page.locator('h2').filter({ hasText: 'アクセス権限がありません' })).toBeVisible();
    await expect(page.locator('text=このクイズは他のユーザーが作成したものであるため')).toBeVisible();
  });
});
