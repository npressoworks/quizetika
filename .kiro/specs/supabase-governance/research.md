# Research & Design Decisions - supabase-governance

## Summary
- **Feature**: `supabase-governance`
- **Discovery Scope**: Complex Integration（既存 Firebase 実装のドメイン移行 + 既存 Supabase プレースホルダースキーマの是正）
- **Key Findings**:
  - `supabase-foundation` が作成済みの `merge_requests`／`genre_requests` テーブルは `details JSONB` の汎用プレースホルダーであり、`tagMerge.ts` の実際の重み付き投票・循環参照防止ロジックと構造が一致しない。`quiz_reviews`（`supabase-gameplay`）と同様に、明示列 + 投票用中間テーブルへの是正が必要。
  - 既存 `merge_requests_write`／`genre_requests_write` の RLS は「モデレータ以上」「admin のみ」に書き込みを制限しているが、実際の業務規則は「BAN されていない任意の認証ユーザーが起案・投票できる（重みが tier で変わるだけ）」であり、現行 RLS は実装意図と矛盾している。
  - 管理者判定が2系統ある: `users.role = 'admin'`（`isAdminUser()` および複数の既存 RLS ポリシーが参照）と `users.moderation_tier = 'admin'`（`reputation.ts` の `banUser`/`unbanUser`/`resetUserReputation` のみが参照）。既存 `isAdminUser()`（`src/lib/middleware-auth-cookies.ts`）は両方を OR 判定するが、`reputation.ts` は `moderation_tier` のみを見ており、`role='admin'` のみを持つ運用者を誤って拒否し得る不整合が現行コードに存在する。
  - `tagMerge.ts` の `runMigration`（マージ可決後のクイズ一括書き換え）は、投票 RPC 相当のトランザクション確定後に `setTimeout(..., 0)` でバックグラウンド実行をキックする Firestore 時代のワークアラウンドだが、Next.js のサーバーレス実行環境ではレスポンス送信後に関数が凍結・終了し得るため、本番で移行処理が実行されない潜在バグを抱えている。
  - PostgreSQL では `quizzes.genre`／`canonical_genre_id`（スカラー列）と `quiz_tags`（正規化済み中間テーブル、`supabase-core-data` 所有）のいずれも集合操作の `UPDATE`/`INSERT ... SELECT` で同期的に一括更新可能なため、Firestore 時代の「100件チャンク + 非同期バックグラウンドジョブ」パターンは不要になり、可決 RPC 内で同期完結できる。
  - `flags` テーブル（`supabase-foundation` 作成済み）に一意制約がなく、現行 Firestore 実装（`${quizId}_${reporterId}` を疑似的な決定的IDとして使うが、`transaction.set` は同一ドキュメントを毎回上書きしつつ `flagsCount` を無条件にインクリメントする）は同一報告者による再通報のたびにカウントを二重計上するバグを抱えている。
  - `/api/admin/genres` の既存アイコン移行ロジック（`genres/temp/` → `genres/{id}/`）は `supabase-storage-migration` が既に `moveTemporaryGenreIcon()`（`src/services/storage-admin.ts`）として実装済みであり、本スペックはこれを呼び出すだけでよい（再実装不要）。
  - `reputation.ts` の `getReputationLimit`（`users/{uid}/reputationLimits/{senderId}` サブコレクション読み取り）は、リポジトリ全体を検索しても呼び出し元が存在しない未使用コードだが、`reputation.ts` の公開APIとして境界内に含まれるため、読み取り専用の正規化テーブルとして移行対象に含める。
  - `tagMerge.ts` の `seedInitialGenres`（ブラウザクライアント版）は呼び出し元が存在しない重複コードであり、実際に使用されるのは `seedInitialGenresAdmin.ts` の `seedInitialGenresWithAdmin`（Admin SDK版、`/api/admin/seed-genres` から呼ばれる）のみ。移行時に重複を解消する。
  - Stripe Webhook の冪等性チェック用 `stripe_processed_events` Firestore コレクションに対応する PostgreSQL テーブルが未作成。
  - （Phase 39）NGワードは `src/services/quiz-validation.ts` にハードコードされた文字列配列（`NG_WORD_LIST`）として実装されており、既存のガバナンス系テーブルには対応するマスタが存在しない。DB化により、既存の `merge_requests`/`genre_requests` と同様の「明示列 + `SECURITY DEFINER` RPC」パターンをそのまま適用できる新規テーブルとして追加する。

## Research Log

