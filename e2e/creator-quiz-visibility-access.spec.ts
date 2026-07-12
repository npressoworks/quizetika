import { test, expect, type Browser, type Page } from '@playwright/test';
import { readE2eFixtureIds } from './fixture-ids';

/**
 * クイズの公開範囲（限定公開・非公開）切り替えと、それに伴う閲覧アクセス制御の
 * 複数アカウントE2Eテスト（要件17.4-17.8）。
 *
 * - Pro プランの作成者（author）が自分のクイズの公開範囲を非公開・限定公開に切り替えると、
 *   フォロワー（follower）と無関係な第三者（stranger）の閲覧可否が正しく変わること。
 * - 無料プランのユーザー（stranger）は自分のクイズであっても非公開・限定公開へは
 *   実際には切り替えられず、Pro プラン誘導ポップアップが表示されること。
 *
 * アカウント・フォロー関係・対象クイズは `e2e/global-setup.ts` が事前に投入する
 * （`e2e/fixture-ids.ts` の `visibilityTest`）。ログインは `/login` の E2E テスト用
 * ログインボタンをクエリパラメータ `e2eEmail`/`e2ePassword` で対象アカウントに向けて実行する。
 */

const { visibilityTest } = readE2eFixtureIds();

async function loginAs(
  browser: Browser,
  email: string,
  password: string
): Promise<Page> {
  const context = await browser.newContext({ storageState: undefined });
  const page = await context.newPage();
  await page.goto(
    `/login?e2eEmail=${encodeURIComponent(email)}&e2ePassword=${encodeURIComponent(password)}`
  );
  const e2eLoginBtn = page.locator('#e2e-test-login-btn');
  await expect(e2eLoginBtn).toBeVisible({ timeout: 10000 });
  await e2eLoginBtn.click();
  await expect(page).toHaveURL('/', { timeout: 15000 });
  await page.waitForLoadState('domcontentloaded');
  return page;
}

test.describe('クイズ公開範囲（限定公開・非公開）のアクセス制御 E2Eテスト', () => {
  test('Proプランの作成者が公開範囲を切り替えると、フォロワー・第三者からの閲覧可否が正しく制御されること', async ({
    browser,
  }) => {
    const authorPage = await loginAs(
      browser,
      visibilityTest.author.email,
      visibilityTest.author.password
    );
    const strangerPage = await loginAs(
      browser,
      visibilityTest.stranger.email,
      visibilityTest.stranger.password
    );
    const followerPage = await loginAs(
      browser,
      visibilityTest.follower.email,
      visibilityTest.follower.password
    );

    const quizId = visibilityTest.authorQuizId;

    async function setVisibility(page: Page, optionValue: 'public' | 'followers' | 'private') {
      const row = page.getByTestId(`creator-quiz-management-row-${quizId}`);
      await expect(row).toBeVisible({ timeout: 15000 });
      const toggle = row.getByTestId('creator-quiz-visibility-toggle');
      await toggle.click();
      const option = page.getByTestId(`creator-quiz-visibility-toggle-option-${optionValue}`);
      await expect(option).toBeVisible();
      await option.click();
      // Pro誘導ポップアップが誤って出ないこと（authorはPro）を確認しつつ、反映を待つ
      await expect(page.getByTestId('creator-quiz-visibility-pro-modal')).toHaveCount(0);
      await expect(row.getByTestId(`creator-quiz-status-${optionValue}`)).toBeVisible({
        timeout: 10000,
      });
    }

    // 1. author: 一覧から対象クイズを「非公開」に切り替える
    await authorPage.goto('/creator/quizzes');
    await setVisibility(authorPage, 'private');

    // 2. stranger: 非公開クイズは閲覧できない（Supabase RLSにより存在しないものとして扱われる）
    await strangerPage.goto(`/quiz/${quizId}`);
    await expect(strangerPage.getByText('クイズが見つかりませんでした')).toBeVisible({
      timeout: 10000,
    });

    // 3. author: 「限定公開」に切り替える
    await authorPage.goto('/creator/quizzes');
    await setVisibility(authorPage, 'followers');

    // 4. follower: フォロー済みのため限定公開クイズを閲覧できる
    await followerPage.goto(`/quiz/${quizId}`);
    await expect(
      followerPage.locator('h1').filter({ hasText: '限定公開・非公開テスト用クイズ' })
    ).toBeVisible({ timeout: 10000 });

    // 5. stranger: フォローしていないため限定公開クイズは依然として閲覧できない
    await strangerPage.goto(`/quiz/${quizId}`);
    await expect(strangerPage.getByText('クイズが見つかりませんでした')).toBeVisible({
      timeout: 10000,
    });

    // 後片付け: 次回実行のため公開に戻す
    await authorPage.goto('/creator/quizzes');
    await setVisibility(authorPage, 'public');
  });

  test('無料プランのユーザーは自分のクイズを非公開・限定公開へ実際には切り替えられず、Proプラン誘導ポップアップが表示されること', async ({
    browser,
  }) => {
    const strangerPage = await loginAs(
      browser,
      visibilityTest.stranger.email,
      visibilityTest.stranger.password
    );
    const quizId = visibilityTest.strangerQuizId;

    await strangerPage.goto('/creator/quizzes');
    const row = strangerPage.getByTestId(`creator-quiz-management-row-${quizId}`);
    await expect(row).toBeVisible({ timeout: 15000 });

    // 切替前は公開状態であることを確認
    await expect(row.getByTestId('creator-quiz-status-public')).toBeVisible();

    const toggle = row.getByTestId('creator-quiz-visibility-toggle');
    await toggle.click();
    const privateOption = strangerPage.getByTestId(
      'creator-quiz-visibility-toggle-option-private'
    );
    await expect(privateOption).toBeVisible();
    await privateOption.click();

    // Pro プラン誘導ポップアップが表示されること
    await expect(strangerPage.getByTestId('creator-quiz-visibility-pro-modal')).toBeVisible({
      timeout: 10000,
    });
    await expect(strangerPage.getByRole('link', { name: /Pro/ })).toHaveAttribute(
      'href',
      '/pricing'
    );

    // ポップアップを閉じても、実際の公開範囲は「公開」のまま変わっていないこと
    await strangerPage.keyboard.press('Escape');
    await expect(row.getByTestId('creator-quiz-status-public')).toBeVisible({ timeout: 10000 });
    await expect(row.getByTestId('creator-quiz-status-private')).toHaveCount(0);

    // サーバー側でも公開範囲が変更されていないこと（RLS越しに他者から見て非公開になっていないか、
    // 自分自身の一覧再取得で公開のままであることを再確認する）
    await strangerPage.reload();
    const reloadedRow = strangerPage.getByTestId(`creator-quiz-management-row-${quizId}`);
    await expect(reloadedRow.getByTestId('creator-quiz-status-public')).toBeVisible({
      timeout: 15000,
    });
  });
});
