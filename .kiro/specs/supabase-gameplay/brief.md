# Brief: supabase-gameplay

## Problem
ゲームプレイ関連のサービス（attempt, review, rating, reaction, リーダーボード, プレイ履歴）が Firestore SDK に依存しており、Supabase への移行が必要。特に `runTransaction` を多用するレビュー・リアクション処理やリーダーボード更新ロジックの PostgreSQL トランザクション/RPC への変換が核心。

## Current State
- `src/services/attempt.ts`: クイズアテンプト CRUD、リーダーボード更新（初回/リプレイ分離）
- `src/services/attempt-server.ts`: サーバーサイドアテンプト処理（Firebase Admin SDK）
- `src/services/review.ts`: クイズレビュー投稿・削除・指摘報告（`runTransaction` 多用）
- `src/services/rating.ts`: クイズ評価（星レーティング）
- `src/services/reaction.ts`: リアクション（いいね等）
- `src/services/ask-ai-utils.ts`: AI対話ユーティリティ
- `src/services/verify-truth-utils.ts`: ウミガメのスープ合格判定
- `src/lib/play-history-client.ts`: プレイ履歴クライアント
- `src/lib/played-quiz-ids-client.ts`: プレイ済みクイズID管理
- 関連 API Routes: `verify-truth`, `ask-ai`, `give-up-lateral`, `quick-press-stream`

## Desired Outcome
- 全ゲームプレイサービスが Supabase JS Client / RPC を使用
- リーダーボードの初回/リプレイ分離ロジックが PostgreSQL で正しく動作
- `runTransaction` → Supabase RPC（PostgreSQL 関数）に変換
- サーバーサイド処理が Supabase サーバークライアントを使用
- プレイ履歴のページネーションが PostgreSQL keyset pagination で動作

## Approach
`attempt.ts` と `review.ts` のトランザクションロジックを PostgreSQL RPC に変換。リーダーボードは配列フィールドから正規化テーブル（`leaderboard_entries`）に変更し、SQL でソート・上位5件取得。API Routes は `createServerClient` による認証済みクライアントを使用。

## Scope
- **In**:
  - `src/services/attempt.ts` の全面書き換え
  - `src/services/attempt-server.ts` の Firebase Admin → Supabase サーバークライアント
  - `src/services/review.ts` の全面書き換え（指摘報告の `runTransaction` → RPC）
  - `src/services/rating.ts` の書き換え
  - `src/services/reaction.ts` の書き換え
  - `src/services/ask-ai-utils.ts` の Firebase 依存除去
  - `src/services/verify-truth-utils.ts` の Firebase 依存除去
  - `src/lib/play-history-client.ts` の書き換え
  - `src/lib/played-quiz-ids-client.ts` の書き換え
  - 関連 API Routes（`verify-truth`, `ask-ai`, `give-up-lateral`, `quick-press-stream`）の Firebase Admin → Supabase
  - リーダーボード用 RPC / テーブル設計
  - 単体テスト更新
- **Out**:
  - Gemini API 連携ロジック自体の変更（DB接続先のみ変更）
  - UI コンポーネントの変更

## Boundary Candidates
- ゲームプレイ CRUD（attempt, review, rating, reaction）
- リーダーボード更新ロジック
- サーバーサイド API Routes

## Out of Boundary
- コアデータ（user, quiz, question）
- モデレーション・ガバナンス
- ストレージ

## Upstream / Downstream
- **Upstream**: `supabase-core-data`（quiz, user テーブルへの外部キー依存）
- **Downstream**: `supabase-cleanup`

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: `quizetika-play-flow-ui`（UI側の データソース切り替え）

## Constraints
- リーダーボードの初回/リプレイ判定ロジックは PostgreSQL 関数内で完結させる
- `runTransaction` の楽観的ロック → PostgreSQL の `SELECT FOR UPDATE` またはシリアライザブル分離レベル
- ウミガメのスープの対話セッション管理は Firestore のサブコレクションから `attempts` テーブルの JSONB カラムに変更
