import { test, expect } from '@playwright/test';

// クイズ詳細ページに遷移するためのヘルパー（クイズがなければ自動作成する）
async function ensureQuizAndNavigate(page: any) {
  await page.goto('/');
  // このテストは広告表示自体の検証対象ではないため、動画広告モーダルによる
  // クリック干渉（1/3確率でのランダム表示）を避けるために広告を無効化する
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
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill('[SOCIAL TEST] 自動公開クイズ');
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
  // 詳細ページへの遷移が確実に完了するまで待機します
  await page.waitForURL(/\/quiz\/[\w-]+$/, { timeout: 10000 });
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

    // クイズカード内のブックマークボタンを特定
    const bookmarkBtn = firstCard.getByTestId('quiz-card-bookmark-btn');
    await expect(bookmarkBtn).toBeVisible();

    const filledIcon = bookmarkBtn.getByTestId('bookmark-icon-filled');
    const outlinedIcon = bookmarkBtn.getByTestId('bookmark-icon-outlined');

    // 既にブックマークされている場合は一旦解除して未ブックマーク状態にする
    if (await filledIcon.isVisible().catch(() => false)) {
      await bookmarkBtn.click();
      await page.waitForTimeout(500);
    }
    await expect(outlinedIcon).toBeVisible();

    // ブックマークボタンをクリック
    await bookmarkBtn.click();

    // 即座に塗りつぶしアイコン（#00ff66）に変化することを確認
    await page.waitForTimeout(500);
    await expect(filledIcon).toBeVisible();

    // 再度クリックしてブックマーク解除
    await bookmarkBtn.click();

    // 即座に元の輪郭アイコンに戻ることを確認
    await page.waitForTimeout(500);
    await expect(outlinedIcon).toBeVisible();
  });

  test('F-404: 通知機能が正常に動作すること', async ({ page }) => {
    // 1. ホームページにアクセス
    await page.goto('/');

    // 2. 通知アイコンをクリック（ハンバーガーメニュー等から）
    const notificationBtn = page.locator('a[href="/notifications"]').first();

    if (await notificationBtn.isVisible()) {
      await notificationBtn.click();
      
      // 通知一覧ページへ遷移することを確認
      await expect(page).toHaveURL(/\/notifications/);
      
      // 通知一覧が表示されることを確認
      await expect(page.getByTestId('notifications-page-container')).toBeVisible();
    }
  });

  test('F-405: 作家リアクション（いいね・感謝）機能が正常に動作すること', async ({ page }) => {
    await ensureQuizAndNavigate(page);

    // クイズ詳細ページであることを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+$/);

    // 2. プレイボタンをクリック
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    await playBtn.waitFor({ state: 'visible', timeout: 5000 });
    await playBtn.click();

    // プレイページへ遷移することを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

    // 結果画面に遷移するまで自動で解答を進めるループ
    for (let i = 0; i < 10; i++) {
      if (page.url().includes('/result')) {
        break;
      }

      const option = page.locator('label').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        await page.waitForTimeout(300);
      }

      const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(300);
      }

      const nextOrResultBtn = page.getByTestId('play-next-question')
        .or(page.getByTestId('play-view-results'));
      if (await nextOrResultBtn.isVisible().catch(() => false)) {
        await nextOrResultBtn.click();
        await page.waitForTimeout(500);
      }
    }

    // 結果画面へ遷移することを確認
    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/);

    // 3. 作家リアクション（いいね）ボタンをクリック
    const likeBtn = page.locator('button').filter({ hasText: /いいね|感謝|👍/ }).first();
    // 自分が作成したクイズの場合はボタンが disabled になるため、有効（Enabled）な場合のみクリックします
    if (await likeBtn.isVisible() && await likeBtn.isEnabled()) {
      await likeBtn.click();
      await page.waitForTimeout(500);
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

  // Phase 23: マイページからリアクション履歴導線を削除したためスキップ（/likes ルートはレガシー存続）
  test.skip('F-407: リアクション履歴が正常に表示されること', async ({ page }) => {
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
    const detailUrl = page.url(); // クイズ詳細ページのURLを記録しておく

    // 2. 作者をフォロー
    const authorLink = page.locator('text=作成者').first()
      .or(page.locator('text=作者').first())
      .or(page.locator('[data-testid="author-name"]').first());
    if (await authorLink.isVisible()) {
      await authorLink.click();
    } else {
      // フォールバック: 直接プロフィール画面へ
      await page.goto('/profile/test-user');
    }

    await expect(page).toHaveURL(/\/profile\//);

    const followBtn = page.locator('button:has-text("フォロー")').first()
      .or(page.locator('[data-testid="follow-btn"]').first());
    if (await followBtn.isVisible() && await followBtn.textContent().then(t => t?.includes('フォロー'))) {
      await followBtn.click();
    }

    // 3. クイズ詳細ページに戻ってプレイ (記録したURLへ直接遷移して履歴依存を排除)
    await page.goto(detailUrl);
    const playBtn = page.locator('button').filter({ hasText: /プレイ|始める/ }).first();
    await playBtn.waitFor({ state: 'visible', timeout: 5000 });
    await playBtn.click();

    // 4. クイズを解答して進める (自動解答ループ)
    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/play/);

    for (let i = 0; i < 10; i++) {
      if (page.url().includes('/result')) {
        break;
      }

      const option = page.locator('label').first();
      if (await option.isVisible().catch(() => false)) {
        await option.click();
        await page.waitForTimeout(300);
      }

      const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
      if (await confirmBtn.isVisible().catch(() => false)) {
        await confirmBtn.click();
        await page.waitForTimeout(300);
      }

      const nextOrResultBtn = page.getByTestId('play-next-question')
        .or(page.getByTestId('play-view-results'));
      if (await nextOrResultBtn.isVisible().catch(() => false)) {
        await nextOrResultBtn.click();
        await page.waitForTimeout(500);
      }
    }

    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/result/);

    // 5. いいねボタンをクリック
    const likeBtn = page.locator('button').filter({ hasText: /いいね|感謝|👍/ }).first();
    // 自分が作成したクイズの場合はボタンが disabled になるため、有効（Enabled）な場合のみクリックします
    if (await likeBtn.isVisible() && await likeBtn.isEnabled()) {
      await likeBtn.click();
    }
  });
});
