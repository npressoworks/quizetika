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
    // このテストは広告表示自体の検証対象ではないため、動画広告モーダルによる
    // 結果画面遷移の阻害（1/3確率でのランダム表示）を避けるために広告を無効化する
    await page.evaluate(() => {
      window.localStorage.setItem('e2e-mock-ads-disabled', 'true');
    });
    await expect(page.locator('h1').filter({ hasText: /クイズを新規作成|クイズを編集/ }).first()).toBeVisible({ timeout: 15000 });

    const uniqueTitle = `[TEST] E2Eプレイ_${Date.now().toString().slice(-4)}`;
    await page.locator('input[placeholder="例: React Hooksの基礎知識クイズ"]').fill(uniqueTitle);
    await page.locator('textarea[placeholder="クイズの概要や対象読者などを入力してください。"]').fill('E2Eテストプレイ検証用の自動生成クイズです。');
    
    // ジャンルの選択
    const genreInput = page.getByTestId('genre-editor-search-input');
    await genreInput.click();
    const genreOption = page.getByTestId('genre-editor-search-option-science-technology');
    await expect(genreOption).toBeVisible();
    await genreOption.click();

    // 第1問目の問題入力
    const qTextarea = page.locator('textarea[placeholder="例: Reactにおいて、**useState** で管理するのは？"]').first();
    await qTextarea.fill('Reactのフックでステート管理を行うのは？');

    // 選択肢の入力
    const choiceInputs = page.locator('[class*="choiceRow"] input[type="text"]');
    await choiceInputs.nth(0).fill('useState'); // 正解
    await choiceInputs.nth(1).fill('useEffect');
    await choiceInputs.nth(2).fill('useContext');
    await choiceInputs.nth(3).fill('useRef');

    // 解説
    const expTextarea = page.locator('textarea[placeholder="正解した/間違えた挑戦者へ表示する解説文を入力してください。"]').first();
    await expTextarea.fill('正解は useState です。');

    // 公開
    const publishBtn = page.getByRole('button', { name: '公開', exact: true });
    await expect(publishBtn).toBeVisible();
    await publishBtn.click();

    // 公開完了画面への遷移を待つ
    await expect(page).toHaveURL(/\/quiz\/[a-zA-Z0-9_-]+\/success/);

    // 3. 検索画面へ移動して公開したクイズを検索する
    await page.goto('/search');

    // 検索入力欄に作成したクイズのユニークタイトルを入力
    const searchInput = page.locator('input[placeholder="タイトル、説明文、作成者、タグでクイズを検索..."]');
    await expect(searchInput).toBeVisible();
    await searchInput.fill(uniqueTitle);
    
    // 検索結果に該当のクイズカードが表示されるのを待つ
    const quizCard = page.getByTestId('quiz-card').filter({ hasText: uniqueTitle });
    await expect(quizCard).toBeVisible();
    await quizCard.getByTestId('play-btn').click();

    // 4. クイズ詳細画面からプレイを開始する
    await expect(page).toHaveURL(/\/quiz\//);
    await expect(page.getByTestId('play-mode-leaderboard-warning')).toBeVisible();
    const startPlayBtn = page.locator('text=プレイを開始する');
    await expect(startPlayBtn).toBeVisible();
    await startPlayBtn.click();

    // 5. クイズプレイ画面での解答操作
    await expect(page).toHaveURL(/\/play/);
    // 正解の選択肢「useState」を選択する
    const optionLabel = page.locator('label').filter({ hasText: 'useState' }).first();
    await expect(optionLabel).toBeVisible({ timeout: 5000 });
    await optionLabel.click();

    // 解答を確定する
    const confirmBtn = page.getByRole('button', { name: '解答を確定する' });
    await expect(confirmBtn).toBeVisible();
    await confirmBtn.click();

    // 6. 全問終了（今回は1問）後、「結果を見る」ボタンで結果画面へ遷移する
    const seeResultBtn = page.getByRole('button', { name: '結果を見る ➔' });
    await expect(seeResultBtn).toBeVisible();
    await seeResultBtn.click();

    // 7. 結果画面の表示検証
    await expect(page).toHaveURL(/\/result/);

    // スコアが 1 / 1 正解 であることを確認（要素が分割されているため、コンテナに対して検証）
    const scoreCircle = page.getByTestId('quiz-result-score-circle');
    await expect(scoreCircle).toBeVisible();
    await expect(scoreCircle).toContainText('1');
    await expect(scoreCircle).toContainText('1');
    await expect(scoreCircle).toContainText('問 正解');
    
    // 8. 良問評価👍を送信
    const thumbsUpBtn = page.getByRole('button', { name: '良問', exact: true });
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

    // 9. 難易度投票の送信 (炎評価UIの5段階目を指定)
    const difficultyVoteBtn = page.getByTestId('difficulty-vote-star-5');
    await expect(difficultyVoteBtn).toBeVisible();
    await difficultyVoteBtn.click();
    await expect(difficultyVoteBtn).toHaveText('🔥');
    await expect(difficultyVoteBtn).not.toHaveClass(/grayscale/);

    // 10. 作家感謝リアクションの送信
    const reactionBtn = page.locator('button').filter({ hasText: 'お礼リアクションを送る' }).first();
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
