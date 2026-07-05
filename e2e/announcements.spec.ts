import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';
import { readE2eFixtureIds } from './fixture-ids';

test.describe('運営からのお知らせ機能 E2Eテスト', () => {

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

  test('未ログインユーザー：お知らせ一覧の閲覧とログイン誘導', async ({ browser }) => {
    // setupプロジェクトで保存されたストレージ状態を引き継がないよう、空のコンテキストを作成する
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. 未ログイン状態で通知画面 (/notifications) にアクセス
    await page.goto('/notifications');
    await page.waitForTimeout(2000);

    // デフォルトで「通知」タブが選択されているか確認
    const personalTabTrigger = page.locator('[data-testid="personal-tab-trigger"]');
    await expect(personalTabTrigger).toHaveAttribute('aria-selected', 'true');

    // ログイン誘導UIが表示されることを確認
    await expect(page.locator('text=通知機能を利用するにはログインが必要です')).toBeVisible();
    await expect(page.locator('[data-testid="login-redirect-btn"]')).toBeVisible();

    // 「運営からのお知らせ」タブを選択
    const announcementTabTrigger = page.locator('[data-testid="announcements-tab-trigger"]');
    await announcementTabTrigger.click();
    await page.waitForTimeout(1000);

    // ログイン誘導UIが非表示になり、お知らせタブの内容が正しく表示されること
    await expect(page.locator('text=通知機能を利用するにはログインが必要です')).not.toBeVisible();

    await context.close();
  });

  test('管理者ユーザー：お知らせの作成・編集・削除CRUDフロー', async ({ browser }) => {
    // 他テストから引き継がれたログイン状態を回避するため、空のコンテキストを作成して明示的にログインする
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. ログイン画面に遷移して、E2Eテストログインボタンでログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible({ timeout: 10000 });
    await e2eLoginBtn.click();
    await page.waitForURL('/', { timeout: 10000 });
    await page.waitForTimeout(3000); // クッキー同期の完了を十分に待つ

    // 2. 管理者ポータルからお知らせ管理画面に遷移
    await page.goto('/admin');
    await page.waitForTimeout(2000);

    const announcementsAdminCard = page.locator('text=運営からのお知らせ管理');
    await expect(announcementsAdminCard).toBeVisible();
    await announcementsAdminCard.click();
    await page.waitForURL(/\/admin\/announcements/, { timeout: 5000 });

    // 3. 新規お知らせ作成
    await page.locator('[data-testid="open-create-announcement-btn"]').click();

    // ダイアログの表示を待つ
    await expect(page.getByRole('heading', { name: '新規お知らせ作成' })).toBeVisible();

    // フォームへの入力
    const testTitle = 'E2Eテストお知らせタイトル-' + Date.now();
    await page.locator('input[placeholder="お知らせのタイトルを入力"]').fill(testTitle);

    // カテゴリとステータスの選択
    await page.locator('select').first().selectOption('update'); // カテゴリ: update
    await page.locator('select').nth(1).selectOption('published'); // ステータス: published

    // 本文入力
    const testContent = 'これは**E2Eテスト**の本文です。[詳細はこちら](https://example.com)';
    await page.locator('textarea[placeholder="お知らせの本文を入力 (Markdown対応)"]').fill(testContent);

    // プレビューの動作確認
    await page.locator('button:has-text("プレビューを表示")').click();
    await expect(page.locator('strong:has-text("E2Eテスト")')).toBeVisible();

    // エディタに戻す
    await page.locator('button:has-text("エディタを表示")').click();

    // 保存
    await page.locator('[data-testid="submit-announcement-btn"]').click();

    // 一覧に新しく作成したお知らせが表示されることを確認
    await page.waitForTimeout(2000);
    await expect(page.locator(`text=${testTitle}`)).toBeVisible();

    // 4. お知らせの編集
    // 編集ボタンをクリック（新しく作ったカード内の編集ボタン）
    const card = page.locator('[data-testid="admin-announcement-card"]', { hasText: testTitle });
    await card.locator('button:has-text("編集")').first().click();

    // 編集ダイアログでタイトルを変更
    const updatedTitle = testTitle + '-編集済';
    await page.locator('input[placeholder="お知らせのタイトルを入力"]').fill(updatedTitle);

    // 保存
    await page.locator('[data-testid="submit-announcement-btn"]').click();
    await page.waitForTimeout(2000);

    // 変更後のタイトルが表示されているか確認
    await expect(page.locator(`text=${updatedTitle}`)).toBeVisible();

    // 5. 一般ユーザー向け表示の確認 (公開中のお知らせが反映されているか)
    await page.goto('/notifications');
    await page.waitForTimeout(2000);

    // 「運営からのお知らせ」タブを選択
    const announcementTabTrigger = page.locator('[data-testid="announcements-tab-trigger"]');
    await announcementTabTrigger.click();
    await page.waitForTimeout(1000);

    // 作成・編集したお知らせが一般ユーザー画面で見えることを確認
    await expect(page.locator(`text=${updatedTitle}`)).toBeVisible();

    // 初期状態は省略表示のため、お知らせカードをクリックして展開する
    const announcementCard = page.locator('[data-testid="announcement-card"]', { hasText: updatedTitle });
    await announcementCard.click();
    await page.waitForTimeout(500);

    // Markdownが正しくHTMLレンダリングされていることをアサート
    const contentElement = page.locator('strong:has-text("E2Eテスト")');
    await expect(contentElement).toBeVisible();

    // 6. 管理画面に戻り、お知らせを削除
    await page.goto('/admin/announcements');
    await page.waitForTimeout(2000);

    // ダイアログハンドラを登録
    page.on('dialog', async (dialog) => {
      expect(dialog.message()).toContain('このお知らせを削除しますか？');
      await dialog.accept();
    });

    // 削除ボタンをクリック
    const updatedCard = page.locator('[data-testid="admin-announcement-card"]', { hasText: updatedTitle });
    await updatedCard.locator('button:has-text("削除")').first().click();
    await page.waitForTimeout(2000);

    // 一覧から削除されたことを確認
    await expect(page.locator(`text=${updatedTitle}`).first()).not.toBeVisible();

    // 一般画面でも削除されたことを確認
    await page.goto('/notifications');
    await page.waitForTimeout(2000);
    // 「運営からのお知らせ」タブを選択
    const announcementTabTriggerAfterDel = page.locator('[data-testid="announcements-tab-trigger"]');
    await announcementTabTriggerAfterDel.click();
    await page.waitForTimeout(1000);
    await expect(page.locator(`text=${updatedTitle}`).first()).not.toBeVisible();

    await context.close();
  });

  test('一般・管理者ユーザー：重要お知らせの強調表示・お知らせの一括既読の検証', async ({ browser }) => {
    const context = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await context.newPage();

    // 1. ログイン
    await page.goto('/login');
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible({ timeout: 10000 });
    await e2eLoginBtn.click();
    await page.waitForURL('/', { timeout: 10000 });
    await page.waitForTimeout(3000);

    // 2. お知らせ管理画面で重要お知らせを作成
    await page.goto('/admin/announcements');
    await page.waitForTimeout(2000);

    await page.locator('[data-testid="open-create-announcement-btn"]').click();
    const testTitle = 'E2E重要おしらせ-' + Date.now();
    await page.locator('input[placeholder="お知らせのタイトルを入力"]').fill(testTitle);
    await page.locator('select').first().selectOption('important'); // 重要カテゴリ
    await page.locator('select').nth(1).selectOption('published'); // 公開
    await page.locator('textarea[placeholder="お知らせの本文を入力 (Markdown対応)"]').fill('これはE2Eテストによる重要お知らせです。');
    await page.locator('[data-testid="submit-announcement-btn"]').click();
    await page.waitForTimeout(2000);

    // 3. 通知画面に遷移し、未読バッジとお知らせカードの強調表示を検証
    await page.goto('/notifications');
    await page.waitForTimeout(2000);

    // 「運営からのお知らせ」タブの横に未読バッジ（数が1以上）が表示されているか確認
    const annTabTrigger = page.locator('[data-testid="announcements-tab-trigger"]');
    await expect(annTabTrigger.locator('span')).toBeVisible();

    // タブをクリックして切り替え
    await annTabTrigger.click();
    await page.waitForTimeout(1000);

    // 重要お知らせカードが表示されているか
    const card = page.locator('[data-testid="announcement-card"]', { hasText: testTitle });
    await expect(card).toBeVisible();
    // 重要お知らせカードには border-rose-500 クラス（またはそれに類する赤いスタイル）が適用されているか
    await expect(card).toHaveClass(/border-rose-500/);

    // 4. 一括既読ボタンを押下して、未読バッジが消える（件数0）ことを確認
    const markAllReadBtn = page.locator('[data-testid="announcements-mark-all-read-btn"]');
    await expect(markAllReadBtn).toBeVisible();
    await markAllReadBtn.click();
    await page.waitForTimeout(1000);

    // 未読バッジ（件数表示）が消えていることを確認
    await expect(annTabTrigger.locator('span')).not.toBeVisible();

    // 5. 後片付け：作成したお知らせを削除
    await page.goto('/admin/announcements');
    await page.waitForTimeout(2000);

    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    const updatedCard = page.locator('[data-testid="admin-announcement-card"]', { hasText: testTitle });
    await updatedCard.locator('button:has-text("削除")').first().click();
    await page.waitForTimeout(2000);

    await context.close();
  });
});
