# Research & Design Decisions - supabase-foundation

## Summary
- **Feature**: `supabase-foundation`
- **Discovery Scope**: Complex Integration / Greenfield Infrastructure Base
- **Key Findings**:
  - Next.js App Router 環境で Supabase を安全に利用するために、`@supabase/ssr` パッケージを用いた Cookie ベースのセッション管理が標準となる。
  - Firebase Auth から Supabase Auth への移行に伴い、セッションはブラウザの `localStorage` ではなく HTTP-only Cookie で維持され、`middleware.ts` で更新する。
  - Firestore の NoSQL データモデルを RDB（PostgreSQL）にマッピングする際、配列や JSON 型を PostgreSQL の `text[]`, `uuid[]` および `jsonb` カラムに適切に変換し、外部キー制約を付与して参照整合性を保証する。

## Research Log

### Supabase と Next.js App Router の統合
- **Context**: App Router の Server Components と Client Components で認証セッションを共有しつつ、セッションの有効期限を自動延長する最適な初期化手法の確立。
- **Sources Consulted**: [Supabase Official Next.js Integration Guide](https://supabase.com/docs/guides/auth/server-side/nextjs)
- **Findings**:
  - `createBrowserClient` (from `@supabase/ssr`) を用いてクライアント側クライアントを作成。
  - `createServerClient` を用いて、`cookies()` をインジェクトしたサーバー側クライアントを作成。Server Component / Action / Route Handler に対応。
  - `middleware.ts` 内で `updateSession` を実行し、期限切れのアクセス・リフレッシュトークンを Cookie レベルで透過的に更新。
- **Implications**: `src/lib/supabase/` 配下にクライアント初期化ファイルを3種類配置する。

### Firestore データモデルの PostgreSQL へのマッピング
- **Context**: Firestore コレクションを PostgreSQL テーブルにマッピングする際、NoSQL特有の配列フィールドや非正規化構造の正規化。
- **Sources Consulted**: PostgreSQL Array/JSONB types documentation, Firebase to Supabase Migration Guide.
- **Findings**:
  - クイズの `tags` や問題の `truthKeywords` は PostgreSQL の `text[]` 配列で保持可能。
  - クイズ詳細のリーダーボード（初回/リプレイ）や問題の選択肢（`Choice[]`）は、独立した関連テーブルに正規化するか、クエリ効率を鑑みて `jsonb` 型で非正規化保持するかを選択。
  - 今回の移行では、クイズ・問題作成時のアトミックなデータ整合性を維持しつつ変更規模を最小限に抑えるため、問題内の `choices` は `jsonb` 型で保持し、クイズリーダーボードは順位比較とクエリの独立性を考慮して `leaderboard_entries` テーブルに正規化設計する。
- **Implications**: DDL 定義において配列型や `jsonb` を適切に使い分け、パフォーマンスと完全性のバランスを取る。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 正規化ファースト | すべてのネスト配列（選択肢、タグ、リーダーボード）を関連テーブルに正規化する。 | 参照整合性と厳格な RDB 制約の保証。 | 書き込み時の複数 INSERT/UPDATE によるトランザクション複雑化。 | 移行オーバーヘッドが大きいため、一部重要ドメインのみに適用。 |
| ハイブリッド (JSONB + 配列型) | 順序が固定された非構造化データ（選択肢など）は `jsonb` で保持し、リレーショナルなデータは関連テーブルに切り出す。 | 既存のコード構造（TypeScript インターフェース）との互換性が高く、移行時の修正が容易。 | JSONB 内のデータに対する厳格な外部キー制約などが利用不可。 | **採用**: 選択肢は `jsonb`、クイズタグ/ジャンルは非正規化とテーブル設計の併用。 |

## Design Decisions

### Decision: ユーザー BAN 状態の RLS によるグローバル遮断
- **Context**: BAN されたユーザーがデータベースに対して一切の新規書き込み（作成・更新・削除）を行えないようにする。
- **Alternatives Considered**:
  1. 各テーブルの RLS ポリシーで毎回 `users` テーブルの `is_banned` カラムを参照する。
  2. データベースの PostgreSQL 関数 `is_not_banned(uid)` を作成し、それを全テーブルのポリシーで呼び出す。
- **Selected Approach**: オプション 2 (共通関数の作成と呼び出し)
- **Rationale**: 重複する RLS 記述を排除し、BAN 遮断ロジックの一貫性と可読性を確保するため。
- **Trade-offs**: RLS ポリシーが実行されるたびに `is_not_banned` 関数の呼び出しオーバーヘッドが発生するが、セッションユーザーのキャッシュやインデックスにより影響は軽微。
- **Follow-up**: RLS ポリシー適用時に `supabase start` で結合テストを実施。

## Risks & Mitigations
- **Docker 依存によるローカル環境構築の失敗** — Supabase CLI は Docker を必要とするため、開発者のローカル環境によっては起動しないリスクがある。構築手順を README に明記し、トラブルシューティングガイドを提供する。
- **RLS ポリシーの再帰的参照エラー (Infinite Recursion)** — `users` テーブルの RLS ポリシー内で `users` 自体を参照するようなポリシーを記述すると無限ループが発生する。ポリシー定義で `auth.uid()` を直接主キーと比較するなどのシンプルな設計で防ぐ。

## References
- [Supabase SSR Guide](https://supabase.com/docs/guides/auth/server-side/nextjs) — Next.js 統合
- [PostgreSQL jsonb Documentation](https://www.postgresql.org/docs/current/datatype-json.html) — JSONB 型の設計基準
