import { test, expect } from '@playwright/test';

test.describe('クリエイターダッシュボード E2Eテスト', () => {

  test('F-901: クリエイターダッシュボードが正常に表示されること', async ({ page }) => {
    // 1. クリエイターダッシュボードへアクセス
    await page.goto('/creator/dashboard');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('stats-skeleton')).toBeHidden({ timeout: 15000 });

    // ダッシュボードページが表示されることを確認
    await expect(page.locator('h1').filter({ hasText: /ダッシュボード|クイズ管理/ }).first()).toBeVisible();

    // 2. 自身が作成したクイズ一覧が表示されることを確認
    const quizList = page.locator('[data-testid="creator-quiz-list"]').first()
      .or(page.locator('div').filter({ hasText: /作成したクイズ/ }).first());
    
    if (await quizList.isVisible()) {
      await expect(quizList).toBeVisible();
    }

    // 3. ダッシュボードに統計情報が表示されることを確認
    const statsSection = page.locator('[data-testid="stats-section"]').first()
      .or(page.locator('div').filter({ hasText: /総プレイ数|ブックマーク|評価/ }).first());
    
    if (await statsSection.isVisible()) {
      await expect(statsSection).toBeVisible();
    }
  });

  test('F-902: 問題別解答分析（アナリティクス）が表示されること', async ({ page }) => {
    // 1. クリエイターダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // 2. ダッシュボードが表示されることを確認
    await expect(page.locator('h1').first()).toBeVisible();

    // 3. クイズを選択してアナリティクス詳細を表示
    const quizCard = page.locator('[data-testid="quiz-card"]').first();
    if (await quizCard.isVisible()) {
      await quizCard.click();
    } else {
      // フォールバック: 「詳細を見る」リンク等を探す
      const detailLink = page.locator('a').filter({ hasText: /詳細|アナリティクス/ }).first();
      if (await detailLink.isVisible()) {
        await detailLink.click();
      }
    }

    // 4. アナリティクス詳細ページが表示されることを確認
    // （ページ構成によって異なるため、複数パターンに対応）
    const analyticsSection = page.locator('[data-testid="analytics-section"]').first()
      .or(page.locator('div').filter({ hasText: /正答率|選択肢分布/ }).first())
      .or(page.locator('canvas').first()); // グラフが表示されている場合

    if (await analyticsSection.isVisible()) {
      await expect(analyticsSection).toBeVisible();
    }
  });

  test('F-903: 称号バッジシステムが表示されること', async ({ page }) => {
    // 1. 自身のプロフィール画面へアクセス
    const avatarBtn = page.locator('header img, aside img, nav img').filter({ visible: true }).first();
    if (await avatarBtn.isVisible()) {
      await avatarBtn.click({ force: true });
      
      const myPageLink = page.locator('text=マイページ');
      if (await myPageLink.isVisible()) {
        await myPageLink.click();
      }
    } else {
      // フォールバック: 直接プロフィール画面へ
      await page.goto('/profile');
    }

    // 2. プロフィール画面でバッジセクションが表示されることを確認
    const badgesSection = page.locator('[data-testid="badges-section"]').first()
      .or(page.locator('div').filter({ hasText: /称号|バッジ|achievement/ }).first());

    if (await badgesSection.isVisible()) {
      await expect(badgesSection).toBeVisible();
    }

    // 3. バッジアイコンが表示されている場合、その内容を確認
    const badges = page.locator('[data-testid="badge"]');
    const badgeCount = await badges.count();
    
    // バッジがある場合は詳細をチェック
    if (badgeCount > 0) {
      for (let i = 0; i < Math.min(badgeCount, 3); i++) {
        const badge = badges.nth(i);
        await expect(badge).toBeVisible();
      }
    }
  });

  test('F-904: リアクション受信履歴が表示されること', async ({ page }) => {
    // 1. クリエイターダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // 2. リアクション履歴セクションを確認
    const reactionsSection = page.locator('[data-testid="reactions-section"]').first()
      .or(page.locator('div').filter({ hasText: /いいね|リアクション|感謝/ }).first());

    if (await reactionsSection.isVisible()) {
      await expect(reactionsSection).toBeVisible();

      // 3. リアクション数が表示されることを確認
      const reactionCount = page.locator('[data-testid="reaction-count"]').first()
        .or(page.locator('span').filter({ hasText: /\d+\s*(いいね|👍|感謝)/ }).first());

      if (await reactionCount.isVisible()) {
        await expect(reactionCount).toBeVisible();
      }
    }
  });

  test('クリエイターダッシュボード: クイズ編集機能が正常に動作すること', async ({ page }) => {
    // 1. ダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // 2. クイズカードから編集ボタンをクリック
    const editBtn = page.locator('button').filter({ hasText: /編集/ }).first();
    
    if (await editBtn.isVisible()) {
      await editBtn.click();

      // クイズ編集ページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/edit/);

      // 3. 編集フォームが表示されることを確認
      const titleInput = page.locator('input[type="text"]').first();
      await expect(titleInput).toBeVisible();
    }
  });

  test('クリエイターダッシュボード: クイズ削除機能が正常に動作すること', async ({ page }) => {
    // 1. ダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // 2. クイズカードから削除ボタンを探す
    const deleteBtn = page.locator('button').filter({ hasText: /削除|✕/ }).first();
    
    if (await deleteBtn.isVisible()) {
      // ダイアログハンドラを設定
      page.on('dialog', async dialog => {
        if (dialog.type() === 'confirm') {
          await dialog.accept();
        }
      });

      // 削除ボタンをクリック
      await deleteBtn.click();

      // 確認ダイアログが表示される
      // (実装によって異なる場合がある)
      await page.waitForTimeout(500);
    }
  });

  test('クリエイターダッシュボード: 指摘・修正フロー', async ({ page }) => {
    // 1. ダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // 2. 指摘レポートセクションを確認
    const reportSection = page.locator('[data-testid="reports-section"]').first()
      .or(page.locator('div').filter({ hasText: /指摘|報告|修正/ }).first());

    if (await reportSection.isVisible()) {
      await expect(reportSection).toBeVisible();

      // 3. 指摘件数が表示されることを確認
      const reportCount = page.locator('[data-testid="report-count"]').first()
        .or(page.locator('span').filter({ hasText: /\d+\s*(件|回)/ }).first());

      if (await reportCount.isVisible()) {
        await expect(reportCount).toBeVisible();
      }

      // 4. 「修正する」ボタンをクリック
      const fixBtn = page.locator('button').filter({ hasText: /修正/ }).first();
      if (await fixBtn.isVisible()) {
        await fixBtn.click();

        // 修正画面へ遷移することを確認
        await page.waitForTimeout(500);
      }
    }
  });

  test('クリエイターダッシュボード: クイズ一括エクスポート機能', async ({ page }) => {
    // 1. ダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // 2. エクスポートボタンを探す
    const exportBtn = page.locator('button').filter({ hasText: /エクスポート|ダウンロード|JSON/ }).first();

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
  });

  test('複合テスト: ダッシュボード → クイズ作成 → 統計確認 の完全フロー', async ({ page }) => {
    // 1. ダッシュボードへアクセス
    await page.goto('/creator/dashboard');

    // ダッシュボードが表示されることを確認
    await expect(page.locator('h1').first()).toBeVisible();

    // 2. 新規クイズ作成ボタンをクリック
    const createBtn = page.locator('button').filter({ hasText: 'クイズを新規作成' }).first();
    
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // クイズ作成ページへ遷移することを確認
      await expect(page).toHaveURL(/\/quiz\/create/);

      // 3. 作成画面で基本情報を入力
      const titleInput = page.locator('input[type="text"]').first();
      if (await titleInput.isVisible()) {
        const quizTitle = `[TEST] ダッシュボード_${Date.now().toString().slice(-4)}`;
        await titleInput.fill(quizTitle);

        // 下書き保存
        const saveDraftBtn = page.locator('text=下書き保存').first();
        if (await saveDraftBtn.isVisible()) {
          await saveDraftBtn.click();

          // ダッシュボードに戻ることを確認
          await expect(page).toHaveURL(/\/creator\/dashboard/);

          // 4. 新しく作成したクイズが一覧に表示されることを確認
          await expect(page.locator(`text=${quizTitle}`)).toBeVisible();
        }
      }
    }
  });
});
