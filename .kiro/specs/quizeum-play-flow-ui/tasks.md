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
- [x] 2.3 クイズ詳細画面への作成者用編集ボタンと編集画面遷移の実装 (P)
  - `src/app/quiz/[id]/page.tsx` を修正し、ログイン中ユーザーがクイズの作成者（`user?.id === quiz.authorId`）である場合に「クイズを編集する」ボタンを表示する。
  - ボタンクリック時に `/quiz/[id]/edit` へ遷移させる処理を実装する。
  - _Requirements: 2.5, 2.6_
  - _Boundary: QuizDetailPage_

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

### 8. クイズ編集画面における認可保護実装
- [x] 8.1 クイズ編集画面における未ログイン制限と所有者認可ガードの実装 (P)
  - `src/components/quiz/quiz-editor.tsx` を修正し、未ログインユーザーの直接アクセス時に `/login` へリダイレクトする制御を実装する。
  - ログイン中ユーザーがクイズの所有者ではない場合（`user.id !== quiz.authorId`）、編集フォームのロードおよびレンダリングをブロックし、「アクセス権限がありません。このクイズは他のユーザーが作成したものです。」という警告メッセージUIを表示する。
  - _Requirements: 8.1, 8.2_
  - _Boundary: QuizEditor_

### 9. クイズ単位リーダーボードUI（Phase 5）
- [x] 9.1 初回／リプレイ二系統リーダーボードコンポーネントの実装 (P)
  - 初回プレイとリプレイをタブで切り替え、各タブに上位5名の表（順位・表示名・正解数・合計解答時間・達成日）を表示する。
  - クイズデータは読み取り専用ヘルパーで取得し、最大5件に切り詰める。並び替え・マージ・永続化は行わない。
  - 記録がないタブには空状態を表示し、全問正解限定の文言は使わない。
  - 設計どおりの `data-testid`（全体・タブ・初回表・リプレイ表・各行）を付与し、ブラウザで初回タブがデフォルト表示されることを確認する。
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  - _Boundary: QuizDualLeaderboard_
- [x] 9.2 クイズ詳細画面へのリーダーボード統合
  - 詳細画面の暫定インライン表とクライアント側並び替えを削除し、新コンポーネントに差し替える。
  - 完了時、詳細ページでタブ式の二系統リーダーボードのみが表示され、ページ内にLB更新ロジックが残っていないこと。
  - _Requirements: 9.1, 9.8_
  - _Depends: 9.1_
  - _Boundary: QuizDetailPage_
- [x] 9.3 クイズ詳細リーダーボードのE2Eテスト更新
  - 旧「最速／ハイスコア専用」セレクタを Phase 5 の初回・リプレイ契約に合わせて更新する。
  - リプレイタブ切替後にリプレイ表が表示され、エントリ行の `data-testid` が初回・リプレイ両方で使えることを検証する。
  - _Requirements: 9.7_
  - _Depends: 9.2_
  - _Boundary: E2E-leaderboard-spec_
- [x] 9.4 リーダーボード表示コンポーネントの単体テスト（任意）
  - 空配列・5件・レガシー `leaderboard` フォールバック時の表示をモック `quiz` で検証する。
  - _Requirements: 9.4, 9.5, 9.6_
  - _Depends: 9.1_
  - _Boundary: QuizDualLeaderboard_

---

### 10. Phase 6 拡張 — ジャンルマスタ駆動の探索UI（2026-06）

> **前提**: `quizeum-core` Phase 6 完了（`listActiveGenres`, `getQuizzesByGenre` C2, `searchQuizzes`）。本スペックは UI 接続のみ。

- [x] 10.1 `useActiveGenres` フックとジャンルナビコンポーネント (P)
  - `listActiveGenres` をマウント時に取得し、loading / error / 空配列を返すフックを実装する。
  - `GenreNav` で `displayName` と `iconImageUrl`（フォールバック絵文字可）を表示し、各アイコンクリックで **常に** `/genres/[genreId]` へ遷移する（ホーム内フィルタに使わない）。
  - **完了状態**: 有効ジャンルが API から描画され、ハードコード `GENRES` がホームから削除されていること。
  - _Requirements: 1.2, 10.1, 10.2, 10.3, 10.9_
  - _Boundary: GenreNav, useActiveGenres_
  - _Depends: quizeum-core Phase 6_

- [x] 10.1b (P) `GenreSearchField` — サジェスト付きジャンル選択
  - `useActiveGenres` の一覧を `displayName` / `genreId` で前方一致・部分一致サジェストするコンボボックスを複合検索パネルに配置する。
  - 選択結果は `genreId` フィルタとして `useHomeQuizFeed` に渡す（アイコン遷移とは別経路）。
  - **完了状態**: マスタ件数が多くてもテキスト入力でジャンルを指定できること。
  - _Requirements: 1.3, 10.4_
  - _Depends: 10.1_

