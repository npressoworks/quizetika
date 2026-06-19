# Requirements Document

## Project Description (Input)

Quizeum のエンドユーザーは、クイズ詳細・プレイ・結果・復習・リーダーボードを通じてクイズ体験のライフサイクル全体を利用している。現状、これらの画面は CSS Modules（`play.module.css` 約 773 行を含む大規模スタイル）と旧 Quizeum ビジュアルで実装されており、Phase 24 の shadcn/ui + Tailwind 刷新方針と整合しない。回答パネル（選択肢/正誤）の視覚的フィードバックとプレイ中の没入型 UX が製品価値の核である。

本スペック（`quizeum-ui-quiz-lifecycle`）は、`quizeum-ui-foundation` と `quizeum-ui-layout-shell` が提供する shadcn 標準テーマと共通プリミティブの上に、クイズライフサイクル全画面を再構築する。プレイ中の没入感、回答フィードバック、タイマー/進捗表示、結果画面のリーダーボード・アコーディオン詳細、`/play` パスでのシェル非表示契約、既存 `data-testid` は維持する。クイズエディタ、プレイエンジン lib、スコア計算・attempt 永続化は範囲外とする。

## Introduction

Quizeum は Next.js 16 + React 19 のクイズ SNS である。Phase 24 では UI 刷新のドメイン垂直スライスの一つとして、クイズライフサイクル（詳細→プレイ→結果→復習→リーダーボード）を shadcn 標準寄せのビジュアルに移行し、関連 CSS Modules を削除する。本スペックは UI 最重要かつ CSS 量最大級の領域であり、プレイ UX 退行は許容しない。

移行順序はリスク低減のため詳細→結果→復習→プレイ（最後）とする。`quizeum-ui-layout-shell` に依存し、`/play` および `/quiz/test-play/*` では LayoutWrapper のシェル非表示契約を維持する。移行完了時に関連 Playwright E2E および Jest テストがグリーンであることを要求する。

**Phase 27（2026-06）**: クイズプレイ統計の BigQuery 連携基盤として、すべての問題形式（真偽値、多肢選択、記述、早押し、並べ替え、連想、水平思考）に対応した詳細な回答データ（解答時間、正誤、ヒント使用履歴、選択順、回答変更有無、記述回答内容など）をトラッキングし、完了ペイロードの `questionAnswerDetails` に含めて保存する要件を追加します。

## Boundary Context

- **In scope**:
  - クイズ詳細（`/quiz/[id]`）、プレイ（`/quiz/[id]/play`）、結果（`/quiz/[id]/result`）、投稿完了（`/quiz/[id]/success`）、復習（`/quiz/review`）、グローバルリーダーボード（`/leaderboard`）
  - テストプレイ（`/quiz/test-play/play`, `/quiz/test-play/result`）
  - 回答 UI: `ChoiceAnswerPanel`, `TrueFalseAnswerPanel`, `PostAnswerFeedback`
  - 結果 UI: `ResultQuestionDetailsAccordion`, `QuizDualLeaderboard`, `DifficultyVoteStars`, `ReportModal`
  - ライフサイクル用スケルトン（detail, play, result, recommend, leaderboard）
  - 詳細・結果で使用する `QuizCard`, `FormatLabel` 等のライフサイクル関連コンポーネント
  - shadcn 標準ビジュアル（Button, RadioGroup, Progress, Accordion, Dialog, Card, Tabs, Skeleton）
  - ライト/ダーク両テーマでの視認性確保
  - 既存 `data-testid` の維持
  - 当該 `.module.css` の削除
  - 関連 E2E・Jest 回帰確認
  - **Phase 27**: クイズプレイ画面（通常・ウミガメスープ・並び替え等）でのタイマー測定・ヒント閲覧・選択肢アクションのトラッキング UI/フック実装、および完了ペイロードへの解答詳細（`QuestionAnswerDetail[]`）の統合。
- **Out of scope**:
  - クイズエディタ（`/quiz/create`, `/quiz/[id]/edit`）、`quiz-editor.tsx`, `quiz-list-editor`, `genre-editor-select`, `author-quiz-reference-panel`, `editor-skeleton`
  - `feedback-skeleton`（`quizeum-ui-admin-creator` が所有）
  - シェルコンポーネント（`quizeum-ui-layout-shell`）
  - プレイエンジン（`usePlayState`, `useAiPlayState`, `useQuickPressStream` 等の hooks）
  - スコア計算・attempt 永続化 lib（`services/attempt` 等）
  - 新機能追加、ルート変更、API/認可ロジック変更
  - `variables.css` の完全削除（`css-modules-cleanup` 候補）
