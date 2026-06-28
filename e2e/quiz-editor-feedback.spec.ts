import { test, expect } from '@playwright/test';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const PROJECT_ID = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? 'quizeum-77bc6';

test.describe('クイズ編集画面指摘機能 E2Eテスト', () => {
  let db: any;

  test.beforeAll(async () => {
    // Firebase Admin の初期化
    process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST ?? '127.0.0.1:8080';
    if (getApps().length === 0) {
      initializeApp({ projectId: PROJECT_ID });
    }
    db = getFirestore();
  });

  test.beforeEach(async () => {
    // クイズのジャンルを有効なものにアップデート
    await db.collection('quizzes').doc('e2e-ad-test-quiz-1').update({
      genre: 'trivia',
      canonicalGenreId: 'trivia',
    });

    // 指摘のテストデータをシード
    await db.collection('feedbackReports').doc('e2e-test-report-1').set({
      id: 'e2e-test-report-1',
      quizId: 'e2e-ad-test-quiz-1',
      quizTitle: '[AD_TEST] クイズ_1',
      questionId: 'e2e-ad-test-q-1',
      questionText: '問題_1 の本文',
      reporterId: 'reporter-uid-999',
      creatorId: 'e2e-test-uid-123456',
      category: 'typo',
      content: '誤字があります。「正解」ではなく「正しい」にしてください。',
      status: 'open',
      createdAt: new Date(),
    });
  });

  test.afterEach(async () => {
    // テストデータのクリーンアップ
    await db.collection('feedbackReports').doc('e2e-test-report-1').delete();
  });

  test('編集画面に指摘内容が正しく表示され、解決・却下・モーダル連携が行えること', async ({ page }) => {
    page.on('console', msg => {
      console.log(`[BROWSER CONSOLE] ${msg.type()}: ${msg.text()}`);
    });
    // 1. クイズの編集画面へアクセス
    await page.goto('/quiz/e2e-ad-test-quiz-1/edit');
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
    await expect(page).toHaveURL(/\/quiz\/e2e-ad-test-quiz-1\/success/);
  });
});
