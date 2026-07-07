# Implementation Plan: quizetika-play-flow-ui

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
- [x] 3.1 問題表示・タイマー・ヒント表示の実装 (P)
  - `src/app/quiz/[id]/play/page.tsx` に通常プレイ用のUIを実装する。
  - 個別カウントダウンタイマー、模擬試験全体の総合制限タイマー、ヒントポップアップダイアログを構築する。
  - _Requirements: 3.1, 3.2_
  - _Boundary: QuizPlayPage_
- [x] 3.2 localStorageを用いた解答進捗のセッション保護と復元の実装
  - `src/hooks/usePlayState.ts` を作成し、問題解答時や経過秒数を `localStorage` に自動シリアライズして退避し、ページ再読み込み時に自動復元する処理を実装する。
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
  - `src/app/quiz/[id]/result/page.tsx` を作成し、正解数、経過秒数、各問題の正誤一覧、マークダウン解説を表示する。
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
  - 間違えた問題を一括フェッチして開始するフローを構築する。
  - _Requirements: 6.1, 6.2_
  - _Boundary: ReviewPage_
- [x] 6.2 復習完了時のリスト自動クレンジング実装
  - 復習セッション終了時、正解した問題を間違いリストから一括削除し、`users.totalFailedQuestionsCount` を減算するアトミック処理を呼び出す。
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

> **前提**: `quizetika-core` Phase 6 完了（`listActiveGenres`, `getQuizzesByGenre` C2, `searchQuizzes`）。本スペックは UI 接続のみ。

- [x] 10.1 `useActiveGenres` フックとジャンルナビコンポーネント (P)
  - `listActiveGenres` をマウント時に取得し、loading / error / 空配列を返すフックを実装する。
  - `GenreNav` で `displayName` と `iconImageUrl`（フォールバック絵文字可）を表示し、各アイコンクリックで **常に** `/genres/[genreId]` へ遷移する（ホーム内フィルタに使わない）。
  - **完了状態**: 有効ジャンルが API から描画され、ハードコード `GENRES` がホームから削除されていること。
  - _Requirements: 1.2, 10.1, 10.2, 10.3, 10.9_
  - _Boundary: GenreNav, useActiveGenres_
  - _Depends: quizetika-core Phase 6_

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
  - _Depends: quizetika-core Phase 6_

- [x] 10.4 (P) タグ別一覧の canonical クエリとソート
  - `getQuizzesByTag(tag, limit, sort)` を用い、ジャンル一覧と同型のソート UI を追加する。
  - **完了状態**: タグページで新着／人気／トレンドの切替が動作すること。
  - _Requirements: 10.7_
  - _Depends: quizetika-core Phase 6_

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

### 11. Phase 8 拡張 — 分類ブックマークと問題リストプレイ UI（2026-06）

> **前提**: `quizetika-core` Phase 8 完了（`getBookmarkFeed`, `getQuestionsInList`, `toggleBookmark` 問題対応, `saveAttempt` の `question-list` モード）。本スペックは UI・セッション状態・遷移のみ。

- [x] 11.1 (P) 問題リスト連続プレイセッションライブラリ
  - `sessionStorage` キー `quizetika_question_list_session` でリスト ID・順序付きエントリ（`questionId`, `parentQuizId`）・現在インデックスを初期化・読取・進行・クリアする純関数を実装する。
  - 問題リストプレイ用 URL（`mode=question-list`, `questionId`, `qIndex`, `listId`）を組み立てるヘルパーを提供する。
  - Jest で init → read → advance → 最終後 null → clear のシーケンスを検証する。
  - **完了状態**: セッションライブラリの単体テストがグリーンであり、問題リスト開始時に先頭エントリの URL が生成できること。
  - _Requirements: 11.11, 11.12_
  - _Boundary: question-list-session_
  - _Depends: quizetika-core Phase 8_

- [x] 11.2 (P) `useBookmarkFeed` フック
  - マウント時に `getBookmarkFeed` を1回呼び出し、クイズ・リスト・問題の3分類フィードと loading 状態を返す。
  - `toggleBookmark` による解除後、該当タブの配列から楽観的にエントリを除去する `removeBookmark` を提供する（タブ切替で再フェッチしない）。
  - **完了状態**: 認証ユーザーで feed が3分類とも取得でき、解除後に UI 状態から当該アイテムが消えること。
  - _Requirements: 11.1, 11.3, 11.4, 11.5_
  - _Boundary: useBookmarkFeed_
  - _Depends: quizetika-core Phase 8_

- [x] 11.3 (P) ブックマークタブ・カードコンポーネント群
  - `BookmarksTabs` で「クイズ」「リスト」「問題」タブを切り替え、設計どおりの `data-testid`（`bookmarks-tabs`, `bookmarks-tab-quiz`, `bookmarks-tab-list`, `bookmarks-tab-question`）を付与する。
  - `BookmarkQuizGrid` は既存ホームカードスタイルを再利用し、解除トグルと `/quiz/[id]` 遷移を提供する。
  - `BookmarkListGrid` はリストカードに解除トグルと `/list/[id]` リンクを提供する。
  - `BookmarkQuestionList` は問題文抜粋・親クイズタイトル・ブックマーク日時降順で問題を表示し、カードクリックで `/quiz/[parentQuizId]/play?startAtQuestionId={id}` へ遷移する。
  - 各タブの空状態に要件どおりの案内文を表示する。
  - **完了状態**: 3タブコンポーネントが Storybook 相当の単体描画または RTL で切替・空状態・testid を確認できること。
  - _Requirements: 11.1, 11.3, 11.4, 11.5, 11.6_
  - _Depends: 11.2_
  - _Boundary: BookmarksTabs, BookmarkQuizGrid, BookmarkListGrid, BookmarkQuestionList_

- [x] 11.4 ブックマーク一覧ページの3タブ統合
  - `bookmarks/page.tsx` を `getBookmarkedQuizzes` 単体から `useBookmarkFeed` + `BookmarksTabs` + 各グリッドへ置換する。
  - 未認証アクセス時は既存どおり `/login` へリダイレクトする（11.2）。
  - **完了状態**: `/bookmarks` で3タブが表示され、クイズタブの既存カード UX が維持されつつリスト・問題タブが動作すること。
  - _Requirements: 7.3, 11.1, 11.2, 11.3, 11.4, 11.5, 11.6_
  - _Depends: 11.3_
  - _Boundary: BookmarksPage_

- [x] 11.5 (P) 問題ブックマークトグルコンポーネント
  - 問題行に星アイコンのオン／オフトグルを表示し、認証時は `toggleBookmark(userId, questionId, 'question')` を呼び出す。
  - 未認証時の操作は `/login` へ遷移する。親クイズ非公開などコア検証エラー時はトグルを元に戻しエラーを表示する。
  - **完了状態**: トグル操作で BM 状態が切り替わり、未認証時にログイン画面へ遷移すること。
  - _Requirements: 11.7, 11.8, 11.9_
  - _Boundary: QuestionBookmarkToggle_
  - _Depends: quizetika-core Phase 8_

- [x] 11.6 (P) リスト詳細の問題リスト分岐と連続プレイ開始
  - `resolveListType` で `listType === 'question'` のとき `getQuestionsInList` による順序付き問題一覧（抜粋・親タイトル）と「問題リストプレイ開始」ボタンを表示する。
  - 開始時に `initQuestionListSession` を呼び、先頭問題の親クイズプレイ URL へ遷移する。
  - `listType === 'quiz'`（または legacy 未設定）は従来の `getQuizzesInList` + 「リストプレイ開始」（`mode=list`）を維持し、問題リスト UI と混在させない。
  - **完了状態**: 問題リスト詳細で問題一覧と開始ボタンが表示され、クイズリスト詳細は従来どおりクイズ連続プレイのみ提供すること。
  - _Requirements: 11.10, 11.11, 11.13_
  - _Depends: 11.1_
  - _Boundary: ListDetailPage_

- [x] 11.7 プレイ画面の問題リストモードと問題BM統合
  - `mode=question-list` クエリ時、`questionId` に一致する1問のみをプレイ対象とし、完了時に `saveAttempt` で `mode: 'question-list'`, `totalQuestions: 1`, `listId` を送信する。
  - 通常・模擬試験プレイ中の問題表示行に `QuestionBookmarkToggle` を配置する（ウミガメスープは対象外でよい）。
  - `startAtQuestionId` クエリ時は当該問題から解答開始できるようインデックスを初期化する（問題タブからの単体プレイ、セッションは作成しない）。
  - **完了状態**: 問題リストプレイで1問完了後に attempt が `question-list` で保存され、プレイ中に問題 BM トグルが動作すること。
  - _Requirements: 11.6, 11.7, 11.9, 11.11, 11.14_
  - _Depends: 11.1, 11.5_
  - _Boundary: QuizPlayPage_

- [x] 11.8 結果画面の問題BMと問題リスト次問題遷移
  - 正誤一覧の各問題行に `QuestionBookmarkToggle` を配置する（公開親問題のみ操作可能）。
  - `listId` かつ `question-list-session` 存在時は、クイズリスト（`quizIds`）分岐より先に問題リスト分岐を評価し、「次の問題へ」で次エントリのプレイ URL へ遷移する。最終問題後はセッションをクリアし完了メッセージとリスト詳細リンクを表示する。
  - セッション欠落時は「リストの続きを再生できません」案内を表示する。
  - **完了状態**: 問題リスト2問目以降へ結果画面から遷移でき、最終問題後に完了 UI が表示されること。
  - _Requirements: 11.8, 11.12_
  - _Depends: 11.1, 11.5, 11.7_
  - _Boundary: QuizResultPage_

- [x] 11.9 Phase 8 統合検証
  - 3タブブックマーク（表示・解除・問題カード→プレイ）、問題 BM トグル（プレイ・結果）、問題リスト連続プレイ（開始→1問完了→次問題→完了）、クイズリスト回帰を Jest またはコンポーネントテストで検証する。
  - `bookmarksCount` 更新や attempt 永続化ロジックが UI 層に追加されていないことを確認する。
  - **完了状態**: Phase 8 関連テストがグリーンであり、手動スモークで問題リスト3問題連続プレイが完走すること。
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10, 11.11, 11.12, 11.13, 11.14_
  - _Depends: 11.4, 11.6, 11.7, 11.8_

