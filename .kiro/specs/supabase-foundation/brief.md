# Brief: supabase-foundation

## Problem
プロジェクト全体が Firebase（Firestore, Auth, Storage）に強く依存しており、Supabase への完全移行に先立ち、PostgreSQL スキーマ、RLS ポリシー、Supabase クライアント初期化層を構築する基盤が必要。後続の全移行スペックがこの基盤に依存する。

## Current State
- Firebase クライアント初期化: `src/lib/firebase/config.ts`（app, auth, db, storage の4エクスポート）
- Firebase Admin 初期化: `src/lib/firebase/admin.ts`（`getAdminFirestore`, `getAdminStorage`）
- Firestore コレクションヘルパー: `src/lib/firebase/firestore.ts`（`createConverter`, `getCollectionRef`, 各コレクション参照）
- Firestore Security Rules: `firestore.rules`（24KB）
- Storage Security Rules: `storage.rules`
- Firestore Indexes: `firestore.indexes.json`
- 型定義: `src/types/` に Firestore の Timestamp/DocumentData に部分依存
- 環境変数: `NEXT_PUBLIC_FIREBASE_*` 系

## Desired Outcome
- `src/lib/supabase/` に Supabase クライアント初期化が完備（ブラウザ用、サーバー用、ミドルウェア用の3パターン）
- 全 Firestore コレクションに対応する PostgreSQL テーブル DDL が `supabase/migrations/` に定義
- 全 Firestore Security Rules に対応する RLS ポリシーが適用
- Supabase CLI によるローカル開発環境が起動可能（`supabase start`）
- 型定義が `supabase gen types` で自動生成される基盤が整備
- 環境変数が `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` に移行

## Approach
Supabase CLI でプロジェクトを初期化し、既存の Firestore ドキュメント構造を分析して正規化された PostgreSQL スキーマを設計する。`@supabase/supabase-js` + `@supabase/ssr` をインストールし、Next.js App Router に対応した3種類のクライアントユーティリティを作成する。

## Scope
- **In**:
  - `supabase init` によるプロジェクト構造の生成
  - `@supabase/supabase-js`, `@supabase/ssr` のインストール
  - `src/lib/supabase/client.ts`（ブラウザ用 `createBrowserClient`）
  - `src/lib/supabase/server.ts`（サーバー用 `createServerClient` + Cookie管理）
  - `src/lib/supabase/middleware.ts`（ミドルウェア用セッション更新）
  - 全テーブル DDL（`supabase/migrations/`）: users, quizzes, questions, attempts, follows, bookmarks, notifications, announcements, quiz_lists, metadata_tags, metadata_genres, genre_requests, merge_requests, feedback_reports, admin_logs, search_logs 等
  - PostgreSQL インデックス設計
  - RLS ポリシー（Security Rules の1:1対応 + PostgreSQL 最適化）
  - Storage バケット作成（quizzes, users, genres, sns-logos）+ Storage RLS ポリシー
  - `src/lib/supabase/types.ts`（`supabase gen types` で生成）
  - 環境変数テンプレート（`.env.local.example` 更新）
- **Out**:
  - サービス層のコード書き換え（後続スペックが担当）
  - 認証フローの書き換え（`supabase-auth-migration` が担当）
  - 既存データのマイグレーション

## Boundary Candidates
- DDL / RLS / インデックス設計（本スペック）
- クライアント初期化パターン（本スペック）
- サービス層の Supabase クライアント利用（`supabase-core-data` 以降）

## Out of Boundary
- Firestore SDK の呼び出しコードの書き換え
- Firebase Auth 関連コードの変更
- テストコードの更新

## Upstream / Downstream
- **Upstream**: なし（最初に実行するスペック）
- **Downstream**: `supabase-auth-migration`, `supabase-core-data`, `supabase-gameplay`, `supabase-storage-migration`, `supabase-governance`, `supabase-cleanup`（全後続スペック）

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: `quizetika-core`（型定義・サービス層の構造を参照）

## Constraints
- NoSQL → RDB 変換: 配列フィールドは JSONB カラムまたは正規化テーブル
- Firestore Timestamp → PostgreSQL `timestamptz`
- Firestore ドキュメント ID → PostgreSQL UUID（`gen_random_uuid()`）
- ローカル開発: Docker が必要（Supabase CLI 前提）
