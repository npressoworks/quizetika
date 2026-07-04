# Research & Design Decisions - supabase-core-data

## Summary
- **Feature**: supabase-core-data
- **Discovery Scope**: Complex Integration (Firestore-shaped schema → fully RDB-optimized normalization, on top of an already-migrated but document-model-mimicking Supabase schema)
- **Key Findings**:
  - Firestore での `runTransaction` による複数ドキュメントのアトミック更新は、Supabase (PostgreSQL) 側でのストアドファンクション (RPC) への移行が最適。
  - Firestore の `increment` や配列操作 (`arrayUnion`, `arrayRemove`) は、PostgreSQL の `col = col + 1` や JSONB 関数/配列操作、および RPC 呼び出しで完全に再現可能。
  - キーセットページネーション (keyset pagination) は、PostgreSQL のインデックスを利用して `order_by` と `gt` フィルタの組み合わせにより高性能に動作可能。
  - 初回移行済みスキーマ（`20260702000000_init.sql` 等）を再監査した結果、`follows`/`bookmarks` の文字列連結主キー、`quizzes.questions` JSONB 複製、`question_ids`/`tags`/`canonical_tag_ids` 配列、`users.badges`/`followed_genres` など、Firestore のドキュメント/コレクション構造をそのまま転写した非正規化パターンが多数残存していることが判明した。
  - `link_kind='reference'` の問題共有機能は本質的に「クイズと問題の多対多関係」だが、現行スキーマは `questions.quiz_id`（単一の親）と `question_ids` 配列（`contains()` 全表スキャン、GIN 未定義）という 2 つの不整合な手段で表現されており、正規化された中間テーブル (`quiz_questions`) でのみ正しく表現できる。
  - 問題並び替え (`updateQuestionOrder`, 要件 2.3) は初回移行では実装されておらず（`tasks.md` に記載のみでコード実体なし）、今回の正規化と合わせて新規 RPC (`handle_reorder_questions`) として実装する。

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
| JSONB/配列を維持したまま部分改修 | `users.badges` 等の JSONB/配列列はそのまま残し、RPC のロジックのみ改善する | 変更範囲が小さい | Firestore 由来の非正規化構造・ロストアップデートリスク・GIN 依存の検索が根本的に解消されない | 不採用。ユーザー要求（RDB への完全最適化）を満たさない |
| 中間テーブルによる完全正規化 | `user_badges`, `user_genre_follows`, `quiz_tags`, `quiz_questions` を新設し、複合主キー・外部キーで関係を表現する | 参照整合性・インデックス効率・同時更新安全性が向上し、RDB のメリットを最大化する | マイグレーション（バックフィル・カットオーバー・列削除の複数フェーズ）が必要、サービス層のクエリ実装の書き換えが必要 | 採用 |

## Design Decisions

### Decision: フォロー及びバッジ獲得トランザクションの RPC 移行
- **Context**: Firestore で `runTransaction` を用いて、フォロー関係の追加とフォロワー数のカウント変更をアトミックに同期していた。
- **Alternatives Considered**:
  1. クライアント側で逐次更新する
  2. Supabase の RPC 関数 (`handle_follow_user`) に処理を寄せる
- **Selected Approach**: オプション 2 を採用。
- **Rationale**: フォロー操作時の「フォロー数とフォロワー数の一貫性」はビジネスルール上極めて重要であり、不整合を防ぐためには DB 側でのトランザクション処理が必須。
- **Trade-offs**: SQL の管理コストが上がるが、データ完全性の保証には代えられない。

### Decision: follows / bookmarks の主キーを文字列連結から複合主キーへ変更
- **Context**: 初回移行で `id = follower_id || '_' || following_id` という Firestore ドキュメント ID 風の TEXT 主キーが採用されていた。`bookmarks.id` は `target_type` を含まず、異なるテーブル由来の UUID が衝突した場合に理論上の脆弱性がある。
- **Alternatives Considered**:
  1. 現状の文字列連結 ID を維持する
  2. サロゲート UUID 主キー + UNIQUE 制約を追加する
  3. 複合主キー（`(follower_id, following_id)` / `(user_id, target_id, target_type)`）に置き換える
