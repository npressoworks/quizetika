# Implementation Tasks - supabase-governance

- [x] 1. 基礎: ガバナンス系スキーマとRPCのマイグレーション
- [x] 1.1 既存プレースホルダーテーブルのALTERと新規テーブル作成、RLSポリシー是正
  - `flags` に `(quiz_id, reporter_id)` の複合ユニーク制約を追加する
  - `metadata_genres` に `metadata_tags` と非対称だった `updated_at` 列を追加する
  - `merge_requests`／`genre_requests` の `details JSONB` を削除し、`target_type`／`source_id`／`target_id`／`requester_id`／集計列（`votes_for_count` 等）へ明示列化する。`merge_requests` には `(source_id, target_id) WHERE status='pending'` の部分ユニークインデックスを新設する
  - `merge_request_votes`／`genre_request_votes`（`(request_id, voter_id)` 複合主キー）、`stripe_processed_events`、`reputation_limits` の各テーブルを新規作成し、RLSを有効化する
  - 既存の `merge_requests_write`／`genre_requests_write` ポリシー（モデレータ以上のみ書き込み可、業務規則と不整合）を削除し、直接書き込みを禁止する
  - マイグレーションをローカル Supabase に適用し、全ALTER・新規テーブルがエラーなく反映されることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 5.1, 6.1, 6.2, 6.3_

- [x] 1.2 共有認可・重みヘルパーとコンテンツ通報RPCの定義
  - `role='admin' OR moderation_tier='admin'` を判定する `is_admin()`、`senior_moderator` 以上または管理者を判定する `is_moderator_or_admin()`、モデレーションティアから投票重みを解決する `resolve_vote_weight()` を定義する
  - `handle_flag_content`（同一報告者の重複通報を `ON CONFLICT DO NOTHING` で冪等に無視し、新規通報時のみ `flags_count` を加算、閾値5件到達で `status='suspended'`）を定義する
  - `handle_resolve_flag`（`is_moderator_or_admin()` 検証、`restore` で公開復帰・通報数リセット、`delete` で作成者への通知作成後にクイズを削除）を定義する
  - 成果物確認: 各RPCがマイグレーション適用後にエラーなくデータベースへロードされること
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - _Depends: 1.1_

- [x] 1.3 マージ・ジャンル新設投票RPCの定義(可決時のクイズ一括書き換えを同期実行)
  - `handle_create_merge_request`（target側の `canonical_id` チェーンを辿る循環マージ検知、起案者の自動賛成票登録）を定義する
  - `handle_vote_merge_request`（複合主キーによる重複投票の原子的拒否、賛成/反対集計、重み付き賛成が閾値5・賛成率70%以上で可決した時点で `quiz_tags` の一括置換または `quizzes.genre`／`canonical_genre_id` の一括UPDATEを同一トランザクション内で同期実行）を定義する
  - `handle_submit_genre_request`／`handle_vote_genre_request`（重み付き賛成が閾値5・賛成率80%以上で可決した時点で `metadata_genres` へ新規登録するまで同期実行）を定義する
  - 成果物確認: 各RPCがマイグレーション適用後にエラーなくデータベースへロードされ、`migrationStatus` のような非同期ライフサイクル列が不要であることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3_
  - _Depends: 1.1, 1.2_

- [x] 1.4 BAN・UNBAN・レピュテーションリセットRPCの定義
  - `handle_ban_user`（`is_admin()` 検証、理由10文字未満は拒否、`users.is_banned` 更新と `admin_logs` への `auth.uid()` を実行者とした監査ログ記録）を定義する
  - `handle_unban_user`（`is_admin()` 検証、BAN解除と監査ログ記録）を定義する
  - `handle_reset_user_reputation`（`is_admin()` 検証、`reputation_score`/`moderation_tier` の初期化と監査ログ記録）を定義する
  - 成果物確認: 権限のない呼び出しが `permission-denied` で拒否され、各RPCがマイグレーション適用後にエラーなくデータベースへロードされること
  - _Requirements: 1.1, 1.2, 3.2_
  - _Depends: 1.1, 1.2_

- [x] 2. コア: ガバナンスサービス層の正規化対応
- [x] 2.1 (P) コンテンツ通報・審査サービスの正規化対応
  - `moderation.ts` の `flagContent`／`resolveFlag` を `handle_flag_content`／`handle_resolve_flag` RPC呼び出しに書き換える
  - 単体テストを実行し、重複通報の冪等な無視、閾値到達時の自動保留、権限不足時のエラー拒否が期待どおりに動作することを確認する
  - _Requirements: 5.1, 5.2, 5.3, 5.4_
  - _Boundary: ModerationService_
  - _Depends: 1.2_