- [ ]* 11.10 Phase 8 E2E スモーク（任意）
  - `[data-testid="bookmarks-tabs"]` で3タブ切替、問題リスト詳細からの連続プレイ、結果画面の次問題ボタンを Playwright で検証する。
  - **完了状態**: E2E 記録またはチェックリストが残ること。
  - _Depends: 11.9_
  - _Requirements: 11.1, 11.10, 11.12_

## Implementation Notes

- Phase 6 は **読み取り専用**（`metadata_genres` 書き込み除く）。`attempts` の **読み取り**（プレイ済み ID 一覧）は要件 1.3 のため `listUserPlayedQuizIds` + API で許容。
- **確定 UX**: ジャンルアイコン＝遷移のみ。ジャンル条件は `GenreSearchField` + `searchQuizzes`（フィルタ変更・デバウンス）。`playStatus` は認証後クライアント後段フィルタ。
- `quizetika-creator-dash-ui` のエディタ動的セレクトと併せて E2E するとジャンル一貫性の受け入れが容易。
- Phase 6 実装（2026-06-03）: `GenreNav` は遷移専用。`GenreSearchField` + `useHomeQuizFeed`（300ms debounce）+ `applyPlayStatusFilter` / `GET /api/user/played-quiz-ids` で要件 1.3 完遂。Jest 296 件・build PASS。
- **Phase 8**: ブックマークは `getBookmarkFeed` 一括取得 + 楽観的解除。問題リスト進行は `question-list-session`（sessionStorage）。attempt 永続化・`bookmarksCount` はコアのみ（要件 11.14）。クイズリスト連続プレイ（`mode=list`）は回帰維持。
- Phase 8 実装（2026-06-05）: `components/bookmark/*`, `useBookmarkFeed`, `question-list-session`。Jest 354 件・build PASS。
- **Phase 10**: 統合検索は `UnifiedSearchField` + `useActiveTags` + `filter-search-suggestions`。タグ AND 検索は `useHomeQuizFeed` → `searchQuizzes({ tags })`（core 10.x 完了後に実装）。カードは `★ N` + ジャンル + 出題形式、探索一覧は `QuizCard` + `href` 共通化。
- Phase 10 実装（2026-06-06）: `UnifiedSearchField`, `useActiveTags`, `quiz-format-labels`, `QuizCard` 拡張、探索一覧共通化。Jest 430 件・build PASS。
- **Phase 11**: ホームは `ExploreAccordionsPanel` + カルーセル（ホーム内フィルタ、`GenreNav` 非表示）。`useExploreQuizFeed` が `format` 含む home/scoped 分岐。ジャンルページは `ExploreSearchSection` + `lockedGenreId`。scoped 検索 + ソート同時時は `sortQuizzesForList` でクライアント再ソート。前提: `quizetika-core` Phase 11（`SearchFilters.format`）完了。
- **Phase 19**: 主要画面を Server Component + `<Suspense>` 分割（`home-client`, `quiz-detail-client`, `quiz-result-client`, 探索・復習・LB・BM・通知各 `*-client`）。スケルトンは設計どおり `data-testid` 付与。`/bookmarks`, `/notifications` は middleware で `307` リダイレクト。Jest 548 件・build PASS・`e2e/streaming-skeleton.spec.ts` 7 件 PASS。

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

> **前提**: `quizetika-core` Phase 10 完了（`listActiveTags`, `searchQuizzes` の `tags` 配列 AND 合成）。本スペックは UI・フィルタ状態・カード表示のみ。

- [x] 13.1 (P) 出題形式ラベル共有ライブラリ
  - クイズエディタ内のローカル形式ラベル解決を共有ライブラリへ抽出し、問題構成から推定した日本語ラベル（選択式、記述式、ウミガメのスープ等）をカードとエディタで同一規則で返す
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
  - _Depends: quizetika-core Phase 10_
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
  - _Depends: quizetika-core Phase 10_
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

> **前提**: `quizetika-core` Phase 11 完了（`searchQuizzes` の `format` フィルタ）。本スペックは UI・フィルタ状態・カルーセル・ジャンルページ scoped 検索のみ。

- [x] 14.1 (P) 探索フィルタ基盤と出題形式定数
  - 7 種の出題形式カルーセル用定数（`QuizFormat` + `getFormatLabel` ラベル）を共有 lib に定義する
  - 複合フィルタ状態に `format` フィールドを追加し、ホーム用 active 判定（形式含む）とジャンルページ scoped 用 active 判定（固定ジャンルのみでは false）を純関数として実装する
  - scoped / home 判定の単体テスト（固定ジャンルのみ、形式のみ、キーワードのみ等）を追加する
  - **完了状態**: `explore-filter-active` の Jest がグリーンであり、`HomeFeedFilters` に `format` が型安全に追加されていること
  - _Requirements: 13.15, 13.17, 13.22_
  - _Depends: quizetika-core Phase 11_
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
  - 独立開閉可能な2アコーディオン（「ジャンルで絞り込む」「出題形式で絞り込む」）と横スクロールカードカルーセルを実装する（CSS scroll-snap、外部 carousel ライブラリ不使用）
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

---

### 15. Phase 15 拡張 — スマートサジェストUIと履歴管理（2026-06）

- [x] 15.1 (P) `localStorage` 直近検索履歴ユーティリティと React Hook の実装
  - `src/lib/search-history.ts` を作成し、`localStorage` から履歴読み込みと追加・件数上限の切り詰めを行う純関数群を実装する（ジャンル履歴最大3件、ワード履歴最大5件）。
  - `src/hooks/useSearchHistory.ts` を作成し、コンポーネントが状態同期した履歴を扱えるようにする。
  - **完了状態**: 単体テストで、重複排除、上限切り詰め、先頭への追加が `localStorage` で正常に行われること。
  - _Requirements: 14.17, 14.18, 14.19, 14.20_
  - _Boundary: search-history_

- [x] 15.2 (P) 週間人気トレンドデータ取得用 React Hook の実装
  - `src/hooks/useWeeklyTrends.ts` を作成し、`GET /api/genres/weekly-top` および `GET /api/search/weekly-top` からそれぞれのデータを loading, error 状態とともに取得する処理を実装する。
  - **完了状態**: データ取得状態が React コンポーネント向けに適切に公開され、モックテストがパスすること。
  - _Requirements: 14.5, 14.13, 14.21_
  - _Boundary: useWeeklyTrends_

- [x] 15.3 `GenreSearchField` のスマートサジェスト対応
  - `src/components/explore/genre-search-field.tsx` を修正し、フォーカス時に `data-testid="genre-smart-suggest"` を持つスマートサジェストを表示する。
  - セクション 「最近検索したジャンル」(`data-testid="recent-genres-section"`)、「今週の人気ジャンル」(`data-testid="weekly-top-genres-section"`) を順に表示し、選択時は履歴保存を実行する。
  - **完了状態**: 空入力時のフォーカスでドロップダウン表示、選択時に履歴更新、入力時は従来サジェストに切り替わること。
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.23_
  - _Depends: 15.1, 15.2_
  - _Boundary: GenreSearchField_

- [x] 15.4 `UnifiedSearchField` のスマートサジェスト対応
  - `src/components/explore/unified-search-field.tsx` を修正し、チップがなく入力が空のフォーカス時に `data-testid="search-smart-suggest"` を表示する。
  - セクション 「最近の検索」(`data-testid="recent-keywords-section"`)、「今週の人気タグ」(`data-testid="weekly-top-tags-section"`)、「今週の人気キーワード」(`data-testid="weekly-top-keywords-section"`) を順に表示する。
  - 入力がある、またはタグチップがあるときはスマートサジェストを非表示にして通常のタグサジェストを表示する。
  - **完了状態**: 条件に応じたスマートサジェストの表示切替、選択時のチップ追加および履歴追加が正常に機能すること。
  - _Requirements: 14.9, 14.10, 14.11, 14.12, 14.13, 14.14, 14.15, 14.16, 14.24_
  - _Depends: 15.1, 15.2_
  - _Boundary: UnifiedSearchField_

- [x] 15.5 Phase 15 統合検証
  - 各種スマートサジェストコンポーネントが仕様を満たすことを Jest で検証する。
  - **完了状態**: スマートサジェスト関連 of テストがすべてグリーンであること。
  - _Depends: 15.3, 15.4_
  - _Boundary: Testing_

---

### 16. Phase 12 拡張 — クイズプレイ・結果画面および難易度UI改善（2026-06-06）

- [x] 16.1 (P) 難易度（★）の等幅星ゲージグラデーションカラー表示ヘルパーの実装
  - `src/lib/difficulty-color.ts` を新設し、難易度（1〜10）の値から HSL カラーコードを算出する純関数 `getDifficultyColor(difficulty: number): string` を実装する。
  - 難易度 1（緑）から 10（赤）まで期待通りのグラデーション値が返ることを検証する Jest 単体テストを追加する。
  - クイズ詳細画面（`src/app/quiz/[id]/page.tsx`）およびクイズ結果画面（`src/app/quiz/[id]/result/page.tsx`）の10段階等幅星ゲージ（★）にインラインスタイルで算出したカラーを適用する。
  - **完了状態**: 難易度に応じた緑→黄→赤のグラデーションカラーが詳細および結果 of 星UIに正しく適用されること。
  - _Requirements: 2.1b-1, 5.2a_
  - _Boundary: difficulty-color, QuizDetailPage, QuizResultPage_

- [x] 16.2 クイズプレイ画面から結果への自動遷移
  - `src/app/quiz/[id]/play/page.tsx` において、すべての問題への解答完了時に待機用中間画面を挟まず、自動的に結果の保存処理を実行して結果画面へ直接遷移するよう変更する。
  - `usePlayState` の完了ハンドラから自動的に結果画面（`/quiz/[id]/result?attemptId={attemptId}`）へ遷移するリダイレクト制御を構築する。
  - 連想クイズプレイ完了時、解答中に表示したヒントの一覧情報を `localStorage`（キー: `quizetika_attempt_hints_{attemptId}`）へ一時保存する。
  - **完了状態**: 最後の問題を送信した瞬間に待機画面を挟まず結果画面へ自動遷移し、連想クイズのヒント表示情報が `localStorage` へ保存されること。
  - _Requirements: 3.6, 5.6_
  - _Boundary: QuizPlayPage_

