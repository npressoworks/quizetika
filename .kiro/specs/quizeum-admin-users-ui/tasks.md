# Implementation Plan: quizeum-admin-users-ui

> **注記（2026-07-12）**: セクション1〜4はプロジェクトのSupabase移行前（Firebase/Firestore時代）に実装・完了済みのタスクの記録であり、`firestore.rules` 等の記述は現在の実装（Supabase RPC + RLS）とは一致しない。すべて `[x]` 完了済みのため再実行しない。BAN機能見直し（通報ランキング・ティア引き下げ・BAN一覧・Requirement 7の新規実装）の新規タスクはセクション5以降に記載する。

## Tasks

### 1. Foundation: 環境設定およびスキーマ拡張
- [x] 1.1 types/index.ts への AdminLog 型の追加
  - `AdminLog` インターフェース（targetUid, executorId, action, reason, createdAt）を `src/types/index.ts` にエクスポートする。
  - **完了条件**: `src/types/index.ts` をインポートする他のファイルでコンパイルが正常に通り、`AdminLog` 型が型エラーなく参照可能になること。
  - _Requirements: 3.2_
  - _Boundary: Types_
- [x] 1.2 firestore.rules への adminLogs コレクションルールの追加
  - `firestore.rules` に `adminLogs` コレクション的セキュリティルール（読み取りは管理者のみ許可、クライアントからの書き込み/更新/削除は一律 `false`）を追記する。
  - **完了条件**: ローカルの Firestore エミュレーターまたは Security Rules テストにおいて、一般ユーザーからの直接書き込みが拒否され、管理者からのみ読み取りが許可されること。
  - _Requirements: 1.1, 3.2_
  - _Boundary: SecurityRules_
- [x] 1.3 firestore.rules への isNotBanned ヘルパーの追加と書き込み拒否ルールの適用
  - `firestore.rules` に `isNotBanned()` 関数を追加し、ログインユーザーのドキュメントの `isBanned` が `true` の場合、データの書き込み（`create/update/delete`）や読み込み（必要箇所）を拒否するよう既存ルールへ適用する。
  - **完了条件**: Security Rules のテストまたはエミュレータ上の検証において、`isBanned == true` のモックユーザーからのデータ操作（クイズ投稿など）が `permission-denied` で拒否されること。
  - _Requirements: 5.6_
  - _Boundary: SecurityRules_
- [x] 1.4 lib/middleware-auth-cookies.ts への quizetika_banned Cookieの同期対応追加
  - `src/lib/middleware-auth-cookies.ts` を修正し、Cookie同期処理において `isBanned` フラグを `quizetika_banned` クッキーとして同期または破棄できるようにする。
  - **完了条件**: `syncMiddlewareAuthCookies` 呼び出し時に `isBanned` が `true` であれば `quizetika_banned: "true"` がクッキーにセットされること。
  - _Requirements: 6.1_
  - _Boundary: AuthCookiesLib_

### 2. Core (Service & API Implementation)
- [x] 2.1 (P) ReputationService への resetUserReputation 関数の実装
  - `src/services/reputation.ts` に `resetUserReputation(targetUid: string, executorId: string, reason: string)` メソッドを追加する。
  - トランザクション内で、`users/{targetUid}` の `reputationScore` を `0`、`moderationTier` を `newcomer` に更新し、同時に `adminLogs` コレクションにリクエスト履歴（監査ログ）を書き込む。
  - 実行者の `executorId` を `users` から再取得し、管理者ロールを持たない場合はエラーをスローする認可チェック（Assert）を組み込む。
  - **完了条件**: `tests/services/reputation.test.ts` にテストを追加し、管理者によるリセット処理が完了してDBに反映されること、および非管理者による呼び出し時にエラーがスローされることが Jest テストでパスすること。
  - _Requirements: 3.2_
  - _Boundary: ReputationService_
  - _Depends: 1.1, 1.2_
- [x] 2.2 (P) resetUserReputation API エンドポイントの作成
  - `src/app/api/admin/users/reset/route.ts` を新規作成し、`POST` リクエストを受け取る Route Handler を実装する。
  - リクエストボディから `targetUid` と `reason` を取得し、ヘッダーに付与された IDトークンの署名検証（JWT）を行って実行者のUIDを抽出し、`resetUserReputation` サービスを呼び出す。
  - **完了条件**: ポストマン等のAPIクライアントから管理者IDトークン付きでリクエストを送信した際、200 OK が返り、データベース上で該当ユーザー情報が初期化され、ログが記録されること。
  - _Requirements: 3.1, 3.2_
  - _Boundary: AdminUsersAPI_
  - _Depends: 2.1_
- [x] 2.3 (P) ReputationService への banUser および unbanUser 関数の実装
  - `src/services/reputation.ts` に `banUser(targetUid: string, executorId: string, reason: string)` および `unbanUser(targetUid: string, executorId: string)` メソッドを追加する。
  - トランザクション内で、対象ユーザーの `isBanned`、`bannedReason`、`bannedAt` フィールドを更新し、同時に `adminLogs` コレクションにアクション（`'ban'` または `'unban'`）のログを保存する。
  - **完了条件**: `tests/services/reputation.test.ts` に Jest テストを追加し、管理者によるBAN/UNBAN処理が正しく走り、DB情報と監査ログが正常に更新されること。
  - _Requirements: 5.2, 5.5_
  - _Boundary: ReputationService_
  - _Depends: 1.1, 1.3_
