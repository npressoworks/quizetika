# Brief: quizetika-admin-users-ui

## Problem
システム管理者が不適切なユーザーに対して緊急の信頼スコア・権限リセットを行ったり、アカウントの停止（BAN）処理を行ったりする際、データベース（Firestoreコンソール等）を直接操作する必要があり、誤操作のリスクや監査ログが残らないという課題があります。また、BANされたユーザーからの不適切なアクセスやデータ書き込みを即座に遮断する仕組みが不足しています。

## Current State
管理者専用のモデレーション画面（`/admin/moderation`）はありますが、ユーザーごとのステータス確認、信頼スコアの手動リセット、アカウントのBAN/UNBANを行う専用画面、および `adminLogs` コレクションは存在しません。また、BANされたユーザーのアクセス制限および自動ログアウトの仕組みもありません。

## Desired Outcome
- システム管理者専用画面 `/admin/users` が提供され、管理者が特定のユーザーUIDで検索・ステータス確認を行い、リセットやBAN/UNBANを実行可能にします。
- アクションを実行した際には自動で `adminLogs` に記録が残るようになります。
- BANされたユーザーがアクセスしようとした場合、即座にログアウト処理を行い、専用の停止メッセージ画面（`/banned`）へリダイレクトしてアクセスを遮断します。

## Approach
`/admin/users` 画面を新規作成し、`reputation.ts` に追加される `resetUserReputation`、および `banUser` / `unbanUser` などのAPIを介して処理を実行します。
認証コンテキスト（`auth-context.tsx`）およびミドルウェア（`middleware.ts`）で `users` ドキュメントの `isBanned` フラグを監視し、BANされたユーザーを強制ログアウトの上、`/banned` 画面にリダイレクトします。

## Scope
- **In**:
  - `/admin/users` 画面の新規追加（ユーザーUIDによる検索・基本情報表示、リセット実行フォーム、BAN/UNBAN実行フォーム、処理結果メッセージ表示）。
  - `admin/moderation` 画面から `/admin/users` へのリンク提供。
  - BANされたユーザー向けの専用停止メッセージ画面（`/banned`）の新規追加。
  - 特権アクション実行時の多重防衛（`executorId` による管理者ロール確認）。
  - アクション後の `adminLogs` コレクションへの永続化（core）。
  - Firestore Security Rules でのBANユーザーによる書き込み/読み込みの遮断。
- **Out**:
  - ユーザーのアカウント物理削除機能自体。
  - BANされたユーザーが過去に投稿したクイズやコメントの物理削除・非公開化（これらはそのまま残します）。

## Boundary Candidates
- AdminUsers-UI: `/admin/users` のフォームおよび表示コンポーネント、および `/banned` 画面。
- AdminUsers-API: `resetUserReputation` / `banUser` / `unbanUser` を呼び出すAPI連携。

## Out of Boundary
- モデレータ（Moderator / Senior Moderator）が管理者専用のユーザー管理画面にアクセスすることはできません。`role === 'admin'` のみがアクセスできます。

## Upstream / Downstream
- **Upstream**: quizetika-core
- **Downstream**: なし

## Existing Spec Touchpoints
- **Extends**: quizetika-core (API・型定義、Firestore Rules、認証ミドルウェア)
- **Adjacent**: quizetika-moderation-governance-ui (モデレーションルートガード、管理ナビゲーション)

## Constraints
- **Styling**: Vanilla CSSを使用。他の管理者画面と統一感のある洗練されたダーク/ライトテーマデザイン。
- **Security**: ミドルウェアおよび画面の両方でアクセス制限（`admin` ロールチェック）を行う。また、BAN検知時の強制ログアウトと `/banned` へのルーティングを保証する。
