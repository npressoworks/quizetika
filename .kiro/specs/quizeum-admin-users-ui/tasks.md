# Implementation Plan: quizetika-admin-users-ui

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
