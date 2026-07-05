import { test, expect } from '@playwright/test';
import { createDbClient } from './db-client';
import { readE2eFixtureIds } from './fixture-ids';

test.describe('クイズ編集画面指摘機能 E2Eテスト', () => {
  const db = createDbClient();
  const { userId, quizIds, questionIds } = readE2eFixtureIds();
  const quizId = quizIds[0];
  const questionId = questionIds[0];
  let reportId: string;

  test.beforeAll(async () => {
    await db.connect();
  });

  test.afterAll(async () => {
    await db.end();
  });

  test.beforeEach(async () => {
    // クイズのジャンルを有効なものにアップデート ('game' は src/data/initial_genres.json に実在するID)
    await db.query(`UPDATE quizzes SET genre = 'game', canonical_genre_id = 'game' WHERE id = $1`, [
      quizId,
    ]);

    // 指摘のテストデータをシード
    const result = await db.query<{ id: string }>(
      `INSERT INTO feedback_reports (
         quiz_id, quiz_title, question_id, question_text, reporter_id, creator_id, category, content, status
       ) VALUES ($1, '[AD_TEST] クイズ_1', $2, '問題_1 の本文', $3, $3, 'typo', $4, 'open')
       RETURNING id`,
      [quizId, questionId, userId, '誤字があります。「正解」ではなく「正しい」にしてください。']
    );
    reportId = result.rows[0].id;
  });

  test.afterEach(async () => {
    // テストデータのクリーンアップ
    await db.query(`DELETE FROM feedback_reports WHERE id = $1`, [reportId]);
  });

  test('編集画面に指摘内容が正しく表示され、解決・却下・モーダル連携が行えること', async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    // 1. クイズの編集画面へアクセス
    await page.goto(`/quiz/${quizId}/edit`);
    await page.waitForLoadState('domcontentloaded');

    // 2. 公開ボタンの表記が「更新」になっていることを確認
    const publishBtn = page.locator('button').filter({ hasText: '更新' }).first();
    await expect(publishBtn).toBeVisible();

    // 3. 指摘ボタン（フローティング）が表示され、バッジ数が 1 であることを確認
    const feedbackSidebarBtn = page.getByTestId('feedback-sidebar-button');
    await expect(feedbackSidebarBtn).toBeVisible();
    await expect(feedbackSidebarBtn.locator('span')).toHaveText('1');

    // 4. 問題カード内にインライン指摘が表示されていることを確認
    const questionInlineFeedback = page.getByTestId('question-inline-feedback');
    await expect(questionInlineFeedback).toBeVisible();
    await expect(questionInlineFeedback).toContainText('誤字があります。');
    await expect(page.getByTestId('question-inline-feedback-badge')).toBeVisible();

    // 5. 指摘ボタンをクリックするとサイドバーが表示され、指摘内容が含まれること
    await feedbackSidebarBtn.click();
    const sidebarPanel = page.getByTestId('feedback-sidebar-panel');
    await expect(sidebarPanel).toBeVisible();
    await expect(sidebarPanel).toContainText('指摘ユーザー');

    // サイドバーを閉じる
    await sidebarPanel.locator('button').filter({ hasText: '' }).first().click(); // 閉じるボタン
    await expect(sidebarPanel).toBeHidden();

    // 6. 「更新」ボタンをクリックすると警告モーダルが表示されること
    await publishBtn.click();
    const unresolvedModal = page.getByTestId('unresolved-reports-modal');
    await expect(unresolvedModal).toBeVisible();
    await expect(unresolvedModal).toContainText('未解消の指摘があります');

    // 7. モーダル内の「却下」ボタンをクリックして却下する
    const rejectBtn = unresolvedModal.getByRole('button', { name: '却下' });
    await rejectBtn.click();

    // 却下後、モーダル内の指摘が解消されてモーダルが自動的に閉じるか、または空になることを期待
    // 本実装ではモーダル表示トリガーとなる未解消指摘が 0 になったとしても、モーダル自体は閉じないため「このまま更新する」で更新
    await expect(unresolvedModal.getByRole('button', { name: '却下' })).toBeHidden();

    // 8. 「このまま更新する」をクリックして更新処理を強行する
    const forcePublishBtn = unresolvedModal.getByRole('button', { name: 'このまま更新する' });
    await forcePublishBtn.click();

    // 更新完了後に詳細画面またはダッシュボードなどへ遷移することを確認
    await expect(page).toHaveURL(new RegExp(`/quiz/${quizId}/success`));
  });
});
