# Research & Design Decisions

## Summary
- **Feature**: `genre-management-enhancement`
- **Discovery Scope**: Extension（既存のジャンル管理機能への機能追加・UI移動）
- **Key Findings**:
  - `quizzes.canonical_genre_id` / `quizzes.genre` は `metadata_genres` への外部キー制約を持たない（TEXT型のみ）。DB制約による自動整合は期待できず、削除時のクイズ再割当てはアプリ層（DB関数）で明示的に実装する必要がある。
  - 唯一FK制約で `metadata_genres` を参照するのは `user_genre_follows.genre_id`（`ON DELETE CASCADE`）であり、ジャンル削除時に自動的にフォローレコードが削除される。本仕様側の対応は不要。
  - 既存のジャンルマージ機能（`handle_vote_merge_request` PL/pgSQL関数）が「対象ジャンルを参照する全クイズを一括で付け替えてから旧レコードを処理する」という、本仕様が必要とする再割当てパターンと同型のロジックをすでに実装済みであり、これを踏襲する。
  - `/api/admin/genres/route.ts` は GET/POST のみで DELETE 未実装。既存の `authorizeAdmin()` ヘルパー（`isAdminUser()` による管理者判定）をそのまま踏襲できる。
  - 一括投入UI（`handleSeedGenres` とそのUIブロック）は `src/app/admin/moderation/page.tsx` に自己完結して実装されており、`assertSeedGenresAccess` と `/api/admin/seed-genres` 呼び出しロジックはそのまま `admin-genres-client.tsx` へ移植可能。

## Research Log

### ジャンル削除時のクイズ再割当てをどう実装するか
- **Context**: Requirement 3 は、削除対象ジャンルを参照する既存クイズを再割当て先へ一括更新してから削除することを求めており、かつ再割当て処理の途中でエラーが起きた場合は削除・更新のいずれも行われない（アトミック性）ことを求めている（3.3）。
- **Sources Consulted**: `supabase/migrations/20260705000000_governance_normalization.sql`（`handle_vote_merge_request` 関数、322-323行目付近の `UPDATE quizzes SET genre = v_target_id, canonical_genre_id = v_target_id ... WHERE canonical_genre_id = v_source_id` パターン）、`supabase/migrations/20260702000000_init.sql`（`quizzes`, `metadata_genres`, `user_genre_follows` テーブル定義）
- **Findings**:
  - PostgreSQL の関数（`LANGUAGE plpgsql`）は単一トランザクションとして実行されるため、関数内で例外（`RAISE EXCEPTION`）を発生させれば、それ以前に行った `UPDATE`/`DELETE` はすべて自動的にロールバックされる。
  - アプリケーション側（Next.js API Route）で「クイズ一括UPDATE」と「ジャンルDELETE」を別々のSupabase呼び出しとして実行すると、2回の呼び出しの間に不整合が生じるリスクがある（片方だけ成功する）。
- **Implications**: DB関数として `delete_genre_with_reassignment(p_genre_id, p_reassign_to_id)` を新設し、クイズの一括再割当てとジャンルレコードの削除を単一のPL/pgSQL関数内でアトミックに実行する。API Routeはこの関数を1回呼び出すだけにする。

