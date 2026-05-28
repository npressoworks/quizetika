# Brief: quizeum-moderation-governance-ui

## Problem
不適切なコンテンツに対する管理者向けの審査キューを提供し、また表記揺れタグや新規ジャンルのマージ・申請をコミュニティ内で自律的にガバナンス（合意形成・投票）するための専用のモデレーションUIが必要です。

## Current State
通報アトミック加算や自動非公開、モデレータ投票、ジャンル承認のFirestoreサービスやビジネスロジック（`ModerationService`）は存在しますが、これらを実行・可視化するための管理者・モデレータ向け画面はありません。

## Desired Outcome
管理者ロールやモデレータ資格を持つユーザーが、安全かつ円滑にプラットフォームの健全性とタグ・ジャンル管理を統制・自治できる、直感的でセキュアなガバナンスUIを提供すること。

## Approach
Next.js App Routerでの専用パス（`/admin/*`, `/community/*`）を構築し、セッション内のユーザー権限（`moderationTier`）に応じたアクセス制限（ガード）と、投票進行状況や可決状況のインタラクティブな表示（プログレスバー等）を実装します。

## Scope
- **In**:
  - 管理者モデレーション画面 (`/admin/moderation`): 不適切通報（5回到達で保留）されたクイズ、リスト、プロフィールの審査キュー表示。通報理由と詳細内容の確認、「公開復帰」または「永久非公開/削除」のモデレーションアクション実行UI。審査対象クイズの特別検証ビュー。
  - タグ/ジャンルマージリクエスト画面 (`/community/merge`): モデレータによるマージ提案の起案フォーム。現在保留中（pending）のリクエスト一覧表示。賛成/反対の加重投票機能（シニアモデレータの重みx2表示）、賛成率のプログレスバー表示。
  - ジャンル新設申請・投票画面 (`/community/genres`): 認証済みユーザーによる新ジャンル申請フォーム（ID、日本語名、PNG/SVGアタッチメント）。保留中の申請一覧表示、モデレータ投票UI、可決時の自動システム反映通知、承認/否決履歴タブ。
- **Out**:
  - 一般ユーザー向けのプレイ・探索画面。

## Boundary Candidates
- `src/app/admin/moderation/page.tsx`
- `src/app/community/merge/page.tsx`
- `src/app/community/genres/page.tsx`

## Out of Boundary
- コアのモデレーションルールや通知の自動トリガー処理（`quizeum-core` が担当）。

## Upstream / Downstream
- **Upstream**: `quizeum-creator-dash-ui`, `quizeum-core`
- **Downstream**: なし（ロードマップの最終Wave）

## Existing Spec Touchpoints
- **Extends**: `quizeum-core` の `ModerationService` およびデータモデル。
- **Adjacent**: `quizeum-auth-profile-ui` (プロフィール上の reputationScore やティアーバッジ表示)

## Constraints
- **Role Guard**: `moderationTier` などの権限ティアーに基づいて、一般ユーザーによるアクセスを厳格に制限（403または404フォールバック）する。
- **Styling**: 洗練されつつも気軽に利用できる統一デザイン。
