import { test, expect } from '@playwright/test';
import { readE2eFixtureIds } from './fixture-ids';

const E2E_USER_UID = readE2eFixtureIds().userId;

test.describe('認証・プロフィール画面 Streaming / Suspense スケルトン E2E', () => {

  test('プロフィール画面で profile-skeleton が消えコンテンツが表示されること', async ({ page }) => {
    await page.goto(`/profile/${E2E_USER_UID}`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('profile-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('profile-page-container')).toBeVisible({ timeout: 15000 });
  });

  test('つながり一覧で connections-skeleton が消えコンテンツが表示されること', async ({ page }) => {
    await page.goto(`/profile/${E2E_USER_UID}/connections`);
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByTestId('connections-skeleton')).toBeHidden({ timeout: 15000 });
    await expect(page.getByTestId('connections-page-container')).toBeVisible({ timeout: 15000 });
  });

  test('未認証時に /profile/edit へのアクセスがログインへリダイレクトされること', async ({ browser }) => {
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();

    await page.goto('/profile/edit');
    await expect(page).toHaveURL(/\/login/);
    expect(new URL(page.url()).searchParams.get('redirect')).toBe('/profile/edit');

    await context.close();
  });
});