- [x] 2.2 (P) タグ・ジャンル統合およびジャンル新設投票サービスの正規化対応
  - `tagMerge.ts` の `createMergeRequest`／`voteMergeRequest`／`submitGenreRequest`／`voteGenreRequest` を対応するRPC呼び出しに書き換える
  - 呼び出し元が存在しない旧 `runMigration`（非同期バックグラウンドジョブ）および重複実装の `seedInitialGenres`（ブラウザクライアント版）を削除する
  - 単体テストを実行し、循環マージ拒否・重複投票拒否・可決閾値判定（マージ70%/ジャンル新設80%）が既存テストの期待値どおりに動作し、可決直後にクイズ側の書き換えが完了していることを確認する
  - _Requirements: 2.1, 2.2, 2.3, 6.1, 6.2, 6.3_
  - _Boundary: TagMergeService_
  - _Depends: 1.3_

- [x] 2.3 (P) レピュテーション・BAN管理サービスの正規化対応
  - `reputation.ts` の `banUser`／`unbanUser`／`resetUserReputation` を対応するRPC呼び出しに書き換え、`getReputationScore`／`checkModeratorEligibility`／`getReputationLimit` を `users`／`reputation_limits` への直接クエリに書き換える
  - `resolveModerationTier`（純関数）は変更せず既存の判定規則を維持する
  - 単体テストを実行し、管理者判定が `role='admin'` のみ／`moderation_tier='admin'` のみ／両方いずれの場合も許可され、非管理者は拒否されることを確認する
  - _Requirements: 1.1, 1.2, 3.1, 3.2_
  - _Boundary: ReputationService_
  - _Depends: 1.4_

- [x] 2.4 (P) エンタイトルメント・サブスクリプション・Stripe Webhookサービスの正規化対応
  - `entitlement.ts`（`resolveUserEntitlements`／`applySubscriptionFromStripe`／`clearPaidEntitlements`）と `subscription.ts`（`getOrCreateStripeCustomer`／`createCheckoutSession`／`createPortalSession`）を Firebase Admin から Supabase Admin クライアント（サービスロール）に書き換える
  - `stripe-webhook.ts` の `isStripeEventProcessed`／`markStripeEventProcessed` を新設 `stripe_processed_events` テーブル参照に書き換える
  - `billing/checkout-session`／`billing/portal-session` API ルート内のBANステータス・メールアドレス確認箇所を Supabase クライアントへ書き換える
  - `entitlement-shared.ts`（純関数）は変更せず維持する
  - 単体テストを実行し、Webhookイベントの冪等性判定・サブスクリプション同期・Checkout/Portal Session発行が既存テストの期待値どおりに動作することを確認する
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: EntitlementService, SubscriptionService, StripeWebhookService_
  - _Depends: 1.1_

- [x] 2.5 (P) 初期ジャンルシードおよびジャンル直接管理の正規化対応
  - `seedInitialGenresAdmin.ts` の `seedInitialGenresWithAdmin` を Supabase Admin クライアントによる冪等な upsert に書き換える
  - `admin/seed-genres` ルートの管理者権限チェックを Firestore ベースから統一済みの Supabase `is_admin()` 判定へ切り替える
  - `admin/genres` ルートの GET/POST を Supabase の `metadata_genres` 読み書きに書き換え、管理者権限チェックを `is_admin()` 判定へ切り替え、アイコン一時ファイルの本パス移行処理を既存の `moveTemporaryGenreIcon()` 呼び出しへ置き換える
  - 単体テストを実行し、初期ジャンルの冪等投入（既存ID更新・未存在ID新規作成）とジャンル直接登録の重複ID拒否が期待どおりに動作することを確認する
  - _Requirements: 7.1_
  - _Boundary: SeedGenresService, GenreAdminRoutes_
  - _Depends: 1.2_

