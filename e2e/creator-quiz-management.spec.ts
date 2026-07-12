import { test, expect } from '@playwright/test';

/**
 * 作成クイズ管理画面（/creator/quizzes）のスモークE2Eテスト（Phase 40, タスク14.12）。
 *
 * 事前に本テスト専用のクイズを新規作成し、既知・決定的なデータとして
 * 検索・絞り込み・並び替え・編集導線・公開範囲切り替えUIの非表示を検証する
 * （テスト実行アカウントに既存のクイズがどれだけあるか・どんな内容かに依存しないため）。
 *
 * _Requirements: 15.1, 15.2, 15.4, 15.6, 16.7, 16.8, 17.2, 17.3, 17.9, 18.3, 19.1, 19.3_
 */
test.describe('作成クイズ管理画面 (/creator/quizzes) E2Eスモークテスト', () => {
  test('一覧表示→検索→絞り込み→並び替え→新規作成導線→編集導線→指摘バッジ→編集画面遷移の一連のフロー', async ({
    page,
  }) => {
    const quizTitle = `[TEST] 管理画面E2E_${Date.now().toString().slice(-6)}`;
    const uniqueTag = `mgmte2e${Date.now().toString().slice(-6)}`;

    // ── 事前準備: 検索・絞り込み・編集導線検証用の既知クイズを新規作成（下書き保存） ──
    await page.goto('/quiz/create');
    await expect(
      page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()
    ).toBeVisible({ timeout: 15000 });

    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(quizTitle);

    const genreSearchInput = page.getByTestId('genre-editor-search-input');
    await expect(genreSearchInput).toBeVisible();
    await genreSearchInput.click();
    await genreSearchInput.fill('歴史');
    const genreOption = page.getByTestId('genre-editor-search-option-history-geography');
    await expect(genreOption).toBeVisible();
    await genreOption.click();

    const tagInput = page.locator('input[placeholder="タグを入力してEnter"]');
    await expect(tagInput).toBeVisible();
    await tagInput.fill(uniqueTag);
    await tagInput.press('Enter');
    await expect(page.locator(`text=#${uniqueTag}`)).toBeVisible();

    const q1Textarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
    await expect(q1Textarea).toBeVisible();
    await q1Textarea.fill('作成クイズ管理画面E2Eテスト用の問題文です。');

    const saveDraftBtn = page.locator('text=下書き保存').first();
    await expect(saveDraftBtn).toBeVisible();
    await saveDraftBtn.click();
    await expect(page).toHaveURL(/\/creator\/quizzes/, { timeout: 15000 });

    // ── 1. 作成クイズ管理画面に遷移済み。一覧に表示されることを確認（要件15.1, 15.4） ──
    await expect(page.getByTestId('creator-quiz-management-page')).toBeVisible({
      timeout: 15000,
    });
    const list = page.getByTestId('creator-quiz-management-list');
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    const row = page
      .locator('[data-testid^="creator-quiz-management-row-"]')
      .filter({ hasText: quizTitle });
    await expect(row).toBeVisible();

    // ── 2. キーワード検索で結果が絞り込まれることを確認（要件16.1, 16.2, 16.7） ──
    const keywordInput = page.getByTestId('creator-quiz-management-filter-keyword');
    await keywordInput.fill(quizTitle);
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    await keywordInput.fill('絶対に一致しないはずのキーワードxyz999');
    await expect(list.getByText(quizTitle)).toBeHidden({ timeout: 15000 });
    await keywordInput.fill('');
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    // ── 3. 統合ステータス絞り込み（作成したクイズは下書き）（要件16.3, 16.7, 17.9） ──
    const statusSelect = page.getByTestId('creator-quiz-management-filter-status');
    await statusSelect.click();
    await page.getByTestId('creator-quiz-management-filter-status-option-draft').click();
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    await statusSelect.click();
    await page.getByTestId('creator-quiz-management-filter-status-option-public').click();
    await expect(list.getByText(quizTitle)).toBeHidden({ timeout: 15000 });

    await statusSelect.click();
    await page.getByTestId('creator-quiz-management-filter-status-option-all').click();
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    // ── 4. ジャンル絞り込み（要件16.4, 16.7） ──
    const genreFilterSelect = page.getByTestId('creator-quiz-management-filter-genre');
    await genreFilterSelect.click();
    await page
      .getByTestId('creator-quiz-management-filter-genre-option-history-geography')
      .click();
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    await genreFilterSelect.click();
    await page.getByTestId('creator-quiz-management-filter-genre-option-all').click();

    // ── 5. タグ絞り込み（要件16.6, 16.7） ──
    const tagFilterInput = page.getByTestId('creator-quiz-management-filter-tag');
    await tagFilterInput.fill(uniqueTag);
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    // ── 6. フィルタ一括クリア（要件16.9） ──
    await page.getByTestId('creator-quiz-management-clear-filters').click();
    await expect(keywordInput).toHaveValue('');
    await expect(tagFilterInput).toHaveValue('');
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    // ── 7. 並び替え操作が機能すること（要件16.11-16.14） ──
    const sortSelect = page.getByTestId('creator-quiz-management-sort');
    await sortSelect.click();
    await page.getByTestId('creator-quiz-management-sort-option-title-asc').click();
    await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });

    // ── 8. 下書き行には公開範囲切り替えUIが表示されないことを確認（要件17.2, 17.3） ──
    await expect(row.getByTestId('creator-quiz-visibility-toggle')).toHaveCount(0);
    await expect(row.getByTestId(`creator-quiz-status-draft`)).toBeVisible();

    // ── 9. 未解決指摘件数バッジが存在する場合、選択すると編集画面へ遷移すること（要件18.3） ──
    const reportBadge = row.getByTestId('creator-quiz-report-badge');
    if (await reportBadge.isVisible().catch(() => false)) {
      await reportBadge.click();
      await expect(page).toHaveURL(/\/quiz\/[\w-]+\/edit$/, { timeout: 15000 });
      await page.goto('/creator/quizzes');
      await expect(list.getByText(quizTitle)).toBeVisible({ timeout: 15000 });
    }

    // ── 10. 「編集する」操作で編集画面へ遷移すること（要件15.9） ──
    const editRow = page
      .locator('[data-testid^="creator-quiz-management-row-"]')
      .filter({ hasText: quizTitle });
    await editRow.getByRole('button', { name: '編集する' }).click();
    await expect(page).toHaveURL(/\/quiz\/[\w-]+\/edit$/, { timeout: 15000 });

    // ── 11. 「クイズを新規作成する」導線でクイズ作成画面へ遷移すること（要件15.8） ──
    await page.goto('/creator/quizzes');
    await expect(page.getByTestId('creator-quiz-management-page')).toBeVisible({
      timeout: 15000,
    });
    await page.getByRole('button', { name: 'クイズを新規作成する' }).first().click();
    await expect(page).toHaveURL(/\/quiz\/create/, { timeout: 15000 });
  });
});
