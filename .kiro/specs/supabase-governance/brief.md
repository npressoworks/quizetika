# Brief: supabase-governance

## Problem
モデレーション・ガバナンス関連のサービス（moderation, tagMerge, reputation, entitlement, subscription）が Firestore SDK に依存しており、特に `tagMerge.ts` は複雑な `runTransaction` と `writeBatch` を多用している。これらを Supabase / PostgreSQL に移行する必要がある。

## Current State
- `src/services/moderation.ts`: モデレーション操作（Firestore クエリ）
- `src/services/tagMerge.ts`: タグ/ジャンル統合申請・投票・可決処理（`runTransaction` + `writeBatch` 多用 — 最も複雑なトランザクションロジック）
- `src/services/reputation.ts`: 信頼スコア・モデレータティアー管理、リセット処理
- `src/services/entitlement.ts`: 権限管理（サブスクリプションベース）
- `src/services/entitlement-shared.ts`: 共有エンタイトルメントロジック
- `src/services/subscription.ts`: Stripe サブスクリプション状態管理（Firestore 同期）
- `src/services/stripe-webhook.ts`: Stripe Webhook 処理（Firebase Admin Firestore で Firestore 書き込み）
- `src/services/seedInitialGenresAdmin.ts`: 初期ジャンルデータ投入（Firebase Admin SDK）
- 関連 API Routes: `admin/users/ban`, `admin/users/unban`, `admin/users/reset`, `admin/seed-genres`, `admin/genres`, `billing/checkout-session`, `billing/portal-session`, `webhooks/stripe`

## Desired Outcome
- 全ガバナンスサービスが Supabase JS Client / RPC を使用
- `tagMerge.ts` の複雑なトランザクションが PostgreSQL RPC に変換
- Stripe Webhook が Supabase サーバークライアントで Supabase に書き込み
- 管理者操作（BAN、スコアリセット等）が RLS ポリシーと RPC で保護
- 初期データ投入が Supabase SQL マイグレーションまたは seed スクリプトに変更

## Approach
`tagMerge.ts` の投票・可決ロジックは PostgreSQL 関数（RPC）として実装し、原子性を保証。Stripe Webhook は `SUPABASE_SERVICE_ROLE_KEY` を使用した特権クライアントで書き込み。管理者操作は RLS ポリシー（`role = 'admin'` チェック）で保護。

## Scope
- **In**:
  - `src/services/moderation.ts` の書き換え
  - `src/services/tagMerge.ts` の全面書き換え（投票・可決 RPC 実装）
  - `src/services/reputation.ts` の書き換え（リセット RPC）
  - `src/services/entitlement.ts` / `entitlement-shared.ts` の書き換え
  - `src/services/subscription.ts` の書き換え
  - `src/services/stripe-webhook.ts` の Firebase Admin → Supabase サーバークライアント
  - `src/services/seedInitialGenresAdmin.ts` の書き換え
  - 関連 API Routes の Firebase Admin → Supabase サーバークライアント
  - タグ/ジャンル統合用 PostgreSQL RPC の DDL 定義
  - 管理者操作用 RPC の DDL 定義
  - 単体テスト更新
- **Out**:
  - Stripe のビジネスロジック変更（Webhook シグネチャ検証等は維持）
  - コアデータサービス（`supabase-core-data` が担当済み）
  - ゲームプレイサービス（`supabase-gameplay` が担当済み）

## Boundary Candidates
- モデレーション・タグ統合操作
- 信頼スコア・エンタイトルメント管理
- Stripe 連携のDB操作部分

## Out of Boundary
- コアデータ（user, quiz, question）
- ゲームプレイ（attempt, review）
- ストレージ操作
- Stripe API 連携のビジネスロジック

## Upstream / Downstream
- **Upstream**: `supabase-core-data`（users, quizzes テーブルへの外部キー依存）
- **Downstream**: `supabase-cleanup`

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: `quizetika-moderation-governance-ui`（UI側のデータソース）

## Constraints
- `tagMerge.ts` の `writeBatch` → PostgreSQL 関数内の複数 UPDATE/INSERT で代替（単一トランザクション内）
- Stripe Webhook は `SUPABASE_SERVICE_ROLE_KEY`（RLS バイパス）で書き込む必要がある
- `adminLogs` テーブルの RLS: 管理者のみ読み書き可能