- [x] 3. 統合と検証
- [x] 3.1 サービス層移行の全体結合と型チェックのパス
  - すべてのガバナンスサービス・APIルートがSupabaseベースへ切り替わった状態で `npm run build` を実行する
  - TypeScript コンパイラが一切の型エラーを報告せず、Next.js プロジェクトのビルドが100%成功することを確認する
  - _Requirements: 1.1, 2.1, 3.1, 4.1, 5.1, 6.1, 7.1_
  - _Depends: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.2 テストスイート全体の確認とマイグレーション整合性検証
  - Jest テストスイート全体を実行し、全テストがパスすることを確認する
  - ローカル Supabase 環境で、マージ提案・ジャンル新設申請の可決時にクイズ側の書き換え（`quiz_tags`／`quizzes.genre`）が非同期ジョブなしで同一トランザクション内に完結していることを確認する
  - `is_admin()` が `role='admin'` のみ／`moderation_tier='admin'` のみ／両方／どちらもなし の4パターンで正しく判定することを確認する
  - BANユーザーからのAPIリクエスト・ログインアクセスが既存の `is_not_banned()` ベースの多重防御により引き続き拒否されることを確認する
  - _Requirements: 1.3, 3.1_
  - _Depends: 3.1_

- [x] 4. 残存する直接 Firestore 依存の排除およびAI作問利用制限機能の移行
- [x] 4.1 (P) モデレーション・ガバナンスUIの残存 Firestore 依存を解消する
  - `src/app/admin/moderation/page.tsx`、`src/app/community/genres/page.tsx`、`src/app/community/merge/page.tsx` の Firestore クライアントSDK直接呼び出し（`onSnapshot` リアルタイム購読を含む）を、Supabase クライアント経由のデータ取得・更新に書き換える。`onSnapshot` の即時反映要件は Supabase Realtime 購読またはポーリングのいずれかで満たす
  - `src/lib/seed-genres-access.ts` の Firestore `getDoc` による管理者権限チェックを、既存の `is_admin()` 判定（Supabase RPC/クエリ）に統一する
  - 成果物確認: 対象4ファイルが firebase パッケージおよび `@/lib/firebase/*` を import しなくなり、モデレーション一覧・マージ申請・ジャンル新設申請の画面が既存の期待値どおりに動作すること
  - _Requirements: 8.1, 8.2_
  - _Boundary: admin/moderation page.tsx, community/genres page.tsx, community/merge page.tsx, seed-genres-access.ts_

- [x] 4.2 (P) ジャンルアイコン生成APIの残存 Firestore 依存を解消する
  - `src/app/api/genres/generate-icon/route.ts` の `getAdminFirestore` による日次生成回数カウンタを Supabase のテーブルに書き換える
  - 成果物確認: `src/app/api/genres/generate-icon/route.ts` が firebase-admin パッケージおよび `@/lib/firebase/admin` を import しなくなり、日次上限判定が既存の期待値どおりに動作すること
  - _Requirements: 8.1_
  - _Boundary: genres/generate-icon route_

- [x] 4.3 (P) AI作問日次利用制限機能をSupabaseへ移行する
  - `src/services/ai-authoring-route-helpers.ts` の `users/{uid}/dailyAiAuthoringCounts` サブコレクション参照を、Supabase の新設テーブル（ユーザーごとの日次カウンタ）への読み書きに書き換える。既存の `resolveUserEntitlements`（`entitlement.ts`）呼び出しはそのまま維持する
  - `src/app/api/quiz/ai-chat-authoring/route.ts`、`src/app/api/quiz/ai-generate-questions/route.ts`、`src/app/api/quiz/ai-generate-thumbnail/route.ts` の `getAdminFirestore` によるカウンタ更新を、書き換え後の Supabase ベースの関数呼び出しに置き換える
  - 成果物確認: 対象4ファイルが firebase-admin パッケージおよび `@/lib/firebase/admin` を import しなくなり、日次利用制限（チャット・問題生成・サムネイル生成それぞれ）が既存の期待値どおりに動作すること
  - _Requirements: 8.3_
  - _Boundary: ai-authoring-route-helpers.ts, ai-chat-authoring route, ai-generate-questions route, ai-generate-thumbnail route_

- [x] 4.4 リグレッション確認
  - Jest テストスイート全体および関連 E2E テストを実行する
  - `supabase-cleanup` の MigrationCompletionGate（`npm run verify:firebase-removed`）を再実行し、本タスクで対応した全ファイルが残存 Firebase 参照として検出されなくなったことを確認する
  - 成果物確認: 全テストがパスし、ゲートの再実行結果から対象ファイルが消えていること
  - _Requirements: 8.1, 8.2, 8.3_
  - _Depends: 4.1, 4.2, 4.3_