### 影響確認（紐づくクイズ件数の取得）
- **Context**: Requirement 2.2 は、削除操作の開始時に対象ジャンルを参照する既存クイズの件数を表示することを求めている。
- **Sources Consulted**: `src/app/api/admin/genres/route.ts`（既存GET実装、`metadata_genres` 全件取得のみでクイズ件数は含まない）
- **Findings**: 既存の一覧取得APIは全ジャンルを返すのみで、ジャンルごとのクイズ件数は含まれていない。全ジャンル分のクイズ件数を毎回集計するのは不要なコストになるため、削除フロー開始時にオンデマンドで対象ジャンル1件分の件数のみ取得する設計が妥当。
- **Implications**: `GET /api/admin/genres/:id/usage` を新設し、削除ボタン押下時にのみ呼び出す。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| DB関数（PL/pgSQL）でアトミック処理 | `delete_genre_with_reassignment` をSupabase側に新設し、API RouteからRPC1回で呼び出す | トランザクション境界がDB内で完結し、要件3.3のロールバック要件を自然に満たす。既存のマージ機能と同じアーキテクチャパターンを踏襲できる | マイグレーション追加が必要 | 採用。既存の `handle_vote_merge_request` と一貫性がある |
| API Route側でSupabaseクライアントを使い2回に分けてUPDATE→DELETEを実行 | Next.js側でシーケンシャルに実行 | マイグレーション不要 | 2回の呼び出しの間で失敗した場合に部分適用のリスクがあり、要件3.3を満たせない | 不採用 |

## Design Decisions

### Decision: ジャンル削除と既存クイズ再割当てをDB関数で単一トランザクション化する
- **Context**: 削除とクイズ再割当てのアトミック性を保証する必要がある（3.1, 3.3）。
- **Alternatives Considered**:
  1. API Route側で逐次呼び出し — 部分適用のリスクがあり不採用
  2. DB関数（PL/pgSQL）でアトミックに処理 — 採用
- **Selected Approach**: `delete_genre_with_reassignment(p_genre_id TEXT, p_reassign_to_id TEXT DEFAULT NULL) RETURNS INTEGER` をSupabase側に新設。紐づくクイズが0件なら再割当てをスキップして削除のみ行い、1件以上なら `p_reassign_to_id` の妥当性検証後に一括UPDATEしてから削除する。異常系はすべて `RAISE EXCEPTION` で表現し、呼び出し元（API Route）がエラーメッセージ文字列でハンドリングする。
- **Rationale**: 既存のジャンルマージ機能と同型のロジック・同じ技術選択であり、レビュー・保守のコストを抑えられる。
- **Trade-offs**: マイグレーションファイルの追加が必要になるが、トランザクション整合性の面で優位。
- **Follow-up**: 関数の実行主体はAdmin API（`createAdminClient()`、service role）のみを想定し、`SECURITY DEFINER` は付与しない（service role実行時点でRLSはバイパスされるため不要）。

### Decision: 影響確認は専用エンドポイントでオンデマンド取得する
- **Context**: 削除フロー開始時にのみクイズ件数が必要であり、常時集計は不要（2.2）。
- **Alternatives Considered**:
  1. 既存 `GET /api/admin/genres` のレスポンスに全ジャンル分のクイズ件数を含める — 毎回全件集計となりコスト増、不採用
  2. `GET /api/admin/genres/:id/usage` を新設し、削除フロー開始時のみ呼び出す — 採用
- **Selected Approach**: 新規エンドポイントで対象ジャンル1件分の `count(*) FROM quizzes WHERE canonical_genre_id = :id` のみ実行する。
- **Rationale**: 既存の一覧表示のパフォーマンスに影響を与えず、削除操作という低頻度の操作にのみコストを限定できる。
- **Trade-offs**: なし（追加エンドポイント1本のみ）。
- **Follow-up**: なし。

## Risks & Mitigations
- 大量のクイズを保有するジャンルを削除した場合、一括UPDATEの実行時間が長くなる可能性 — `canonical_genre_id` には既存の複合インデックスがあり、`WHERE canonical_genre_id = :id` は既存インデックスを利用できるため、通常運用のデータ量では許容範囲と判断。
- 削除確定後にブラウザリロード等でジャンル一覧が古いまま残るリスク — 削除成功時にクライアント側で一覧を再取得することで対応。

## References
- `supabase/migrations/20260702000000_init.sql` — `metadata_genres`, `quizzes`, `user_genre_follows` テーブル定義
- `supabase/migrations/20260705000000_governance_normalization.sql` — `handle_vote_merge_request` 関数（再割当てロジックの参考実装）
