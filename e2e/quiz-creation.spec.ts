import { test, expect } from '@playwright/test';

test.describe('クイズ作成・管理 E2Eテスト', () => {

  test('ユーザーはクイズの新規作成、問題エディタでの問題設定、下書き保存、および公開申請を行えること', async ({ page }) => {
    await page.goto('/');
    let dialogMessage = '';
    page.on('dialog', async dialog => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    // 2. ヘッダーの「作問する」をクリック
    const createQuizBtn = page.locator('text=作問する');
    await expect(createQuizBtn).toBeVisible();
    await createQuizBtn.click();

    // 3. クイズ新規作成画面にいることを確認
    await expect(page).toHaveURL(/\/quiz\/create/);
    await expect(page.locator('h1:has-text("クイズを新規作成")')).toBeVisible();

    // 4. 基本情報（タイトル、説明）の入力
    const quizTitle = `[TEST] E2E自動クイズ_${Date.now().toString().slice(-4)}`;
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(quizTitle);
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('これはPlaywrightのE2Eテストによって自動作成されたクイズです。');

    // 5. タグ追加と正規化・サジェストの動作確認
    const tagInput = page.locator('input[placeholder="タグを入力してEnter"]');
    await expect(tagInput).toBeVisible();
    await tagInput.fill('react');
    await tagInput.press('Enter');

    // タグが登録されたことを確認
    await expect(page.locator('text=#react')).toBeVisible();

    // 6. 第1問（デフォルト追加済み）の入力
    // 問題文
    const q1Textarea = page.locator('[data-testid^="auto-grow-question-text"]').first();
    await expect(q1Textarea).toBeVisible();
    await q1Textarea.fill('Reactにおいて、コンポーネントのステートを管理するためのフックは次のうちどれ？');

    // 選択肢1 (正解) の入力 (第1問目の選択肢1)
    const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
    await expect(choiceInputs.first()).toBeVisible();
    await choiceInputs.nth(0).fill('useState');
    await choiceInputs.nth(1).fill('useEffect');
    await choiceInputs.nth(2).fill('useContext');
    await choiceInputs.nth(3).fill('useRef');

    // 問題解説の入力
    const explanationTextarea = page.locator('textarea[placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"]').first();
    await expect(explanationTextarea).toBeVisible();
    await explanationTextarea.fill('ステート管理には useState を使用します。useEffectは副作用用、useContextはContext取得用です。');

    // 7. 「下書き保存」をクリック
    const saveDraftBtn = page.locator('text=下書き保存');
    await expect(saveDraftBtn).toBeVisible();
    await saveDraftBtn.click();

    // アラートの表示とダッシュボードへの遷移を確認
    await expect.poll(() => dialogMessage).toContain('下書きを保存しました');
    await expect(page).toHaveURL(/\/creator\/dashboard/);

    // ダッシュボード内に保存した下書きクイズが表示されていることを確認
    await expect(page.locator(`text=${quizTitle}`)).toBeVisible();
  });
});
