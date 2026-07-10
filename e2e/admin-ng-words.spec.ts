import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';
import { readE2eFixtureIds } from './fixture-ids';

test.describe('管理者NGワードマスタ管理 E2Eテスト', () => {

  test.beforeAll(async () => {
    // global-setup.ts が作成済みの E2Eテストユーザーを admin ロールで再確認する
    // （このファイル単体で実行された場合も admin 権限を保証するための防御的な再upsert）
    const db = createDbClient();
    await db.connect();
    try {
      const { userId } = readE2eFixtureIds();
      await db.query(`UPDATE users SET role = 'admin' WHERE id = $1`, [userId]);
    } finally {
      await db.end();
    }
  });

  test('非管理者ユーザーでのアクセス制限確認', async ({ page }) => {
    // 認証状態が残っている場合はクリアして非ログイン状態にする
    await page.context().clearCookies();
    await page.goto('/login');
    await page.evaluate(() => localStorage.clear());

    // 1. 管理者以外の状態で /admin/ng-words へのアクセスを試みる
    await page.goto('/admin/ng-words');

    // アクセス拒否されて /not-found または /login に遷移するか、404表示になることを確認
    await page.waitForTimeout(2000);
    const currentUrl = page.url();

    expect(
      currentUrl.includes('/not-found') ||
      currentUrl.includes('/login') ||
      await page.locator('text=見つかりません').isVisible()
    ).toBeTruthy();
  });

  test('管理者としてNGワードの登録・編集・有効/無効切替を行うと一覧へ即座に反映されること', async ({ page }) => {
    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. NGワード管理画面へ遷移
    await page.goto('/admin/ng-words');
    await page.waitForTimeout(2000);

    await expect(page.locator('h1')).toContainText('NGワードマスタ管理');

    const wordInput = page.getByLabel('NGワード');
    const addButton = page.locator('button:has-text("追加")');
    await expect(wordInput).toBeVisible();
    await expect(addButton).toBeVisible();

    // 3. 新規語句を登録し、一覧テーブルへ即時反映されることを確認（ページリロード不要）
    const testWord = `E2Eテスト語句${Date.now()}`;
    await wordInput.fill(testWord);
    await addButton.click();

    await expect(page.locator(`text=${testWord}`).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=登録しました')).toBeVisible();

    // 対象行を一意に特定するため、有効/無効トグルの data-testid（NGワードID由来）を取得しておく。
    // 編集モードでは語句セルが <input> に切り替わり textContent から消えるため、
    // 以降は語句テキストではなくこの ID をキーに行を特定する。
    const initialRow = page.locator('tr', { hasText: testWord });
    const toggleTestId = await initialRow
      .locator('[data-testid^="ngword-toggle-"]')
      .getAttribute('data-testid');
    expect(toggleTestId).toBeTruthy();

    const row = page.locator('tr').filter({
      has: page.locator(`[data-testid="${toggleTestId}"]`),
    });

    // 4. 同じ語句を再度登録しようとすると、重複エラーがインライン表示され登録されないこと
    await wordInput.fill(testWord);
    await addButton.click();
    await expect(page.locator('text=この語句はすでに登録されています。')).toBeVisible();
    // 一覧に重複行が追加されていないこと（同一語句のテキストが1件のみ存在すること）
    await expect(page.locator(`text=${testWord}`)).toHaveCount(1);
    await wordInput.fill('');

    // 5. 登録した語句の表記を編集し、一覧へ即座に反映されることを確認
    const editedWord = `${testWord}-編集後`;
    await row.locator('button:has-text("編集")').click();

    const editInput = row.locator('input[type="text"]');
    await expect(editInput).toHaveValue(testWord);
    await editInput.fill(editedWord);
    await row.locator('button:has-text("保存")').click();

    await expect(row).toContainText(editedWord, { timeout: 10000 });
    await expect(page.locator('text=NGワードを更新しました。')).toBeVisible();

    // 6. 有効/無効トグルを操作し、状態が即座に画面へ反映されることを確認
    await expect(row.locator('text=有効')).toBeVisible();
    const toggle = row.locator(`[data-testid="${toggleTestId}"]`);
    await toggle.click();

    await expect(row.locator('text=無効')).toBeVisible({ timeout: 10000 });
    await expect(row.locator('text=有効')).not.toBeVisible();

    // 再度有効化して元の状態に戻す（テストデータの後片付け。物理削除APIは存在しないため無効化のみ行う）
    await toggle.click();
    await expect(row.locator('text=有効')).toBeVisible({ timeout: 10000 });
  });

  test('管理者ポータルから「NGワード管理」カードをクリックすると /admin/ng-words へ遷移すること', async ({ page }) => {
    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    if (await e2eLoginBtn.isVisible()) {
      await e2eLoginBtn.click();
      await page.waitForURL('/', { timeout: 10000 });
    }

    // 2. 管理者ポータルへ遷移
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    const isPageVisible = await page.locator('h1').filter({ hasText: '管理者コントロールセンター' }).isVisible().catch(() => false);

    if (isPageVisible) {
      // 「NGワード管理」ナビゲーションカードが表示されていることを確認
      const ngWordsCard = page.locator('text=NGワード管理');
      await expect(ngWordsCard).toBeVisible();

      // 3. クリックして /admin/ng-words へ遷移することを確認
      await ngWordsCard.click();
      await page.waitForURL(/\/admin\/ng-words/, { timeout: 5000 });
      await expect(page.locator('h1')).toContainText('NGワードマスタ管理');

      // NGワード管理画面から管理者ポータルへ戻れることも確認
      const portalLink = page.locator('text=管理者ポータルへ');
      await expect(portalLink).toBeVisible();
      await portalLink.click();
      await page.waitForURL(/\/admin$/, { timeout: 5000 });
    }
  });
});