- [ ] 5. NGワードマスタ管理機能の追加（Phase 39）
- [x] 5.1 NGワードマスタのスキーマとCRUD RPCのマイグレーション
  - `ng_words` テーブル（`word`／`normalized_word`／`is_active`／`created_at`／`updated_at`）を新規作成し、`normalized_word`（`lower(trim(word))`）への一意インデックスで大文字・小文字を区別しない重複登録をDB制約レベルで防止する
  - RLSを有効化し、SELECTは全員に許可、書き込みはRPC限定とするポリシーを定義する
  - `handle_create_ng_word`（`is_admin()` 検証、空文字拒否、`normalized_word` の一意制約違反時は例外）、`handle_update_ng_word`（表記編集）、`handle_set_ng_word_active`（有効/無効切替）の3RPCを定義する
  - 成果物確認: マイグレーションをローカル Supabase に適用し、テーブル・インデックス・3RPCがエラーなくデータベースへロードされること
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.8_

- [x] 5.2 NGワードマスタ読み書きサービスの実装
  - `ngWords.ts` に `listNgWords`（RLS経由のSELECT）、`createNgWord`、`updateNgWord`、`setNgWordActive`（いずれも対応RPC呼び出し）を実装する
  - `createNgWord`／`updateNgWord` はサービス層でも空文字・空白のみの入力を事前検証し、RPC呼び出し前に早期リターンする
  - 重複エラー（`23505` unique_violation）を「この語句はすでに登録されています」というドメインエラーへ変換する
  - 単体テストを実行し、正常系（登録・編集・有効/無効切替・一覧取得）と異常系（重複語句、空文字、権限不足）が期待どおりに動作することを確認する
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  - _Boundary: NgWordsService_
  - _Depends: 5.1_

- [x] 5.3 NGワード管理APIルートの実装
  - `/api/admin/ng-words` に GET（一覧取得）と POST（新規登録）を実装し、`ngWords.ts` の `listNgWords`／`createNgWord` を呼び出す
  - `/api/admin/ng-words/[id]` に PATCH（表記編集・有効/無効切替）を実装し、`ngWords.ts` の `updateNgWord`／`setNgWordActive` を呼び出す
  - 重複エラーを `409`、空文字エラーを `400`、対象ID不在を `404` として返却するエラーハンドリングを実装する
  - 成果物確認: 管理者トークンでの POST/GET/PATCH がそれぞれ期待どおりのレスポンスを返し、非管理者トークンでは `403` が返ること
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  - _Boundary: NgWordsAdminRoutes_
  - _Depends: 5.2_

- [x] 5.4 統合検証
  - `npm run build` を実行し、型エラーが発生しないことを確認する
  - Jest テストスイート全体を実行し、既存テストを含めて全てパスすることを確認する
  - 大文字・小文字表記のみが異なる語句（例: `Spam` と `spam`）を連続登録した場合に2件目が重複として拒否されることを手動確認する
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8_
  - _Depends: 5.3_

- [x] 5.5 バグ修正: ngWords.ts のSupabaseクライアントをサーバー用に是正
  - `ngWords.ts` が `../lib/supabase/client`（ブラウザ用、セッションなしの匿名クライアント）をモジュールトップレベルで生成しているため、サーバーサイドAPI Route（`/api/admin/ng-words`, `/api/admin/ng-words/[id]`）から呼び出すと `auth.uid()` が常に `NULL` になり、`handle_create_ng_word`／`handle_update_ng_word`／`handle_set_ng_word_active` 内の `is_admin()` 判定が常に失敗して `permission-denied` になる不具合を修正する
  - `../lib/supabase/server` の Cookie 連携 `createClient()`（非同期関数）に差し替え、各関数内で `await createClient()` を呼ぶ形に変更する（モジュールトップレベルでのインスタンス化を廃止する）
  - 成果物確認: 実際にログイン済み管理者セッションのCookieを持つリクエストで `/api/admin/ng-words` へのPOSTがRPC呼び出しレベルで成功し、`permission-denied` が発生しないことを確認する（Jestのモックテストだけでなく、ローカルSupabase + 開発サーバーを用いた実リクエストでの検証を含める）
  - 単体テストを実行し、`tests/services/ngWords.test.ts` のモックをサーバークライアント（`../lib/supabase/server`）に合わせて更新した上で全てパスすることを確認する
  - _Requirements: 9.1, 9.2, 9.4, 9.5, 9.6, 9.8_
  - _Boundary: NgWordsService_
  - _Depends: 5.2_

## Implementation Notes (Phase 39)