- [x] 10.2 ホーム画面の複合検索・`searchQuizzes`・プレイ状況（要件 1.3 完遂）
  - `useHomeQuizFeed`: ジャンル ID・難易度・問題数・キーワードのいずれかが有効なとき、フィルタ変更をデバウンス（例 300ms）後に `searchQuizzes` を呼ぶ。全未指定時はタブ別取得を維持。
  - `usePlayedQuizIds` + `listUserPlayedQuizIds`（`attempt.ts`）+ `GET /api/user/played-quiz-ids`: 認証ユーザーのプレイ済み `quizId` を取得し、`playStatus`（未プレイ／プレイ済み）をタブ取得・検索結果の後段で適用する。
  - 未認証時はプレイ状況 select を無効化し案内表示（または常にすべて）。
  - **完了状態**: ジャンル＋難易度の AND 検索、プレイ状況絞り込み、フィルタ変更トリガーが動作すること。
  - _Requirements: 1.3, 10.4_
  - _Depends: 10.1, 10.1b_

- [x] 10.3 (P) ジャンル別一覧画面のメタ表示とソートタブ
  - `listActiveGenres` から `displayName` / `iconImageUrl` を解決してヘッダーを表示する。
  - 「新着」「人気」「トレンド」タブで `getQuizzesByGenre(genreId, limit, sort)` を切り替える。
  - **完了状態**: マージ済み旧ジャンルのクイズが C2 経由で一覧に含まれ、ソート切替が動作すること。
  - _Requirements: 10.5, 10.6_
  - _Depends: quizeum-core Phase 6_

- [x] 10.4 (P) タグ別一覧の canonical クエリとソート
  - `getQuizzesByTag(tag, limit, sort)` を用い、ジャンル一覧と同型のソート UI を追加する。
  - **完了状態**: タグページで新着／人気／トレンドの切替が動作すること。
  - _Requirements: 10.7_
  - _Depends: quizeum-core Phase 6_

- [x] 10.5 弱点克服画面のジャンル選択をマスタ駆動に更新
  - `REVIEW_GENRES` ハードコードを `listActiveGenres` +「オールジャンル」に置換する。
  - **完了状態**: 新設可決ジャンルが復習フィルタに表示されること（マスタ反映後）。
  - _Requirements: 10.8_
  - _Depends: 10.1_

- [x] 10.6 Phase 6 統合検証
  - ジャンルアイコン遷移、サジェスト検索、フィルタ変更→`searchQuizzes`、認証時 `playStatus`、ジャンル一覧ソート、復習フィルタをコンポーネントまたは E2E で検証する。
  - マスタ取得失敗時にハードコード一覧へフォールバックしないことを確認する。
  - **完了状態**: 関連 Jest / Playwright がグリーンであること。
  - _Requirements: 1.2, 1.3, 10.1, 10.4, 10.5, 10.6, 10.8, 10.10_
  - _Depends: 10.2, 10.3, 10.4, 10.5_

- [x]* 10.7 Phase 6 E2E スモーク（任意）
  - ジャンル新設可決後にホームナビと `/genres/[id]` に新ジャンルが現れることを E2E または手動チェックリストで確認する。
  - **完了状態**: チェックリストまたは E2E 記録が残ること。
  - _Depends: 10.6_
  - _Requirements: 10.1, 10.5_

---

### 11. Phase 8 拡張 — 分類ブックマークと設問リストプレイ UI（2026-06）

> **前提**: `quizeum-core` Phase 8 完了（`getBookmarkFeed`, `getQuestionsInList`, `toggleBookmark` 設問対応, `saveAttempt` の `question-list` モード）。本スペックは UI・セッション状態・遷移のみ。

- [x] 11.1 (P) 設問リスト連続プレイセッションライブラリ
  - `sessionStorage` キー `quizeum_question_list_session` でリスト ID・順序付きエントリ（`questionId`, `parentQuizId`）・現在インデックスを初期化・読取・進行・クリアする純関数を実装する。
  - 設問リストプレイ用 URL（`mode=question-list`, `questionId`, `qIndex`, `listId`）を組み立てるヘルパーを提供する。
  - Jest で init → read → advance → 最終後 null → clear のシーケンスを検証する。
  - **完了状態**: セッションライブラリの単体テストがグリーンであり、設問リスト開始時に先頭エントリの URL が生成できること。
  - _Requirements: 11.11, 11.12_
  - _Boundary: question-list-session_
  - _Depends: quizeum-core Phase 8_