- **Adjacent expectations**:
  - `quizeum-ui-foundation` は Tailwind、shadcn テーマ、`cn()`、初期プリミティブ（Button, Dialog, Card, Skeleton 等）を提供済みであること
  - `quizeum-ui-layout-shell` は `/play` パスで Sidebar/Header/BottomNav を非表示にする契約を維持すること
  - `quizeum-core` の attempt 契約および `quizeum-play-flow-ui` のプレイ/結果フローは本移行後も同一であること
  - 下流で `e2e/quiz-play.spec.ts` 等の selector 更新が必要な場合は本スペック完了時に実施すること

## Requirements

### Requirement 1: クイズ詳細画面
**Objective:** As a プレイヤー, I want クイズ詳細を shadcn 標準の見た目で閲覧しプレイを開始できること, so that 刷新後もクイズ情報とプレイ導線を迷わず利用できる。

#### Acceptance Criteria
1. When ユーザーが `/quiz/[id]` にアクセスしたとき, the Quiz Lifecycle UI shall クイズタイトル・説明・問題数・難易度・ジャンル・フォーマットラベル・作成者情報を表示する。
2. When ユーザーがプレイモード（通常/試験/フラッシュカード）を選択したとき, the Quiz Lifecycle UI shall 選択状態を視覚的に示し、プレイ開始導線を提供する。
3. When ログインユーザーがブックマーク操作を行ったとき, the Quiz Lifecycle UI shall ブックマーク状態を切り替えて表示する。
4. While ユーザーが当該クイズをプレイ済みであるとき, the Quiz Lifecycle UI shall プレイ済みステータスを表示する。
5. Where クイズにリーダーボード対象プレイモードが含まれる, the Quiz Lifecycle UI shall リーダーボード参加に関する注意表示（`play-mode-leaderboard-warning`）を維持する。
6. The Quiz Lifecycle UI shall クイズ詳細画面の既存 `data-testid`（`quiz-detail-skeleton`, `quiz-detail-play-status`, `play-mode-leaderboard-warning`, `quiz-leaderboard` 等）を維持する。
7. The Quiz Lifecycle UI shall クイズ詳細画面で旧 Quizeum ビジュアル（glass-card、ネオン色クラス）を使用しない。

### Requirement 2: クイズ結果・投稿完了画面
**Objective:** As a プレイヤー, I want プレイ後の結果と投稿完了画面を shadcn 標準で閲覧・操作できること, so that スコア確認・復習・共有・評価フローを維持できる。

#### Acceptance Criteria
1. When ユーザーがプレイ完了後に結果画面に遷移したとき, the Quiz Lifecycle UI shall スコアサマリー・正答率・難易度表示・各問の正誤概要を表示する。
2. When ユーザーが結果画面で問題詳細アコーディオンを操作したとき, the Quiz Lifecycle UI shall 各問の正解・自分の回答・解説を展開/折りたたみ表示する。
3. When ユーザーが結果画面で難易度投票を行ったとき, the Quiz Lifecycle UI shall 星評価 UI（`difficulty-vote-stars`）で投票操作を受け付ける。
4. When ユーザーが結果画面でリプレイ・ブックマーク・通報・作者フォロー等の操作を行ったとき, the Quiz Lifecycle UI shall 既存と同一の導線と `data-testid`（`quiz-replay-btn`, `quiz-result-bookmark-btn`, `quiz-report-btn`, `author-follow-btn` 等）を維持する。
5. Where クイズにリーダーボードデータが存在する, the Quiz Lifecycle UI shall 初回/リプレイタブ付きデュアルリーダーボード（`quiz-leaderboard`, `quiz-leaderboard-tab-first`, `quiz-leaderboard-tab-replay`）を表示する。
6. When ユーザーが投稿完了画面（`/quiz/[id]/success`）にアクセスしたとき, the Quiz Lifecycle UI shall 公開完了メッセージ・共有リンク・次のアクション導線を表示する。
7. The Quiz Lifecycle UI shall 結果・投稿完了画面で旧 Quizeum ビジュアルを使用しない。

### Requirement 3: 弱点克服（復習）画面
**Objective:** As a プレイヤー, I want 復習画面でジャンル別の弱点克服クイズを shadcn 標準 UI で探索できること, so that 復習習慣を維持できる。