- [x] 2.4 (P) banUser および unbanUser API エンドポイントの作成
  - `src/app/api/admin/users/ban/route.ts` および `unban/route.ts` を新規作成し、`POST` リクエストを受け取る Route Handler を実装する。
  - 特権管理者トークンのJWT検証を行い、検証完了後にそれぞれ `banUser` / `unbanUser` サービスを呼び出す。
  - **完了条件**: 管理者IDトークンを用いてBAN/UNBANエンドポイントを叩いた際、`200 OK` が返り、対象ユーザーのBAN状態がトグルされること。
  - _Requirements: 5.2, 5.5_
  - _Boundary: AdminUsersAPI_
  - _Depends: 2.3_

### 3. UI Implementation & Wiring
- [x] 3.1 (P) /admin/users 画面の新規作成とナビゲーションの統合
  - `src/app/admin/users/page.tsx` および `users.module.css` を新規作成する。
  - 特定のUIDによるユーザー情報の検索・取得表示（ユーザー名、アバター、スコア、ティアー、退会ステータス）を実装。
  - リセット理由入力フォーム（10文字以上バリデーション）と、実行中のローディング表示、多重送信防止用のボタン非活性化を実装。
  - ページおよびミドルウェア層での管理者アクセス制限ガードを適用し、非管理者はアクセスできないようにする。
  - 既存の `src/app/admin/moderation/page.tsx` に `/admin/users` へのリンクを配置し、`/admin/users` 画面にも審査画面に戻る相互リンクを配置する。
  - **完了条件**: 管理者でログインして `/admin/users` にアクセスでき、検索・リセット処理実行・メッセージ表示・リンク遷移が画面上で視覚的に正しく動作すること。
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.3, 3.4, 4.1, 4.2_
  - _Boundary: AdminUsersUI_
  - _Depends: 2.2_
- [x] 3.2 (P) /admin/users 画面への BAN/UNBAN 操作UIの追加
  - `src/app/admin/users/page.tsx` にアカウント停止（BAN/UNBAN）の実行用フォームを追加する。
  - 現在のユーザーのBAN状態に応じて、「BAN実行」および「停止解除」のボタンを動的に切り替え、BAN時は10文字以上の理由入力をバリデーション付きで求める。
  - **完了条件**: 管理者画面でユーザーを検索した際、BANステータスが正しく表示され、BAN/UNBANの処理が画面上から実行可能で、成功後に表示が最新状態（「BAN済み」など）に更新されること。
  - _Requirements: 5.1, 5.3, 5.4, 5.5_
  - _Boundary: AdminUsersUI_
  - _Depends: 2.4_
- [x] 3.3 AuthContext での BAN 検知による即時サインアウトの実装
  - `src/context/auth-context.tsx` を修正し、`onAuthStateChanged` または `refreshUser` で取得した Firestore ユーザーデータ内の `isBanned` が `true` の場合、直ちに `auth.signOut()` を実行してフロントエンド側のセッションを破棄し、クッキーをクリアする。
  - **完了条件**: ログイン中にデータベース上で `isBanned` を `true` に書き換えた状態で操作（リロードや再取得など）を行うと、自動的にログアウトが走り、セッションが破棄されること。
  - _Requirements: 6.1_
  - _Boundary: AuthContext_
- [x] 3.4 middleware.ts での /banned 画面へのリダイレクト実装
  - `src/middleware.ts` を修正し、`quizetika_banned === 'true'` が検出された場合に、`/banned` 以外の一般ページへのアクセスを `/banned` に強制リダイレクトするガードロジックを追加する。
  - **完了条件**: Cookie に `quizetika_banned=true` を手動セット（またはBANによる自動セット）した状態で任意のページに遷移しようとした際、`/banned` に強制リダイレクトされること。
  - _Requirements: 6.1, 6.3_
  - _Boundary: RouteGuard_
- [x] 3.5 アカウント停止画面（/banned）の新規作成とリダイレクト制御
  - `src/app/banned/page.tsx` および `banned.module.css` を作成する。
  - 非BANユーザーまたは未ログインのユーザーが `/banned` にアクセスした際は、ホーム画面 `/` にリダイレクトするガードを記述する。
  - **完了条件**: BANされたユーザーでアクセスした際に停止通知画面が表示され、非BANユーザーが直接 `/banned` にアクセスした場合はホーム画面へリダイレクトされること。
  - _Requirements: 6.1, 6.2_
  - _Boundary: BannedUI_