- [x] 11.2 (P) `useBookmarkFeed` フック
  - マウント時に `getBookmarkFeed` を1回呼び出し、クイズ・リスト・設問の3分類フィードと loading 状態を返す。
  - `toggleBookmark` による解除後、該当タブの配列から楽観的にエントリを除去する `removeBookmark` を提供する（タブ切替で再フェッチしない）。
  - **完了状態**: 認証ユーザーで feed が3分類とも取得でき、解除後に UI 状態から当該アイテムが消えること。
  - _Requirements: 11.1, 11.3, 11.4, 11.5_
  - _Boundary: useBookmarkFeed_
  - _Depends: quizeum-core Phase 8_

- [x] 11.3 (P) ブックマークタブ・カードコンポーネント群
  - `BookmarksTabs` で「クイズ」「リスト」「設問」タブを切り替え、設計どおりの `data-testid`（`bookmarks-tabs`, `bookmarks-tab-quiz`, `bookmarks-tab-list`, `bookmarks-tab-question`）を付与する。
  - `BookmarkQuizGrid` は既存ホームカードスタイルを再利用し、解除トグルと `/quiz/[id]` 遷移を提供する。
  - `BookmarkListGrid` はリストカードに解除トグルと `/list/[id]` リンクを提供する。
  - `BookmarkQuestionList` は問題文抜粋・親クイズタイトル・ブックマーク日時降順で設問を表示し、カードクリックで `/quiz/[parentQuizId]/play?startAtQuestionId={id}` へ遷移する。
  - 各タブの空状態に要件どおりの案内文を表示する。
  - **完了状態**: 3タブコンポーネントが Storybook 相当の単体描画または RTL で切替・空状態・testid を確認できること。
  - _Requirements: 11.1, 11.3, 11.4, 11.5, 11.6_
  - _Depends: 11.2_
  - _Boundary: BookmarksTabs, BookmarkQuizGrid, BookmarkListGrid, BookmarkQuestionList_

- [x] 11.4 ブックマーク一覧ページの3タブ統合
  - `bookmarks/page.tsx` を `getBookmarkedQuizzes` 単体から `useBookmarkFeed` + `BookmarksTabs` + 各グリッドへ置換する。
  - 未認証アクセス時は既存どおり `/login` へリダイレクトする（11.2）。
  - **完了状態**: `/bookmarks` で3タブが表示され、クイズタブの既存カード UX が維持されつつリスト・設問タブが動作すること。
  - _Requirements: 7.3, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - _Depends: 11.3_
  - _Boundary: BookmarksPage_

- [x] 11.5 (P) 設問ブックマークトグルコンポーネント
  - 設問行に星アイコンのオン／オフトグルを表示し、認証時は `toggleBookmark(userId, questionId, 'question')` を呼び出す。
  - 未認証時の操作は `/login` へ遷移する。親クイズ非公開などコア検証エラー時はトグルを元に戻しエラーを表示する。
  - **完了状態**: トグル操作で BM 状態が切り替わり、未認証時にログイン画面へ遷移すること。
  - _Requirements: 11.7, 11.8, 11.9_
  - _Boundary: QuestionBookmarkToggle_
  - _Depends: quizeum-core Phase 8_

- [x] 11.6 (P) リスト詳細の設問リスト分岐と連続プレイ開始
  - `resolveListType` で `listType === 'question'` のとき `getQuestionsInList` による順序付き設問一覧（抜粋・親タイトル）と「設問リストプレイ開始」ボタンを表示する。
  - 開始時に `initQuestionListSession` を呼び、先頭設問の親クイズプレイ URL へ遷移する。
  - `listType === 'quiz'`（または legacy 未設定）は従来の `getQuizzesInList` + 「リストプレイ開始」（`mode=list`）を維持し、設問リスト UI と混在させない。
  - **完了状態**: 設問リスト詳細で設問一覧と開始ボタンが表示され、クイズリスト詳細は従来どおりクイズ連続プレイのみ提供すること。
  - _Requirements: 11.10, 11.11, 11.13_
  - _Depends: 11.1_
  - _Boundary: ListDetailPage_

- [x] 11.7 プレイ画面の設問リストモードと設問BM統合
  - `mode=question-list` クエリ時、`questionId` に一致する1問のみをプレイ対象とし、完了時に `saveAttempt` で `mode: 'question-list'`, `totalQuestions: 1`, `listId` を送信する。
  - 通常・模擬試験プレイ中の設問表示行に `QuestionBookmarkToggle` を配置する（ウミガメスープは対象外でよい）。
  - `startAtQuestionId` クエリ時は当該設問から解答開始できるようインデックスを初期化する（設問タブからの単体プレイ、セッションは作成しない）。
  - **完了状態**: 設問リストプレイで1問完了後に attempt が `question-list` で保存され、プレイ中に設問 BM トグルが動作すること。
  - _Requirements: 11.6, 11.7, 11.9, 11.11, 11.14_
  - _Depends: 11.1, 11.5_
  - _Boundary: QuizPlayPage_

