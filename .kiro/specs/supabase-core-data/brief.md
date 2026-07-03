# Brief: supabase-core-data

## Problem
主要なサービス層（22+ファイル）が Firestore SDK に直接依存しており、Supabase JS Client への全面書き換えが必要。ユーザー、クイズ、問題、ブックマーク、通知、お知らせなどのコア CRUD 操作と、Firestore 固有のコンバーター・コレクション参照を PostgreSQL / Supabase Client に置換する。

## Current State
- `src/services/user.ts`: ユーザー CRUD、フォロー/アンフォロー（`runTransaction`）、バッジ授与（`runTransaction`）
- `src/services/quiz.ts`: クイズ CRUD、検索、ジャンル別取得（`canonicalGenreId` 解決）、カーソルベースページネーション
- `src/services/question.ts`: 問題 CRUD、クイズ内問題の並び替え
- `src/services/bookmark.ts`: ブックマーク追加・削除・一覧取得
- `src/services/notification.ts`: 通知 CRUD、既読管理
- `src/services/announcement.ts`: お知らせ CRUD
- `src/lib/firebase/firestore.ts`: `createConverter`（Timestamp→Date変換）、`getCollectionRef`、型安全コレクション参照

## Desired Outcome
- 全コアサービスが Supabase JS Client（`supabase.from('table').select()`等）を使用
- Firestore 固有のコンバーター・コレクション参照が不要に
- `runTransaction` → PostgreSQL トランザクション / Supabase RPC に置換
- 型安全性が `supabase gen types` で生成された型で維持
- カーソルベースページネーションが keyset pagination に変換

## Approach
各サービスファイルを1つずつ Supabase JS Client API に書き換え。Firestore の `doc().get()` → `supabase.from().select().eq().single()`、`addDoc()` → `supabase.from().insert()`、`updateDoc()` → `supabase.from().update().eq()` のパターンで置換。`runTransaction` は Supabase の `rpc()` でサーバー関数として実装。

## Scope
- **In**:
  - `src/services/user.ts` の全面書き換え（フォロー/アンフォロー、バッジ等の transaction → RPC）
  - `src/services/quiz.ts` の全面書き換え（検索、ジャンル別、ページネーション）
  - `src/services/question.ts` の全面書き換え
  - `src/services/bookmark.ts` の全面書き換え
  - `src/services/notification.ts` の全面書き換え
  - `src/services/announcement.ts` の全面書き換え
  - `src/services/quiz-validation.ts` の Firestore 依存除去
  - `src/lib/firebase/firestore.ts` の削除（コンバーター・コレクション参照が不要に）
  - `src/lib/metadata-resolution.ts` の書き換え
  - `src/lib/search-log.ts` の書き換え
  - 関連する Supabase RPC（サーバー関数）の DDL 定義
  - 単体テストの更新
- **Out**:
  - ゲームプレイ関連サービス（`supabase-gameplay` が担当）
  - モデレーション関連サービス（`supabase-governance` が担当）
  - ストレージ操作（`supabase-storage-migration` が担当）

## Boundary Candidates
- コア CRUD 操作（user, quiz, question, bookmark, notification, announcement）
- Firestore コンバーター・コレクション参照の除去
- PostgreSQL RPC（トランザクション代替）

## Out of Boundary
- ゲームプレイ（attempt, review, rating, reaction）
- モデレーション（moderation, tagMerge, reputation）
- 課金（subscription, entitlement）
- ストレージ操作

## Upstream / Downstream
- **Upstream**: `supabase-auth-migration`（認証済みクライアントの取得パターン）
- **Downstream**: `supabase-gameplay`, `supabase-governance`, `supabase-cleanup`

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: `quizetika-core`（サービス層の構造・API を大幅に変更）

## Constraints
- Firestore の配列フィールド（`tags[]`, `leaderboardFirstPlay[]`）→ JSONB カラムまたは正規化テーブル
- Firestore の `increment()` → PostgreSQL の `UPDATE SET col = col + 1` または RPC
- Firestore の `arrayUnion` / `arrayRemove` → PostgreSQL 配列関数または JSONB 操作
- `where('field', 'in', [...])` の Firestore 10件制限は PostgreSQL の `= ANY(...)` で自然に解消