- [x] 16.3 結果画面のメタ情報表示拡張（ヒント数/質問回数表示）
  - `src/app/quiz/[id]/result/page.tsx` において、連想クイズの場合は `localStorage` から `attemptId` に基づいて取得したヒント表示履歴を表示し、ウミガメスープの場合は `attempt.aiTurnCount` を用いて質問回数を結果詳細情報として表示する。
  - `localStorage` のヒント履歴は、容量圧迫を防ぐため、最新の20件のみをキャッシュし、それを超えた古いデータは自動的に削除する管理ロジックを実装する。
  - **完了状態**: 結果画面で連想クイズのヒント一覧（または回数）およびウミガメスープの質問回数が正しく描画されること。
  - _Requirements: 5.6_
  - _Boundary: QuizResultPage_
  - _Depends: 16.2_

- [x] 16.4 結果画面のナビゲーション拡張および同じ作者のおすすめクイズ表示
  - `src/app/quiz/[id]/result/page.tsx` に「もう一度プレイする」ボタン (詳細画面 `/quiz/[id]` 遷移) および作者プロフィールページへのリンクを追加する。
  - 同一作者の他の公開クイズを `getQuizzesByAuthor(authorId)` を用いて最大3件取得し、現在プレイしたクイズを除外して `QuizCard` を用いたおすすめグリッドとして表示する。
  - クイズ取得中およびエラー時のローディングスケルトンまたはプレースホルダー表示を構築する。
  - **完了状態**: もう一度プレイするボタン、作者へのリンク、および同じ作者の他クイズ（最大3件）が結果画面に正しく表示されること。
  - _Requirements: 5.7, 5.7a, 5.8, 5.9_
  - _Boundary: QuizResultPage_

- [x] 16.5 結果画面のアクション強化（ブックマーク、指摘カテゴリ制限、通報機能）
  - `src/app/quiz/[id]/result/page.tsx` の「お疲れ様でした」サマリーカード領域に、クイズ全体のブックマーク（お気に入り）登録・解除トグルボタンを追加する。
  - 間違い指摘モーダルにおいて、対象が「クイズ全体への指摘」の場合のみ指摘カテゴリから「別解の追加」を選択肢から除外する。
  - 指摘ボタンの隣に通報ボタンを配置し、クリックで通報モーダル `ReportModal` (`src/components/quiz/report-modal.tsx`) を表示する。未ログインのゲストユーザーの場合は、通報ボタンを非活性化するか、クリック時に `/login` へリダイレクトする認可ガードを実装する。
  - `ReportModal` は通報理由 (reason) テキスト入力を提供し、送信時に `quizetika-core` の `flagContent(quizId, reporterId, reason)` を呼び出す。
  - **完了状態**: 結果画面でのブックマーク切り替え、クイズ全体指摘時の別解除外、通報ボタン・モーダルの表示および送信が正しく行えること。
  - _Requirements: 5.3a, 5.10, 5.11, 5.11a_
  - _Boundary: QuizResultPage, ReportModal_

- [x] 16.6 Phase 12 統合検証
  - 新設した `getDifficultyColor` 難易度グラデーション、プレイ画面から結果への自動遷移、結果画面のヒント/質問回数、もう一度プレイ/作者リンク/おすすめクイズ表示、サマリーカードのブックマークトグル、クイズ全体指摘時の別解除外、および通報機能の動作を検証する。
  - 単体テスト (Jest) および結合・E2Eテスト (Playwright) を追加・実行し、すべてのテストがグリーンであることを確認する。
  - **完了状態**: 関連する Jest および Playwright テストが全て正常にパスすること。
  - _Requirements: 2.1b-1, 3.6, 5.2a, 5.3a, 5.6, 5.7, 5.7a, 5.8, 5.9, 5.10, 5.11, 5.11a_
  - _Boundary: Testing_
  - _Depends: 16.1, 16.3, 16.4, 16.5_

- [x]* 16.7 Phase 12 E2E スモーク（任意）
  - Playwright で、自動遷移、おすすめクイズカードの描画、全体指摘時のカテゴリ選択確認、通報ボタン押下からの通報送信フローをスモーク検証する。
  - **完了状態**: Playwright の E2E シナリオがグリーンであること。
  - _Depends: 16.6_
  - _Requirements: 3.6, 5.3a, 5.9, 5.11a_
  - _Boundary: Testing_

---

### 17. Phase 13 拡張 — 難易度5段階化 (2026-06)

- [x] 17.1 (P) 難易度カラー算出ヘルパーと星ゲージ表示の更新
  - `getDifficultyColor` などの HSL 配色算出ロジックを 5段階に最適化する（`Math.max(0, 120 - (difficulty - 1) * 30)`）。
  - クイズカード、詳細画面、および結果画面の星ゲージ表示を従来の 10段階から 5段階の等幅ゲージ（`★` と `☆` の計5文字）に変更する。
  - 難易度に応じた星ゲージのグラデーションカラー（緑→黄→橙→赤）が 1〜5 の範囲で正しく変化するようにする。
  - **完了状態**: 難易度 1〜5 それぞれに対して正しい HSL カラーが返され、画面上の星ゲージが常に5文字等幅でレンダリングされること。
  - _Requirements: 2.1b, 2.1b-1, 5.2a, 12.16_
  - _Boundary: difficulty-color, UI Components_

- [x] 17.2 (P) 結果画面における難易度投票 UI の更新
  - 結果画面の体感難易度投票の選択肢を 1〜5 の 5段階に変更する。
  - **完了状態**: 投票 UI の選択肢が 5つになり、選択した難易度が正常に送信できること。
  - _Requirements: 5.2, 5.2a_
  - _Boundary: ResultPage_

- [x] 17.3 (P) UI テストコードの修正
  - 既存 of UI ユニットテストおよび E2E テストにおいて、難易度が 6 以上になっている期待値やセレクタ、モックデータを 1〜5 の範囲に修正する。
  - **完了状態**: モックデータ読み込みがエラーにならず、すべての UI テストが正常にパスすること。
  - _Requirements: 2.1b, 5.2_
  - _Boundary: Testing_

- [x] 17.4 Phase 13 UI 統合検証
  - 難易度5段階化されたクイズカード、詳細、結果画面、および投票フローが一貫して動作することを確認する。
  - **完了状態**: UI 関連テストスイートおよび開発用ビルドでエラーが発生しないこと。
  - _Depends: 17.1, 17.2, 17.3_

### 18. Phase 14 拡張 — 作家お礼機能の廃止および結果画面でのフォロー機能の追加（2026-06）

- [x] 18.1 作家お礼リアクションボタンの削除とフォローボタンの配置 (P)
  - クイズ結果画面（`src/app/quiz/[id]/result/page.tsx`）から、お礼リアクション送信ボタン（`handleSendReaction` や `reactionSent` 関連のコード、お礼の JSX 記述）を削除する。
  - 代わりに、ログインユーザー（`user.id`）とクイズ作成者（`quiz.authorId`）が異なる場合のみ表示される「作者をフォローする / フォロー解除」ボタンを配置する。自分自身の場合は非表示にする。
  - **完了状態**: 結果画面でお礼ボタンが非表示になり、他のユーザーが作成したクイズの結果画面では「フォローする / フォロー解除」ボタンが表示されること。自分自身のクイズ結果画面ではフォローボタンが表示されないこと。
  - _Requirements: 5.4_
  - _Boundary: QuizResultPage_

- [x] 18.2 フォロー状態の取得とトグル操作の実装 (P)
  - クイズ結果画面のロード時に、`isFollowing` サービス（`src/services/user.ts`）を呼び出して作成者の現在のフォロー状態を取得・保持する。
  - フォローボタン of クリックにより、現在の状態に応じて `followUser` または `unfollowUser` を実行し、フォロー状態の表示をトグルする。
  - オフライン時（`!online`）は、フォローボタンを無効化（`disabled`）にする。
  - **完了状態**: ボタンクリックでフォローのオン・オフが正常にトグルされ、オフライン時はボタンが非活性になり操作できないこと。
  - _Requirements: 5.4, 5.5_
  - _Boundary: QuizResultPage_

- [x] 18.3 統合検証とテストの更新
  - クイズ結果画面で作成者をフォロー・フォロー解除する動作と、自己フォロー時の非表示処理、オフライン時の非活性化処理を検証するテスト（Jest や E2E テスト）を実装・更新する。
  - **完了状態**: テストが正常にパスし、自動・手動検証で結果画面からのフォロー機能が完全に動作すること。
  - _Requirements: 5.4, 5.5_
  - _Depends: 18.1, 18.2_
  - _Boundary: Testing_

### 19. Phase 12 拡張 — 非同期データフェッチとスケルトンロード表示（Streaming & Suspense）のUI実装（2026-06-07）

- [x] 19.1 ホーム画面の Server Component 化と Suspense 導入 (P)
  - `src/app/page.tsx` を Server Component に移行し、静的なヘッダーやサイドバー、検索バーの枠組みなどをサーバー側で即時描画・配信する。
  - クイズフィードやカルーセルなどの非同期フェッチ領域を `<Suspense fallback={<GridSkeleton data-testid="home-feed-skeleton" />}>` 等でラップして Streaming を有効にする。
  - _Requirements: 15.13, 15.14, 15.15_
  - _Boundary: HomePage_
- [x] 19.2 クイズ詳細画面の Server Component 化と Suspense 導入 (P)
  - `src/app/quiz/[id]/page.tsx` を Server Component に移行し、静的な戻るボタン、コンテナ背景などを即座に表示する。
  - 詳細情報メタ（タイトル、難易度星ゲージ等）と、リーダーボード（`QuizDualLeaderboard`）をそれぞれ個別の `<Suspense>` でラップして非同期描画する。
  - スケルトンプレースホルダーに `data-testid="quiz-detail-skeleton"` および `data-testid="leaderboard-skeleton"` を付与する。
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.11_
  - _Boundary: QuizDetailPage_
- [x] 19.3 クイズ結果画面の Server Component 化と Suspense 導入 (P)
  - `src/app/quiz/[id]/result/page.tsx` を Server Component に移行し、静的なヘッダーや戻るボタンを即座に表示する。
  - 結果サマリー・解説と、おすすめクイズをそれぞれ個別の `<Suspense>` でラップして非同期描画する。
  - スケルトンプレースホルダーに `data-testid="quiz-result-skeleton"` および `data-testid="recommend-skeleton"` を付与する。
  - _Requirements: 15.6, 15.7, 15.8, 15.9, 15.10, 15.12_
  - _Boundary: QuizResultPage_
