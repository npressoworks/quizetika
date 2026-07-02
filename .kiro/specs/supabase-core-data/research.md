# Research & Design Decisions - supabase-core-data

## Summary
- **Feature**: supabase-core-data
- **Discovery Scope**: Extension & Refactoring (Firestore to Supabase migration)
- **Key Findings**:
  - Firestore での `runTransaction` による複数ドキュメントのアトミック更新は、Supabase (PostgreSQL) 側でのストアドファンクション (RPC) への移行が最適。
  - Firestore の `increment` や配列操作 (`arrayUnion`, `arrayRemove`) は、PostgreSQL の `col = col + 1` や JSONB 関数/配列操作、および RPC 呼び出しで完全に再現可能。
  - キーセットページネーション (keyset pagination) は、PostgreSQL のインデックスを利用して `order_by` と `gt` フィルタの組み合わせにより高性能に動作可能。

## Research Log

### トランザクション処理の代替案
- **Context**: フォロー/アンフォローやバッジ付与など、複数のテーブルをアトミックに書き換えたい。
- **Sources Consulted**: Supabase JS Client Docs (RPC), PostgreSQL PL/pgSQL documentation.
- **Findings**:
  - Supabase クライアントライブラリは、クライアント主導の複数ステートメントトランザクションをサポートしない。
  - ストアドファンクション (PL/pgSQL) を定義し、`supabase.rpc()` で呼び出すことで、データベースサーバー側で単一のトランザクションとして安全に処理可能。
- **Implications**: フォロー・アンフォロー・バッジ付与処理を RPC 経由にする DDL 定義をマイグレーションに追加し、JS 側から呼び出す設計にする。

### ページネーションと検索
- **Context**: クイズ検索やジャンル別のクイズ一覧取得において、Firestore 時代のカーソルベースページネーションから移行する。
- **Sources Consulted**: PostgreSQL indexing on JSONB, full-text search strategies.
- **Findings**:
  - `quizzes` テーブルの `created_at` や `id` をキーにしたキーセットページネーションを構築する。
  - クイズ一覧取得クエリでは `select()` に対して `order()` および範囲条件 (`gt()`, `lt()`) を組み合わせる。
- **Implications**: 旧カーソルエンコーダ (`encodeQuizFeedCursor`) を変更し、JSON 等でシリアライズされたキーをパラメータに載せる。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| JS 側逐次実行 | 複数の await insert / update をクライアントから逐次呼び出す | 実装がシンプル、SQL変更不要 | ネットワーク切断等によるデータ不整合リスクが高い | 不採用 |
| PostgreSQL RPC | DBサーバー側でトランザクション関数を実行 | 完全なアトミック性、高い信頼性 | マイグレーションでの DDL 適用が必要 | 採用。フォロー数やバッジ付与の整合性を保証する唯一の現実的アプローチ |

## Design Decisions

### Decision: フォロー及びバッジ獲得トランザクションの RPC 移行
- **Context**: Firestore で `runTransaction` を用いて、フォロー関係の追加とフォロワー数のカウント変更をアトミックに同期していた。
- **Alternatives Considered**:
  1. クライアント側で逐次更新する
  2. Supabase の RPC 関数 (`handle_follow_user`) に処理を寄せる
- **Selected Approach**: オプション 2 を採用。
- **Rationale**: フォロー操作時の「フォロー数とフォロワー数の一貫性」はビジネスルール上極めて重要であり、不整合を防ぐためには DB 側でのトランザクション処理が必須。
- **Trade-offs**: SQL の管理コストが上がるが、データ完全性の保証には代えられない。

## Risks & Mitigations
- RLS ポリシーによる管理者権限の漏洩 — `SECURITY DEFINER` 関数の実行時には `search_path` の設定等に配慮し、意図しない権限昇格を防ぐ。

## References
- [Supabase Store Procedure (RPC)](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL PL/pgSQL](https://www.postgresql.org/docs/current/plpgsql.html)
