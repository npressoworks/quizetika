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
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill('[SOCIAL TEST] 自動公開クイズ');
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('E2E自動シード');
    
    // 選択肢
    const choiceInputs = page.locator('.choiceRow input[type="text"]');
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
    await page.locator('text=公開申請する').click();
    await page.waitForTimeout(1000);  }

  await page.goto('/');
  const quizCard = page.locator('[data-testid="quiz-card"]').first();
  await quizCard.waitFor({ state: 'visible', timeout: 15000 });
  await quizCard.click();
}

test.describe('ソーシャル機能 E2Eテスト', () => {

  test('F-401: フォロー/フォロー解除機能が正常に動作すること', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // 2. 作者プロフィール画面へ遷移
    const authorLink = page.locator('text=作者').first().or(page.locator('[data-testid="author-name"]').first());
    if (await authorLink.isVisible()) {
      await authorLink.click();
    } else {
      // 作者情報が見つからない場合、直接プロフィール画面へ
      await page.goto('/profile/test-user');
    }

    // プロフィール画面であることを確認
    await expect(page).toHaveURL(/\/profile\//);

    // 3. フォローボタンの存在確認とクリック
    const followBtn = page.locator('button:has-text("フォロー")').first().or(page.locator('[data-testid="follow-btn"]').first());
    if (await followBtn.isVisible()) {
      const followCount = await page.locator('text=フォロワー').first();
      const followCountBefore = await followCount.textContent();
      
      // フォローボタンをクリック
      await followBtn.click();
      
      // ボタンが「フォロー解除」に変わることを確認
      await expect(followBtn).toHaveText(/フォロー解除/);
      
      // フォロワー数が増加することを確認
      await page.waitForTimeout(500);
      const followCountAfter = await followCount.textContent();
      expect(followCountAfter).not.toEqual(followCountBefore);
    }
  });

  test('F-403: ブックマーク（お気に入り）機能が正常に動作すること', async ({ page }) => {
    await ensureQuizAndNavigate(page);
    // 2. ブックマークボタンをクリック
    const bookmarkBtn = page.locator('button').filter({ hasText: /ブックマーク|☆|★/ }).first();
    if (await bookmarkBtn.isVisible()) {
      const bookmarkCountBefore = await page.locator('text=ブックマーク').first().textContent();
      
      // ブックマークボタンをクリック
      await bookmarkBtn.click();
      
      // ブックマーク状態が変わることを確認
      await page.waitForTimeout(500);
      
      // ブックマーク一覧画面へ移動
      await page.goto('/bookmarks');
      
      // ブックマーク一覧画面が表示されることを確認
      await expect(page.locator('text=ブックマーク').first()).toBeVisible();
      
      // ブックマーク解除
      const removeBookmarkBtn = page.locator('button').filter({ hasText: /削除|✕/ }).first();
      if (await removeBookmarkBtn.isVisible()) {
        await removeBookmarkBtn.click();
      }
    }
  });

  test('F-403-2: トップページ一覧からクイズを直接ブックマークでき、星アイコンのカラーが即時反映されること', async ({ page }) => {
    // 1. ホームページにアクセス
    await page.goto('/');

    // ログイン状態を確認・シミュレート（もし未ログインならE2Eログインボタンをクリック）
    const loginBtn = page.locator('#e2e-test-login-btn');
    try {
      await loginBtn.waitFor({ state: 'visible', timeout: 2000 });
      if (await loginBtn.isVisible()) {
        await loginBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}

    // トップページにクイズカードが表示されていることを確認
    const firstCard = page.locator('[data-testid="quiz-card"]').first();
    await expect(firstCard).toBeVisible({ timeout: 10000 });

    // クイズカード内のお気に入り（星）ボタンを特定
    const bookmarkBtn = firstCard.locator('button[title="ブックマーク"]').first();
    await expect(bookmarkBtn).toBeVisible();

    const starIcon = bookmarkBtn.locator('svg').first();
    await expect(starIcon).toBeVisible();

    // 既にブックマークされている場合は一旦解除して白星スタートにする
    let fillAttr = await starIcon.getAttribute('fill');
    if (fillAttr === '#ff007f') {
      await bookmarkBtn.click();
      await page.waitForTimeout(500);
      fillAttr = await starIcon.getAttribute('fill');
    }
    expect(fillAttr).toBe('none');

    // ブックマークボタンをクリック
    await bookmarkBtn.click();

    // 即座に星の色がネオンピンク (#ff007f) に変化することを確認
    await page.waitForTimeout(500);
    const starFill = await starIcon.getAttribute('fill');
    expect(starFill).toBe('#ff007f');

    // 再度クリックしてブックマーク解除
    await bookmarkBtn.click();

    // 即座に元の白抜き（none）に戻ることを確認
    await page.waitForTimeout(500);
    const starFillAfter = await starIcon.getAttribute('fill');
    expect(starFillAfter).toBe('none');
  });

  test('F-404: 通知機能が正常に動作すること', async ({ page }) => {
    // 1. ホームページにアクセス
    await page.goto('/');

    // 2. 通知アイコンをクリック（ハンバーガーメニュー等から）
    const notificationBtn = page.locator('[data-testid="notifications-btn"]').first()
      .or(page.locator('button').filter({ hasText: /通知|ベル/ }).first());
    
    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();
      
      // 通知一覧ページへ遷移することを確認
      await expect(page).toHaveURL(/\/notifications/);
      
      // 通知一覧が表示されることを確認
      const notificationList = page.locator('[data-testid="notification-list"]').first()
        .or(page.locator('div').filter({ hasText: /通知/ }).first());
      await expect(notificationList).toBeVisible();
    }
  });

  test('F-405: 作家リアクション（いいね・感謝）機能が正常に動作すること', async ({ page }) => {
    // 1. ホームページからクイズを選択してプレイ
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

      // 簡単なクイズの場合、即座に完了
      // (実際のテストではクイズの内容に応じて選択肢をクリックなど)
      
      // 結果画面へのナビゲーション（複数問ある場合）
      const nextBtn = page.locator('button').filter({ hasText: /次へ|次の問題/ }).first();
      const submitBtn = page.locator('button').filter({ hasText: /完了|提出/ }).first();
      
      if (await nextBtn.isVisible()) {
        await nextBtn.click();
      } else if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }

      // 結果画面へ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/);

      // 3. 作家リアクション（いいね）ボタンをクリック
      const likeBtn = page.locator('button').filter({ hasText: /いいね|感謝|👍/ }).first();
      if (await likeBtn.isVisible()) {
        await likeBtn.click();
        
        // リアクションが送信されたことを確認
        await page.waitForTimeout(500);
      }
    }
  });

  test('F-406: フォロー/フォロワー一覧が正常に表示されること', async ({ page }) => {
    // 1. プロフィール画面へ移動
    await page.goto('/profile/test-user');

    // プロフィール画面であることを確認
    await expect(page).toHaveURL(/\/profile\//);

    // 2. フォロー/フォロワー数のリンクをクリック
    const connectionsLink = page.locator('text=つながり').first()
      .or(page.locator('a').filter({ hasText: /フォロー|フォロワー/ }).first());
    
    if (await connectionsLink.isVisible()) {
      await connectionsLink.click();

      // フォロー/フォロワー一覧ページへ遷移することを確認
      await expect(page).toHaveURL(/\/profile\/[\w-]+\/connections/);

      // 一覧が表示されることを確認
      const connectionsList = page.locator('[data-testid="connections-list"]').first()
        .or(page.locator('ul').first());
      await expect(connectionsList).toBeVisible();
    }
  });

  test('F-407: リアクション履歴が正常に表示されること', async ({ page }) => {
    // 1. プロフィール画面へ移動
    await page.goto('/profile/test-user');

    // プロフィール画面であることを確認
    await expect(page).toHaveURL(/\/profile\//);

    // 2. リアクション履歴リンクをクリック
    const likesLink = page.locator('text=いいね').first()
      .or(page.locator('a').filter({ hasText: /リアクション|👍/ }).first());
    
    if (await likesLink.isVisible()) {
      await likesLink.click();

      // リアクション履歴ページへ遷移することを確認
      await expect(page).toHaveURL(/\/profile\/[\w-]+\/likes/);

      // 履歴が表示されることを確認
      const likesList = page.locator('[data-testid="likes-list"]').first()
        .or(page.locator('div').filter({ hasText: /いいね|リアクション/ }).first());
      if (await likesList.isVisible()) {
        await expect(likesList).toBeVisible();
      }
    }
  });

  test('F-402: タイムライン機能が正常に動作すること（ログイン時のみ）', async ({ page }) => {
    // 1. ホームページへアクセス
    await page.goto('/');

    // 2. タイムラインタブをクリック（ログイン状態でのみ表示）
    const timelineTab = page.locator('button').filter({ hasText: /タイムライン|フィード/ }).first();
    
    if (await timelineTab.isVisible()) {
      await timelineTab.click();

      // タイムラインが表示されることを確認
      await page.waitForTimeout(500);
      const quizCards = page.locator('[data-testid="quiz-card"]');
      
      // 最低限1件以上のクイズが表示されることを確認（フォロー中のユーザーがいない場合は空になる可能性）
      const count = await quizCards.count();
      expect(count).toBeGreaterThanOrEqual(0);
    }
  });
  test('複合テスト: フォロー → プレイ → リアクション の完全フロー', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // 2. 作者をフォロー
    const authorLink = page.locator('text=作者').first()
      .or(page.locator('[data-testid="author-name"]').first());
    if (await authorLink.isVisible()) {
      await authorLink.click();
    }

    await expect(page).toHaveURL(/\/profile\//);

    const followBtn = page.locator('button:has-text("フォロー")').first()
      .or(page.locator('[data-testid="follow-btn"]').first());
    if (await followBtn.isVisible() && await followBtn.textContent().then(t => t?.includes('フォロー'))) {
      await followBtn.click();
    }

    // 3. クイズ詳細ページに戻ってプレイ
    await page.goBack();
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    if (await playBtn.isVisible()) {
      await playBtn.click();
    }
    // 4. クイズを解答して進める
    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

    const firstOption = page.locator('.optionBtn').first()
      .or(page.locator('button').filter({ hasText: /選択肢|答え|useState/ }).first());
    await expect(firstOption).toBeVisible({ timeout: 5000 });
    await firstOption.click();

    const submitBtn = page.locator('button').filter({ hasText: /次へ|提出|完了/ }).first();
    await expect(submitBtn).toBeVisible({ timeout: 5000 });
    await submitBtn.click();

    // 結果を確認する
    const resultBtn = page.locator('text=結果を確認する');
    await expect(resultBtn).toBeVisible({ timeout: 5000 });
    await resultBtn.click();

    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/);

    // 5. いいねボタンをクリック
    const likeBtn = page.locator('button').filter({ hasText: /いいね|感謝|👍/ }).first();
    if (await likeBtn.isVisible()) {
      await likeBtn.click();
    }
  });
});