- [x] 19.4 ジャンル・タグ一覧、弱点克服、総合リーダーボード、ブックマーク、通知画面の非同期最適化 (P)
  - `/genres/[genreName]`, `/tags/[tagName]`, `/quiz/review`, `/leaderboard`, `/bookmarks`, `/notifications` をそれぞれ Server Component 化。
  - 静的フレームの先行描画と、各画面専用のスケルトン表示（`data-testid` 付与）を実装する。
  - _Requirements: 15.16, 15.17, 15.18, 15.19, 15.20, 15.21_
  - _Boundary: PageRouterComponents_
- [x] 19.5 認証必須画面における Middleware サーバーサイド認証保護の実装
  - クライアントサイドでのマウント後リダイレクトによる白紙表示を防ぐため、`src/middleware.ts` を作成（または更新）し、Firebase セッション Cookie または認証 Cookie に基づいて `/bookmarks`, `/notifications` 等へのアクセスをサーバーサイドで即時リダイレクト（`307`）制御する。
  - _Requirements: 11.2, 15.20_
  - _Boundary: NextMiddleware_
- [x] 19.6 非同期最適化の E2E テストと結合テストの更新
  - Playwright 等の E2E テストにて、スケルトンの `data-testid` が正しく表示され、ロード完了後に非表示になり実データが表示されるシーケンスを検証する。
  - _Requirements: 15.11, 15.12, 15.20, 15.21_
  - _Boundary: Testing_

### 20. Phase 12 追補 — プレイ画面の Suspense 最適化（2026-06-07）

- [x] 20.1 (P) quick-press 難読化ユーティリティの共通化
  - `src/lib/quick-press-obfuscate.ts` を新設し、quick-press 問題の `questionText` 空化と `correctTextAnswerList` の Base64 難読化を1か所に集約する。
  - 本番 Loader と test-play Client の両方から import できることを確認する。
  - _Requirements: 15.24, 15.28_
  - _Boundary: quick-press-obfuscate_

- [x] 20.2 (P) `PlaySkeleton` コンポーネントの実装
  - `src/components/quiz/play-skeleton.tsx` と CSS Module を新設し、プログレスバー・問題文・選択肢枠の pulsing スケルトンを描画する。
  - `data-testid="quiz-play-skeleton"` をデフォルト付与する。
  - _Requirements: 15.23, 15.27, 15.30, 15.31_
  - _Boundary: PlaySkeleton_

- [x] 20.3 本番プレイ画面の Server Component 化と Loader 分割
  - `src/app/quiz/[id]/play/page.tsx` を Server Component に移行し、静的フレーム（戻る、プログレス枠、コンテナ）を即時描画する。
  - async `QuizPlayLoader` で `getQuiz` + 難読化を行い、`<Suspense fallback={<PlaySkeleton />}>` 内で `QuizPlayClient` に `initialQuiz` を渡す。
  - 既存 `QuizPlayPageContent` を `quiz-play-client.tsx` へ移管し、Client 側の `getQuiz` useEffect を削除する。
  - 全プレイモード（normal / exam / flashcard / lateral / question-list）の既存挙動を維持する。
  - _Requirements: 15.22, 15.23, 15.24, 15.25, 15.31, 15.32_
  - _Depends: 20.1, 20.2_
  - _Boundary: QuizPlayPage_

- [x] 20.4 テストプレイ画面の Server Component 化
  - `src/app/quiz/test-play/play/page.tsx` を Server Component シェル + 共有静的フレーム + Suspense に移行する。
  - `TestPlayClient` で sessionStorage payload 解決、難読化、既存テストプレイ UI を維持する。
  - payload 欠落・期限切れ時のエラー UI と戻り導線を表示する。
  - _Requirements: 15.26, 15.27, 15.28, 15.29, 15.30, 15.31, 15.32_
  - _Depends: 20.1, 20.2_
  - _Boundary: TestPlayPage_

- [x] 20.5 Phase 12 追補 統合検証
  - 本番・test-play 双方で静的フレームが即時表示され、ロード中は `quiz-play-skeleton` が表示されることを手動または自動テストで確認する。
  - 「プレイ環境を準備中...」テキストのみの白紙表示がプライマリロード UI として使われていないことを確認する。
  - localStorage セッション復元、ウミガメ AI、test-play 結果遷移が退行していないことを確認する。
  - _Requirements: 15.22, 15.25, 15.28, 15.31_
  - _Depends: 20.3, 20.4_
  - _Boundary: Integration_

## Implementation Notes

- Phase 12 追補: 静的フレームの二重表示回避のため、Server `page.tsx` は `styles.container` + Suspense のみ。ヘッダー／プログレスの先行表示は `PlaySkeleton` 内に集約。
- `QuizPlayClientBoundary` / `TestPlayClientBoundary` で `useSearchParams` 用の内側 Suspense を維持。

- [ ]* 20.6 Phase 12 追補 E2E スモーク（任意）
  - Playwright で本番プレイ・test-play のスケルトン表示 → 問題 UI 表示シーケンスを検証する。
  - _Requirements: 15.30_
  - _Depends: 20.5_
  - _Boundary: Testing_

### 21. Phase 14 — 結果画面の解説アコーディオン化と難易度投票 UI 改善（2026-06-08）

- [x] 21.1 (P) 問題回答・解説アコーディオンコンポーネントの実装
  - 各問題行で回答サマリー・解説・ヒント履歴を折りたたみ表示するアコーディオンコンポーネントと専用 CSS Module を新設する。
  - 初期状態は閉じた状態（`defaultOpen={false}`）とし、見出しクリックで展開／折りたたみを切り替える。
  - 問題ごとに開閉状態が独立すること（他問題の開閉に影響されないこと）をコンポーネント内 state で保証する。
  - 見出しに `aria-expanded` を付与し、`data-testid="result-question-accordion-{questionId}"` を設定する。
  - トリガーラベルは「回答と解説を表示」／「回答と解説を隠す」で展開状態に応じて切り替わること。
  - _Requirements: 16.2, 16.3, 16.4, 16.13, 16.14_
  - _Boundary: ResultQuestionDetailsAccordion_

- [x] 21.2 (P) 体感難易度投票 ★ コンポーネントの実装
  - クリック可能な ★5個で体感難易度（1〜5）を投票するコンポーネントと専用 CSS Module を新設する。
  - 第 N 個の ★ クリックで `onVote(N)` を呼び出し、投票済み値に応じて塗りつぶし ★ と空星 ☆ を表示する。
  - 各 ★ に `getDifficultyColor` によるグラデーションカラーを適用する。
  - `disabled` 時（オフライン）はクリック不可・視覚的に非活性とする。
  - `data-testid="difficulty-vote-stars"` および各星に `data-testid="difficulty-vote-star-{N}"` を付与する。
  - _Requirements: 16.7, 16.8, 16.9, 16.10, 16.11, 16.14_
  - _Boundary: DifficultyVoteStars_

- [x] 21.3 本番クイズ結果画面への統合
  - 本番結果画面クライアントで、各問題の `answerSummary`・`explanationBox`・`hintHistoryBox` をアコーディオン内に移管する。
  - 第 N 問・正誤ラベル・問題文・ブックマーク／指摘ボタンはアコーディオン外に常時表示する。
  - 既存の数値ボタン難易度投票（`difficultyBar` / `diffCell`）を ★ 投票コンポーネントに置き換え、既存 `handleDifficultyVote` コールバックを接続する。
  - 未使用となった `result.module.css` の `.difficultyBar` / `.diffCell` スタイルを削除する。
  - 結果画面を開いた直後、各問題の回答・解説が非表示であり、難易度投票が ★ UI で表示されること。
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.7, 16.8, 16.9, 16.10, 16.11_
  - _Depends: 21.1, 21.2_
  - _Boundary: QuizResultClient_

- [x] 21.4 テストプレイ結果画面へのアコーディオン統合
  - テストプレイ結果画面に同一のアコーディオンコンポーネントを適用し、本番結果画面と同規則（初期 closed、回答・解説の折りたたみ）とする。
  - テストプレイ結果画面を開いた直後、各問題の回答・解説が非表示であること。
  - _Requirements: 16.6_
  - _Depends: 21.1_
  - _Boundary: TestPlayResultPage_

- [x] 21.5 (P) Phase 14 単体テストの追加
  - アコーディオンコンポーネントの初期 closed、トグル後の children 表示、`aria-expanded` 切替を検証するテストを追加する。
  - ★ 投票コンポーネントのクリックで `onVote(N)` 呼び出し、`disabled` 時の非活性、投票済み `value=3` で ★3+☆2 表示を検証するテストを追加する。
  - _Requirements: 16.3, 16.4, 16.8, 16.10, 16.11_
  - _Depends: 21.1, 21.2_
  - _Boundary: Testing_

- [x] 21.6 Phase 14 統合検証
  - 本番結果画面でアコーディオン見出しクリックにより回答・解説が表示されること、★ クリックで難易度投票が更新されることを手動または自動テストで確認する。
  - オフライン時に ★ 投票が非活性であること、連想クイズのヒント履歴がアコーディオン内に含まれることを確認する。
  - 既存の結果画面機能（ブックマーク、指摘、おすすめクイズ、リスト連続プレイ）が退行していないことを確認する。
  - _Requirements: 16.1, 16.2, 16.3, 16.5, 16.7, 16.8, 16.11_
  - _Depends: 21.3, 21.4, 21.5_
  - _Boundary: Integration_

- [ ]* 21.7 Phase 14 E2E スモーク（任意）
  - Playwright で本番結果画面の「初期非表示 → アコーディオン展開 → ★ 投票」のシーケンスを検証する。
  - テストプレイ結果画面でもアコーディオン挙動が本番と一致することを検証する。
  - _Requirements: 16.2, 16.6, 16.8_
  - _Depends: 21.6_
  - _Boundary: Testing_

## Implementation Notes (Phase 14)

- 要件 16.12（`difficultyVote` 永続化ロジック変更の対象外）は意図的にタスク化しない。既存 `handleDifficultyVote` / `updateDoc` を維持する。
- `ExploreAccordion` は探索画面専用のため結果画面では新規コンポーネントを使用する（design.md Phase 14 §3）。

---

### 22. Phase 15 — 通常モード即時フィードバック・スキップ・楽観的結果遷移（2026-06-08）

