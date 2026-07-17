import { test, expect } from '@playwright/test';
import { readE2eFixtureIds } from './fixture-ids';

test.describe('コミュニティガバナンス凍結機能 E2Eテスト', () => {
  const fixtures = readE2eFixtureIds();

  test.beforeEach(async ({ page }) => {
    // 動画広告モーダルなどを無効化
    await page.goto('/');
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
    });
  });

  test('モデレーターアカウントでマージ/ジャンル管理画面にアクセスした際、404（not-found）にリダイレクトされること', async ({ page, context }) => {
    // 管理者セッションをクリアしてモデレーターでログインし直す
    await context.clearCookies();
    await page.goto('/');
    await page.evaluate(() => window.localStorage.clear());

    await page.goto(`/login?e2eEmail=${encodeURIComponent(fixtures.moderator.email)}&e2ePassword=${encodeURIComponent(fixtures.moderator.password)}`);
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    await expect(e2eLoginBtn).toBeVisible({ timeout: 15000 });
    await e2eLoginBtn.click();
    await expect(page).toHaveURL('/', { timeout: 15000 });

    // `/community/merge` にアクセス
    await page.goto('/community/merge');
    // 307で /not-found に遷移し、表示が404になること
    await expect(page).toHaveURL('/not-found', { timeout: 10000 });

    // `/community/genres` にアクセス
    await page.goto('/community/genres');
    await expect(page).toHaveURL('/not-found', { timeout: 10000 });
  });

  test('管理者アカウントでマージ/ジャンル管理画面にアクセスでき、保留案件の承認/却下が正常に行えること', async ({ page }) => {
    // デフォルトで管理者アカウントとしてログイン済みのセッションを使用
    await page.goto('/community/merge');

    // 凍結中警告バナーが描画されていること
    await expect(page.locator('text=コミュニティガバナンスは一時凍結中です')).toBeVisible({ timeout: 10000 });

    // シードした保留中のマージ提案（e2e-source-tag → e2e-target-tag）が表示されていること
    const sourceTagLink = page.locator('button', { hasText: 'e2e-source-tag ↗' }).first();
    await expect(sourceTagLink).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=e2e-target-tag').first()).toBeVisible();

    // マージの承認ボタン
    const approveBtn = page.locator(`#vote-approve-${fixtures.governanceFreeze.pendingMergeRequestId}`);
    await expect(approveBtn).toBeVisible();
    await approveBtn.click();

    // 承認成功の表示を確認
    await expect(page.locator('text=マージ提案を承認し、即時実行しました')).toBeVisible({ timeout: 10000 });

    // 2. ジャンル管理画面の検証
    await page.goto('/community/genres');
    await expect(page).toHaveURL('/community/genres');

    // 凍結中警告バナーが描画されていること
    await expect(page.locator('text=コミュニティガバナンスは一時凍結中です')).toBeVisible({ timeout: 5000 });

    // 投票タブ（保留中の申請一覧）に切り替え
    const voteTab = page.locator('#tab-vote');
    await expect(voteTab).toBeVisible();
    await voteTab.click();

    // シードした保留中のジャンル申請（e2e-pending-genre）が表示されていること
    await expect(page.locator('text=e2e-pending-genre').first()).toBeVisible({ timeout: 5000 });

    // 承認ボタンをクリック
    const genreApproveBtn = page.locator(`#genre-vote-approve-${fixtures.governanceFreeze.pendingGenreRequestId}`);
    await expect(genreApproveBtn).toBeVisible();
    await genreApproveBtn.click();

    // 承認成功の表示を確認
    await expect(page.locator('text=ジャンル申請「E2E保留ジャンル」を承認し、即時登録しました')).toBeVisible({ timeout: 10000 });
  });

  test('プロフィール画面でティアバッジと信頼スコアが非表示であること', async ({ page }) => {
    // デフォルトで管理者アカウントとしてログイン済みのセッションを使用し、プロフィール画面へ遷移
    await page.goto(`/profile/${fixtures.userId}`);
    await expect(page.locator('h1', { hasText: 'e2e-test-user' })).toBeVisible({ timeout: 15000 });

    // ティアバッジ (senior_moderator など) が非表示であること
    await expect(page.locator('text=senior_moderator').or(page.locator('text=シニアモデレータ'))).not.toBeVisible();
    // 信頼スコア (reputationScore などのラベル) が非表示であること
    await expect(page.locator('text=信頼スコア')).not.toBeVisible();
  });
});

