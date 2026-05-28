# Technical Design Document: quizeum-play-flow-ui

## Overview
本ドキュメントは、クイズ投稿SNS「quizeum」におけるメインプレイフローおよび探索関連UIの技術設計仕様を定義します。エントランスとなるホーム画面から、クイズ詳細、インタラクティブな各種プレイモード（通常、模擬試験、フラッシュカード）、AIチャットを活用した水平思考プレイ（ウミガメのスープ）、結果表示と評価フィードバック、過去の誤答の復習プレイ、各種探索（ブックマーク、タグ別、ジャンル別）、およびリーダーボードを構築します。

本システムは、Next.jsのApp RouterおよびReact、TypeScriptのフロントエンド構成に加え、CSS Modulesによる親しみやすく遊び心のあるUIを実装し、Firestoreサービス（`AttemptService`, `BookmarkService`等）およびサーバーサイドAPI Routesと接続します。

### Goals
- 複合検索フィルタ、タブ切替タイムラインを備えた軽快なホーム画面の構築。
- プレイ中のブラウザ再読み込みや切断をカバーする、`localStorage` を用いた解答セッションのクライアントサイド一時保護と同期。
- ウミガメのスーププレイにおける、2カラムレイアウトおよびAI回答生成中の「・・・AIが質問を分析中です」（グレー文字表示）を含むリッチなチャットインタラクション。
- クイズ完了後の👍/👎評価、難易度投票、クローズド間違い指摘、作家への感謝のリアクションUIの実装。
- オフライン時におけるプレイ進行・結果確認のフォールバック処理。

### Non-Goals
- クイズおよびクイズリストの作成・編集UI（`quizeum-creator-dash-ui`が担当）。
- 管理者モデレーション、タグ・ジャンル仮想マージなどの自治ガバナンスUI（`quizeum-moderation-governance-ui`が担当）。

---

## Boundary Commitments

### This Spec Owns
- **UIルーティング設計**: `/`, `/quiz/[id]`, `/quiz/[id]/play`, `/quiz/[id]/result`, `/quiz/review`, `/leaderboard`, `/bookmarks`, `/tags/[tagName]`, `/genres/[genreName]` の各ページコンポーネント。
- **クライアントサイドセッション保護**: プレイ進捗の `localStorage` シリアライズ・復元・オンライン復帰時のバックグラウンド自動同期。
- **AI対話インタラクション**: ウミガメチャットUI、ターン制限・キャッシュバッジ、および回答生成待機メッセージのグレー文字表示制御。
- **評価フィードバックUI**: 良問評価投票、難易度投票、指摘フォームモーダル、作家感謝リアクション。

### Out of Boundary
- Gemini APIとの対話やプロンプト生成のバックエンドロジック本体。
- 認証状態の監視およびユーザープロフィールそのものの編集UI（`quizeum-auth-profile-ui`が担当）。

### Allowed Dependencies
- **`quizeum-auth-profile-ui`**: `Header`, `useAuth`
- **`quizeum-core`**: `AttemptService`, `BookmarkService`, `ReviewService`
- **サーバーAPIプロキシ**: `/api/attempt/ask-ai`, `/api/attempt/verify-truth`

### Revalidation Triggers
- AI質問判定API (`/api/attempt/ask-ai`) または真相判定API (`/api/attempt/verify-truth`) の入出力スキーマ変更。
- `AttemptService` のデータ格納スキーマ変更。

---

## Architecture

### Architecture Pattern & Boundary Map
プレイ画面はクライアントサイドでのインタラクティブな状態管理（ステート）が極めて重要であり、通常プレイ用の `PlayStateManager` フックおよびウミガメスープ用の `AiPlayStateManager` フックを介して `localStorage` への永続化とAPI通信を統制します。

```mermaid
graph TD
    Client[Play View / UI]
    Manager[PlayStateManager / React Hook]
    LocalStorage[(Local Client Storage)]
    ApiProxy[ask-ai / verify-truth API]
    Firestore[(Cloud Firestore)]

    Client --> Manager
    Manager --> LocalStorage
    Manager --> ApiProxy
    Manager --> Firestore
```

### Technology Stack
- **Frontend**: Next.js v16.2.6 (App Router), React v19.2.4, TypeScript
- **Styling**: Vanilla CSS (CSS Modules)
- **Local Storage**: `localStorage` (クライアントサイドセッション保護用)

---

## File Structure Plan

