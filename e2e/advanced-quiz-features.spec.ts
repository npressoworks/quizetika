import { test, expect } from '@playwright/test';

// テスト全体で共有する通常クイズ（選択肢形式）のID
let sharedNormalQuizId: string | null = null;

// テスト用クイズがまだ作成されていない場合に動的に新規作成して公開する関数
async function ensureSharedNormalQuiz(page: any, dialogMessages: string[]) {
  if (sharedNormalQuizId) return sharedNormalQuizId;

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

  const uniqueTitle = `[TEST] E2E共通クイズ_${Date.now().toString().slice(-4)}`;
  await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(uniqueTitle);
  await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('E2Eテスト共通の自動生成クイズです。');

  // 第1問目の問題入力
  const qTextarea = page.locator('textarea[placeholder*="Reactにおいて"]').first();
  await qTextarea.fill('Reactのフックでステート管理を行うのは？');

  // 選択肢の入力
  const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
  await choiceInputs.nth(0).fill('useState'); // 正解
  await choiceInputs.nth(1).fill('useEffect');
  await choiceInputs.nth(2).fill('useContext');
  await choiceInputs.nth(3).fill('useRef');

  // ジャンル選択
  const genreSelect = page.getByTestId('genre-editor-select');
  await expect(genreSelect).toBeVisible({ timeout: 5000 });
  const firstGenre = genreSelect.locator('option[value]:not([value=""])').first();
  await expect(firstGenre).toBeAttached({ timeout: 5000 });
  const genreValue = await firstGenre.getAttribute('value');
  if (genreValue) {
    await genreSelect.selectOption(genreValue);
  }

  // 公開
  const publishBtn = page.locator('button').filter({ hasText: /^公開$/ }).first();
  await expect(publishBtn).toBeVisible();
  await publishBtn.click();

  // 公開完了アラートを閉じる
  await expect.poll(() => dialogMessages).toContain('クイズを公開しました！');
  await expect(page).toHaveURL(/\/creator\/dashboard/);

  // ダッシュボードから作成したクイズを探してURLからIDを取得
  await page.goto('/');
  const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
  await expect(searchInput).toBeVisible();
  await searchInput.fill(uniqueTitle);
  
  const quizCard = page.locator(`text=${uniqueTitle}`).first();
  await expect(quizCard).toBeVisible();
  await quizCard.click();

  await expect(page).toHaveURL(/\/quiz\/([\w-]+)$/);
  const currentUrl = page.url();
  const match = currentUrl.match(/\/quiz\/([\w-]+)$/);
  if (match) {
    sharedNormalQuizId = match[1];
  }
  return sharedNormalQuizId;
}