- [x] 11.8 結果画面の設問BMと設問リスト次設問遷移
  - 正誤一覧の各設問行に `QuestionBookmarkToggle` を配置する（公開親設問のみ操作可能）。
  - `listId` かつ `question-list-session` 存在時は、クイズリスト（`quizIds`）分岐より先に設問リスト分岐を評価し、「次の設問へ」で次エントリのプレイ URL へ遷移する。最終設問後はセッションをクリアし完了メッセージとリスト詳細リンクを表示する。
  - セッション欠落時は「リストの続きを再生できません」案内を表示する。
  - **完了状態**: 設問リスト2問目以降へ結果画面から遷移でき、最終設問後に完了 UI が表示されること。
  - _Requirements: 11.8, 11.12_
  - _Depends: 11.1, 11.5, 11.7_
  - _Boundary: QuizResultPage_

- [x] 11.9 Phase 8 統合検証
  - 3タブブックマーク（表示・解除・設問カード→プレイ）、設問 BM トグル（プレイ・結果）、設問リスト連続プレイ（開始→1問完了→次設問→完了）、クイズリスト回帰を Jest またはコンポーネントテストで検証する。
  - `bookmarksCount` 更新や attempt 永続化ロジックが UI 層に追加されていないことを確認する。
  - **完了状態**: Phase 8 関連テストがグリーンであり、手動スモークで設問リスト3設問連続プレイが完走すること。
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14_
  - _Depends: 11.4, 11.6, 11.7, 11.8_

- [ ]* 11.10 Phase 8 E2E スモーク（任意）
  - `[data-testid="bookmarks-tabs"]` で3タブ切替、設問リスト詳細からの連続プレイ、結果画面の次設問ボタンを Playwright で検証する。
  - **完了状態**: E2E 記録またはチェックリストが残ること。
  - _Depends: 11.9_
  - _Requirements: 11.1, 11.10, 11.12_

## Implementation Notes

- Phase 6 は **読み取り専用**（`metadata_genres` 書き込み除く）。`attempts` の **読み取り**（プレイ済み ID 一覧）は要件 1.3 のため `listUserPlayedQuizIds` + API で許容。
- **確定 UX**: ジャンルアイコン＝遷移のみ。ジャンル条件は `GenreSearchField` + `searchQuizzes`（フィルタ変更・デバウンス）。`playStatus` は認証後クライアント後段フィルタ。
- `quizeum-creator-dash-ui` のエディタ動的セレクトと併せて E2E するとジャンル一貫性の受け入れが容易。
- Phase 6 実装（2026-06-03）: `GenreNav` は遷移専用。`GenreSearchField` + `useHomeQuizFeed`（300ms debounce）+ `applyPlayStatusFilter` / `GET /api/user/played-quiz-ids` で要件 1.3 完遂。Jest 296 件・build PASS。
- **Phase 8**: ブックマークは `getBookmarkFeed` 一括取得 + 楽観的解除。設問リスト進行は `question-list-session`（sessionStorage）。attempt 永続化・`bookmarksCount` はコアのみ（要件 11.14）。クイズリスト連続プレイ（`mode=list`）は回帰維持。
- Phase 8 実装（2026-06-05）: `components/bookmark/*`, `useBookmarkFeed`, `question-list-session`。Jest 354 件・build PASS。
- **Phase 10**: 統合検索は `UnifiedSearchField` + `useActiveTags` + `filter-search-suggestions`。タグ AND 検索は `useHomeQuizFeed` → `searchQuizzes({ tags })`（core 10.x 完了後に実装）。カードは `★ N` + ジャンル + 出題形式、探索一覧は `QuizCard` + `href` 共通化。
- Phase 10 実装（2026-06-06）: `UnifiedSearchField`, `useActiveTags`, `quiz-format-labels`, `QuizCard` 拡張、探索一覧共通化。Jest 430 件・build PASS。
- **Phase 11**: ホームは `ExploreAccordionsPanel` + カルーセル（ホーム内フィルタ、`GenreNav` 非表示）。`useExploreQuizFeed` が `format` 含む home/scoped 分岐。ジャンルページは `ExploreSearchSection` + `lockedGenreId`。scoped 検索 + ソート同時時は `sortQuizzesForList` でクライアント再ソート。前提: `quizeum-core` Phase 11（`SearchFilters.format`）完了。

---

### 12. Phase 9 拡張 — ホーム画面・クイズ探索 UI の最適化（2026-06）