#### Acceptance Criteria
1. When ユーザーが `/quiz/review` にアクセスしたとき, the Quiz Lifecycle UI shall 復習ページコンテナ（`review-page-container`）とジャンルセレクタを表示する。
2. When ユーザーがジャンルフィルタを切り替えたとき, the Quiz Lifecycle UI shall 選択ジャンルに応じたクイズ一覧を更新表示する（`review-genre-all`, `review-genre-{id}`）。
3. While 復習データの読み込み中であるとき, the Quiz Lifecycle UI shall 復習用スケルトン（`review-skeleton`）を表示する。
4. The Quiz Lifecycle UI shall 復習画面から各クイズ詳細またはプレイへの既存導線を維持する。

### Requirement 4: リーダーボード画面
**Objective:** As a プレイヤー, I want グローバルリーダーボードを shadcn 標準 UI で閲覧できること, so that ランキング情報を快適に確認できる。

#### Acceptance Criteria
1. When ユーザーが `/leaderboard` にアクセスしたとき, the Quiz Lifecycle UI shall スコア・プレイ数・クリエイター等のタブ切替可能なランキング一覧を表示する。
2. When ユーザーがタブを切り替えたとき, the Quiz Lifecycle UI shall 対応するランキングデータを読み込み表示する。
3. The Quiz Lifecycle UI shall ランキング各行にユーザー表示名・アバター・スコアを表示する。
4. The Quiz Lifecycle UI shall グローバルリーダーボード画面で旧 Quizeum ビジュアルを使用しない。

### Requirement 5: 回答パネルとフィードバック UI
**Objective:** As a プレイヤー, I want 選択肢・正誤・回答後フィードバックが shadcn 標準で明確に表示されること, so that 解答中および解答後の学習体験が維持される。

#### Acceptance Criteria
1. When 選択式問題が表示されたとき, the Quiz Lifecycle UI shall `ChoiceAnswerPanel` で単一/複数選択の回答 UI を提供し、確定操作を受け付ける。
2. When 正誤問題が表示されたとき, the Quiz Lifecycle UI shall `TrueFalseAnswerPanel` で「正しい/正しくない」選択（`true-false-answer-true`, `true-false-answer-false`）を提供する。
3. When ユーザーが回答を確定したとき, the Quiz Lifecycle UI shall `PostAnswerFeedback` で正誤表示・解説・次問/結果導線（`play-answer-feedback`, `play-next-question`, `play-view-results`）を表示する。
4. While 回答パネルが無効化されているとき, the Quiz Lifecycle UI shall 追加の回答操作を受け付けない。
5. The Quiz Lifecycle UI shall 回答パネルで shadcn Button / RadioGroup（または同等のアクセシブル選択 UI）を用い、旧 CSS Modules スタイルに依存しない。

### Requirement 6: クイズプレイ没入型体験
**Objective:** As a プレイヤー, I want プレイ画面が没入型の全画面体験として機能し続けること, so that 集中してクイズに挑戦できる。

#### Acceptance Criteria
1. While ユーザーが `/quiz/[id]/play` または `/quiz/test-play/play` にいるとき, the Quiz Lifecycle UI shall アプリシェル（Sidebar/Header/BottomNav）を表示しない（LayoutWrapper 契約に委譲）。
2. When プレイが開始されたとき, the Quiz Lifecycle UI shall 問題文・回答 UI・進捗/タイマー表示（`play-elapsed-seconds`）を表示する。
3. When ユーザーがプレイ中に操作したとき, the Quiz Lifecycle UI shall スキップ（`play-skip-question`）、ブックマーク、通報等の既存インタラクションを維持する。
4. While プレイデータの読み込みまたは完了処理中であるとき, the Quiz Lifecycle UI shall プレイ用スケルトン（`quiz-play-skeleton`, `quiz-play-completing`）を表示する。
5. When ユーザーがテストプレイ結果画面に遷移したとき, the Quiz Lifecycle UI shall 本番結果画面と同等の結果 UI 契約を維持する。
6. The Quiz Lifecycle UI shall プレイ画面の DOM 契約および `data-testid` を E2E 互換の範囲で維持する。
7. The Quiz Lifecycle UI shall プレイ画面で旧 Quizeum ビジュアルを使用せず、没入型レイアウト（全画面コンテンツ、十分なタップ領域）を維持する。
8. When [プレイヤーがクイズ（通常・ウミガメスープ・並び替え等の全形式）をプレイしているとき], the Quiz Lifecycle UI shall [解答時間、ヒント閲覧アクション、および選択肢変更アクション（最初のクリックから別の選択肢への変更等）をフックしトラッキングする]。
9. When [クイズプレイが完了したとき], the Quiz Lifecycle UI shall [トラッキングされた `QuestionAnswerDetail[]` 配列を構築し、完了ペイロードとして `attempts` 保存処理に統合する]。