- [x] 22.1 (P) `usePlayState` の回答記録と進行の分離
  - `src/hooks/usePlayState.ts` に `recordAnswer`（正誤判定・スコア・`answeredIds` 更新のみ）と `advanceToNext`（`currentIdx` 進行）を追加する。
  - 通常モード（`mode === 'normal'`）では `handleAnswerSubmit` から自動 `currentIdx` 進行を除去し、exam / flashcard は従来の一体 `handleAnswerSubmit` を維持する。
  - 制限時間 0 秒時は `recordAnswer('')` を呼び出し側（`QuizPlayClient`）でフィードバック表示に接続する。
  - **完了状態**: 通常モードで回答後に `currentIdx` が変化せず、「次へ」で初めて進むこと。exam モードは回答後すぐ次問へ進むこと。
  - _Requirements: 17.1, 17.2, 17.4, 17.8, 17.14_
  - _Boundary: PlayStateManager_

- [x] 22.2 (P) 楽観的 attempt 一時保存ユーティリティ
  - `src/lib/optimistic-attempt.ts` を新設し、`sessionStorage` への完了 attempt 保存・読取・削除を実装する（キー: `quizetika_optimistic_attempt_{localId}`）。
  - **完了状態**: 保存したデータが結果画面 Client から読み取れ、削除後は取得できないこと。
  - _Requirements: 17.17, 17.18, 17.19, 5.1b_
  - _Boundary: optimistic-attempt_

- [x] 22.3 (P) `PostAnswerFeedback` コンポーネントの実装
  - `src/components/quiz/post-answer-feedback.tsx` と CSS Module を新設し、正誤表示・解説・正解表示・「次へ」／「結果を見る」CTA を提供する。
  - `data-testid="play-answer-feedback"`、CTA に `play-next-question` / `play-view-results` を付与する。
  - **完了状態**: 最終問以外は「次へ」、最終問は「結果を見る」が表示されること。
  - _Requirements: 17.4, 17.5, 17.6, 17.12, 17.13, 17.23_
  - _Boundary: PostAnswerFeedback_

- [x] 22.4 通常モードプレイ UI のフィードバックフロー統合
  - `src/app/quiz/[id]/play/quiz-play-client.tsx` を修正し、選択式・記述式・早押し・並び替え・連想の各 submit を `recordAnswer` + `PostAnswerFeedback` フローに統合する。
  - 「わからない（スキップ）」ボタン（`data-testid="play-skip-question"`）を追加し、`recordAnswer('')` と同等の不正解記録を行う。
  - 早押し専用インライン feedback UI を `PostAnswerFeedback` に統合し重複を削除する。
  - `isFinished || completing` 時の「解答データを送信中...」ブロックを削除する。
  - exam / flashcard / lateral / question-list の既存フローを退行させないこと。
  - **完了状態**: 通常モードで回答→正誤表示→次への手動進行が全問題形式で動作し、スキップが不正解として記録されること。
  - _Requirements: 17.1, 17.3, 17.4, 17.7, 17.9, 17.10, 17.11, 17.14, 17.16, 17.20, 17.23_
  - _Depends: 22.1, 22.3_
  - _Boundary: QuizPlayClient_

- [x] 22.5 楽観的結果遷移とバックグラウンド `saveAttempt`
  - `handlePlayComplete` を改修し、完了データを `optimistic-attempt` に保存した直後に `router.push(/quiz/{id}/result?localId=...)` する。
  - `saveAttempt` は `await` せずバックグラウンド実行し、成功時に `router.replace(?attemptId=...)` と localStorage 補助データ（早押しタイム・連想ヒント）のキー移行を行う。
  - 失敗時は既存 `saveOffline` / `addPendingSyncAttempt` フォールバックを維持する。
  - **完了状態**: 「結果を見る」押下直後に結果 URL へ遷移し、プレイ画面に送信中テキストが表示されないこと。
  - _Requirements: 17.15, 17.16, 17.17, 17.18, 17.19, 3.6a, 5.1a_
  - _Depends: 22.2, 22.4_
  - _Boundary: QuizPlayClient_

- [x] 22.6 結果画面 Client の楽観的データ読み取り
  - `src/app/quiz/[id]/result/quiz-result-client.tsx` を修正し、`localId` 指定時に `optimistic-attempt` から完了データを優先読み取りしてスコアサマリーを即表示する。
  - バックグラウンドで Firestore attempt 取得後に state を更新する。Server 側 `ResultSkeleton` との整合を維持する。
  - **完了状態**: 通常モード完了直後に結果画面でスコアが即表示され、attempt 永続化後も整合すること。
  - _Requirements: 5.1a, 5.1b, 17.17, 17.18_
  - _Depends: 22.2, 22.5_
  - _Boundary: QuizResultClient_

- [x] 22.7 クイズ詳細の即時正誤トグル無効化（通常モード）
  - `src/app/quiz/[id]/quiz-detail-client.tsx` において、通常モード選択時は「解答後にその場で正誤・解説を表示」トグルを非表示または無効化し、`feedback` クエリを送信しない（または無視されることを明示）ようにする。
  - **完了状態**: 通常モード開始時に新フィードバックフローが常に適用されること。
  - _Requirements: 17.20_
  - _Boundary: QuizDetailPage_

- [x] 22.8 Phase 15 統合検証
  - 通常モードの回答→フィードバック→次へ→結果を見る、スキップ不正解、楽観的結果表示、exam/lateral 退行なしを Jest / 手動で検証する。
  - **完了状態**: 関連テストがグリーン、送信中画面が表示されないこと。
  - _Requirements: 17.1, 17.4, 17.10, 17.15, 17.16, 17.2_
  - _Depends: 22.4, 22.5, 22.6, 22.7_
  - _Boundary: Integration_

- [ ]* 22.9 Phase 15 E2E スモーク（任意）
  - Playwright で通常プレイのフィードバック表示、「結果を見る」→ 結果 skeleton → スコア表示シーケンスを検証する。
  - _Requirements: 17.16, 17.17, 17.23_
  - _Depends: 22.8_
  - _Boundary: Testing_

## Implementation Notes (Phase 15)

- タスク 16.2（自動結果遷移）は通常モードについて 22.5 で上書き。exam 等は 16.2 挙動を維持。
- 要件 15.25 は通常モードのみ 22.4 / 22.5 により改定。他モードは Phase 12 追補どおり。
- `optimistic-attempt` は `globalThis.sessionStorage` を参照（Jest / ブラウザ両対応）。
- 通常モード判定は `playMode === 'normal' && !questionListMode`（`isNormalFeedbackFlow`）。

---

### 23. Phase 16 — 早押し形式の区間累計経過時間・制限時間・フィードバック・レイアウト（2026-06-09）

- [x] 23.1 (P) 区間累計経過時間の純関数ユーティリティ
  - `src/lib/play-elapsed.ts` を新設し、区間の開始・確定・表示秒数算出（`finalizedSeconds` + 進行中区間）を純関数で提供する。
  - `tests/lib/play-elapsed.test.ts` で start / finalize / 連続確定の idempotency を検証する。
  - **完了状態**: 確定済み秒数と進行中区間を合成した表示秒数が、単体テストで期待どおり算出されること。
  - _Requirements: 18.4, 18.5, 18.13, 18.15_
  - _Boundary: play-elapsed_

- [x] 23.2 `usePlayState` の区間累計タイマーと制限時間遅延開始
  - `src/hooks/usePlayState.ts` に `elapsedPolicy`（`standard` / `quick-press` + phase）を受け取り、ゲート付き tick で `elapsedSeconds` を更新する。
  - 早押し問題では `currentIdx` 変化時に `timeLeft` を即セットせず、`beginLimitCountdown()` で問読み修了後に開始する。
  - `recordAnswer` / `advanceToNext` 時に区間を確定し、`LocalAttemptSession` 保存値と表示値を一致させる。復元時は保存済み累計を `finalizedSeconds` 初期値とする。
  - **完了状態**: `pre_reading` で tick なし、`reading` / `post_reading` で加算、`feedback` で停止すること。早押し問題表示直後はカウントダウンが始まらないこと。
  - _Requirements: 3.1, 3.1a, 18.4, 18.5, 18.6, 18.7, 18.8, 18.9, 18.10, 18.11, 18.12, 18.13, 18.14, 18.15, 18.16_
  - _Depends: 23.1_
  - _Boundary: PlayStateManager_

- [x] 23.3 (P) `useQuickPressStream` の問読み修了通知
  - `src/hooks/useQuickPressStream.ts` に `onReadingComplete` コールバックを追加し、ストリーム正常完了時（`setIsStreaming(false)`、エラー・Abort 除く）に 1 回だけ呼ぶ。
  - 返却値に `isReadingComplete`（任意）を追加し、UI テストから問読み修了を検証可能にする。
  - **完了状態**: 正常ストリーム完了で `onReadingComplete` が 1 回発火し、`cancelStream` では発火しないこと。
  - _Requirements: 18.10, 18.11, 18.20_
  - _Boundary: useQuickPressStream_

- [x] 23.4 (P) 早押しプレイ用レイアウト拡大
  - `src/app/quiz/[id]/play/play.module.css` に早押し用コンテナクラス（例: `containerQuickPress`）を追加し、問読み前から問題カードが十分な横幅で表示されるようにする。
  - **完了状態**: 現在問題が `quick-press` のとき、問読み開始前から拡大レイアウトが適用され、問読み後のみ幅が変わる挙動がないこと。
  - _Requirements: 18.19, 18.20_
  - _Boundary: play-layout_

- [x] 23.5 早押しプレイ UI のフェーズ統合と不正解フィードバック調整
  - `src/app/quiz/[id]/play/quiz-play-client.tsx` で早押しフェーズ（`pre_reading` → `reading` → `post_reading` → `feedback`）を `elapsedPolicy` と同期する。
  - 「問読みを開始する」で reading 開始、「押して回答する！」で `post_reading` へ遷移（ストリーム未完了でも tick 継続）、`onReadingComplete` で `beginLimitCountdown()` を呼ぶ。
  - 早押し不正解時は `PostAnswerFeedback` に `correctAnswerDisplay` を渡さない。経過時間表示に `data-testid="play-elapsed-seconds"` を付与する。
  - 早押しタイム（押下〜回答秒数）の既存計測・記録は変更しないこと。
  - **完了状態**: 問読み前は経過時間が増えず、問読み〜制限時間中は加算され、不正解確定後は停止する。不正解フィードバックに正解行が表示されないこと。
  - _Requirements: 17.6, 18.1, 18.7, 18.8, 18.9, 18.12, 18.13, 18.14, 18.16, 18.17, 18.18, 18.24_
  - _Depends: 23.2, 23.3, 23.4_
  - _Boundary: QuizPlayClient_