- [x] 12.1 `QuizCard` および `SkeletonCard` コンポーネントの実装
  - サムネイル画像（`thumbnailUrl` が存在すればNext.js Image、なければジャンルに応じたスタイリッシュなグラデーション/プレースホルダー絵文字表示）、タイトル、作成者、難易度（プログレスバー）、星評価（`reviewScore` などのスター表示）、および「プレイする」ボタンを持つ `QuizCard` を作成する。
  - ホバー時にネオン発光境界線と浮き上がりアニメーションを実現する CSS Modules を `src/components/quiz/quiz-card.module.css` に定義する。
  - カード内のブックマークボタンをクリックした際の伝播制御（`stopPropagation`）および未認証時の `/login` 遷移、ブックマークトグルの状態反映を実装する。
  - ロード中のパルス（明滅）アニメーションを持つ `SkeletonCard` を `src/components/ui/skeleton-card.tsx` および `skeleton-card.module.css` として実装する。
  - **完了状態**: カードホバー時にスタイリッシュなネオン調のトランジションが作動し、ブックマーククリック時に詳細画面への遷移が阻害されずブックマーク更新が走ること。また、ロード中には骨組みプレースホルダーが明滅表示されること。
  - _Requirements: 1.4, 1.5_
  - _Boundary: QuizCard, SkeletonCard_

- [x] 12.2 ホーム画面レイアウトの最適化と統合検索 UI の統合
  - `src/app/page.tsx` を修正し、巨大なテキストバナーを削除・縮小し、検索バーを画面最上部の最も目立つ優先位置に配置する。
  - 検索入力エリアに虫眼鏡アイコン、入力クリア（X）ボタン、およびフォーカス時のネオン発光アウトラインエフェクトを実装する。
  - 検索バーの直下に人気のタグやおすすめのジャンルを示す「クイックサーチチップ（ネオンバッジチップ）」を配置し、クリック時に即座に検索欄へテキストを入力して統合検索を実行するロジックを実装する。
  - 横スクロール可能な1行ピル形式のカテゴリー（ジャンル）表示ナビゲーション（`GenreNav`）を実装し、主要ジャンル以外は「すべて見る」トグルで折りたたむようにする。
  - 検索中（`loading === true`）に `SkeletonCard` グリッドをプレースホルダーとして描画し、検索完了後に `QuizCard` グリッドへ切り替える。
  - フィルタ変更時またはキーワード入力時に 300ms デバウンスを適用して `searchQuizzes` を呼び出す。
  - **完了状態**: ホーム画面最上部に配置された統合検索バーが機能し、入力クリア、フォーカス時ネオンエフェクト、クイックバッジ検索が機能すること。また、ジャンルピルが横スクロール可能かつ「すべて見る」で開閉でき、ローディング中にスケルトンが表示されること。
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: HomePage, GenreNav_
  - _Depends: 12.1_

- [x] 12.3 統合検索およびホーム UI の結合テスト・E2Eテストの作成
  - 新規に作成した `QuizCard`、`SkeletonCard`、統合検索（バッジクリック検索や消去ボタン等の UI 動作）が期待通り動作することを検証するテストスイートを `tests/` 内に追加する。
  - **完了状態**: Jest で関連コンポーネントテストを実行した際に、すべてのテストケースがグリーンであること。
  - _Requirements: 1.4, 1.5_
  - _Depends: 12.2_
  - _Boundary: Testing_

- [x]* 12.4 回帰スモークテスト of 実行（任意）
  - ホーム画面のレイアウト改修後も、既存のタブ切り替えやクイズプレイ詳細画面への遷移、ブックマーク操作などのコアフローがデグレードなく動作することを検証する。
  - **完了状態**: 既存の E2E テストやコンポーネントテストがすべて正常にパスすること。
  - _Requirements: 1.1, 1.3_
  - _Depends: 12.3_
  - _Boundary: Testing_

---

### 13. Phase 10 拡張 — タグチップ統合検索・サジェスト強化・クイズカード情報拡充（2026-06）

> **前提**: `quizeum-core` Phase 10 完了（`listActiveTags`, `searchQuizzes` の `tags` 配列 AND 合成）。本スペックは UI・フィルタ状態・カード表示のみ。

- [x] 13.1 (P) 出題形式ラベル共有ライブラリ
  - クイズエディタ内のローカル形式ラベル解決を共有ライブラリへ抽出し、設問構成から推定した日本語ラベル（選択式、記述式、ウミガメのスープ等）をカードとエディタで同一規則で返す
  - エディタは共有ライブラリを参照するよう委譲し、重複ロジックを除去する
  - **完了状態**: 共有ライブラリの単体テストがグリーンであり、エディタとカードが同一ラベル文字列を表示すること
  - _Requirements: 12.18_
  - _Boundary: quiz-format-labels_