### 既存 Supabase スキーマの governance ドメイン充足度調査
- **Context**: `supabase-foundation`（実装完了）が全テーブル DDL を一括作成済みのため、governance ドメインに必要なテーブルがどこまで実装済みかを `supabase/migrations/20260702000000_init.sql` で確認した。
- **Sources Consulted**: `supabase/migrations/20260702000000_init.sql`、`20260703000000_core_data_normalization.sql`、`20260703000200_gameplay_normalization.sql`
- **Findings**:
  - `users` テーブルに `reputation_score`／`moderation_tier`（enum に `admin` を含む）／`role`（TEXT）／`reputation_history`（JSONB）／`is_banned`／`banned_reason`／`banned_at`／`subscription_tier`／`stripe_customer_id`／`stripe_subscription_id`／`subscription_status`／`current_period_end`／`is_premium` が全て列として存在済み（`supabase-core-data` が汎用マッピングのみ実装、書き込みロジックは対象外として本スペックに委譲）。
  - `admin_logs`（`target_uid`／`executor_id`／`action` enum／`reason`）は要件を満たす形で作成済み。RLS は `FOR ALL USING (FALSE)` でクライアント書き込みを全遮断済み（SECURITY DEFINER RPC 経由の書き込みを前提とした設計になっている）。
  - `flags`（`quiz_id`／`reporter_id`／`reason`）は存在するが一意制約なし。
  - `merge_requests`／`genre_requests` は `status`／`created_by`／`details JSONB` の汎用プレースホルダー。
  - `metadata_genres`／`metadata_tags` は `supabase-core-data` が読み取り専用外部キー参照先として作成済み（書き込みは governance が担当、との明記が `supabase-core-data/design.md` に存在）。
  - `stripe_processed_events`／`reputation_limits`（`users/{uid}/reputationLimits/{senderId}` 相当）は未作成。
- **Implications**: マージ・ジャンル申請系は `quiz_reviews`（gameplay）と同様の「プレースホルダー是正」パターンが必要。admin_logs・flags は概ね流用可能（flags のみ一意制約追加が必要）。新規テーブルは 2 つ（`stripe_processed_events`、`reputation_limits`）で済む。

### マージ可決時のクイズ一括書き換え方式
- **Context**: `tagMerge.ts` の `runMigration` は Firestore の書き込みスループット制約（バッチ上限500、クエリ結果のページング必要）に対応するため、100件チャンクの `while` ループ + `writeBatch` + `setTimeout` 非同期キックという複雑な構成を取っている。RDB移行後にこの複雑性を維持すべきか検証した。
- **Sources Consulted**: `supabase/migrations/20260703000000_core_data_normalization.sql`（`quiz_tags`／`quiz_questions` 正規化構造）、`supabase/migrations/20260702000000_init.sql`（`quizzes.genre`／`canonical_genre_id` 列定義）
- **Findings**:
  - ジャンルは `quizzes.genre`／`canonical_genre_id` という単一スカラー列であるため、`UPDATE quizzes SET genre = target, canonical_genre_id = target WHERE canonical_genre_id = source` の1文で一括置換が完結する。
  - タグは `quiz_tags(quiz_id, tag_id, original_label)` 中間テーブルであるため、`INSERT ... SELECT ... ON CONFLICT DO NOTHING`（target 側の重複を無視）+ `DELETE FROM quiz_tags WHERE tag_id = source` の2文で完結する。
  - PostgreSQL の集合演算 `UPDATE`/`INSERT SELECT` は数万行規模でも単一トランザクション内でミリ秒〜秒オーダーで完結し、Firestore のような1回の書き込みリクエストあたりのドキュメント数上限（バッチ500件）が存在しない。
- **Implications**: 可決 RPC 内でクイズ書き換えを同期的に実行できるため、`migrationStatus`（`processing`/`completed`/`failed`）というライフサイクル状態と、それを追跡する非同期ジョブ・`setTimeout` キック自体が不要になる。これにより「サーバーレス環境でバックグラウンド処理が実行されない」という Firestore 時代の潜在バグも同時に解消される。