### Directory Structure
```
src/
├── app/
│   ├── page.tsx                   # ホーム画面 (1.1, 1.2, 1.3, 1.4)
│   ├── page.module.css
│   ├── bookmarks/
│   │   ├── page.tsx               # ブックマーク一覧画面 (7.3)
│   │   └── bookmarks.module.css
│   ├── leaderboard/
│   │   ├── page.tsx               # 総合リーダーボード画面 (7.1)
│   │   └── leaderboard.module.css
│   ├── tags/
│   │   └── [tagName]/
│   │       └── page.tsx           # タグ別クイズ一覧画面 (7.2)
│   ├── genres/
│   │   └── [genreName]/
│   │       └── page.tsx           # ジャンル別クイズ一覧画面 (7.2)
│   └── quiz/
│       ├── review/
│       │   ├── page.tsx           # 弱点克服プレイ画面 (6.1, 6.2, 6.3)
│       │   └── review.module.css
│       └── [id]/
│           ├── page.tsx           # クイズ詳細画面 (2.1, 2.2, 2.3, 2.4)
│           ├── page.module.css
│           ├── play/
│           │   ├── page.tsx       # クイズプレイ画面 (3.1, 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6)
│           │   └── play.module.css
│           └── result/
│               ├── page.tsx       # クイズ結果画面 (5.1, 5.2, 5.3, 5.4, 5.5)
│               └── result.module.css
└── hooks/
    ├── usePlayState.ts            # 通常プレイのセッション管理フック (3.4)
    └── useAiPlayState.ts          # ウミガメチャットのステート管理フック (4.3, 4.4)
```

---

## System Flows

### ウミガメスープ AI回答生成中インタラクションフロー
```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant UI as チャット画面 (/play)
    participant State as useAiPlayState
    participant API as /api/attempt/ask-ai

    Player->>UI: 質問テキスト入力 & 送信
    UI->>State: askQuestion(text)
    State->>State: pending状態をtrueに設定
    Note over UI: チャット末尾に「・・・AIが質問を分析中です」をグレー文字でインライン表示
    State->>API: POST /api/attempt/ask-ai
    API-->>State: 判定結果 (yes/no/irrelevant/unknown) + コメント
    State->>State: pending状態をfalseに設定、対話履歴に追加
    Note over UI: 送信待機表示が消え、AIの回答バブルが表示される
```

---

## Requirements Traceability

| Requirement | Summary | Components | Interfaces | Flows |
|-------------|---------|------------|------------|-------|
| 1.1 | ホームタブ表示（新着・人気・トレンド・フォローTL） | `/` Page | `QuizService` | - |
| 1.2 | 主要ジャンルナビゲーション | `/` Page | `metadata_genres` | - |
| 1.3 | 複合検索フィルタ | `/` Page | `QuizService` | - |
| 1.4 | 未ログイン時ブックマーク制限 | `/` Page | `useAuth`, `/login` | - |
| 2.1 | クイズ詳細メタ情報表示 | `/quiz/[id]` Page | `QuizService` | - |
| 2.2 | 良問評価バッジとマスク制御 | `/quiz/[id]` Page | `ReviewService` | - |
| 2.3 | 3つのプレイモード選択UI | `/quiz/[id]` Page | Mode Panel | - |
| 2.4 | プレイ画面へのリダイレクト遷移 | `/quiz/[id]` Page | `useRouter` | - |
| 3.1 | 個別/全体カウントダウンタイマー | `/quiz/[id]/play` Page | Timer Hook | - |
| 3.2 | ヒント表示ポップアップ | `/quiz/[id]/play` Page | Dialog UI | - |
| 3.3 | `localStorage` セッション保護と復元 | `/quiz/[id]/play` Page | `usePlayState` | - |
| 3.4 | オフライン時のローカル解答進行 | `/quiz/[id]/play` Page | `AttemptService` | - |
| 4.1 | ウミガメスープ2カラムレイアウト | `/quiz/[id]/play` Page | AI Component | - |
| 4.2 | 未ログイン時のウミガメスープ制限リダイレクト | `/quiz/[id]/play` Page | Auth Guard | - |
| 4.3 | AI回答生成中待機「・・・AIが質問を分析中です」表示 | `/quiz/[id]/play` Page | `useAiPlayState` | インタラクションフロー |
| 4.4 | 同一質問キャッシュバッジ表示 | `/quiz/[id]/play` Page | AI Component | - |
| 4.5 | 無料ユーザーのターン制限表示と無効化 | `/quiz/[id]/play` Page | AI Component | - |
| 4.6 | 真相回答と自動真相判定・クリア演出 | `/quiz/[id]/play` Page | `verify-truth` | - |
| 5.1 | プレイ結果表示と解説マークダウン | `/quiz/[id]/result` Page | Result Component | - |
| 5.2 | 👍/👎良問評価および難易度投票 | `/quiz/[id]/result` Page | `ReviewService` | - |
| 5.3 | 問題の間違い指摘フォーム | `/quiz/[id]/result` Page | Feedback Dialog | - |
| 5.4 | 作家感謝リアクション送信 | `/quiz/[id]/result` Page | `ReactionService` | - |
| 5.5 | オフライン結果画面表示と機能制限 | `/quiz/[id]/result` Page | Offline Handler | - |
| 6.1 | 弱点克服ジャンルフィルタ選択 | `/quiz/review` Page | Genre Selector | - |
| 6.2 | 間違い設問のフェッチと復習プレイ | `/quiz/review` Page | `AttemptService` | - |
| 6.3 | 復習完了時の誤答リストアトミック削除 | `/quiz/review` Page | `AttemptService` | - |
| 7.1 | 総合リーダーボード各種ランキング | `/leaderboard` Page | Ranking Tab | - |
| 7.2 | タグ別・ジャンル別クイズ一覧表示 | `/tags/[tagName]`, `/genres/[genreName]` | Quiz Card Grid | - |
| 7.3 | ブックマーク一覧とお気に入り解除 | `/bookmarks` Page | `BookmarkService` | - |