- [x] 13.2 (P) タグ・統合検索サジェストフィルタ
  - 有効タグマスタを ID 部分一致（表示は `tagName ?? id`）で絞り込む純関数を実装する
  - タグ候補とジャンル候補をマージしランキングする統合サジェスト純関数を実装する（ジャンルは表示名および ID の双方にマッチ可）
  - 空クエリ・大文字小文字無視・件数上限の単体テストを追加する
  - **完了状態**: サジェストフィルタの Jest がグリーンであり、タグ照合キーが ID であること
  - _Requirements: 12.7, 12.10_
  - _Boundary: filter-tag-suggestions, filter-search-suggestions_

- [x] 13.3 (P) 有効タグマスタ取得フック
  - マウント時に `listActiveTags` を1回取得し、loading / error / 空配列を返すフックを実装する（`useActiveGenres` と対称）
  - 存続タグ（マージ吸収済みを除外）のみを UI に渡し、ハードコード候補へフォールバックしない
  - `tagLabelById` マップを構築しサジェスト表示ラベルに利用する
  - **完了状態**: タグ取得失敗時にエラー状態が返り、成功時に安定したタグ一覧が描画に使えること
  - _Requirements: 12.7, 12.10_
  - _Depends: quizeum-core Phase 10_
  - _Boundary: useActiveTags_

- [x] 13.4 `QuizCard` の難易度星表記・ジャンル・出題形式拡張
  - 難易度を数値併記の星表記（例: `★ 7`）へ変更し、プログレスバー形式の表示を除去する
  - ジャンル表示名（任意 prop 優先、未指定時はクイズ保存値をフォールバック）と出題形式ラベル行を追加する
  - 任意 `href` 指定時はカード全体をリンク化し、探索一覧でも `data-testid="play-btn"` を維持する
  - 難易度・ジャンル・出題形式に設計どおりの `data-testid` を付与する
  - **完了状態**: コンポーネントテストで `★ N` 表示・testid・プログレスバー非存在が確認できること
  - _Requirements: 12.16, 12.17, 12.18, 12.19, 12.22_
  - _Depends: 13.1_
  - _Boundary: QuizCard_

- [x] 13.5 統合検索フィールド（タグチップ＋サジェスト）
  - 確定済みタグをチップ行に表示し、スペース（およびサジェスト非表示時の Enter）で `normalizeTag` 後にチップ追加、空トークン・重複は拒否する
  - サジェスト open かつ候補ありの Enter はハイライト候補を選択する（既存ジャンルサジェストと同型）
  - 自由入力1文字以上でタグ／ジャンル候補をドロップダウン表示し、タグ選択はチップ追加、ジャンル選択は `onGenreSelect` でフィルタ同期する
  - 消去ボタンでキーワード・全チップ・ジャンル選択を一括クリアできるよう親と連携する
  - チップ削除・キーボード操作・`data-testid`（`search-tag-chips`, `search-tag-chip`, `search-suggest-tag-*`, `search-suggest-genre-*`）を実装する
  - **完了状態**: `UnifiedSearchField` のコンポーネントテストがグリーンであり、Space 確定・サジェスト選択・クリアが期待どおり動作すること
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.21, 12.22_
  - _Depends: 13.2, 13.3_
  - _Boundary: UnifiedSearchField_

- [x] 13.6 ホームフィードへのタグチップ AND 検索連携
  - 複合フィルタ状態にタグチップ配列を追加し、全フィルタ未指定判定にチップ有無を含める
  - `searchQuizzes` 呼び出し時にキーワードと `tags` 配列を AND 合成で渡し、300ms デバウンスと依存配列にチップを含める
  - タグのみ・複数タグ AND・キーワード併用時に検索モードへ切り替わり、全未指定時はタブ別取得を維持する
  - **完了状態**: 複数タグチップ指定時に両タグを満たすクイズのみグリッドに表示されること
  - _Requirements: 12.12, 12.13, 12.14, 12.15_
  - _Depends: quizeum-core Phase 10_
  - _Boundary: useHomeQuizFeed, home-feed-filters_

- [x] 13.7 ホーム画面への統合検索・クイックチップ連携
  - プレーン検索入力を統合検索フィールドへ置換し、`useActiveTags` とフィルタパネル内ジャンル選択の双方向同期を実装する
  - クイックサーチチップクリック時はテキスト流し込みではなく対応タグチップを追加して即時検索する
  - 拡張済み `QuizCard` と読み込み中 `SkeletonCard` をグリッドに適用し、検索中スケルトン表示を維持する
  - **完了状態**: ホームでタグチップ追加・サジェスト・クリア後のタブ別復帰・クイックチップ→チップ追加が手動またはテストで確認できること
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.11, 12.12, 12.13, 12.14, 12.15, 12.20_
  - _Depends: 13.4, 13.5, 13.6_
  - _Boundary: HomePage_