- **Selected Approach**: オプション 3 を採用。
- **Rationale**: この 2 テーブルは関係そのものが主キーであり、代理キーを持つ意味がない。複合主キーは PostgreSQL のネイティブな一意制約機構であり、`ON CONFLICT` 句と直接組み合わせられる。
- **Trade-offs**: `id` 列に依存するコードが存在すれば破壊的変更になるが、調査の結果コードベース内に `Follow.id` / `Bookmark.id` の参照は存在しないため実質的な移行コストは低い。

### Decision: users.badges / followed_genres、quizzes.tags 系列を中間テーブルへ正規化
- **Context**: いずれも Firestore の配列/マップフィールドをそのまま TEXT[] / JSONB に転写したものであり、`followGenre`/`unfollowGenre` は配列全体を読み込んで書き戻す read-modify-write のため同時実行時にロストアップデートが発生し得る。タグ検索も GIN インデックスの `contains()` に依存し `metadata_tags` との参照整合性を保証できない。
- **Alternatives Considered**:
  1. 現状の配列/JSONB 列を維持する
  2. 中間テーブル（`user_badges`, `user_genre_follows`, `quiz_tags`）へ正規化する
- **Selected Approach**: オプション 2 を採用。
- **Rationale**: 中間テーブル化により、追加/削除が単一行の INSERT/DELETE になり同時実行安全性が向上する。また `metadata_genres` / `metadata_tags` への外部キー制約により参照整合性が保証される。
- **Trade-offs**: `User.badges` / `User.followedGenres` / `Quiz.tags` 等の既存 TypeScript 型・関数シグネチャは維持し、`mapRowTo*` 側で JOIN 結果を再構成することで外部契約への影響を回避する。

### Decision: quizzes.questions / question_ids を quiz_questions 中間テーブルへ正規化
- **Context**: `link_kind='reference'` の問題は複数クイズから共有され得る本質的に多対多の関係だが、現行スキーマは `questions.quiz_id`（単一の親 FK）と `quizzes.question_ids`（配列、GIN 未定義で全表スキャン）という 2 つの不整合な手段で表現しており、`quizzes.questions` JSONB がさらに内容を複製している。
- **Alternatives Considered**:
  1. 現状維持し `question_ids` に GIN インデックスのみ追加する
  2. `quiz_questions(quiz_id, question_id, display_order)` 中間テーブルへ正規化し、`questions.quiz_id` は所有クイズ参照 (`owner_quiz_id`) として意味を分離する
- **Selected Approach**: オプション 2 を採用。
- **Rationale**: 多対多関係と表示順序を単一の正規化構造で表現でき、「問題並び替え」(2.3) をトランザクション安全な RPC (`handle_reorder_questions`) として初めて実装できる。`questions` テーブルの内容複製 (`quizzes.questions` JSONB) も不要になり、不整合フォールバックのための実装（`question.ts` の `getQuestionsByQuiz`）を削減できる。
- **Trade-offs**: マイグレーション時のバックフィル（`question_ids` 配列 → `quiz_questions` 行への展開）が必要。`questions.quiz_id` の意味変更（`owner_quiz_id` への改称）は当スペック内の全参照箇所の追従が必要。

## Risks & Mitigations
- RLS ポリシーによる管理者権限の漏洩 — `SECURITY DEFINER` 関数の実行時には `search_path` の設定等に配慮し、意図しない権限昇格を防ぐ。
- マイグレーション中のデータ不整合 — Phase 1（追加のみ）→ Phase 2（バックフィル）→ Phase 3（カットオーバー）→ Phase 4（旧列削除）の段階的移行とし、各フェーズ間で件数検証を行う。
- `badges` マスタテーブルと `BADGE_DEFINITIONS`（TypeScript）の乖離 — シード整合性テストで両者の ID 集合の一致を検証する。
- `questions.quiz_id` → `owner_quiz_id` のリネームによる見落とし — `canDeleteQuestionDoc` を含む全参照箇所を Components and Interfaces にて明示し、実装フェーズでの grep 確認を必須とする。

## References
- [Supabase Store Procedure (RPC)](https://supabase.com/docs/guides/database/functions)
- [PostgreSQL PL/pgSQL](https://www.postgresql.org/docs/current/plpgsql.html)