- [x] 23.6 Phase 16 統合検証
  - 区間累計タイマー、問読み後の limitTime 開始、不正解時の正解非表示、レイアウト、混合クイズでの非早押し区間維持、exam 退行なしを Jest / 手動で検証する。
  - **完了状態**: 関連単体・統合テストがグリーンで、早押し通常プレイの経過時間・フィードバックが要件 18 を満たすこと。
  - _Requirements: 18.1, 18.2, 18.3, 18.6, 18.21, 18.22, 18.23_
  - _Depends: 23.5_
  - _Boundary: Integration_

- [ ]* 23.7 Phase 16 E2E スモーク（任意）
  - Playwright で早押し通常プレイの問読み開始前経過時間停止、問読み後カウントダウン、不正解時正解非表示を検証する。
  - _Requirements: 18.7, 18.10, 18.17, 18.19, 18.24_
  - _Depends: 23.6_
  - _Boundary: Testing_

## Implementation Notes (Phase 16)

- テストプレイ（`/quiz/test-play/play`）は要件 18.2 のとおり対象外。本番 `quiz-play-client.tsx` のみ変更する。
- `PostAnswerFeedback` コンポーネント本体は変更せず、呼び出し側で `correctAnswerDisplay` を省略する（design.md Phase 16 §5）。
- 混合クイズでは非早押し問題に `standard` policy を適用し、セッション合計は各区間の累計とする（要件 18.6）。
- `elapsedSeconds` の意味が区間累計に変わるが、`saveAttempt` スキーマ変更は行わない（要件 18.21）。

---

### 24. Phase 19: 模擬試験・フラッシュカード LB 警告（2026-06-09）

- [x] 24.1 プレイモード選択パネルへのランキング非対象警告
  - 通常・模擬試験・フラッシュカードの3モード選択 UI が表示されるクイズ詳細で、プレイパネル内に共通の注意文を表示する
  - 文案に「模擬試験・フラッシュカードは初回／リプレイランキング非対象」「先にこれらでプレイすると通常モードでも初回ランキング不可（リプレイのみ）」を含める
  - ウミガメ専用・早押し固定 UI では警告を表示しない
  - 警告領域に `data-testid="play-mode-leaderboard-warning"` を付与する
  - **完了状態**: 対象クイズ詳細で警告が表示され、ウミガメ・早押しクイズでは非表示であること
  - _Requirements: 2.3a, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9_
  - _Boundary: QuizDetailClient_

- [x] 24.2 (P) Phase 19 コンポーネントテスト
  - 通常クイズで警告 testid が存在し、文案に模擬試験・フラッシュカード・初回プレイランキングが含まれることを検証する
  - ウミガメ・早押しクイズで警告がレンダリングされないことを検証する
  - **完了状態**: 関連コンポーネントテストがグリーンであること
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.9_
  - _Depends: 24.1_
  - _Boundary: Testing_

- [x] 24.3 Phase 19 統合検証
  - モード選択およびプレイ開始遷移が Phase 15 以前どおり機能することを確認する
  - プレイ画面・結果画面に追加警告が表示されないことを確認する
  - **完了状態**: 要件 19.7–19.8 を満たし、既存プレイフロー E2E／手動スモークに回帰がないこと
  - _Requirements: 2.3, 2.4, 19.7, 19.8_
  - _Depends: 24.1_
  - _Boundary: Integration_

- [x]* 24.4 Phase 19 E2E スモーク（任意）
  - クイズ詳細画面で `[data-testid="play-mode-leaderboard-warning"]` が visible であることを Playwright で検証する
  - _Requirements: 19.9_
  - _Depends: 24.1_
  - _Boundary: Testing_

## Implementation Notes (Phase 19)

- LB 登録ロジックは `quizetika-core` Phase 18 に依存。UI は告知のみでサーバー側判定を実装しない。
- 専用コンポーネントは作らず `QuizDetailClient` 内インライン実装とする（design.md Phase 19 §6）。
- プレイ中・結果画面での再警告は要件外。

---

### 25. Phase 20: 〇×問題の1タップ回答 UI（2026-06-09）

- [x] 25.1 〇／× 専用回答パネルの実装
  - 大きな「〇」「✕」ボタンを並べ、1タップで即座に選択肢 ID を解答として送信する専用パネルを実装する（確定ボタンなし）
  - `data-testid="true-false-answer-panel"`、`true-false-answer-true`、`true-false-answer-false` を付与する
  - 送信中・フィードバック表示中は二重送信を防ぐためボタンを無効化する
  - legacy ラベル（「○」「×」等）でも choice ID を解決できること
  - **完了状態**: ボタン1回のクリックで `onConfirm(choiceId)` が1回だけ呼ばれること
  - _Requirements: 20.1, 20.2, 20.3, 20.4, 20.16_
  - _Boundary: TrueFalseAnswerPanel_

- [x] 25.2 本番プレイ画面への組み込み
  - `true-false` 問題では `ChoiceAnswerPanel` の代わりに専用パネルを表示する
  - 通常モードでは送信後に既存の即時正誤フィードバックフロー（要件 17）を適用する
  - 模擬試験モードでは1タップ送信後も従来の exam 進行（自動次問なし）を維持する
  - **完了状態**: 本番プレイで 〇× 問題が1タップ回答でき、通常モードでフィードバックが表示されること
  - _Requirements: 20.5, 20.8, 20.9, 20.15_
  - _Depends: 25.1_
  - _Boundary: QuizPlayClient_

- [x] 25.3 テストプレイ・弱点克服画面への組み込み
  - テストプレイ画面と弱点克服プレイ画面でも本番と同一の 〇／× 専用パネルを使用する
  - **完了状態**: 3画面すべてで `true-false` 問題に専用パネルが表示され、選択式パネルが使われないこと
  - _Requirements: 20.6, 20.7_
  - _Depends: 25.1_
  - _Boundary: TestPlayClient, ReviewClient_

- [x] 25.4 出題形式ラベルと探索カルーセルの拡張
  - クイズカード等の出題形式表示で `true-false` を「〇×式」として表示する（コア lib のラベル定義を利用）
  - ホームの出題形式カルーセルに「〇×式」を追加し、選択時に形式フィルタが `true-false` になること
  - **完了状態**: カード・カルーセルに「〇×式」が表示され、カルーセル選択でグリッドが絞り込まれること
  - _Requirements: 20.10, 20.11, 20.12_
  - _Depends: quizetika-core 19.2_
  - _Boundary: QuizCard, ExploreFilterSection_

- [x] 25.5 (P) Phase 20 コンポーネントテスト
  - 専用パネルの即送信・無効化・legacy ラベル解決を検証する
  - **完了状態**: 関連 Jest がグリーンであること
  - _Requirements: 20.3, 20.4, 20.16_
  - _Depends: 25.2, 25.3_
  - _Boundary: Testing_

- [x] 25.6 Phase 20 統合検証
  - 通常モードのフィードバック（要件 17）・exam モード退行なしを確認する
  - 採点は既存 choice ID ベースのまま動作することを確認する
  - **完了状態**: プレイフロー関連テスト・ビルドがグリーンであること
  - _Requirements: 20.8, 20.9, 20.13, 20.14, 20.15_
  - _Depends: 25.4, 25.5_
  - _Boundary: Integration_

- [ ]* 25.7 Phase 20 E2E スモーク（任意）
  - Playwright で 〇× クイズの1タップ回答とフィードバック表示を検証する
  - _Requirements: 20.3, 20.5, 20.16_
  - _Depends: 25.6_
  - _Boundary: Testing_

## Implementation Notes (Phase 20)

- 実装順: `quizetika-core` 19.x 完了後に 25.4（ラベル・カルーセル）。25.1–25.3 は既存 `choices` データで先行可能。
- `ChoiceAnswerPanel` は `true-false` から分離し変更しない（multiple-choice 専用のまま）。
- 作問 UI は `quizetika-creator-dash-ui` Phase 10 が担当。

---

### 26. Phase 21: ホームフィード無限スクロール・sticky 検索バー・フィルタ UI 再編（2026-06-09）

- [x] 26.1 検索セクションへのカルーセル統合と sticky 検索バー
  - ホームから独立アコーディオンパネルを除去し、ジャンル・出題形式の横スクロールカルーセルを検索セクション内に常時表示する
  - ジャンル名絞り込み入力をカルーセル上部に配置し、難易度・問題数・プレイ状況のみ「フィルター」ボタンで開閉する
  - 検索バー行（統合検索＋フィルターボタン）のみ画面上部に sticky 固定し、`data-testid="home-search-bar-sticky"` を付与する
  - ジャンルページ（`lockedGenreId` あり）ではカルーセルを表示せず、従来どおり検索バー＋フィルタパネルのみとする
  - **完了状態**: ホームに `genre-carousel` / `format-carousel` が常時 visible で、アコーディオン見出しが存在しないこと
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 21.10, 21.11, 21.12, 21.13, 21.14_
  - _Boundary: ExploreSearchSection, HomeClient_

- [x] 26.2 探索フィードフックの段階的取得対応
  - 先頭ページ取得・続きページ追加・`hasMore` / `loadingMore` 状態をフックに追加する
  - タブ切替・フィルタ変更時は一覧をリセットし、デバウンス 300ms 後に先頭ページから再取得する
  - タブ別取得および複合検索有効時は、コアの段階的取得 API（`PaginatedQuizResult`）を呼び出す
  - ジャンル scoped モード（ジャンル一覧ページ）は一括取得のまま変更しないこと
  - **完了状態**: フィルタ変更で一覧がリセットされ、続きカーソル付きで2ページ目が末尾に追加されること
  - _Requirements: 21.1, 21.6, 21.7, 21.8, 21.15_
  - _Depends: quizetika-core 20.3, 20.4_
  - _Boundary: useExploreQuizFeed_

- [x] 26.3 スクロール末端検知フックの追加
  - 一覧末端付近のセンティネル要素を `IntersectionObserver` で監視し、続きがある場合のみ追加読み込みを発火するフックを実装する
  - 先頭読み込み中・追加読み込み中・続きなしのときは発火しないこと
  - **完了状態**: センティネルが viewport に入ると `loadMore` が1回だけ呼ばれ、二重発火しないこと
  - _Requirements: 21.2, 21.4_
  - _Depends: 26.2_
  - _Boundary: useIntersectionLoadMore_

