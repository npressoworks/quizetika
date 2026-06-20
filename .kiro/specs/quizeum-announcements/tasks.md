# Implementation Plan: quizeum-announcements

## 1. Foundation: データベース基盤とサービス層の構築

- [x] 1.1 型定義の追加と Firestore サービス層の構築
  - `src/types/index.ts` に `Announcement` 型（ID, タイトル, 本文, カテゴリ, ステータス, 日付, 作成者）を追加する。
  - `src/services/announcement.ts` を新規作成し、`getAnnouncements`, `adminGetAnnouncements`, `createAnnouncement`, `updateAnnouncement`, `deleteAnnouncement` などの Firestore CRUD関数を実装する。
  - **Observable completion**: TypeScriptのビルドが通り、新設した各関数の型エラーがないこと。
  - _Requirements: 1.2, 1.3, 1.5, 2.2_
  - _Boundary: Core Model & Service_

- [ ] 1.2 Firestore セキュリティルールの更新
  - `firestore.rules` に `announcements` コレクションのアクセスルール（管理者は全操作許可、一般ユーザーは `status == 'published'` の読み取りのみ許可、一般ユーザーの書き込みは拒否）を追加する。
  - **Observable completion**: `firestore.rules` が有効化され、管理者以外からの書き込みがルールで遮断されること。
  - _Requirements: 3.2, 3.3_
  - _Boundary: Security Rules_

## 2. Core: 管理者・一般ユーザーUIの実装

- [ ] 2.1 (P) 管理者向けお知らせ管理UIの実装
  - `src/app/admin/announcements/page.tsx` および `client.tsx` を新規作成する。
  - お知らせの一覧表示、新規作成、編集、削除を行うCRUD画面を構築する。
  - 本文入力中のMarkdownプレビュー表示機能を追加する（`parseMarkdownToHtml` を使用）。
  - **Observable completion**: 管理者アカウントでログイン時、`/admin/announcements` にてお知らせの作成、編集、削除、プレビューの一連の操作がブラウザ上でエラーなく行えること。
  - _Requirements: 1.2, 1.3, 1.4, 1.5_
  - _Boundary: Admin Announcements UI_

- [ ] 2.2 (P) 通知画面ガードの緩和とタブ化対応
  - `src/middleware.ts` を修正し、`authRequiredPaths` から `/notifications` を除外して未ログインでもアクセスできるようにする。
  - `src/app/notifications/page.tsx` を修正し、Shadcn `Tabs` コンポーネントを配置して「通知」と「運営からのお知らせ」を切り替えられるようにする。
  - 未ログインユーザーがアクセスした際、「通知」タブではログイン誘導UI（ログインボタン等）を表示し、「運営からのお知らせ」タブは制限なしで表示されるようにする。
  - **Observable completion**: 未ログイン状態で `/notifications` にアクセスした際、ログイン画面に強制リダイレクトされず、お知らせがそのまま閲覧できること。
  - _Requirements: 2.1, 2.3, 2.4, 3.1_
  - _Boundary: RouteGuard & Notifications Page_
  - _Depends: 1.2_

- [ ] 2.3 (P) 一般ユーザー向けお知らせ一覧タブの構築
  - `src/app/notifications/announcements-tab.tsx` を新規作成する。
  - 公開状態のお知らせを公開日時の降順で一覧表示し、本文を `parseMarkdownToHtml` を用いてマークダウン表示する。
  - **Observable completion**: お知らせ一覧に投稿されたお知らせがマークダウン形式で正しくレンダリングされて表示されること。
  - _Requirements: 2.2, 2.5_
  - _Boundary: Announcements Tab UI_
  - _Depends: 1.1_

## 3. Integration & Validation: 結合と自動テスト

- [ ] 3.1 管理ポータルからの遷移追加と全体の結合
  - `src/app/admin/page.tsx` を修正し、「運営からのお知らせ管理」へのリンクカードを追加する。
  - ページ間遷移、未ログイン時のAPI制限（403応答）が正常に機能することを確認する。
  - **Observable completion**: 管理者ポータルからお知らせ管理画面に遷移でき、一般ユーザー向けの表示とも矛盾なくデータが同期すること。
  - _Requirements: 1.1, 3.1_
  - _Boundary: Admin Portal & Routing_
  - _Depends: 2.1, 2.2_

- [ ] 3.2 E2Eテストの実装
  - 管理者お知らせ作成・編集・削除、未ログインユーザーでのお知らせタブ表示・ログイン誘導の Playwright E2Eテストを `e2e/announcements.spec.ts` などの新規ファイルで追加する。
  - **Observable completion**: `npm run test:e2e` を実行し、追加したお知らせ関連のE2Eテストがすべてパスすること。
  - _Requirements: 1.2, 1.3, 1.5, 2.2, 2.3, 2.4, 3.2, 3.3_
  - _Boundary: E2E Testing_
  - _Depends: 3.1_