- [x] 13.8 (P) ジャンル／タグ一覧での `QuizCard` 共通化
  - ジャンル別・タグ別一覧のインライン `Link` カードを共通 `QuizCard` グリッドへ置換する
  - `useActiveGenres` で解決した `genreDisplayName` と `href={/quiz/[id]}` を各カードに渡し、ソート切替時もスケルトン表示を維持する
  - **完了状態**: ジャンル／タグ一覧で `quiz-card-difficulty`・`quiz-card-genre`・`quiz-card-format` が表示され、カードクリックで詳細へ遷移すること
  - _Requirements: 12.19, 12.20_
  - _Depends: 13.4_
  - _Boundary: GenreExplorePage, TagExplorePage_

- [x] 13.9 Phase 10 統合検証
  - タグチップ・サジェスト・複数タグ AND・クイックチップ・カードメタ表示・探索一覧共通化をコンポーネントテストおよび E2E で検証する
  - Phase 9 ホームレイアウト・Phase 6 ジャンル探索・既存 `searchQuizzes` キーワード検索が破壊されていないことを確認する
  - **完了状態**: Phase 10 関連 Jest / Playwright がグリーンであること
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 12.9, 12.10, 12.11, 12.12, 12.13, 12.14, 12.15, 12.16, 12.17, 12.18, 12.19, 12.20, 12.21, 12.22_
  - _Depends: 13.7, 13.8_
  - _Boundary: Testing_

- [x]* 13.10 Phase 10 E2E スモーク（任意）
  - `e2e/quiz-search.spec.ts` でタグチップ確定、クイックチップ、複数タグ AND、カード `★ N` メタを検証する
  - **完了状態**: E2E 記録またはチェックリストが残ること
  - _Depends: 13.9_
  - _Requirements: 12.11, 12.13, 12.16, 12.19_

---

### 14. Phase 11 拡張 — 探索アコーディオン・カルーセルおよびジャンルページ scoped 検索（2026-06）

> **前提**: `quizeum-core` Phase 11 完了（`searchQuizzes` の `format` フィルタ）。本スペックは UI・フィルタ状態・カルーセル・ジャンルページ scoped 検索のみ。

- [x] 14.1 (P) 探索フィルタ基盤と出題形式定数
  - 7 種の出題形式カルーセル用定数（`QuizFormat` + `getFormatLabel` ラベル）を共有 lib に定義する
  - 複合フィルタ状態に `format` フィールドを追加し、ホーム用 active 判定（形式含む）とジャンルページ scoped 用 active 判定（固定ジャンルのみでは false）を純関数として実装する
  - scoped / home 判定の単体テスト（固定ジャンルのみ、形式のみ、キーワードのみ等）を追加する
  - **完了状態**: `explore-filter-active` の Jest がグリーンであり、`HomeFeedFilters` に `format` が型安全に追加されていること
  - _Requirements: 13.15, 13.17, 13.22_
  - _Depends: quizeum-core Phase 11_
  - _Boundary: explore-formats, explore-filter-active, home-feed-filters_

- [x] 14.2 `useExploreQuizFeed` フック（home / scoped 分岐）
  - ホーム: active 判定時に `searchQuizzes` へ `format` を含む全フィルタを渡し、未指定時はタブ別取得を維持する（300ms デバウンス）
  - ジャンルページ scoped: active 判定時に固定 `genreId` 付き `searchQuizzes` を呼び出し、戻り値を `sortQuizzesForList` でソートタブ順に再ソートする。未指定時は `getQuizzesByGenre` を維持する
  - 既存 `useHomeQuizFeed` 呼び出し元との互換（re-export または置換）を整理する
  - **完了状態**: 形式フィルタ指定時に `searchQuizzes` が `format` 引数付きで呼ばれ、scoped モードで固定ジャンル外の結果が含まれないこと（モックテスト）
  - _Requirements: 13.16, 13.21, 13.22_
  - _Depends: 14.1_
  - _Boundary: useExploreQuizFeed_

- [x] 14.3 (P) アコーディオンとジャンル／形式カルーセル UI
  - 独立開閉可能な2アコーディオン（「ジャンルから探す」「出題形式で探す」）と横スクロールカードカルーセルを実装する（CSS scroll-snap、外部 carousel ライブラリ不使用）
  - ジャンルカード選択で `genreId` を設定／再選択で解除し、**ページ遷移しない**（`useRouter` 不使用）。形式カードも同一トグルパターン
  - 選択中カードのハイライト、`aria-expanded`、設計どおりの `data-testid`（accordion / carousel / card プレフィックス）を付与する
  - ジャンルカードは `listActiveGenres` 由来の表示名・アイコン（任意説明文）を表示する
  - **完了状態**: カルーセルコンポーネントテストがグリーンであり、ジャンルカードクリックで `onGenreSelect` が呼ばれ `/genres` へ遷移しないこと
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.9, 13.10, 13.11, 13.12, 13.26_
  - _Depends: 14.1_
  - _Boundary: ExploreAccordionsPanel, GenreCarousel, FormatCarousel, ExploreAccordion_

