# Requirements Document: quizeum-creator-dash-ui

## Introduction
本ドキュメントは、クイズ投稿SNS「quizeum」におけるクイズ作成・編集、作家ダッシュボード（アナリティクスおよび間違い指摘管理）、およびクイズリスト（問題集）の作成・編集・エクスポートを含む、クリエイター（作家）向けフロントエンドUI要件を定義します。

## Boundary Context
- **In scope**:
  - クイズ新規作成・編集画面における動的設問管理、設問タイプ（選択肢/短答）の切り替え。
  - クイズタグ入力時の「自動名寄せ正規化」と類似 canonical タグ存在時のインラインサジェスト警告UI。
  - 公開申請時のZodスキーマを用いた厳格な検証エラーリストインライン表示。
  - 作家ダッシュボードにおけるアナリティクスグラフ（累計プレイ数、評価、ブックマーク）およびクイズ個別設問解答割合グラフ。
  - プレイヤーからクローズドに送信された「間違い指摘フィードバック」の一覧表示と修正アクション動線。
  - 自分が作成したクイズデータのワンクリック一括JSONエクスポート機能。
  - クイズリスト詳細画面における収録クイズ一覧と listId / mode = 'list' による連続プレイ開始UI。
  - クイズリスト作成・編集画面におけるクイズ検索アタッチ、ドラッグ＆ドロップによる順序並べ替え、およびリストパッケージJSONエクスポート。
- **Out of scope**:
  - 外部クイズデータのインポートUIおよびインポート処理本体（仕様変更によりインポート機能は完全に廃止されたため、UI領域は一切設置しません）。

## Requirements

### Requirement 1: クイズ作成・編集画面 (Page: `/quiz/create`, `/quiz/[id]/edit`)
**Objective:** As a Quiz Creator, I want a visual editor with live tag normalization, suggestions, and strict validation, so that I can draft, edit, and publish high-quality quizzes.

#### Acceptance Criteria
1. The Quiz Editor Screen shall display metadata fields for title, description, thumbnail upload, difficulty (1-10 slider), genre selector, and tag inputs (maximum 5 tags).
2. The Quiz Editor Screen shall display a link "新しいジャンルを申請する" adjacent to the genre selector, redirecting to the Genre Request Screen.
3. When the creator inputs a tag, the Quiz Editor Screen shall normalize the text (trim, convert to lowercase, remove spaces/symbols) and, if a similar canonical tag exists, display an inline warning: "推奨: 類似するタグ #TagName が既に存在します。既存のタグを使用することをお勧めします。".
4. The Quiz Editor Screen shall allow creators to dynamically add or delete questions, toggle question type between "選択式 (multiple-choice)" and "短答文字入力式 (text-input)".
5. When the creator attempts to publish a quiz, the Quiz Editor Screen shall run Zod schema validation and, if any integration constraints are violated (e.g., no question, no correct answer specified), display a clear red error list.
6. The Quiz Editor Screen shall allow the creator to click "下書き保存" at any time, saving the draft state to Firestore via `QuizService.saveQuiz(status='draft')` without validation errors.

### Requirement 2: 作家ダッシュボード (Page: `/creator/dashboard`)
**Objective:** As a Quiz Creator, I want a unified dashboard for analytics, feedback resolution, and exporting my content, so that I can monitor performance and maintain my quizzes.

#### Acceptance Criteria
1. The Creator Dashboard Screen shall display an analytics summary (cumulative plays, average rating, bookmarks) using visual charts (line/bar graphs).
2. The Creator Dashboard Screen shall display a detailed analytics panel for each quiz, visualizing the answer distribution percentage for each question (e.g., pie charts of choice selections).
3. The Creator Dashboard Screen shall display a closed feedback report queue, displaying player-reported issues (typos, fact errors, alternatives).
4. When the creator clicks "修正する" on a feedback report card, the system shall redirect the creator to the corresponding Quiz Editor Screen pre-loaded with the affected question.
5. The Creator Dashboard Screen shall display a "クイズ一括エクスポート" button that packages all quizzes (including drafts) into a single downloadable JSON package.

### Requirement 3: クイズリスト詳細画面 (Page: `/list/[id]`)
**Objective:** As a Quizeum User, I want to view quiz lists and start sequential attempts, so that I can solve organized collections of quizzes.

#### Acceptance Criteria
1. The Quiz List Detail Screen shall display the list title, description, creator avatar, list cover image, and card list of embedded quizzes.
2. When the user clicks the "リストプレイ開始" button, the Quiz List Detail Screen shall start sequential play, tracking attempts with `attempts.listId` set to the list ID and `mode` set to `'list'`.
3. Where the authenticated user is the list creator, the Quiz List Detail Screen shall display a "リストを編集する" edit button.

### Requirement 4: リスト作成・編集画面 (Page: `/list/create`, `/list/[id]/edit`)
**Objective:** As a Quiz Creator, I want to draft quiz lists using search and drag-and-drop sorting, so that I can package themed content collections.

#### Acceptance Criteria
1. The List Editor Screen shall display metadata fields (title, description, cover image, public/private visibility toggle) and a quiz search panel.
2. The List Editor Screen shall allow creators to search and attach quizzes, and sort their order using visual drag-and-drop handles.
3. The List Editor Screen shall display a "リストパッケージエクスポート" button that packages the list metadata and full self-created quiz data into a single downloadable JSON package.