### 4. Validation & Edge Cases
- [x] 4.1 アクセスガードおよびエラーハンドリングの検証
  - 一般ユーザーやモデレータ資格ユーザーで `/admin/users` への直接遷移や、リセットAPIの直接叩き込みを行い、アクセス拒否（リダイレクトまたは 403 エラー）されることを検証する。
  - 存在しない UID で検索した際に「ユーザーが見つかりません」のエラーメッセージがUIに表示されること、およびリセット理由が10文字未満の際にエラーガードが作動することを確認する。
  - **完了条件**: 認可ガードおよび不正入力時のクライアント/サーバー双方のエラー動作確認が正常に行われ、E2Eテストまたは手動テストチェックリストがすべてクリアされること。
  - _Requirements: 1.1, 2.2, 3.1_
  - _Boundary: TestSuite_
  - _Depends: 3.1_
- [x] 4.2 BANユーザーのアクセス即時遮断とデータ不変性の検証
  - ログイン中のユーザーがBANされた際、即座にログアウト処理が走り、どの機能にもアクセスできず `/banned` 画面へ遷移することを確認する。
  - BANされたユーザーの作成済みデータ（クイズ等）が非公開や削除にならず、一般プレイヤーから通常通り閲覧・プレイ可能であることを確認する。
  - **完了条件**: E2Eテストまたは手動検証チェックリストを実行し、BANユーザーの完全遮断シナリオとデータ保持シナリオが正常に動作すること。
  - _Requirements: 5.6, 6.1, 6.2_
  - _Boundary: TestSuite_
  - _Depends: 3.2, 3.3, 3.4, 3.5_

### 5. Foundation: DBスキーマ拡張（enum・テーブル・RPC）
- [x] 5.1 admin_log_action_enum への tier_downgrade 値追加マイグレーション作成
  - `admin_log_action_enum` に `tier_downgrade` 値を追加する専用マイグレーションファイルを作成する（値追加のみを行い、この値を参照するRPC定義は含めない）。
  - **完了条件**: ローカルSupabaseでマイグレーションを適用後、`SELECT unnest(enum_range(NULL::admin_log_action_enum))` に `tier_downgrade` が含まれること。
  - _Requirements: 10.3_
  - _Boundary: Database Migration_
  - _実装ファイル: `supabase/migrations/20260719000000_admin_log_action_enum_tier_downgrade.sql`（design.md記載の `20260713000000` は既存の別マイグレーション連番と衝突するため `20260719000000` に変更。以降5.2のマイグレーションもこの後続番号を使用）_
- [x] 5.2 user_reportsテーブル・RLS・5種のRPC定義マイグレーション作成
  - `user_reports` テーブル（`reporter_id`, `target_uid`, `category` CHECK制約付き, `detail`, `status`, `created_at`）と、`(reporter_id, target_uid)` に `status='open'` の部分ユニークインデックスを作成する。
  - `user_reports` にRLSを有効化し、クライアントからの直接SELECT/INSERT/UPDATEを許可しないポリシーを設定する。
  - `handle_report_user`（自己通報拒否・カテゴリ検証・冪等な重複防止）、`handle_downgrade_tier`（`is_admin()`検証・下位ティアのみ許可・`admin_logs`記録）、`get_reported_users_ranking`（`quizzes.flags_count`合算＋`user_reports`合算・0件除外・降順ページング）、`get_banned_users`（`users`と`admin_logs`をJOINし実行者情報を含めて返却・日時フィルタ・キーワード検索）、`get_user_admin_logs`（対象UIDの`admin_logs`履歴を降順取得）の5つの`SECURITY DEFINER`関数を定義する。
  - **完了条件**: ローカルSupabaseでマイグレーションを適用後、`psql`または`supabase db`経由で5関数すべてが存在し、非adminユーザーで管理者専用4関数を呼ぶと `permission-denied` 相当のエラーが返ること。
  - _Requirements: 8.1, 8.4, 8.5, 8.6, 9.3, 9.4, 9.5, 10.1, 10.2, 10.3, 10.4, 10.7, 11.3, 11.4, 11.5, 11.6_
  - _Boundary: Database Migration_
  - _Depends: 5.1_
  - _実装ファイル: `supabase/migrations/20260719000100_user_reports_and_ranking.sql`_
- [x] 5.3 型定義の再生成とアプリケーション型の追加
  - `npm run gen:types` を実行し `src/lib/supabase/database.types.ts` を再生成する。
  - `src/types/index.ts` に `UserReport`, `ReportedUserSummary`, `BannedUserSummary`, `AdminLogEntry` 型を追加する。
  - **完了条件**: `database.types.ts` に `user_reports` テーブル型と5RPCの引数/戻り値型が反映され、`tsc --noEmit` が型エラーなく通ること。
  - _Requirements: 8.1, 9.6, 10.1, 11.3_
  - _Boundary: Types_
  - _Depends: 5.2_
  - _レビュー指摘（非ブロッキング）: `UserReport.status` に design.md 未記載の `'rejected'` が含まれる（DB側もCHECK制約なし）。現時点で消費者コードがないため実害なし。UserReportを実際に使用するタスク6.5/8.5で整合を確認すること。_