### 管理者判定ロジックの統一
- **Context**: `resolveFlag`（`moderation.ts`）は `moderationTier === 'senior_moderator' || role === 'admin'` を見る一方、`banUser`/`unbanUser`/`resetUserReputation`（`reputation.ts`）は `moderationTier === 'admin'` のみを見ており、`role === 'admin'` を無視している。一方 `isAdminUser()`（`src/lib/middleware-auth-cookies.ts`）は `moderationTier === 'admin' || role === 'admin'` の OR 判定を採用しており、`/api/admin/genres`・`/api/admin/seed-genres` はこちらに準拠している。
- **Sources Consulted**: `src/lib/middleware-auth-cookies.ts`、`src/services/reputation.ts`、`src/services/moderation.ts`、`src/types/index.ts`（`User.role`／`User.moderationTier` のコメント: 「管理者は role または tier の 'admin'」）
- **Findings**: 型定義のコメント自体が「管理者は role または tier の 'admin'」という OR 判定を仕様として明記しており、`reputation.ts` の実装（`moderationTier` のみ判定）が既存の意図から外れた実装バグである。
- **Implications**: 移行後は `is_admin()` という単一の SQL ヘルパー関数（`role = 'admin' OR moderation_tier = 'admin'`）に統一し、`banUser`/`unbanUser`/`resetUserReputation`/`resolveFlag`/`seed-genres`/`genres` の全ての管理者チェックがこれを参照する。これにより既存の権限判定バグを移行と同時に解消する。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| サービス層ブラックボックス置換 + RPC（`supabase-core-data`/`supabase-gameplay` 踏襲） | 外部インターフェース（関数シグネチャ）を変えず、内部実装のみ Supabase RPC 呼び出しに差し替える | 呼び出し元（API Routes、テスト）への影響を最小化。既存2スペックとの実装idiom一貫性 | RPC 定義が肥大化しやすい（本ドメインは5系統） | 採用。ドメインごとに RPC ファイルセクションを分割して可読性を確保 |
| Edge Function / Webhook 専用サーバーレス関数への切り出し | Stripe Webhook 処理を独立した Supabase Edge Function に移行 | Next.js API Route から分離、Stripe側の推奨構成に近い | 既存の Next.js Route Handler 構成からの逸脱が大きく、本移行のスコープ（DB接続先のみ変更）を超える | 却下。ビジネスロジック変更を避ける方針（`requirements.md` Out of scope）に反する |
| マージ可決時の非同期ジョブ維持（Supabase Edge Function や pg_cron 等） | Firestore 時代の非同期バックグラウンド実行パターンをそのまま踏襲 | 大規模データセットでの実行時間分散 | 本ドメインのクイズ件数規模（数千〜数万件想定）では同期 `UPDATE`/`INSERT SELECT` で十分高速。追加インフラ（pg_cron等）の運用コストが不要な複雑性を持ち込む | 却下。RPC内同期実行を採用（Research Log 参照） |

## Design Decisions

### Decision: 管理者判定を `is_admin()` ヘルパーへ統一
- **Context**: `role='admin'` と `moderation_tier='admin'` の二重判定が既存コードで不整合（Research Log 参照）。
- **Alternatives Considered**:
  1. 各 RPC 内に判定ロジックをインラインで複製する — 既存コードと同じ不整合再発リスクを持つ。
  2. `role = 'admin'` のみに統一し `moderation_tier = 'admin'` を廃止する — `moderation_tier_enum` の `admin` 値を使う既存データがあれば互換性を壊す。
- **Selected Approach**: `is_admin()` という `SECURITY DEFINER` SQL 関数を新設し、`role = 'admin' OR moderation_tier = 'admin'` を判定する。全ての管理者操作 RPC（BAN/UNBAN/レピュテーションリセット/コンテンツ削除・復元/ジャンル直接登録/ジャンル初期投入）がこの関数を参照する。
- **Rationale**: `User` 型定義のコメントが元々 OR 判定を意図しており、`isAdminUser()`（TS側）と対称的な単一の正本を SQL 側にも設けることで、今後の判定ロジックの分岐を防ぐ。
- **Trade-offs**: 判定ロジックが1箇所に集約される代わり、`moderation_tier='admin'` という重複した意味論的フィールドが残置される（`role` への統一は将来の `supabase-cleanup` 等で再検討可能、本スペックのスコープ外）。
- **Follow-up**: 実装時に `is_admin()` の単体検証（`role`のみ設定 / `moderation_tier`のみ設定 / 両方 / どちらもなし の4パターン）を行う。

### Decision: マージ・ジャンル申請の可決処理を RPC 内で同期実行する
- **Context**: `runMigration`（`setTimeout` 非同期キック + 100件チャンクループ）はサーバーレス環境で実行漏れの懸念がある。
- **Alternatives Considered**:
  1. Firestore と同じ非同期パターンを維持（`setTimeout` を RPC 呼び出し後の Node.js 側に残す）。
  2. Supabase Realtime や pg_notify を使ったジョブキュー化。
- **Selected Approach**: 可決判定と同一の `SECURITY DEFINER` RPC トランザクション内で、`quizzes`／`quiz_tags` の一括書き換えを同期的な `UPDATE`/`INSERT SELECT`/`DELETE` として実行する。`migration_status` ライフサイクルは廃止し、可決 (`approved`) が確定した時点で書き換えも完了しているものとして扱う。
- **Rationale**: PostgreSQL の集合演算は非同期分割が不要な性能特性を持ち、Research Log で検証済み。同期化によりサーバーレス環境での実行漏れリスクを構造的に排除できる。
- **Trade-offs**: 可決処理のレイテンシがわずかに増加する（同期実行のため）が、対象クイズ件数の規模ではユーザー体感に影響しない範囲と判断。
- **Follow-up**: 実装時に対象クイズ件数が非常に多いテナントで RPC タイムアウトが発生しないか、ローカル Supabase でのベンチマークを推奨（該当時は将来的な分割検討の余地を残す）。

