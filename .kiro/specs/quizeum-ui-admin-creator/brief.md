# Brief: quizetika-ui-admin-creator

## Problem
管理画面（ユーザー管理、モデレーション）、クリエイターダッシュボード、コミュニティツール（ジャンル管理、マージ）は dense なテーブル/フォーム UI で CSS Modules が大きい（admin ~450 行 each, community/genres ~687 行）。

## Current State
- `/admin/users`, `/admin/moderation`
- `/creator/dashboard`
- `/community/genres`, `/community/merge`
- charts コンポーネント（analytics-chart, selection-pie）

## Desired Outcome
- 管理/クリエイター/コミュニティ UI が shadcn + Tailwind で再構築
- テーブル、フィルタ、モデレーションアクション、統計チャートが機能維持
- 管理者/モデレーター権限ガード（middleware + UI）が維持

## Approach
shadcn Table, DataTable パターン, Dialog（確認）, Badge（ステータス）, Chart（recharts または既存 chart を Tailwind ラップ）。admin は内部ユーザー向けのため視覚刷新の許容度はやや高いが機能は厳守。

## Scope
- **In**: admin pages, creator dashboard, community pages, charts コンポーネント, 関連 CSS Modules
- **Out**: 認可 middleware/API、reputation サービス

## Boundary Candidates
- `src/app/admin/*`, `src/app/creator/*`, `src/app/community/*`
- `src/components/charts/*`

## Out of Boundary
- Firestore admin API
- Stripe ダッシュボード連携

## Upstream / Downstream
- **Upstream**: quizetika-ui-layout-shell, quizetika-ui-foundation
- **Downstream**: quizetika-admin-users-ui, quizetika-moderation-governance-ui, quizetika-creator-dash-ui spec 更新

## Existing Spec Touchpoints
- **Extends**: quizetika-admin-users-ui, quizetika-moderation-governance-ui, quizetika-creator-dash-ui
- **Adjacent**: quizetika-core

## Constraints
- 管理者ルートの middleware 契約維持
- モデレーション操作の確認ダイアログ必須（誤操作防止）
