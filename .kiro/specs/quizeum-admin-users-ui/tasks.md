# Implementation Plan: quizeum-admin-users-ui

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

### 4. Validation & Edge Cases
- [ ] 4.1 アクセスガードおよびエラーハンドリングの検証
  - 一般ユーザーやモデレータ資格ユーザーで `/admin/users` への直接遷移や、リセットAPIの直接叩き込みを行い、アクセス拒否（リダイレクトまたは 403 エラー）されることを検証する。
  - 存在しない UID で検索した際に「ユーザーが見つかりません」のエラーメッセージがUIに表示されること、およびリセット理由が10文字未満の際にエラーガードが作動することを確認する。
  - **完了条件**: 認可ガードおよび不正入力時のクライアント/サーバー双方のエラー動作確認が正常に行われ、E2Eテストまたは手動テストチェックリストがすべてクリアされること。
  - _Requirements: 1.1, 2.2, 3.1_
  - _Boundary: TestSuite_
  - _Depends: 3.1_