### Decision: `merge_requests`/`genre_requests` を明示列 + 投票用中間テーブルへ正規化
- **Context**: 既存プレースホルダー DDL（`details JSONB`）は `tagMerge.ts` の実際のフィールド（`sourceId`／`targetId`／`votesForCount`／`weightedVotesFor`／`votedUserIds`／`votes[]` 等）を表現できない。
- **Alternatives Considered**:
  1. `details JSONB` のまま Application 層でシリアライズ/デシリアライズする — 型安全性が失われ、`votedUserIds` の重複投票防止をアプリ側の read-then-write に頼ることになり Race Condition を再導入する。
  2. 明示列化 + `merge_request_votes`/`genre_request_votes` 中間テーブル（`quiz_reviews`/`difficulty_votes` と同型） — DB制約（複合PK）で重複投票を原子的に防止できる。
- **Selected Approach**: 案2を採用。`votedUserIds`/`votes` 配列を `(request_id, voter_id)` 複合主キーを持つ中間テーブルに正規化する。
- **Rationale**: `supabase-gameplay` の `quiz_reviews`/`difficulty_votes` 正規化と同じ設計哲学を踏襲し、一貫性を保つ。
- **Trade-offs**: テーブル数が増えるが、投票の原子性・型安全性が向上する。
- **Follow-up**: なし。

### Decision: NGワードマスタのCRUDを Admin Client 直接操作ではなく RPC 化する（Phase 39）
- **Context**: 既存の類似パターンとして、ジャンル直接登録（`/api/admin/genres`）は Supabase Admin クライアント（サービスロール、RLSバイパス）による直接書き込みを採用している。NGワードCRUDも同様に Admin Client 直接操作とするか、`handle_ban_user` 等と同様に RPC 化するか検討した。
- **Alternatives Considered**:
  1. Admin Client 直接操作（`metadata_genres` 直接書き込みと同型） — 重複検知（大文字小文字を区別しない）や空文字検証をアプリケーション層(TypeScript)で行う必要があり、検証ロジックが分散する。
  2. `SECURITY DEFINER` RPC 化（`handle_ban_user`/`handle_create_merge_request` と同型） — 権限検証・正規化・重複検知をDBトランザクション内に閉じ込められる。
- **Selected Approach**: 案2（RPC化）を採用。`handle_create_ng_word`／`handle_update_ng_word`／`handle_set_ng_word_active` の3RPCと、`normalized_word` への一意インデックスを組み合わせる。
- **Rationale**: 要件9.2（大文字小文字を区別しない重複拒否）はレースコンディション下でも原子的に保証する必要があり、DB制約（一意インデックス）と組み合わせたRPCが最も確実。ジャンル直接登録がAdmin Client直接操作なのは`metadata_genres`が`supabase-core-data`所有の既存テーブルで重複キー(id)のみをチェックすればよい単純さによるものであり、NGワードの「表記ゆれを含む重複防止」という要件には適合しない。
- **Trade-offs**: RPC定義が3つ増える一方、検証ロジックの一貫性と原子性が向上する。
- **Follow-up**: なし。

## Risks & Mitigations
- **RPC 関数数の増加による可読性低下** — ドメイン別（モデレーション/マージ/レピュテーション/エンタイトルメント）にマイグレーションファイル内でコメント区切りし、`design.md` でもドメインごとにセクション分割する。
- **`is_admin()` 統一による意図しない権限剥奪** — 既存データで `role` にも `moderation_tier` にも `'admin'` が入っていない管理者アカウントが存在する場合、移行直後にロックアウトされる可能性がある。実装時に本番相当データでの事前検証を推奨。
- **マージ可決の同期実行によるRPCタイムアウト** — 対象クイズ件数が極端に多い場合（想定外の大規模テナント）、RPC実行時間が伸びる可能性がある。初期実装では許容し、必要が生じた場合のみ将来的にチャンク分割を再検討する。
- **Stripe Webhook の `firebaseUid` 命名** — Supabase 移行後も Stripe 側のメタデータキー名は `firebaseUid` のまま維持する（Stripe Customer メタデータの変更は本スペックのスコープ外、`requirements.md` Out of scope に合致）。

## References
- `.kiro/specs/supabase-gameplay/design.md` — RPC設計・正規化パターンの参照実装
- `.kiro/specs/supabase-core-data/design.md` — `metadata_genres`/`metadata_tags` の所有境界の確認
- `supabase/migrations/20260702000000_init.sql` — 既存 governance 関連テーブルの現状