- [x] 14.4 (P) 共有探索検索セクション（`ExploreSearchSection`）
  - 統合検索フィールドと展開可能フィルタパネル（難易度・問題数・プレイ状況）をホーム／ジャンルページ共通コンポーネントとして抽出する
  - `lockedGenreId` 指定時はフィルタパネル内ジャンルセレクトを非表示とし、ジャンルサジェストが固定ジャンルを上書きしない
  - ジャンルページ検索領域に `data-testid="genre-explore-search"` を付与する
  - **完了状態**: `lockedGenreId` あり／なしのコンポーネントテストがグリーンであり、ホーム同型の検索 UI がジャンルページでも描画されること
  - _Requirements: 13.15, 13.19, 13.20, 13.21, 13.27_
  - _Depends: 14.1_
  - _Boundary: ExploreSearchSection_

- [x] 14.5 ホーム画面統合（`GenreNav` 除去・フィルタ状態同期）
  - ホームから `GenreNav` の import／render を除去し、検索バー直下に `ExploreAccordionsPanel` を配置する
  - ジャンルカルーセル・形式カルーセル・統合検索サジェスト・フィルタパネルの `genreId` / `format` を単一 state で同期する
  - 検索バー一括クリアでジャンル・形式カルーセルの選択状態も解除する
  - `ExploreSearchSection` + `useExploreQuizFeed`（home モード）+ `ExploreAccordionsPanel` を配線し、全フィルタ未指定時はタブ別取得へ復帰する
  - `genre-nav.tsx` に deprecation コメントを追加する（ファイルは残置）
  - **完了状態**: ホーム DOM に `[data-testid="genre-nav"]` が存在せず、ジャンルカルーセル選択後も URL が `/` のままグリッドが絞り込まれること
  - _Requirements: 1.2, 10.1, 10.3, 13.8, 13.13, 13.14, 13.15, 13.16, 13.17, 13.18_
  - _Depends: 14.2, 14.3, 14.4_
  - _Boundary: HomePage_

- [x] 14.6 ジャンル別一覧ページ scoped 検索 UI
  - `/genres/[genreName]` に `ExploreSearchSection`（`lockedGenreId`）を見出し／ソートタブ近傍に配置する
  - scoped フィルタ active 時は `useExploreQuizFeed`（scoped モード）、未指定時は既存 `getQuizzesByGenre` + ソートタブを維持する
  - 読み込み中スケルトン表示、固定ジャンル外クイズが結果に含まれないことを確認する
  - **完了状態**: ジャンルページでキーワードまたは形式フィルタ指定時に当該ジャンル内のみ結果が更新され、全フィルタ未指定時はソートタブ切替が従来どおり動作すること
  - _Requirements: 13.19, 13.20, 13.21, 13.22, 13.23_
  - _Depends: 14.2, 14.4_
  - _Boundary: GenreExplorePage_

- [x] 14.7 Phase 11 統合検証
  - ホーム: アコーディオン展開、ジャンル／形式カルーセル絞り込み、検索バーとの状態同期、クリア連動、GenreNav 非表示をコンポーネントテストおよび E2E で検証する
  - ジャンルページ: scoped 検索、ソートタブ回帰、スケルトン表示を検証する
  - Phase 10 統合検索（タグチップ・サジェスト）および Phase 6 ジャンル一覧が破壊されていないことを確認する
  - **完了状態**: Phase 11 関連 Jest / Playwright がグリーンであること
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 13.8, 13.9, 13.10, 13.11, 13.12, 13.13, 13.14, 13.15, 13.16, 13.17, 13.18, 13.19, 13.20, 13.21, 13.22, 13.23, 13.26, 13.27_
  - _Depends: 14.5, 14.6_
  - _Boundary: Testing_

- [x]* 14.8 Phase 11 E2E スモーク（任意）
  - `e2e/quiz-search.spec.ts` で形式カルーセル絞り込み、ジャンルカルーセルが `/genres` に遷移しないこと、ジャンルページ scoped 検索を検証する
  - **完了状態**: E2E 記録またはチェックリストが残ること
  - _Depends: 14.7_
  - _Requirements: 13.4, 13.10, 13.14, 13.21_
  - _Boundary: Testing_

