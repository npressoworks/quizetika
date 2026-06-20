# Brief: quizeum-announcements

## Problem
運営メンバーや非開発者が、ビルドやデプロイを行わずにアプリ内のお知らせ（Announcements/News）を動的に追加・編集・削除できるようにしたい。また、ユーザーはお知らせと個人宛ての通知を一元的に確認したいが、お知らせは未ログインユーザーであっても自由に閲覧可能にする必要がある。

## Current State
現在、クイズ投稿SNS「Quizeum」には個人宛ての通知機能（`notifications` コレクション、`/notifications` ページ）は存在するが、全ユーザー向けおよび運営からのお知らせ機能は存在しない。また、通知画面には認証ガードがかかっており、ログインしないと画面にアクセスできない。

## Desired Outcome
Firestore に `announcements` コレクションを作成し、管理者用のCRUD画面（`/admin/announcements`）を用意してブラウザ上で簡単にお知らせを追加・管理可能にする。一般ユーザーは、ログインの有無にかかわらず `/notifications` ページから運営からのお知らせ（Markdown対応）を閲覧できるようになり、通知と併せて確認できるようになる。

## Approach
- Firestore `announcements` コレクションを新設。
- 管理者のみ書き込み可（`admin` ロールチェック）、一般は読み取り可とする `firestore.rules` を設定。
- 管理者メニュー（`/admin`）に「お知らせ管理」メニューを追加し、`/admin/announcements` ページでCRUDを作成（Markdownプレビュー対応）。
- 一般ユーザー向けには、`/notifications` ページに Shadcn `Tabs` を用いて「通知」と「運営からのお知らせ」タブを設ける。
- ルーティングガード（`middleware.ts` / page / context）を緩和し、未ログインでも `/notifications` で「運営からのお知らせ」タブのみ表示・閲覧できるようにする。

## Scope
- **In**:
  - `announcements` のデータ型定義および Firestore サービス層。
  - 管理者用お知らせ管理画面（`/admin/announcements`）の作成。
  - 一般ユーザー用お知らせ表示機能（`/notifications` 内のタブ表示）。
  - 未ログインユーザー向けのお知らせ閲覧対応。
  - 本文の簡易 Markdown パース表示（`parseMarkdownToHtml` を流用）。
  - Firestore セキュリティルールおよびインデックス設定。
- **Out**:
  - 特定ユーザーグループ向けのお知らせセグメント配信。
  - 各お知らせのユーザー個別既読管理（既読バッジのON/OFFなど）。

## Boundary Candidates
- `Announcement` 型の定義
- `announcement.ts` Firestore サービス
- 管理者お知らせCRUDコンポーネント
- 一般ユーザー通知画面（お知らせタブ統合）

## Out of Boundary
- 個別ユーザーの通知システム（既存の `quizeum-auth-profile-ui` が所有）

## Upstream / Downstream
- **Upstream**: `quizeum-core` (Firestore, 認証), `quizeum-auth-profile-ui` (通知画面)
- **Downstream**: なし

## Existing Spec Touchpoints
- **Extends**: `quizeum-core` (データ層, 認証・管理者認可), `quizeum-auth-profile-ui` (通知画面UIの拡張)
- **Adjacent**: なし

## Constraints
- **Styling**: Tailwind CSS v4 ＋ Shadcn/ui を使用（Vanilla CSS ではなく Phase 24 の移行規約に準拠）。
- **認証**: 管理者画面は `isAdminUser(user)` によるガードを継続。お知らせ表示は未ログイン対応のため、認証ガードを部分緩和する。
