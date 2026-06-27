# Brief: quizeum-ui-personal

## Problem
個人向け画面（プロフィール、ブックマーク、通知、設定、カスタムクイズ、ログイン、料金）が CSS Modules で分散実装されており、フォーム・タブ・グリッド等のパターンが shadcn プリミティブに統一されていない。

## Current State
- `/profile/*`, `/bookmarks`, `/notifications`, `/settings`, `/my-quiz`, `/login`, `/pricing`
- `ThemeToggle` は CSS Modules + `data-theme`
- Phase 23 でカスタムクイズ・設定・テーマ切替実装済み

## Desired Outcome
- 個人ハブ全画面が shadcn + Tailwind で再構築
- テーマ切替（ライト/ダーク）が settings から正常動作
- カスタムクイズの 4 ソースフィルタ・出題設定・プレイ開始が機能維持
- ブックマーク/プロフィール/通知のタブ・グリッド UI が統一感を持つ

## Approach
shadcn Tabs, Form, Select, Switch（テーマ）, Table（カスタムクイズ）等を使用。settings の ThemeToggle を foundation テーマ bridge と統合。

## Scope
- **In**: profile, bookmarks, notifications, settings, my-quiz, login, pricing 関連コンポーネントと CSS Modules
- **Out**: シェル、クイズプレイ、エディタ、Core セッション lib

## Boundary Candidates
- `src/app/profile/*`, `src/app/bookmarks/*`, `src/app/notifications/*`
- `src/app/settings/*`, `src/app/my-quiz/*`, `src/app/login/*`, `src/app/pricing/*`
- `src/components/profile/*`, `src/components/bookmark/*`, `src/components/my-quiz/*`
- `src/components/settings/*`, `src/components/pricing/*`

## Out of Boundary
- プレイ画面起動後の UI（→ quiz-lifecycle）
- Firestore データ取得ロジック

## Upstream / Downstream
- **Upstream**: quizeum-ui-layout-shell, quizeum-ui-foundation
- **Downstream**: quizeum-auth-profile-ui, quizeum-my-quiz-ui, quizeum-user-settings-ui, quizeum-billing-subscription-ui spec 更新

## Existing Spec Touchpoints
- **Extends**: quizeum-auth-profile-ui, quizeum-my-quiz-ui, quizeum-user-settings-ui, quizeum-billing-subscription-ui
- **Adjacent**: quizeum-core（my-quiz-session）

## Constraints
- カスタムクイズ: 非公開クイズ問題は自作ソースのみ（Phase 23 契約維持）
- テーマ: localStorage 永続化維持
