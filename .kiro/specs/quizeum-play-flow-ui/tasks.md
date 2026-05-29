# Implementation Plan: quizeum-play-flow-ui

## Tasks

### 1. ホーム画面のUI実装
- [x] 1.1 ホーム画面タブ切り替えとクイズグリッド表示の実装 (P)
  - `src/app/page.tsx` および `page.module.css` に、新着、人気、トレンド、およびフォローTL（ログイン時のみ）のタブパネルを実装する。
  - カジュアルモダンなクイズカードのグリッド表示を構築する。
  - _Requirements: 1.1_
  - _Boundary: HomePage_
- [x] 1.2 ジャンルナビゲーションと複合検索フィルタの実装
  - ジャンルアイコン一覧ナビゲーション、およびジャンル、難易度（1-10）、問題数、未プレイ等の複合検索パネルを構築し、動的にクイズリストが更新されることを確認する。
  - 未ログイン時のブックマーク操作時のリダイレクト制御を実装する。
  - _Requirements: 1.2, 1.3, 1.4_
  - _Boundary: HomePage-Filters_

### 2. クイズ詳細画面のUI実装
- [x] 2.1 クイズ基本情報と良問評価バッジ表示の実装 (P)
  - `src/app/quiz/[id]/page.tsx` および `page.module.css` を作成し、タイトル、難易度、タグ、 perfect score リーダーボードなどを親しみやすいデザインで実装する。
  - `reviewBadge` フィールドに基づく良問バッジとスコアを表示し、仮リセット再評価期間中のマスク処理を統合する。
  - _Requirements: 2.1, 2.2_
  - _Boundary: QuizDetailPage_
- [x] 2.2 プレイモード選択UIと遷移の実装
  - 「通常モード」「模擬試験モード」「フラッシュカードモード」の3つのプレイモードを選択できるPlay Panelを実装し、開始時に選択したモードでプレイ画面へ遷移するように構築する。
  - _Requirements: 2.3, 2.4_
  - _Boundary: QuizDetailPage-Modes_

### 3. クイズプレイ画面（通常・模擬試験・フラッシュカード）のUI実装
- [x] 3.1 設問表示・タイマー・ヒント表示の実装 (P)
  - `src/app/quiz/[id]/play/page.tsx` に通常プレイ用のUIを実装する。
  - 個別カウントダウンタイマー、模擬試験全体の総合制限タイマー、ヒントポップアップダイアログを構築する。
  - _Requirements: 3.1, 3.2_
  - _Boundary: QuizPlayPage_
- [x] 3.2 localStorageを用いた解答進捗のセッション保護と復元の実装
  - `src/hooks/usePlayState.ts` を作成し、設問解答時や経過秒数を `localStorage` に自動シリアライズして退避し、ページ再読み込み時に自動復元する処理を実装する。
  - オフライン時のローカル解答進行と、オンライン復帰時の同期インジケーターを実装する。
  - _Requirements: 3.3, 3.4_
  - _Boundary: PlayStateManager_

### 4. 水平思考クイズ（ウミガメのスープ）プレイ画面のUI実装
- [x] 4.1 2カラムAIチャットレイアウトの実装 (P)
  - クイズタイプが `lateral-thinking` の場合、プレイ画面を2カラムレイアウトに切り替え、左にチャットエリア、右にスクロール可能なQ&A履歴リストを表示する。
  - 未ログインユーザーのアクセス制限（`/login` へのリダイレクト）を実装する。
  - _Requirements: 4.1, 4.2_
  - _Boundary: QuizPlayPage-AiColumn_
- [x] 4.2 AI回答生成中の待機インタラクション実装
  - `src/hooks/useAiPlayState.ts` を作成し、質問送信時に `pending: true` となり、チャット末尾に入力欄やチャットバブルの形で「・・・AIが質問を分析中です」とグレー文字でインライン表示する。
  - 同一質問キャッシュバッジ表示、無料ユーザーの1日20回制限と入力無効化UIを実装する。
  - _Requirements: 4.3, 4.4, 4.5_
  - _Boundary: AiPlayStateManager_
- [x] 4.3 真相回答入力とAI真相判定合格時のクリア演出の実装
  - 「真相を解き明かす」ボタンから最終回答を送信し、API判定で合格した際にクリアのアニメーションを再生して結果画面へ自動遷移するフローを実装する。
  - _Requirements: 4.6_
  - _Boundary: QuizPlayPage-Verify_

### 5. クイズ結果画面のUI実装
- [x] 5.1 スコア結果・正誤リストおよび解説表示の実装 (P)
  - `src/app/quiz/[id]/result/page.tsx` を作成し、正解数、経過秒数、各設問の正誤一覧、マークダウン解説を表示する。
  - _Requirements: 5.1_
  - _Boundary: QuizResultPage_
- [x] 5.2 評価・難易度投票、間違い指摘、作家リアクションUIの実装
  - 👍/👎良問評価ボタン、1-10の難易度投票、間違い・別解指摘フォームモーダル、作家へのお礼リアクション送信ボタンを実装する。
  - オフライン時の機能ボタン非活性化と警告メッセージ表示を実装する。
  - _Requirements: 5.2, 5.3, 5.4, 5.5_
  - _Boundary: QuizResultPage-Feedback_

### 6. 弱点克服（復習プレイ）画面のUI実装
- [x] 6.1 ジャンルフィルタ選択と復習プレイセッション開始の実装 (P)
  - `src/app/quiz/review/page.tsx` を作成し、復習前にジャンル（またはオールジャンル）を選択するパネルを実装する。
  - 間違えた設問を一括フェッチして開始するフローを構築する。
  - _Requirements: 6.1, 6.2_
  - _Boundary: ReviewPage_
- [x] 6.2 復習完了時のリスト自動クレンジング実装
  - 復習セッション終了時、正解した設問を間違いリストから一括削除し、`users.totalFailedQuestionsCount` を減算するアトミック処理を呼び出す。
  - _Requirements: 6.3_
  - _Boundary: ReviewPage-Cleanup_

### 7. その他の探索・リーダーボード画面のUI実装
- [x] 7.1 総合リーダーボード画面の実装 (P)
  - `src/app/leaderboard/page.tsx` にハイスコア、プレイ数、クリエイターランキングを切り替えるタブとグリッド表示を構築する。
  - _Requirements: 7.1_
  - _Boundary: LeaderboardPage_
- [x] 7.2 タグ別・ジャンル別クイズ一覧画面の実装 (P)
  - `src/app/tags/[tagName]/page.tsx` および `src/app/genres/[genreName]/page.tsx` に合致するクイズカード一覧グリッドを実装する。
  - _Requirements: 7.2_
  - _Boundary: ExplorePages_
- [x] 7.3 ブックマーク一覧画面の実装 (P)
  - `src/app/bookmarks/page.tsx` に、ブックマークしたクイズおよびリストのタブ一覧を表示し、ダイレクトにブックマークのトグル解除が行えるUIを構築する。
  - _Requirements: 7.3_
  - _Boundary: BookmarksPage_