- [x] 26.4 ホーム画面の配線とプレイ状況追読み込み
  - ホームクライアントでフック拡張・センティネル・末尾ローディング（`data-testid="home-feed-load-more"`）を配線する
  - プレイ状況フィルタ適用後に表示件数が閾値未満かつ続きがある場合、自動で追加読み込みを1回発火する
  - 続きがないときは追加読み込みを行わず、無限ローディングを表示しないこと
  - **完了状態**: スクロールでカード件数が増加し、末尾到達後にローディングが止まること
  - _Requirements: 21.3, 21.5, 21.9, 21.18_
  - _Depends: 26.1, 26.3_
  - _Boundary: HomeClient, feed-visible-threshold_

- [x] 26.5 (P) Phase 21 フック・コンポーネントテスト
  - `useExploreQuizFeed` のリセット・append・`hasMore` 制御をモック API で検証する
  - 検索セクションにカルーセルが常時描画されることを検証する
  - **完了状態**: 関連 Jest がグリーンであること
  - _Requirements: 21.1, 21.2, 21.4, 21.6, 21.7_
  - _Depends: 26.4_
  - _Boundary: Testing_

- [x] 26.6 Phase 21 統合検証
  - 統合検索バー・カルーセル・タブ・フィルタの状態共有が維持されることを確認する（要件 13.16–13.19）
  - sticky 検索バーがサイドバー・ボトムナビと視覚的に競合しないことを手動またはスナップショットで確認する
  - **完了状態**: プレイフロー関連テスト・ビルドがグリーンであること
  - _Requirements: 13.5, 13.6, 13.16, 13.17, 13.18, 13.19, 21.16, 21.17_
  - _Depends: 26.5_
  - _Boundary: Integration_

- [x]* 26.7 Phase 21 E2E スモーク（任意）
  - Playwright でホームのスクロール追加読み込みと sticky 検索バーを検証する
  - _Requirements: 21.2, 21.10, 21.18_
  - _Depends: 26.6_
  - _Boundary: Testing_

## Implementation Notes (Phase 21)

- 実装順: `quizetika-core` 20.3・20.4 完了後に 26.2 以降。26.1（UI 再編）はコア API 待ちなしで先行可能。
- `ExploreAccordionsPanel` はホームから参照を外す。ファイル削除は任意。
- ジャンル別・タグ別一覧への無限スクロールは将来拡張。本フェーズはホーム（`/`）のみ。

---

### 27. Phase 22: ホーム／検索 IA 分離・ディスカバリーホーム・フィルタ常時表示（2026-06-09）

- [x] 27.1 (P) クイズ横スクロールカルーセルコンポーネント
  - 横スクロール（scroll-snap）でクイズカードを並べるカルーセルコンポーネントを実装する
  - ローディング・エラー・空状態を表示できること
  - **完了状態**: モックデータで横スクロール一覧が描画され、各カードからクイズ詳細へ遷移できること
  - _Requirements: 22.3, 22.4, 22.5, 22.10_
  - _Boundary: QuizCarousel_

- [x] 27.2 (P) ジャンルカルーセルのナビゲーションモード
  - ジャンルカルーセルに navigate モードを追加し、選択時に検索画面へジャンルフィルタ付きで遷移する（ホーム内フィルタではなく遷移）
  - filter モード（検索画面内絞り込み）は既存挙動を維持する
  - **完了状態**: ディスカバリーホームでジャンルタップが `/search?genreId=*` へ遷移すること
  - _Requirements: 22.8_
  - _Boundary: GenreCarousel_

- [x] 27.3 ディスカバリーホーム画面の実装
  - トップ（`/`）に統合検索・タブ・無限スクロールグリッドを表示しない
  - おすすめクイズ（トレンド Top 10）・おすすめジャンル・新着 Top 10 の3セクションを順に表示する
  - 各セクションに「もっと見る」深いリンク（トレンド→`/search?tab=trending`、新着→`/search?tab=latest`、ジャンル→`/search?openFilters=1`）を配置する
  - `data-testid="home-discovery-trending"` / `home-discovery-genres` / `home-discovery-latest` および各 `discovery-see-more-*` を付与する
  - データ読み込み中はセクション単位のスケルトンを表示する
  - **完了状態**: `/` に3カルーセルのみ表示され、もっと見る・ジャンルクリックで正しい URL へ遷移すること
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.5, 22.6, 22.7, 22.8, 22.9, 22.10, 22.24, 22.26_
  - _Depends: 27.1, 27.2, quizetika-core 21.1_
  - _Boundary: HomeDiscoveryClient_

- [x] 27.4 検索画面ルートへの探索 UX 移設
  - `/search` ルートを新設し、現行ホームクライアントの統合検索・タブ・無限スクロール・sticky 検索バー・カルーセルを移設する
  - 移設後 `home-client.tsx` を削除する
  - 検索画面本体に `data-testid="search-page"` を付与する
  - sticky 検索バー testid を `search-search-bar-sticky` に更新する（または同等の検索画面専用 testid）
  - **完了状態**: `/search` で Phase 21 相当の探索 UX が動作し、`/` には検索 UI が存在しないこと
  - _Requirements: 22.11, 22.12, 21.1, 21.2, 21.10, 21.18_
  - _Depends: 26.4_
  - _Boundary: SearchClient_

- [x] 27.5 検索 URL 状態同期フック
  - コア lib の parse/serialize をラップし、`useSearchParams` / router と探索タブ・フィルタ・openFilters・プレイ状況を双方向同期する
  - マウント時に URL から初期状態を復元し、ユーザー操作時に `router.replace` で URL を更新する
  - **完了状態**: `/search?tab=trending&genreId=xxx` 直アクセスでタブ・ジャンルフィルタが復元され、フィルタ変更で URL が更新されること
  - _Requirements: 22.13, 22.14_
  - _Depends: quizetika-core 21.3, 27.4_
  - _Boundary: useSearchUrlState_

- [x] 27.6 検索バー下のフィルタ条件常時表示
  - フィルタパネルの開閉に関わらず、1件以上のアクティブ条件があるとき検索バー直下にチップ行を常時表示する
  - 各チップの × で個別解除、一括クリアで全条件解除ができること
  - フィルタパネルに `initialOpenFilters` を渡し、`openFilters=1` 深いリンクで初期展開できること
  - `data-testid="search-active-filters"` を付与する
  - **完了状態**: パネルを閉じてもジャンル等のチップが visible で、× で当該条件のみ解除されること
  - _Requirements: 22.9, 22.15, 22.16, 22.17, 22.18, 22.19, 22.25_
  - _Depends: 27.4, 27.5_
  - _Boundary: ActiveFilterChips, ExploreSearchSection_

- [x] 27.7 (P) Phase 22 コンポーネント・フックテスト
  - ディスカバリーホームに検索バー／タブ不在、検索画面の URL 復元、フィルタチップ常時表示を検証する
  - **完了状態**: 関連 Jest がグリーンであること
  - _Requirements: 22.1, 22.13, 22.15, 22.18_
  - _Depends: 27.3, 27.6_
  - _Boundary: Testing_

- [x] 27.8 Phase 22 統合検証
  - サイドバー／ボトムナビから `/` と `/search` を切り替えられること（`quizetika-sidebar-layout` Phase 5 完了後）
  - ディスカバリー → 検索深いリンク → フィルタチップ → 一覧更新の一連フローが途切れないこと
  - **完了状態**: プレイフロー関連テスト・ビルドがグリーンであること
  - _Requirements: 22.6, 22.7, 22.8, 22.11, 22.12, 22.20, 22.21, 22.22, 22.23_
  - _Depends: 27.7, quizetika-sidebar-layout 5.3_
  - _Boundary: Integration_

- [x]* 27.9 Phase 22 E2E スモーク（任意）
  - Playwright でディスカバリー「もっと見る」・ジャンルクリック・検索フィルタチップ常時表示を検証する
  - _Requirements: 22.6, 22.7, 22.8, 22.15, 22.24, 22.26_
  - _Depends: 27.8_
  - _Boundary: Testing_

## Implementation Notes (Phase 22)

- `GenreCarousel` は filter モードでも `useRouter` を呼ぶため、テストでは `next/navigation` のモックが必要。
- 新着「もっと見る」は `serialize` 既定で `tab=latest` を省略するため、深いリンクは `/search?tab=latest` を明示指定。
- Phase 21 E2E（26.7）は探索 UX 移設後 `/search` で無限スクロール・sticky を検証（`quiz-search.spec.ts` 内）。
- 実装順: 27.1・27.2（並行）→ 27.3。27.4（移設）は 27.3 と並行可だが同一ファイル移動のため順序注意。27.5 は core 21.3 後。27.6 は 27.5 後。
- `/` の正本はディスカバリーホーム、探索 UX の正本は `/search`（要件 1 Phase 22 改定）。
- パーソナライズドおすすめ・ジャンル／タグ一覧 URL 共通化は対象外。

---

### 28. Phase 26: リスト機能 UI の完全廃止（2026-06-10）

- [x] 28.1 リスト探索・作成ルートおよび専用コンポーネントの削除
  - `/lists`・`/list/*` ページ、`components/lists`・`components/quiz-list`、リストブックマーク一覧、プロフィールリストパネル、リスト検索フックを削除する
  - 廃止 URL はルート削除により Next.js 既定の 404 とする（リダイレクトなし）
  - **完了状態**: `/lists` および `/list/create` が 404 を返し、削除対象コンポーネントへの import が残らないこと
  - _Requirements: 26.1, 26.2, 26.6_
  - _Depends: quizetika-core 23.6_
  - _Boundary: lists-routes_

- [x] 28.2 ブックマーク画面の2タブ化
  - ブックマークタブ型から `list` を除去し、「クイズ」「問題」の2タブのみ表示する
  - ブックマークフィード取得・表示から `lists` 配列参照を除去する
  - `data-testid="bookmarks-tabs"` を維持し、タブが2件のみであることをテスト可能にする
  - **完了状態**: `/bookmarks` にリストタブが存在せず、クイズ・問題タブの既存 UX が動作すること
  - _Requirements: 26.3, 26.4, 26.5, 26.6, 26.11, 26.16, 26.17_
  - _Depends: quizetika-core 23.2, 28.1_
  - _Boundary: bookmarks-client_