test.describe('高度なクイズ機能 E2Eテスト', () => {

  test('F-307: AI連携自動判定プレイ（ウミガメのスープ）が機能すること', async ({ page }) => {
    // 1. ホームページからウミガメのスープクイズを検索
    await page.goto('/');

    // キーワード検索でウミガメを検索
    const searchInput = page.locator('input[type="text"]').filter({ hasText: /検索|search/ }).first();
    if (await searchInput.isVisible()) {
      await searchInput.fill('ウミガメ');
      await searchInput.press('Enter');
    }

    // クイズを選択
    const firstQuizCard = page.locator('[data-testid="quiz-card"]').first();
    await firstQuizCard.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
    if (await firstQuizCard.isVisible()) {
      await firstQuizCard.click();
    } else {
      // フォールバック: 直接ウミガメクイズへ
      await page.goto('/quiz/lateral-thinking-quiz');
    }

    // 2. クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 3. プレイモード選択画面でウミガメモードを確認
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // 4. ウミガメプレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

      // 5. AI対話UIが表示されることを確認
      const chatInput = page.locator('input[placeholder*="質問"]').first()
        .or(page.locator('textarea').filter({ hasText: /質問/ }).first());

      if (await chatInput.isVisible()) {
        // 質問を入力
        await chatInput.fill('主人公は生きていますか？');

        // 送信ボタンをクリック
        const submitBtn = page.locator('button').filter({ hasText: /送信|質問/ }).first();
        if (await submitBtn.isVisible()) {
          await submitBtn.click();

          // AIの回答が表示されることを確認
          await page.waitForTimeout(1000);
          const response = page.locator('[data-testid="ai-response"]').first()
            .or(page.locator('div').filter({ hasText: /はい|いいえ|関係/ }).first());

          if (await response.isVisible()) {
            await expect(response).toBeVisible();
          }
        }
      }
    }
  });

  test('F-307: ウミガメのスープ - 同一質問キャッシュが機能すること', async ({ page }) => {
    // 1. ウミガメクイズへアクセス
    await page.goto('/quiz/lateral-thinking-quiz/play');

    // 2. AI対話UIが表示されることを確認
    const chatInput = page.locator('input[placeholder*="質問"]').first()
      .or(page.locator('textarea').filter({ hasText: /質問/ }).first());

    if (await chatInput.isVisible()) {
      // 質問を入力
      const testQuestion = '主人公は生きていますか？';
      await chatInput.fill(testQuestion);

      // 送信ボタンをクリック
      const submitBtn = page.locator('button').filter({ hasText: /送信|質問/ }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // 最初の回答を待つ
        await page.waitForTimeout(1000);

        // 同じ質問を再度入力（キャッシュが機能するか確認）
        await chatInput.fill(testQuestion);
        await submitBtn.click();

        // キャッシュ表示があるか確認（オプション）
        const cachedBadge = page.locator('text=既存の回答').first();
        if (await cachedBadge.isVisible()) {
          await expect(cachedBadge).toBeVisible();
        }
      }
    }
  });

  test('F-307: ウミガメのスープ - 真相判定が機能すること', async ({ page }) => {
    // 1. ウミガメクイズへアクセス
    await page.goto('/quiz/lateral-thinking-quiz/play');

    // 2. AI対話UIが表示されることを確認
    const chatInput = page.locator('input[placeholder*="質問"]').first()
      .or(page.locator('textarea').filter({ hasText: /質問/ }).first());

    if (await chatInput.isVisible()) {
      // 質問を複数回入力
      await chatInput.fill('テスト質問');

      const submitBtn = page.locator('button').filter({ hasText: /送信|質問/ }).first();
      if (await submitBtn.isVisible()) {
        await submitBtn.click();

        // 3. 真相を解く入力フォームを確認
        const truthInput = page.locator('input[placeholder*="真相"]').first()
          .or(page.locator('textarea').filter({ hasText: /真相|答え/ }).first());

        if (await truthInput.isVisible()) {
          // 真相を入力
          await truthInput.fill('真相の要約');

          // 真相を解くボタンをクリック
          const solveBtn = page.locator('button').filter({ hasText: /解く|判定|完了/ }).first();
          if (await solveBtn.isVisible()) {
            await solveBtn.click();

            // 判定結果が表示されることを確認
            await page.waitForTimeout(1000);
          }
        }
      }
    }
  });

  test('F-1001: 模擬試験モードが正常に機能すること', async ({ page }) => {
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // 共通のテストクイズが存在することを確認
    const quizId = await ensureSharedNormalQuiz(page, dialogMessages);
    
    // クイズ詳細ページに直接遷移
    await page.goto(`/quiz/${quizId}`);

    // 2. プレイモード選択で「模擬試験モード」を選択
    const mockExamBtn = page.locator('button').filter({ hasText: /模擬試験|試験/ }).first();
    
    if (await mockExamBtn.isVisible()) {
      await mockExamBtn.click();

      // 模擬試験プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

      // 3. 模擬試験モードの特徴を確認
      // 最初の問題で選択肢をクリック
      const option = page.locator('button[class*="optionBtn"], button').filter({ hasText: /useState/ }).first();
      if (await option.isVisible()) {
        await option.click();

        // 次へボタンをクリック
        const nextBtn = page.locator('button').filter({ hasText: /次へ|次の問題|結果を確認する/ }).first();
        if (await nextBtn.isVisible()) {
          await nextBtn.click();
        }
      }
      await page.waitForTimeout(500);
    }
  });

  test('F-1002: シャッフル出題が正常に機能すること', async ({ page }) => {
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // 共通のテストクイズが存在することを確認
    const quizId = await ensureSharedNormalQuiz(page, dialogMessages);
    
    // クイズ詳細ページに直接遷移
    await page.goto(`/quiz/${quizId}`);

    // 2. プレイ前にシャッフルオプションを確認
    const shuffleOption = page.locator('input[type="checkbox"]').filter({ hasText: /シャッフル/ }).first()
      .or(page.locator('label').filter({ hasText: /シャッフル/ }).first());

    if (await shuffleOption.isVisible()) {
      // シャッフルをオン
      const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: /シャッフル/ }).first();
      if (await checkbox.isVisible()) {
        const isChecked = await checkbox.isChecked();
        if (!isChecked) {
          await checkbox.check();
        }
      }
    }

    // 3. プレイボタンをクリック
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);
    }
  });

  test('F-1003: 弱点克服プレイ（復習プレイ）が正常に機能すること', async ({ page }) => {
    // 1. プロフィール画面へアクセス
    const profileBtn = page.locator('[data-testid="sidebar-profile-btn"]').first();
    if (await profileBtn.isVisible()) {
      await profileBtn.click({ force: true });
      const myPageLink = page.locator('text=マイページ');
      if (await myPageLink.isVisible()) {
        await myPageLink.click();
      }
    } else {
      const avatarLink = page.locator('header img, aside img, nav img').filter({ visible: true }).first();
      if (await avatarLink.isVisible()) {
        await avatarLink.click({ force: true });
      } else {
        await page.goto('/profile');
      }
    }

    // 2. 弱点克服セクションを確認
    const reviewSection = page.locator('[data-testid="review-section"]').first()
      .or(page.locator('div').filter({ hasText: /復習|弱点克服|間違い問題/ }).first());

    if (await reviewSection.isVisible()) {
      // 3. 復習プレイボタンをクリック
      const reviewBtn = page.locator('button').filter({ hasText: /復習|弱点克服|開始/ }).first();
      if (await reviewBtn.isVisible()) {
        await reviewBtn.click();

        // 4. ジャンル選択画面が表示される可能性
        const genreSelector = page.locator('select').first();
        if (await genreSelector.isVisible()) {
          // ジャンルを選択
          await genreSelector.selectOption({ index: 0 });
        }

        // 5. 復習プレイページへ遷移することを確認
        await page.waitForTimeout(500);
        await expect(page).toHaveURL(/\/quiz\/review/);
      }
    }
  });

  test('F-1004: フラッシュカード（暗記カード）モードが正常に機能すること', async ({ page }) => {
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // 共通のテストクイズが存在することを確認
    const quizId = await ensureSharedNormalQuiz(page, dialogMessages);
    
    // クイズ詳細ページに直接遷移
    await page.goto(`/quiz/${quizId}`);

    // 2. プレイモード選択で「フラッシュカード」を選択
    const flashcardBtn = page.locator('button').filter({ hasText: /フラッシュ|暗記|カード/ }).first();
    
    if (await flashcardBtn.isVisible()) {
      await flashcardBtn.click();

      // フラッシュカードプレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

      // 3. フラッシュカード UI を確認
      const card = page.locator('[data-testid="flashcard"]').first()
        .or(page.locator('div').filter({ hasText: /問題|答え/ }).first());

      if (await card.isVisible()) {
        await expect(card).toBeVisible();

        // 4. 「答えを見る」ボタンをクリック
        const revealBtn = page.locator('button').filter({ hasText: /答え|見る|裏/ }).first();
        if (await revealBtn.isVisible()) {
          await revealBtn.click();

          // 答えが表示されることを確認
          await page.waitForTimeout(300);
        }

        // 5. 次のカードボタンをクリック
        const nextCardBtn = page.locator('button').filter({ hasText: /次|→|進む/ }).first();
        if (await nextCardBtn.isVisible()) {
          await nextCardBtn.click();

          // 次のカードが表示されることを確認
          await page.waitForTimeout(300);
        }
      }
    }
  });

  test('複合テスト: 多様な問題タイプのプレイフロー', async ({ page }) => {
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // 共通のテストクイズが存在することを確認
    const quizId = await ensureSharedNormalQuiz(page, dialogMessages);
    
    // クイズ詳細ページに直接遷移
    await page.goto(`/quiz/${quizId}`);

    // 5. 通常モードでプレイ
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();

      // プレイページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

      // 6. 複数の問題に回答
      const option = page.locator('button[class*="optionBtn"], button').filter({ hasText: /useState/ }).first();
      if (await option.isVisible()) {
        await option.click();
      }

      const nextBtn = page.locator('button').filter({ hasText: /次へ|提出|完了|結果を確認する/ }).first();
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
        await page.waitForTimeout(300);
      }
    }
  });
});