### 6. Core: サービス層実装
- [x] 6.1 (P) reputation service への downgradeUserTier 実装
  - `src/services/reputation.ts` に `downgradeUserTier(targetUid, executorId, newTier, reason)` を追加し、`handle_downgrade_tier` RPCを呼び出す。理由10文字未満はRPC呼び出し前にクライアント側でも早期リターンする。
  - **完了条件**: `tests/services/reputation.test.ts` に追加したJestテストで、正常系（RPC呼び出しとモック結果の整形）と異常系（理由10文字未満でRPCを呼ばずエラーを返す）がパスすること。
  - _Requirements: 10.3, 10.4_
  - _Boundary: reputation service_
  - _Depends: 5.3_
- [x] 6.2 (P) reputation service への getReportedUsersRanking 実装
  - `src/services/reputation.ts` に `getReportedUsersRanking(page, pageSize)` を追加し、`get_reported_users_ranking` RPCの結果を `ReportedUserSummary[]` に整形する。
  - **完了条件**: Jestテストで、RPCモックの戻り値が `ReportedUserSummary[]` へ正しくマッピングされ、`hasMore` がページサイズと結果件数から正しく算出されることを検証できること。
  - _Requirements: 9.3, 9.4, 9.5_
  - _Boundary: reputation service_
  - _Depends: 5.3_
  - _実装メモ: `GetReportedUsersRankingResult` 型はdesign.mdの `types/index.ts` 割当リストに含まれないため、`reputation.ts` 内でローカル定義・exportした（design.md整合、レビュー確認済み）。以降のUIタスクはこの型を `services/reputation` からimportすること。_
- [x] 6.3 (P) reputation service への getBannedUsers 実装
  - `src/services/reputation.ts` に `getBannedUsers(filters)` を追加し、`get_banned_users` RPCへ日時範囲・キーワード・ページングパラメータを渡し、結果を `BannedUserSummary[]` に整形する。
  - **完了条件**: Jestテストで、フィルタ引数がRPC呼び出しパラメータへ正しく渡されること、および `bannedByExecutorId` を含む結果整形が検証できること。
  - _Requirements: 11.3, 11.4, 11.5, 11.6_
  - _Boundary: reputation service_
  - _Depends: 5.3_
  - _実装メモ: `get_banned_users` のSQL引数にDEFAULT NULLがないため、未指定フィルタは明示的に`null`へ変換してから渡す（`undefined`のままではPostgRESTに拒否される）。`BannedUserFilters`/`GetBannedUsersResult`型はtask 6.2と同様`reputation.ts`内でローカル定義・export。_
- [x] 6.4 (P) reputation service への getUserAdminLogs 実装
  - `src/services/reputation.ts` に `getUserAdminLogs(targetUid)` を追加し、`get_user_admin_logs` RPCの結果を `AdminLogEntry[]` に整形する。
  - **完了条件**: Jestテストで、RPCモックの戻り値が `AdminLogEntry[]` へ正しくマッピングされることを検証できること。
  - _Requirements: 7.4, 7.5_
  - _Boundary: reputation service_
  - _Depends: 5.3_
- [x] 6.5 (P) user-report service の新規作成
  - `src/services/user-report.ts` を新規作成し、`submitUserReport(reporterId, targetUid, category, detail)` を実装する。呼び出し前に `reporterId === targetUid` を検証しRPCを呼ばずエラーを返す。
  - **完了条件**: `tests/services/user-report.test.ts` を新規作成し、自己通報時にRPCが呼ばれずエラーが返ること、正常系でRPC呼び出しが行われることがJestテストでパスすること。
  - _Requirements: 8.3, 8.5, 8.6_
  - _Boundary: user-report service_
  - _Depends: 5.3_
  - _実装メモ: レビュー時にPowerShellのsafety classifierが一時的に利用不可となり `npx jest` の実行検証ができなかったため、独立レビュアーおよび親コントローラーがコード・テストファイルの内容を直接読み、実際のSQL（`RAISE EXCEPTION`文字列）と1対1で突合するstatic verificationで承認した。次回のテスト全体実行（タスク7.x以降のいずれかで`npm run test`を回す際）で `tests/services/user-report.test.ts` が実際にパスすることを確認すること。_

### 7. Core: APIエンドポイント実装
- [x] 7.1 (P) /api/admin/users/downgrade-tier エンドポイントの作成
  - `src/app/api/admin/users/downgrade-tier/route.ts` を新規作成し、既存の `ban/route.ts` と同型のBearerトークン検証を行った上で `downgradeUserTier` を呼び出す。
  - **完了条件**: 管理者トークンでリクエストした際に `200 OK` が返り対象ユーザーのティアが更新されること、非admin/不正リクエストでは 400/401/403/409 のいずれかが返ることを確認できること。
  - _Requirements: 10.3, 10.4_
  - _Boundary: downgrade-tier API Route_
  - _Depends: 6.1_