---

## Components and Interfaces

### Component Summary Table

| Component | Domain/Layer | Intent | Req Coverage | Key Dependencies | Contracts |
|-----------|--------------|--------|--------------|------------------|-----------|
| `HomePage` | UI / Page | クイズ探索・複合検索・タブ切替 | 1.1, 1.2, 1.3, 1.4 | `QuizService`, `useAuth` | State |
| `QuizDetailPage` | UI / Page | クイズのメタデータおよび良問評価、プレイモード選択 | 2.1, 2.2, 2.3, 2.4 | `QuizService`, `ReviewService` | State |
| `QuizPlayPage` | UI / Page | クイズ解答画面（通常タイマー、ヒント、ウミガメスープチャット） | 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3, 4.4, 4.5, 4.6 | `usePlayState`, `useAiPlayState` | State, API |
| `QuizResultPage` | UI / Page | 正誤解説、評価・難易度投票、指摘フォーム、お礼送信 | 5.1, 5.2, 5.3, 5.4, 5.5 | `ReviewService`, `ReactionService` | State, API |
| `ReviewPage` | UI / Page | 間違えた設問の復習プレイとフィルタ制御 | 6.1, 6.2, 6.3 | `AttemptService` | State |
| `LeaderboardPage` | UI / Page | プラットフォームランキングの可視化 | 7.1 | `QuizService` | State |
| `BookmarksPage` | UI / Page | ブックマークしたアイテムの管理と解除 | 7.3 | `BookmarkService` | State |

---

## Error Handling

### Error Strategy
- **AI回答生成中のタイムアウト・切断**:
  - API呼び出しに失敗した場合、待機表示（「・・・AIが質問を分析中です」）を解除し、「通信エラーが発生しました。もう一度質問を送信してください。」と赤文字のバブルをチャットに追加表示して親切にフォローします。
- **オフライン時の制限処理**:
  - オフラインでのプレイ中、結果画面に遷移した際は、「現在オフラインのため、良問評価や間違い指摘、作家リアクションは送信できません。オンライン復帰後に自動同期されます。」と優しいトーンで警告ヘッダーを表示し、関連ボタンを非活性化（disabled）します。

---

## Testing Strategy

### Unit Tests
- **`localStorage` セッションの保存と復旧**:
  - `usePlayState` フックが、指定の解答データ（設問ID、解答インデックス、経過秒数）を正しく `localStorage` にシリアライズし、ページ初期化時に正確にデシリアライズできるかをテスト。

### Integration Tests
- **ウミガメスープ AI回答中の状態監視**:
  - プレイヤーが質問を送信した瞬間、`useAiPlayState` の `pending` フラグが `true` となり、UI上にグレー文字の「・・・AIが質問を分析中です」が表示されることを検証。
  - APIレスポンス完了時に、`pending` フラグが `false` となり、結果テキストがチャットバブルに正しくマッピングされることを結合テスト。

### E2E/UI Tests
- **複合検索フィルタ**:
  - ホーム画面でジャンルアイコンをクリック、または難易度スライダーを動かした際に、表示されるクイズカードの一覧が意図通りにフィルタリングされるかをブラウザシミュレートしてテスト。
