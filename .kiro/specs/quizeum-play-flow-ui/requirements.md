# Requirements Document: quizeum-play-flow-ui

## Introduction
本ドキュメントは、クイズ投稿SNS「quizeum」におけるホーム画面、クイズ探索、クイズ詳細、プレイ画面（通常・ウミガメスープ含む）、結果画面、弱点克服、およびリーダーボードを含む、ユーザーのクイズプレイに関する一連のフロントエンドUI要件を定義します。

## Boundary Context
- **In scope**:
  - ホーム画面における新着・人気・トレンド・フォロータイムラインのタブ表示および複合検索。
  - クイズ詳細画面における良問評価バッジ、リーダーボード、3つのプレイモード選択UI。
  - 通常プレイ画面における設問表示、制限時間タイマー、ヒント表示、および `localStorage` を用いたセッション保護。
  - 水平思考（ウミガメのスープ）における2カラムレイアウト、AIチャット（入力制限、ターン制限、回答生成中の「・・・AIが質問を分析中です」グレー表示、キャッシュマーク）、および真相判定。
  - クイズ結果画面における正誤解説リスト、👍/👎良問評価、難易度投票、指摘フォーム、お礼リアクション、SNS共有。
  - 過去の間違い設問を復習できる弱点克服プレイ画面（ジャンル選択機能含む）。
  - 各種探索一覧画面（ブックマーク、タグ別、ジャンル別）および総合リーダーボード画面。
- **Out of scope**:
  - Gemini APIを利用した判定サーバーサイドロジックそのもの（`quizeum-core`が担当）。
  - クイジエーター向けのクイズやクイズリストの作成・編集画面（後続スペックが担当）。

## Requirements

### Requirement 1: ホーム画面 (Page: `/`)
**Objective:** As a Quizeum User, I want to explore quizzes via tabs, genres, and a compound search filter, so that I can easily discover quizzes that interest me.

#### Acceptance Criteria
1. The Home Screen shall display distinct tab panels for "新着順", "人気順", "トレンド順", and "タイムライン" (visible only when authenticated).
2. The Home Screen shall display an interactive icon navigation list representing major metadata genres.
3. The Home Screen shall display a compound search panel allowing users to filter by genre, difficulty range (1-10), question count, and play status (unplayed / played).
4. If an unauthenticated guest user attempts to bookmark a quiz card on the Home Screen, then the Home Screen shall redirect the user to the Authentication Screen (`/login`).

### Requirement 2: クイズ詳細画面 (Page: `/quiz/[id]`)
**Objective:** As a Quizeum User, I want to view quiz metadata, ratings, leaderboards, and select a play mode, so that I can prepare for the quiz and understand its structure.

#### Acceptance Criteria
1. The Quiz Detail Screen shall display the quiz title, description, thumbnail, genre, tags, difficulty (1-10), perfect score leaderboards, and bookmark toggle.
2. The Quiz Detail Screen shall display the `reviewBadge` and `reviewScore` (re-evaluation state masked if within the 7-day re-evaluation reset period).
3. The Quiz Detail Screen shall display an interactive Play Panel offering three modes: "通常モード", "模擬試験モード", and "フラッシュカードモード".
4. When the user clicks the play button in the Play Panel, the Quiz Detail Screen shall redirect the user to the corresponding Quiz Play Screen (`/quiz/[id]/play`) in the selected mode.

### Requirement 3: クイズプレイ画面 (Page: `/quiz/[id]/play`)
**Objective:** As a Quiz Player, I want to answer quiz questions with countdowns, hints, and session preservation, so that I can enjoy a fair and reliable playing experience.

#### Acceptance Criteria
1. While playing in normal or exam mode, if a per-question time limit is specified, the Play Screen shall display a countdown timer and automatically submit incorrect answer on expiration (0 seconds).
2. While playing in exam mode, the Play Screen shall apply a single overall countdown timer instead of per-question limits, allowing players to navigate freely and review previous answers.
3. When the player clicks the "ヒントを表示" button, the Play Screen shall display the corresponding hint text.
4. While playing, the Play Screen shall continuously serialize the current answer states and save them to `localStorage` to allow recovery on reload or crash.
5. If the network is disconnected during play, the Play Screen shall allow the player to complete the quiz offline, presenting an offline results view upon completion.

### Requirement 4: 水平思考クイズ（ウミガメのスープ）プレイモード
**Objective:** As a Quiz Player, I want to play lateral thinking quizzes using a 2-column AI chat interface, so that I can ask questions and resolve the mystery.

#### Acceptance Criteria
1. When playing a quiz of type `lateral-thinking`, the Play Screen shall switch to a 2-column layout, displaying the interactive AI Chat on the left and the scrollable Q&A History List on the right.
2. If the user is unauthenticated, then the system shall redirect them to the Authentication Screen (`/login`) before loading the lateral thinking play screen.
3. When the player submits a free-text question, while the AI response is pending, the AI Chat shall display a loading message "・・・AIが質問を分析中です" in gray text at the bottom.
4. When a submitted question exactly matches a question in the current history, the Play Screen shall instantly return the cached answer with a "📋 既存の回答" badge, bypassing the AI API call.
5. If a free-tier user reaches the daily limit of 20 questions for that quiz, then the AI Chat shall disable input and display a "本日の残り質問数: 0/20" warning indicator.
6. When the player clicks "真相を解き明かす" and submits a truth summary, if the AI API approves it, then the Play Screen shall play a clear animation and redirect to the Quiz Result Screen.

### Requirement 5: クイズ結果画面 (Page: `/quiz/[id]/result`)
**Objective:** As a Quiz Player, I want to see my playing score, detailed explanations, and provide quality feedback, so that I can learn and rate the content.

#### Acceptance Criteria
1. The Quiz Result Screen shall display the clear score (correct count / total questions), elapsed time, correctness list, and rich markdown explanations for each question.
2. The Quiz Result Screen shall display a rating widget allowing the player to cast a binary vote (👍 Good / 👎 Bad) and rate the experienced difficulty (1-10).
3. When the player clicks the "問題の間違い指摘" button, the Quiz Result Screen shall open a feedback form allowing selection of categories (typo, fact, alternative) and detail input.
4. When the player clicks the "作家にお礼リアクションを送る" button, the Quiz Result Screen shall atomically send an appreciation notification to the creator.
5. If the user is offline, the Quiz Result Screen shall display an offline indicator, disable rating votes, feedback forms, and creator reactions, and notify "Attempt queued for sync".

### Requirement 6: 弱点克服プレイ画面 (Page: `/quiz/review`)
**Objective:** As an Authenticated User, I want to review questions I previously failed, so that I can overcome my knowledge gaps.

#### Acceptance Criteria
1. The Review Screen shall present a genre-filter selection panel (including "オールジャンル") prior to starting the session.
2. The Review Screen shall fetch failed questions from the database matching the filter and initiate a review play session.
3. When the review session completes, the system shall atomically update the failed list database and reduce `users.totalFailedQuestionsCount`.

### Requirement 7: その他の探索・リーダーボード画面
**Objective:** As a Quizeum User, I want to view global rankings and search tags/genres, so that I can explore high-quality competitive content.

#### Acceptance Criteria
1. The Leaderboard Screen shall display tabs for "総合ハイスコア", "月間プレイ数", and "作家ランキング".
2. The Tag Search Screen (`/tags/[tagName]`) and Genre Search Screen (`/genres/[genreName]`) shall display lists of matching quizzes sorted by popularity or newness.
3. The Bookmarks Screen (`/bookmarks`) shall display bookmarked quizzes and lists with dynamic toggle actions.