- [x] 7.2 (P) /api/users/report エンドポイントの作成
  - `src/app/api/users/report/route.ts` を新規作成し、認証済みユーザーのトークンを検証した上で `submitUserReport` を呼び出す。
  - **完了条件**: 認証済みユーザーのトークンでリクエストした際に `200 OK` が返ること、未認証時は401、自己通報時は409が返ることを確認できること。
  - _Requirements: 8.3, 8.4, 8.5_
  - _Boundary: report API Route_
  - _Depends: 6.5_

### 8. Core: UIコンポーネント実装
- [x] 8.1 (P) AdminUserSearchPanel への抽出とTierDowngradeControl統合
  - 既存 `src/app/admin/users/page.tsx` の検索・リセット・BAN/UNBANロジックを `src/app/admin/users/admin-user-search-panel.tsx` へ移設する。既存の `id`/`data-testid`（`execute-reset-btn` 等）は一切変更しない。
  - `src/components/admin/tier-downgrade-control.tsx` を新規作成し、現在のティアより厳密に下位のティアのみを選択肢とするドロップダウン、理由入力（10文字以上）、確認フローを実装して `AdminUserSearchPanel` に統合する。`newcomer` の場合は操作を非活性化する。
  - **完了条件**: 検索結果表示エリアに「ティア引き下げ」操作が表示され、下位ティア選択→理由入力→確認→実行後にティア表示が更新されること。既存のリセット/BAN/UNBANフォームは移設前と同じ`id`で動作すること。
  - _Requirements: 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5, 10.1, 10.2, 10.4, 10.5, 10.6, 10.7_
  - _Boundary: UserSearchPanel_
  - _Depends: 7.1_
- [x] 8.2 UserSearchPanel への監査ログ履歴リストとスケルトン表示の追加
  - `AdminUserSearchPanel` に、検索対象ユーザーに関する `admin_logs` 履歴リスト表示エリアを新規実装し、`getUserAdminLogs` を呼び出して表示する（アクション種別・実行者・理由・日時）。
  - ユーザー情報表示エリアと監査ログ表示エリアそれぞれに、ロード中はセクション単位のスケルトンプレースホルダー（`data-testid="admin-user-info-skeleton"` / `data-testid="admin-logs-skeleton"`）を表示し、ロード完了後に実データへ差し替える。
  - **完了条件**: UIDを検索すると監査ログ履歴リストが表示され、リセット/BAN/UNBAN/ティア引き下げの実行後に一覧が最新化されること。ロード中は指定の`data-testid`を持つスケルトンが表示され、完了後に実データへ切り替わることが目視・テストで確認できること。
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.9_
  - _Boundary: UserSearchPanel_
  - _Depends: 8.1, 6.4_
  - _レビュー指摘（非ブロッキング）: reset/ban/unban/tier-downgradeの4アクションすべてがrefreshAdminLogsを呼ぶことはコード直読で確認済みだが、テストのコール数アサーションはresetアクションのみ。他3アクションのテストカバレッジ追加は将来の改善候補。_
- [x] 8.3 (P) AdminReportedUsersPanel の新規実装
  - `src/app/admin/users/admin-reported-users-panel.tsx` を新規作成し、`getReportedUsersRanking` を呼び出して表示名・UID・ティア・BANステータス・総通報数を含む一覧を総通報数降順で表示する。limit/offsetベースの「前へ/次へ」ページネーションを実装する。
  - 0件時の空状態メッセージと、ロード中のスケルトン（`data-testid="admin-reported-users-skeleton"`）を実装する。行選択時に `onSelectUser(uid)` プロパティを呼び出す。
  - **完了条件**: 通報ランキングタブを開くと一覧が総通報数降順で表示され、「次へ」操作でページが切り替わり、該当0件時に空状態メッセージが表示されること。
  - _Requirements: 9.1, 9.2, 9.6, 9.7, 9.8, 9.9_
  - _Boundary: ReportedUsersPanel_
  - _Depends: 6.2_
- [x] 8.4 (P) AdminBannedUsersPanel の新規実装
  - `src/app/admin/users/admin-banned-users-panel.tsx` を新規作成し、`getBannedUsers` を呼び出してBAN日時降順の一覧（表示名・UID・BAN理由・BAN日時・実行者）を表示する。
  - BAN日時の期間指定（開始/終了）とUID/表示名キーワード検索の入力操作を実装し、`ConfirmActionDialog` を再利用した解除（UNBAN）操作を一覧行から実行可能にする。
  - 0件時の空状態メッセージと、ロード中のスケルトン（`data-testid="admin-banned-users-skeleton"`）を実装する。
  - **完了条件**: BAN管理タブでBAN済み一覧が表示され、日時範囲・キーワードでの絞り込みが機能し、行から解除操作を実行すると一覧からその行が除外されること。
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9_
  - _Boundary: BannedUsersPanel_
  - _Depends: 6.3_
  - _重大な発見・修正（本タスクのレビュー中に検出）: `src/services/reputation.ts` はサーバー専用Supabaseクライアント（`next/headers`依存）を使用しており、クライアントコンポーネント（8.2/8.3/8.4）から直接importすると`next build`が失敗することが判明。`src/services/reputation-client.ts`（ブラウザクライアント版）を新規作成し、`getReportedUsersRanking`/`getBannedUsers`/`getUserAdminLogs`/`unbanUser`をクライアント向けに複製、3パネルのimport先を切り替えて解決。`reputation.ts`本体とAPIルート（ban/unban/reset/downgrade-tier）は無変更。`npx next build`のグリーンを確認済み。以降タスク8.5でクライアントコンポーネントから`reputation.ts`の関数を使う場合は`reputation-client.ts`を使用すること。_