### Requirement 7: 通報モーダルと補助コンポーネント
**Objective:** As a プレイヤー, I want 通報や補助 UI が shadcn 標準の Dialog で操作できること, so that モデレーション導線と情報表示が一貫する。

#### Acceptance Criteria
1. When ユーザーが通報操作を開始したとき, the Quiz Lifecycle UI shall `ReportModal` を Dialog ベースで表示する（`report-modal-overlay`, `report-modal-content`）。
2. When ユーザーが通報理由を入力して送信したとき, the Quiz Lifecycle UI shall 送信処理を実行し、成功時に成功メッセージ（`report-success-message`）を表示する。
3. The Quiz Lifecycle UI shall 通報モーダルの既存 `data-testid`（`report-reason-input`, `report-submit-btn`）を維持する。
4. Where ライフサイクル画面でスケルトンが必要である, the Quiz Lifecycle UI shall shadcn Skeleton ベースのローディング表示を提供する。

### Requirement 8: shadcn 標準ビジュアルとテーマ対応
**Objective:** As a ユーザー, I want クイズライフサイクル全画面が shadcn 標準のクリーンな見た目でライト/ダーク両方で視認できること, so that Phase 24 UI 刷新の一貫性を体感できる。

#### Acceptance Criteria
1. The Quiz Lifecycle UI shall 旧 Quizeum ビジュアル（glass-card、ネオン色クラス、body gradient 依存）をライフサイクル画面で使用しない。
2. When ライトモードが適用されているとき, the Quiz Lifecycle UI shall shadcn 標準ライトパレットで全ライフサイクル画面を表示する。
3. When ダークモードが適用されているとき, the Quiz Lifecycle UI shall shadcn 標準ダークパレットで全ライフサイクル画面を表示する。
4. Where 正誤・進捗・選択状態が表示される, the Quiz Lifecycle UI shall ライト/ダークいずれでも十分なコントラストで状態を識別できる。
5. The Quiz Lifecycle UI shall カード・サーフェスに shadcn 標準の border と背景（`bg-background` / `border-border` 等）を用いる。

### Requirement 9: レガシースタイル削除と構造維持
**Objective:** As a 開発者, I want ライフサイクル関連 CSS Modules が削除されルーティング・データフローが維持されること, so that 後続スライスが Tailwind 正の基盤の上に実装できる。

#### Acceptance Criteria
1. When 本スペックの実装が完了したとき, the Quiz Lifecycle UI shall クイズ詳細・プレイ・結果・成功・復習・リーダーボードおよびライフサイクル用 `src/components/quiz/` 配下の対象 `.module.css` をすべて削除する。
2. The Quiz Lifecycle UI shall 既存ルート（`/quiz/[id]`, `/quiz/[id]/play`, `/quiz/[id]/result`, `/quiz/[id]/success`, `/quiz/review`, `/leaderboard`, `/quiz/test-play/*`）を変更しない。
3. The Quiz Lifecycle UI shall プレイ・結果のデータフロー（hooks、services、attempt 契約）を変更しない。
4. The Quiz Lifecycle UI shall エディタ関連ファイル（`quiz-editor.tsx`, `create.module.css`, `editor-skeleton` 等）の CSS Modules を削除しない。

### Requirement 10: 回帰テストと品質維持
**Objective:** As a オペレーター, I want ライフサイクル UI 移行後も既存テストが通過すること, so that プレイ UX 退行なく UI 刷新をリリースできる。

#### Acceptance Criteria
1. When 本スペックの実装がマージされたとき, the Quiz Lifecycle UI shall `e2e/quiz-play.spec.ts` がグリーンである。
2. When 本スペックの実装がマージされたとき, the Quiz Lifecycle UI shall `e2e/leaderboard.spec.ts` および関連 E2E がグリーンである。
3. When 本スペックの実装がマージされたとき, the Quiz Lifecycle UI shall `npm run build` と `npm run lint` が新規エラーなく成功する。
4. When 本スペックの実装がマージされたとき, the Quiz Lifecycle UI shall 既存 Jest テストスイートがグリーンである。
5. The Quiz Lifecycle UI shall プレイ画面について手動 QA または視覚回帰確認を実施し、没入型 UX・回答フィードバック・タイマー表示の退行がないことを確認する。
