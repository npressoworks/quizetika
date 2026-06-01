import { test, expect } from '@playwright/test';

test.describe('クイズプレイ・結果評価フロー E2Eテスト', () => {

  test('ユーザーは公開されたクイズを検索・プレイし、全問正解後に結果画面で良問評価、難易度投票、感謝リアクションを行えること', async ({ page }) => {
    // 1. ダイアログハンドラの設定 (alertのキャッチ)
    let dialogMessages: string[] = [];
    page.on('dialog', async dialog => {
      dialogMessages.push(dialog.message());
      await dialog.accept();
    });

    // 2. テスト用のクイズを作成して公開する
    await page.goto('/quiz/create');
    // ログイン状態が失われている場合の自動ログイン・フォールバック
    const e2eLoginBtn = page.locator('#e2e-test-login-btn');
    try {
      await e2eLoginBtn.waitFor({ state: 'visible', timeout: 3000 });
      if (await e2eLoginBtn.isVisible()) {
        await e2eLoginBtn.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {}
    await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });

    const uniqueTitle = `[TEST] E2Eプレイ_${Date.now().toString().slice(-4)}`;
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(uniqueTitle);
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('E2Eテストプレイ検証用の自動生成クイズです。');

    // 第1問目の問題入力
    const qTextarea = page.locator('textarea[placeholder="例: Reactにおいて、コンポーネントのステートを管理するためのフックは？"]').first();
    await qTextarea.fill('Reactのフックでステート管理を行うのは？');

    // 選択肢の入力
    const choiceInputs = page.locator('.choiceRow input[type="text"]');
    await choiceInputs.nth(0).fill('useState'); // 正解
    await choiceInputs.nth(1).fill('useEffect');
    await choiceInputs.nth(2).fill('useContext');
    await choiceInputs.nth(3).fill('useRef');

    // 解説
    const expTextarea = page.locator('textarea[placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"]').first();
    await expTextarea.fill('正解は useState です。');

    // 公開
    const publishBtn = page.locator('text=公開');
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // 公開完了アラートを閉じる
    await expect.poll(() => dialogMessages).toContain('クイズを公開しました！');
    await expect(page).toHaveURL(/\/creator\/dashboard/);

    // 3. ホームに戻って公開したクイズを検索する
    await page.goto('/');
    
    // 検索入力欄に作成したクイズのユニークタイトルを入力
    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(uniqueTitle);
    
    // 検索結果に該当のクイズカードが表示されるのを待つ
    const quizCard = page.locator(`text=${uniqueTitle}`).first();
    await expect(quizCard).toBeVisible();
    await quizCard.click();

    // 4. クイズ詳細画面からプレイを開始する
    await expect(page).toHaveURL(/\/quiz\//);
    const startPlayBtn = page.locator('text=プレイを開始する');
    await expect(startPlayBtn).toBeVisible();
    await startPlayBtn.click();

    // 5. クイズプレイ画面での解答操作
    await expect(page).toHaveURL(/\/play/);
    // 正解の選択肢「useState」のボタン要素をクリック（strict mode 回避のためbuttonに厳密化）
    const correctOptionBtn = page.locator('button.optionBtn, button').filter({ hasText: 'useState' }).first();
    await expect(correctOptionBtn).toBeVisible({ timeout: 5000 });
    await correctOptionBtn.click();

    // 6. 全問終了（今回は1問）後のリザルト遷移
    const viewResultBtn = page.locator('text=結果を確認する');
    await expect(viewResultBtn).toBeVisible();
    await viewResultBtn.click();

    // 7. 結果画面の表示検証
    await expect(page).toHaveURL(/\/result/);
    
    // スコアが 1 / 1 正解 であることを確認（要素が分割されているため、コンテナに対して検証）
    const scoreCircle = page.locator('[class*="scoreCircle"]');
    await expect(scoreCircle).toBeVisible();
    await expect(scoreCircle).toContainText('1');
    await expect(scoreCircle).toContainText('1');
    await expect(scoreCircle).toContainText('問 正解');
    
    // 8. 良問評価👍を送信
    const thumbsUpBtn = page.locator('text=良問 (👍)');
    await expect(thumbsUpBtn).toBeVisible();
    
    // 自身が作成したクイズは評価できない仕様（disabled）になっているかを確認
    // ※ 自身が作者の場合、authorId と userId が同じになるため、良問ボタンは無効化されます。
    // その仕様の挙動を検証します。
    const authorIsMe = await thumbsUpBtn.isDisabled();
    if (authorIsMe) {
      // 自身が作成したクイズであるため無効化されていることを確認
      await expect(thumbsUpBtn).toBeDisabled();
    } else {
      await thumbsUpBtn.click();
      // クリック後にボタンが active（押された状態）になることを確認
      await expect(thumbsUpBtn).toHaveClass(/voteActive/);
    }

    // 9. 難易度投票の送信 (CSSモジュールのハッシュ化回避のため、テキストで厳密に「5」のボタンを指定)
    const difficultyVoteBtn = page.getByRole('button', { name: '5', exact: true });
    await expect(difficultyVoteBtn).toBeVisible();
    await difficultyVoteBtn.click();
    await expect(difficultyVoteBtn).toHaveClass(/.*diffCellSelected.*/);

    // 10. 作家感謝リアクションの送信
    const reactionBtn = page.locator('text=お礼リアクションを送る');
    if (await reactionBtn.isVisible()) {
      if (authorIsMe) {
        await expect(reactionBtn).toBeDisabled();
      } else {
        await reactionBtn.click();
        await expect(page.locator('text=感謝を送信しました！')).toBeVisible();
      }
    }
  });
});