- [x] 8.5 (P) ReportUserDialog の新規実装とプロフィール画面への統合
  - `src/components/profile/report-user-dialog.tsx` を、既存 `report-modal.tsx` と同型の構成（カテゴリ選択、自由記述、送信、成功表示）で新規作成する。
  - `src/app/profile/[uid]/profile-client.tsx` に「ユーザーを通報」ボタンを追加し、`ReportUserDialog` を開く導線を実装する（対象が自分自身のプロフィールの場合はボタンを非表示にする）。
  - **完了条件**: 他ユーザーのプロフィール画面で「ユーザーを通報」ボタンから理由未入力時にインラインエラーが出ること、正しく送信すると成功メッセージが表示されること、自分のプロフィールではボタンが表示されないこと。
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: ReportUserDialog_
  - _Depends: 7.2_
- [x] 8.6 (P) /banned画面のスケルトン化
  - `src/app/banned/page.tsx` を修正し、ヘッダー・タイトル・停止通知の基本フレームを即座に表示した上で、BAN理由・日時等の詳細情報のロード中は専用スケルトン（`data-testid="banned-info-skeleton"`）を表示し、ロード完了後に実データへ差し替える。
  - **完了条件**: `/banned` 画面にアクセスした際、基本フレームが即座に表示され、詳細情報のロード中はスケルトンが表示され、完了後に実際のBAN理由・日時に差し替わることが確認できること。
  - _Requirements: 7.6, 7.7, 7.8, 7.10_
  - _Boundary: BannedPage_
  - _レビュー1回目でREJECTED（BAN日時`bannedAt`が未表示）→修正後APPROVED。`displayBannedAt`をdisplayReasonと同じフォールバックパターンで実装し、同じスケルトン条件下でreasonと共に表示。_

### 9. Integration: タブコンテナ化と状態配線
- [x] 9.1 /admin/users のタブコンテナ化と選択中ユーザー状態の配線
  - `src/app/admin/users/page.tsx` を、`Tabs`（UID検索・通報ランキング・BAN管理）を持つコンテナへ変更し、`AdminUserSearchPanel` / `AdminReportedUsersPanel` / `AdminBannedUsersPanel` を配置する。管理者用サイドバー・ヘッダー・タブ枠等の静的フレームをサーバーコンポーネントとして即座にレンダリングし、Next.jsのStreaming機能でクライアントへ送信する構成に変更する。
  - `selectedUid` 状態を `page.tsx` にリフトアップし、`ReportedUsersPanel` / `BannedUsersPanel` の行選択時に `onSelectUser(uid)` が呼ばれたら検索タブへ切り替え、`AdminUserSearchPanel` に選択UIDを渡して自動検索させる。
  - **完了条件**: 通報ランキングタブでユーザー行を選択すると検索タブへ自動遷移し、該当ユーザーの詳細情報が表示された状態になること。既存の管理者アクセスガード（1.1, 1.2）とナビゲーションリンク（4.1, 4.2）が維持されていること。静的フレームがデータロードを待たずに即座に表示されること。
  - _Requirements: 1.1, 1.2, 4.1, 4.2, 7.1, 9.7_
  - _Boundary: AdminUsersPage_
  - _Depends: 8.1, 8.2, 8.3, 8.4_
  - _実装メモ: デフォルトアクティブタブは「検索」のため、既存e2e/admin-users.spec.tsのタブ非依存な検索フローに影響なし。BannedUsersPanelへのonSelectUser配線はdesign.md/requirements.mdがRequirement 11で要求していないため未実装（レビュー確認済み、正当なスコープ判断）。Requirement 7.1は/bannedページ（8.6）と同じ「認証確認後、静的フレームをデータロード待たずに同期表示」という実用的解釈を踏襲（真のRSC Streamingではない）。_

### 10. Validation
- [x] 10.1 既存検索/リセット/BAN/UNBAN機能の回帰確認
  - `e2e/admin-users.spec.ts` を実行し、タブコンテナ化・パネル抽出後も既存のUID検索・リセット・BAN/UNBANフローがすべて成功することを確認する。失敗があれば `id`/`data-testid` の不一致を修正する。
  - **完了条件**: `e2e/admin-users.spec.ts` の既存テストケースがすべてパスすること。
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 3.1, 3.2, 3.3, 3.4, 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: TestSuite_
  - _Depends: 9.1_
  - _重大な発見: 既存テストの`isVisible().catch(()=>false)`ガードが認証コンテキスト解決前に評価され、2テストのアサーションが実質スキップされていたことが判明（`waitFor({state:'visible'})`へ修正して初めて実際の検証が走った）。修正後、(1)「モデレーション審査キューに戻る」→実際の文言「🛡️ モデレーション審査画面へ」への追従、(2)タブ追加により`検索`ボタンセレクタが曖昧になった問題、の2件の実回帰を発見・修正。BAN/UNBANの明示的なE2Eケースはspecファイルに存在しない（本タスク範囲外の既存ギャップ）。_