- 管理者権限チェックは `is_admin()` RPC（DB層）に加え、`/api/admin/*` の慣例に倣い Route 層でも `authorizeAdmin()` による401/403判定を明示的に実装（`listNgWords` 自体はRLS SELECT公開のため権限ゲートを持たないため）。
- エラー種別のHTTPステータス変換は既存の `admin/users/ban` 等と同様、サービス層が投げるエラーメッセージの部分文字列一致で判定するパターンを踏襲（`ngWords.ts` のエラーメッセージ文言と `route.ts` のマッピングが暗黙的に結合している点に注意）。
- **【重大・要フォローアップ】タスク5.5で判明**: `ngWords.ts` はサービス層でSupabaseクライアントをモジュールトップレベルで生成する際、ブラウザ用の匿名クライアント（`../lib/supabase/client`）を使っていたため、サーバーサイドAPI Routeから呼び出すと `auth.uid()` が常に `NULL` になり `is_admin()` 判定が常に失敗する不具合があった（実際に管理者としてログインしていても操作が全て権限エラーになる）。この不具合は `quizeum-moderation-governance-ui` タスク14.5のPlaywright E2Eテストで実際に検出された。同じパターン（モジュールトップレベルでブラウザ用クライアントを生成し、`auth.uid()` に依存するRPCを呼ぶ）を `src/services/reputation.ts` の `banUser`／`unbanUser`／`resetUserReputation` も持っており、これらの唯一の呼び出し元がサーバーサイドAPI Route（`/api/admin/users/ban`／`unban`／`reset`）であるため、**管理者のBAN/UNBAN/レピュテーションリセット機能が本番で同様に機能していない可能性が高い**。別途バグ修正タスクとして起票し検証・修正すべき（`moderation.ts`／`tagMerge.ts` は呼び出し元が全てクライアントコンポーネントのため同種の実害はないことを確認済み）。

## 6. バグ修正: reputation.ts のSupabaseクライアントをサーバー用に是正（既存機能の潜在バグ）

<!-- タスク5.5でngWords.tsに発見・修正した不具合と同一パターン。reputation.ts はタスク2.3（既存・完了済み）で実装されたが、当時のレビューではモックテストとビルド成功のみで検証しており、実際のサーバーコンテキストでのauth.uid()解決を見落としていた。Phase 39のNGワード機能実装中にPlaywright E2Eテストの手法が確立されたことで、既存機能の潜在バグとして本タスクを追加する。 -->

- [x] 6.1 reputation.ts のSupabaseクライアントをサーバー用に是正
  - `reputation.ts` が `../lib/supabase/client`（ブラウザ用、セッションなしの匿名クライアント）をモジュールトップレベルで生成しているため、サーバーサイドAPI Route（`/api/admin/users/ban`, `/api/admin/users/unban`, `/api/admin/users/reset`）から呼び出すと `auth.uid()` が常に `NULL` になり、`handle_ban_user`／`handle_unban_user`／`handle_reset_user_reputation` 内の `is_admin()` 判定が常に失敗して `permission-denied` になる不具合を修正する
  - `../lib/supabase/server` の Cookie 連携 `createClient()`（非同期関数）に差し替え、`banUser`／`unbanUser`／`resetUserReputation`／`getReputationScore`／`checkModeratorEligibility`／`getReputationLimit` の各関数内で `await createClient()` を呼ぶ形に変更する（モジュールトップレベルでのインスタンス化を廃止する）
  - 成果物確認: 実際にログイン済み管理者セッションのCookieを持つリクエストで `/api/admin/users/ban`（および unban／reset）へのPOSTがRPC呼び出しレベルで成功し、`permission-denied` が発生しないことを確認する（ローカルSupabase + 開発サーバーを用いた実リクエスト、または既存のE2Eテストがあれば実行しての検証を含める）
  - 単体テストを実行し、既存テストのモックをサーバークライアント（`../lib/supabase/server`）に合わせて更新した上で全てパスすることを確認する
  - _Requirements: 1.1, 1.2, 3.1, 3.2_
  - _Boundary: ReputationService_

- [ ] 6.2 リグレッション確認
  - `npm run build` を実行し、型エラーが発生しないことを確認する
  - Jest テストスイート全体を実行し、既存テストを含めて全てパスすることを確認する
  - `admin/users` 画面（BAN/UNBAN/レピュテーションリセットUI）が存在すれば、実際の管理者操作フローを手動またはE2Eで確認する
  - _Requirements: 1.1, 1.2, 1.3, 3.1, 3.2_
  - _Depends: 6.1_