- [x] 28.3 プレイ画面からリスト／問題リストモード導線の除去
  - `mode=list`・`mode=question-list`・`listId` クエリ・問題リストセッション読み取り分岐を削除する
  - ウミガメ諦め後の「次の問題へ」（リスト文脈）およびオフライン時リスト次クイズブロックを削除する
  - **完了状態**: 通常・`my-quiz` プレイが動作し、リストモード用クエリ・セッション import が存在しないこと
  - _Requirements: 26.7, 26.9, 26.10, 26.12_
  - _Depends: quizetika-core 23.6, 28.1_
  - _Boundary: quiz-play-client_

- [x] 28.4 結果画面からリスト内ナビゲーションの除去
  - リスト内次クイズ／次問題 URL 生成・関連 analytics イベントを削除する
  - **完了状態**: 結果画面にリスト内「次へ」導線が表示されず、通常・`my-quiz` 結果ナビは維持されること
  - _Requirements: 26.8, 26.12_
  - _Depends: 28.3_
  - _Boundary: quiz-result-client_

- [x] 28.5 プロフィール・ナビのリスト参照除去
  - プロフィール画面から「作成したリスト」タブを除去する（軽微・本スペック境界）
  - ナビ active 判定から `/lists`・`/list/*` を除去する
  - **完了状態**: プロフィールにリストタブがなく、`nav-active` にリストパスが残らないこと
  - _Requirements: 26.1, 26.2_
  - _Depends: 28.1_
  - _Boundary: profile-client, nav-active_

- [x] 28.6 (P) Phase 26 コンポーネント・フックテストの更新
  - ブックマーク2タブ、リスト専用コンポーネントテスト削除、`useBookmarkFeed` 更新を検証する
  - リスト専用 E2E（`lists-discovery`・`quiz-list`）を削除し、`phase8`・`layout` を更新する
  - **完了状態**: 関連 Jest がグリーンで、リスト専用 E2E ファイルが除去されていること
  - _Requirements: 26.17, 26.18_
  - _Depends: 28.2, 28.4, 28.5_
  - _Boundary: Testing_

- [x] 28.7 Phase 26 統合検証
  - ブックマーク2タブ・通常プレイ・`mode=my-quiz` 結果フローが途切れないことを確認する
  - プレイフロー関連ビルド・テストスイートがグリーンであることを確認する
  - **完了状態**: Phase 26 完了後も探索・ブックマーク・プレイの主要導線が回帰なく動作すること
  - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 26.10, 26.11, 26.12, 26.16, 26.17, 26.18_
  - _Depends: 28.6_
  - _Boundary: Integration_

- [x]* 28.8 Phase 26 E2E スモーク（任意）
  - `/bookmarks` でリストタブ不存在、`/lists` が 404 であることを Playwright で検証する
  - _Requirements: 26.2, 26.3, 26.17_
  - _Depends: 28.7_
  - _Boundary: Testing_

## Implementation Notes (Phase 26)

- **前提**: `quizetika-core` Phase 26（23.6 完了）後に着手。Core と同一 PR の場合は Core 変更を先にコミット。
- リストルート削除は本スペック（28.1）が正本。`quizetika-creator-dash-ui` はダッシュボード CTA のみ担当。
- 維持: `quiz-list-skeleton.tsx`（ダッシュボード用）、問題・クイズブックマーク、`my-quiz` プレイ連携。
- Sidebar「リスト」ナビは `quizetika-sidebar-layout` が別途担当。

---

### 29. Phase 37: クイズ詳細画面のプレイモード選択廃止・既プレイ限定の代替導線（2026-07-07）

- [x] 29.1 単一プレイボタン化（3択UI廃止）
  - クイズ詳細画面の `selectedMode` state と、通常形式向けの通常・模擬試験・フラッシュカードの3択プレイパネル（3分岐）のみを削除する
  - 通常形式のクイズでは、常に単一の「プレイ」ボタンのみを表示し、押下時は常に通常モードのプレイ画面へ遷移するようにする
  - 水平思考（ウミガメのスープ）・早押し形式向けの既存の単一モード表示・遷移先・マークアップ・スタイルクラスは変更しない（これらの分岐は3択UIとは別の分岐であり、共有スタイルクラスは維持する）
  - プレイパネルの見出しを「プレイモード選択」から「プレイ」に変更する（全分岐で共通表示のため）
  - **完了状態**: 未プレイの新規クイズ詳細画面を表示すると、モード選択UIは一切なく「プレイ」という見出しの下に「プレイ」ボタン1つのみが表示され、押下すると通常モードのプレイ画面へ遷移すること。水平思考・早押し形式のクイズの表示・スタイルに変化がないこと
  - _Requirements: 2.3, 2.3a, 2.4_
  - _Boundary: QuizDetailClient_

- [ ] 29.2 既プレイ限定の代替導線とランキング非対象警告の表示条件反転・文言修正
  - 認証済みユーザーが当該クイズを完了済みと判定される場合（既存のプレイ済み判定を再利用）にのみ、単一プレイボタンの下に模擬試験・フラッシュカードへの代替導線を追加表示する新規スタイルクラスを追加し、マークアップを実装する
  - 代替導線から模擬試験・フラッシュカードそれぞれのプレイ画面へ正しく遷移できるようにする
  - ランキング非対象警告の表示条件を、現行の「未プレイ時のみ表示」から「代替導線が表示されるとき（＝既プレイ時）のみ表示」へ反転する
  - 警告文言から「先にこれらのモードでプレイした場合、以降通常モードでも初回プレイランキングに掲載されない」というプレイ順序依存の一文を除去し、「プレイ回数や順序にかかわらずランキングに影響しない」という順序非依存の表現に修正する
  - 水平思考・早押し形式では、完了状況にかかわらず代替導線・警告のいずれも表示しない
  - 未認証ユーザーには代替導線を表示しない
  - **完了状態**: 通常モードを1周完了したユーザーが同じクイズの詳細画面に戻ると、代替導線とランキング非対象警告（順序非依存の新文言）が表示され、模擬試験・フラッシュカードそれぞれへ正しく遷移できること。未プレイのクイズでは両方とも非表示のままであること
  - _Requirements: 2.3b, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.9, 27.1, 27.2, 27.3, 27.4, 27.5, 27.8, 27.9_
  - _Depends: 29.1_
  - _Boundary: QuizDetailClient_

- [ ] 29.3 (P) コンポーネントテストの更新（既存テストの反転修正含む）
  - 既存の「プレイ済みクイズでは警告を表示しない」テストを、既プレイ時に警告と代替導線が表示されることを検証するテストへ反転修正する
  - 既存の「通常クイズで警告を表示する」テストを、未プレイのクイズでは警告・代替導線ともに表示されないことを検証するテストへ更新する
  - 単一プレイボタンのみが表示されること、および代替導線から模擬試験・フラッシュカードへの遷移が正しく行われることを検証するテストを追加する
  - 水平思考・早押し形式のクイズでは完了状況にかかわらず代替導線・警告が表示されないことを検証するテストを維持する
  - **完了状態**: `tests/components/quiz-detail-client.test.tsx` の全テストが新しい表示条件と整合してグリーンであること
  - _Requirements: 2.3, 2.3a, 2.3b, 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.9, 27.1, 27.2, 27.3, 27.4, 27.5, 27.9_
  - _Depends: 29.2_
  - _Boundary: Testing_

- [ ] 29.4 (P) E2Eテストの更新（既存3ファイル）
  - `e2e/learning-support.spec.ts` の模擬試験・フラッシュカードE2Eを、初回に通常モードで1周完了させたうえで詳細画面に戻り、代替導線からモード選択する手順に更新する
  - `e2e/quiz-play.spec.ts` の、新規クイズ初回訪問時にランキング非対象警告が常時表示されることを前提としたテストを、未プレイ時は警告非表示・単一「プレイ」ボタンのみであることを検証するテストへ更新する
  - `e2e/advanced-quiz-features.spec.ts` の模擬試験・フラッシュカードE2Eの開始手順を、既プレイ状態を経由する手順へ更新する
  - **完了状態**: 3本のE2Eスペックがいずれも新しいゲーティング条件のもとでPlaywrightグリーンとなること
  - _Requirements: 2.3, 2.4, 19.1, 19.2, 19.9, 27.4, 27.5_
  - _Depends: 29.2_
  - _Boundary: Testing_

- [ ] 29.5 Phase 37 統合検証
  - 水平思考・早押し形式クイズの既存プレイ・結果保存フローに回帰がないことを確認する
  - 通常モードのプレイ完了 → 結果画面「もう一度プレイする」→ 詳細画面 → 代替導線という一連の導線が途切れず機能することを確認する
  - 模擬試験・フラッシュカードのプレイ進行・結果保存ロジック自体（`quizetika-core` 依存部分）に変更がないことを確認する
  - カスタムクイズ機能（`/my-quiz`）のセッション・UIに影響がないことを確認する
  - **完了状態**: 要件 19.7–19.8・27.6–27.8 を満たし、既存プレイフロー（通常・模擬試験・フラッシュカード・水平思考・早押し・my-quiz）の関連テストスイートに回帰がないこと
  - _Requirements: 2.3, 2.3a, 2.3b, 2.4, 19.7, 19.8, 27.6, 27.7, 27.8_
  - _Depends: 29.3, 29.4_
  - _Boundary: Integration_

## Implementation Notes (Phase 37)

- 専用コンポーネントは作らず `QuizDetailClient` 内インライン実装とする（design.md Phase 37 §3、Simplification原則）。
- 既プレイ判定は新規実装せず、既存 `usePlayedQuizIds` / `hasPlayedThisQuiz` をそのまま再利用する。
- **重要**: 現行のランキング非対象警告は `!hasPlayedThisQuiz`（未プレイ時のみ表示）が条件であり、既存テストもこれに整合している。本フェーズはこの条件を意図的に反転させるため、既存テスト（`tests/components/quiz-detail-client.test.tsx`・E2E3本）の期待値修正が実装の一部として必須（29.3・29.4）。あわせて警告文言のプレイ順序依存の一文も除去する（29.2）。
- **重要**: `modeOption`/`modeSelected`/`modeHeader`/`modeDesc` は水平思考・早押し形式の既存の単一モード表示カードでも共用されているため**削除しない**。3択UIブロック（通常形式の3分岐）のみを削除する（design.md Phase 37 §1・§4 のサニティレビューで確認済み）。
- カスタムクイズ機能（`/my-quiz`）・模擬試験/フラッシュカードのプレイ進行ロジック・`quizetika-core` のLB登録判定は対象外。