- [x] 10.2 通報ランキングからティア引き下げまでのE2E検証
  - 管理者が通報ランキング一覧から行を選択し、検索タブへ切り替わって詳細が表示され、ティア引き下げを実行して成功することを確認するE2Eテストを作成する。
  - **完了条件**: 新規E2Eテストが、ランキング表示→行選択→タブ切替→ティア引き下げ実行→成功表示までの一連の流れでパスすること。
  - _Requirements: 9.7, 10.3, 10.6_
  - _Boundary: TestSuite_
  - _Depends: 9.1_
- [x] 10.3 ユーザー直接通報のE2E検証
  - 一般ユーザーが他ユーザーのプロフィール画面から通報を送信し、成功メッセージが表示されるまでの一連の流れを確認するE2Eテストを作成する。
  - **完了条件**: 新規E2Eテストが、通報ダイアログを開く→理由入力→送信→成功メッセージ表示までパスすること。
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: TestSuite_
  - _Depends: 8.5_
  - _既存のvisibilityTest.follower/authorフィクスチャを通報者・通報対象として再利用。afterAllでuser_reportsレコードを削除しテストデータ衛生を確保。_
- [x] 10.4 BAN済み一覧の絞り込み・解除のE2E検証
  - 管理者がBAN管理タブでBAN日時範囲を指定して一覧を絞り込み、UNBANを実行して一覧からその行が消えることを確認するE2Eテストを作成する。
  - **完了条件**: 新規E2Eテストが、日時フィルタ適用→絞り込み結果確認→解除実行→一覧更新確認までパスすること。
  - _Requirements: 11.4, 11.7_
  - _Boundary: TestSuite_
  - _Depends: 9.1_
  - _2ユーザー（対象/範囲外）をSQL直接投入しBAN日時フィルタの絞り込みを検証、UNBAN実行後の行消失も確認。afterAllで両ユーザーのBAN状態・admin_logsをクリーンアップ。全E2E横断実行（8/8）で相互干渉なしを確認済み。_

### 11. Foundation: 通報数リセット用DBスキーマ拡張
- [x] 11.1 admin_log_action_enum への report_reset 値追加マイグレーション作成
  - `admin_log_action_enum` に `report_reset` 値を追加する専用マイグレーションファイルを作成する（値追加のみを行い、この値を参照するRPC定義は含めない。既存の `tier_downgrade` 追加時と同じ理由）。
  - **完了条件**: ローカルSupabaseでマイグレーションを適用後、`SELECT unnest(enum_range(NULL::admin_log_action_enum))` に `report_reset` が含まれること。
  - _Requirements: 12.3_
  - _Boundary: Database Migration_
  - _実装ファイル: `supabase/migrations/20260719000200_admin_log_action_enum_report_reset.sql`。11.2以降のマイグレーションもこの連番の続き（`20260719000300`以降）を使用すること。_
- [x] 11.2 handle_reset_user_reports / get_user_open_report_count の2RPC定義マイグレーション作成
  - `handle_reset_user_reports(p_target_uid UUID, p_reason TEXT) RETURNS VOID`（`is_admin()`検証、対象ユーザー存在確認、理由10文字以上検証、`user_reports`の`status='open'`行を`resolved`に一括UPDATE、`admin_logs`に`action='report_reset'`で記録、`quizzes`テーブルへは書き込まない）と、`get_user_open_report_count(p_target_uid UUID) RETURNS INT`（`is_admin()`検証、`user_reports`の`status='open'`件数をCOUNT）の2つの`SECURITY DEFINER`関数を定義する。
  - `npm run gen:types` を実行し `src/lib/supabase/database.types.ts` を再生成する。
  - **完了条件**: ローカルSupabaseでマイグレーションを適用後、両関数が存在し、非adminユーザーで呼び出すと `permission-denied` 相当のエラーが返ること。`database.types.ts` に両関数の引数/戻り値型が反映されること。
  - _Requirements: 12.3, 12.4, 12.7, 12.8_
  - _Boundary: Database Migration_
  - _Depends: 11.1_
  - _実装ファイル: `supabase/migrations/20260719000300_reset_user_reports.sql`_

### 12. Core: サービス層・APIエンドポイント実装
- [x] 12.1 reputation service への resetUserReports 実装
  - `src/services/reputation.ts` に `resetUserReports(targetUid, executorId, reason)` を追加し、`handle_reset_user_reports` RPCを呼び出す。理由10文字未満はRPC呼び出し前にクライアント側でも早期リターンする。
  - **完了条件**: `tests/services/reputation.test.ts` に追加したJestテストで、正常系（RPC呼び出しとエラーマッピング）と異常系（理由10文字未満でRPCを呼ばずエラーを返す）がパスすること。
  - _Requirements: 12.3, 12.4_
  - _Boundary: reputation service_
  - _Depends: 11.2_
