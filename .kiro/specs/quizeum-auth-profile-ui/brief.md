# Brief: quizeum-auth-profile-ui

## Problem
ユーザーがquizeumにアクセスした際、セキュアにログインし、自分や他人のプロフィール、つながり（フォロー関係）、獲得したバッジ、通知、および過去のリアクション履歴を確認できる基盤となるUIが必要です。

## Current State
`src/app/login/page.tsx` などの初期テンプレートは存在しますが、完全なUI統合や、プロフィール・ソーシャル関係・通知一覧などの他の画面は存在しません。

## Desired Outcome
ユーザーがGoogle認証でログインでき、洗練されつつも親しみやすいプロフィール画面（称号バッジや権限ティアーバッジ、退会処理中時のフォールバック表示を含む）、フォロー/フォロワー一覧、通知一覧、リアクション履歴をスムーズに確認・操作できること。

## Approach
Next.js App Router と CSS Modules を用いた、シンプルでカジュアルモダンなUI実装。既存の `UserService` を呼び出し、データを画面に結合します。

## Scope
- **In**:
  - 認証画面 (`/login`): Google認証によるログイン・アカウント登録UI。ログイン済みユーザーは `/` にリダイレクト。
  - プロフィール画面 (`/profile/[uid]`): 表示名、自己紹介、フォロー/フォロワー数、称号バッジ一覧、権限ティアー表示、投稿したクイズ/リストのタブ表示、退会保留中アカウントアクセス時の404フォールバック。
  - プロフィール編集画面 (`/profile/edit`): 表示名（最大30文字）と自己紹介（最大200文字）の変更フォーム。
  - フォロー/フォロワー一覧画面 (`/profile/[uid]/connections`): つながりの確認とダイレクトなフォロートグル。
  - 通知一覧画面 (`/notifications`): アクティビティ通知（フォロー、指摘修正完了等）の時系列表示。
  - リアクション履歴画面 (`/profile/[uid]/likes`): 自分が送った / もらったリアクション（お礼・いいね）の履歴。
- **Out**:
  - クイズのプレイや作成などの別スコープの画面。

## Boundary Candidates
- `src/app/login/page.tsx`
- `src/app/profile/[uid]/page.tsx`
- `src/app/profile/edit/page.tsx`
- `src/app/profile/[uid]/connections/page.tsx`
- `src/app/notifications/page.tsx`
- `src/app/profile/[uid]/likes/page.tsx`

## Out of Boundary
- Firestore セキュリティルールやバックエンドのバッジ付与処理（`quizeum-core` が担当）。

## Upstream / Downstream
- **Upstream**: `quizeum-core` (Firestoreスキーマ、`UserService`)
- **Downstream**: `quizeum-play-flow-ui`

## Existing Spec Touchpoints
- **Extends**: `quizeum-core` の `UserService` をUIから結合します。
- **Adjacent**: `quizeum-play-flow-ui` (プロフィール画面から弱点克服プレイへの動線等)

## Constraints
- **Design style**: 洗練されつつも親しみやすいカジュアルモダンなUI（角丸、暖かい色調）。
- **Performance**: ページの初期ロードや画面遷移が軽快であること。
