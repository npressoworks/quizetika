# Brief: quizeum-play-flow-ui

## Problem
ユーザーがクイズを探索し、詳細を確認して、プレイ（通常、ウミガメのスープ含む）を行い、結果を確認し、弱点克服やリーダーボードで学習や競い合いを楽しむための一連のUIフローが必要です。

## Current State
プレイフロー UI は Phase 5 まで実装済み。Phase 6 では `quizeum-core` API に未接続。ホームはハードコード `GENRES`・アイコンがインライン絞り込み・`playStatus` 未配線。

## Phase 6 UX（確定）
- ジャンル**アイコン**クリック → `/genres/[id]` 遷移のみ。
- 複合検索パネルに **サジェスト付きジャンル入力**（件数増加対応）。
- フィルタ変更で **デバウンス後 `searchQuizzes`**。
- **プレイ状況**は認証ユーザーの完了 `attempts` に基づき一覧を後段絞り込み（要件 1.3 完遂）。

## Desired Outcome
カジュアルで洗練されたホーム画面からクイズを見つけ、複数のプレイモード（通常、模擬試験、フラッシュカード）で遊べ、特に「ウミガメのスープ」モードでは直感的でリッチな2カラムAI対話チャット（回答生成中の「・・・AIが質問を分析中です」のグレー表示等を含む）を利用でき、結果画面での評価投票や指摘送信がスムーズに行えること。

## Approach
Next.js App Routerでのダイナミックルーティングを使用し、レスポンシブなUIを CSS Modules でスタイリングします。ウミガメスープ用のチャットステートや、オフライン時のセッション永続化（localStorage）と自動同期をクライアントサイドで統合します。

## Scope
- **In**:
  - ホーム画面 (`/`): クイズのタブ表示（新着・人気・トレンド・フォローTL）、複合検索フィルタ、主要ジャンルナビゲーション。
  - クイズ詳細画面 (`/quiz/[id]`): クイズのメタ情報、難易度（1-10）、良問評価バッジ表示、歴代ハイスコアリーダーボード、3つのプレイモード選択UI。
  - クイズプレイ画面 (`/quiz/[id]/play`): クイズの設問とタイマー、ヒント表示、セッション中断保護（localStorage）。
    - **ウミガメのスープ（lateral-thinking）プレイ**: 2カラムレイアウト。左カラムはAI質問チャットUI（入力制限、ターン数表示、AI回答生成中はグレー文字で「・・・AIが質問を分析中です」と表示）、右カラムはスクロール可能なQ&A履歴リスト。真相回答入力とAI自動真相判定の合格/不合格フィードバック。
    - **ゲストアクセス制限**: 未ログイン状態でウミガメスープにアクセスした場合、`/login` にリダイレクト。
  - クイズ結果画面 (`/quiz/[id]/result`): 正解率・タイム結果、設問解説、👍/👎投票（悪問時は理由入力）、体感難易度投票、指摘送信モーダル、作家リアクション、SNS共有。オフライン時は非同期同期表示と一部無効化。
  - 弱点克服（復習プレイ）画面 (`/quiz/review`): 間違えた問題の一括フェッチと、開始前のジャンル選択UI。
  - 総合リーダーボード画面 (`/leaderboard`): プラットフォーム全体の各種ランキング。
  - ブックマーク一覧画面 (`/bookmarks`): お気に入りクイズ・リストのトグル解除機能。
  - タグ別クイズ一覧画面 (`/tags/[tagName]`): タグ付きクイズの人気・新着ソート表示。
  - ジャンル別クイズ一覧画面 (`/genres/[genreName]`): ジャンルの紹介、マージ済みジャンルの仮想統合クイズ表示。
- **Out**:
  - クイズやリストの新規作成・編集画面（別スペック）。

## Boundary Candidates
- `src/app/page.tsx`
- `src/app/quiz/[id]/page.tsx`
- `src/app/quiz/[id]/play/page.tsx`
- `src/app/quiz/[id]/result/page.tsx`
- `src/app/quiz/review/page.tsx`
- `src/app/leaderboard/page.tsx`
- `src/app/bookmarks/page.tsx`
- `src/app/tags/[tagName]/page.tsx`
- `src/app/genres/[genreName]/page.tsx`

## Out of Boundary
- Gemini APIとのやり取りそのものや、認証・プロフィール系UI（他スペック）。

## Upstream / Downstream
- **Upstream**: `quizeum-auth-profile-ui`, `quizeum-core`
- **Downstream**: `quizeum-creator-dash-ui`

## Existing Spec Touchpoints
- **Extends**: `quizeum-core` の `AttemptService`, `BookmarkService` および各種API。
- **Adjacent**: `quizeum-auth-profile-ui` (プロフィールからの弱点克服遷移など)

## Constraints
- **AI loading status**: 質問送信後、AIの回答が得られるまでの間、入力欄やチャット末尾に「・・・AIが質問を分析中です」とグレー文字で表示する。
- **Styling**: 硬すぎず、カジュアルながらも洗練された現代的で温かみのあるデザイン。