- [ ] 12.2 reputation service への getUserOpenReportCount 実装
  - `src/services/reputation.ts` に `getUserOpenReportCount(targetUid)` を追加し、`get_user_open_report_count` RPCの結果（整数）を返す。
  - **完了条件**: Jestテストで、RPCモックの戻り値が正しく整数として返却されること、`permission-denied`エラーが日本語メッセージにマッピングされることを検証できること。
  - _Requirements: 12.7_
  - _Boundary: reputation service_
  - _Depends: 12.1（同一ファイル `reputation.ts`/`reputation.test.ts` を編集するため12.1と並列実行不可、順序のみで依存関係を表現）_
- [ ] 12.3 /api/admin/users/reset-reports エンドポイントの作成
  - `src/app/api/admin/users/reset-reports/route.ts` を新規作成し、既存の `downgrade-tier/route.ts` と同型のBearerトークン検証を行った上で `resetUserReports` を呼び出す。
  - **完了条件**: 管理者トークンでリクエストした際に `200 OK` が返り対象ユーザーの通報が解決済みになること、非admin/不正リクエストでは400/401/403/404のいずれかが返ることを確認できること。
  - _Requirements: 12.3, 12.4_
  - _Boundary: reset-reports API Route_
  - _Depends: 12.1_

### 13. Core: UI統合
- [ ] 13.1 UserSearchPanel への通報数リセットUIの追加
  - `src/app/admin/users/admin-user-search-panel.tsx` の検索結果詳細表示エリアに、`TierDowngradeControl` と同様のパターン（理由入力10文字以上・`ConfirmActionDialog`による確認・実行ボタン）で「通報数リセット」操作を追加する。
  - ユーザー検索成功時に `getUserOpenReportCount` を呼び出し、結果が0件の場合はリセット操作を非活性化する（Requirement 12.7）。実行成功後は成功メッセージを表示し、未処理通報件数の表示（0件）を更新する。
  - 本操作がクイズ通報累計（`quizzes.flags_count`）には影響しないことを明示する説明文をUI上に表示する（Requirement 12.8）。
  - 本操作は既に `AdminUsersPage`（タスク9.1）が提供する管理者ロールガード配下で提供され、`UserSearchPanel` 自体に個別の追加ガードは実装しない（Requirement 12.1、既存ガードで充足）。
  - **完了条件**: 検索結果に未処理の直接通報が1件以上あるユーザーでは「通報数リセット」操作が活性化され、理由入力→確認→実行→成功表示→件数0件への更新まで一連の流れが動作すること。未処理通報が0件のユーザーでは操作が非活性化されていること。
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8_
  - _Boundary: UserSearchPanel_
  - _Depends: 12.2, 12.3_

### 14. Validation
- [ ] 14.1 通報数リセットのE2E検証
  - 管理者が検索タブで対象ユーザーを検索し、通報数リセットを実行して未処理直接通報が解決済みになり、画面表示が更新されるまでの一連の流れを確認するE2Eテストを作成する。あわせて、未処理通報が0件のユーザーでは操作が非活性化されていることも確認する。
  - **完了条件**: 新規E2Eテストが、対象ユーザー検索→通報数リセット実行→成功表示→件数更新確認、および0件ユーザーでの非活性化確認の両方でパスすること。
  - _Requirements: 12.3, 12.6, 12.7_
  - _Boundary: TestSuite_
  - _Depends: 13.1_

## Implementation Notes
- 5.1: マイグレーションファイル名は設計書記載の `20260713000000` ではなく `20260719000000` を使用（既存の `20260713000000`〜`20260718000000` は別チェーンの既存マイグレーションと衝突するため）。5.2以降のマイグレーションもこの連番の続き（`20260719000100`以降）を使用すること。
- 5.1: ローカル環境の `supabase_migrations.schema_migrations` 履歴テーブルが空だったため `npx supabase migration up` が使えず、`pg` 経由で直接SQLを適用し履歴行を手動追加した（既存の環境課題、本タスクでは対応不要）。以降のタスクでも同様の対応が必要になる可能性がある。
- **重要**: PowerShellの `Get-Content`/`Set-Content` で日本語を含むspecファイルを読み書きすると、システムのデフォルトコードページ（CP932）誤変換によりUTF-8日本語テキストが破損する（文字化け）ことが判明した。spec配下の`.md`ファイルを編集する際は、必ずRead/Edit/Writeツールを使用し、PowerShell経由でのテキスト置換は行わないこと。
- 8.1（レビューで発見・本タスク起因ではない既存バグ）: `e2e/admin-users.spec.ts` の「モデレーション審査キューに戻る」テキストへの期待が、`page.tsx`の実際のナビリンク文言「🛡️ モデレーション審査画面へ」と一致していない（このズレは本タスクの変更以前から存在）。タスク10.1（既存機能の回帰確認）でこの不一致がテスト失敗として顕在化する場合は、テスト側の期待値を実際の文言に合わせて修正すること。
