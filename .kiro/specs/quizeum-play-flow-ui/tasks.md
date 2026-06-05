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

- [ ]* 10.7 Phase 6 E2E スモーク（任意）
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
