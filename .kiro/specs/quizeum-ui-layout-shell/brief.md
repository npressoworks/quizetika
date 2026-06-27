# Brief: quizetika-ui-layout-shell

## Problem
アプリシェル（Sidebar, Header, BottomNav, LayoutWrapper）は CSS Modules で実装されており、全画面のナビゲーション体験の基盤。UI 刷新の最初のユーザー可視スライスとして、shadcn 基盤の上に再構築する必要がある。

## Current State
- `layout-wrapper.tsx`: PC Sidebar + モバile Header/BottomNav、`/play` ではシェル非表示
- `sidebar.module.css` (~289 行), `header.module.css`, `bottom-nav.module.css`
- アカウントポップアップに設定・ログアウト等
- Phase 23 で「リスト」「カスタムクイズ」ナビ追加済み

## Desired Outcome
- シェルコンポーネントが shadcn + Tailwind で再実装され、レスポンシブ挙動（275px/70px Sidebar、BottomNav 固定）が維持される
- アクティブナビ判定、ログイン状態による表示切替が機能維持
- ライト/ダーク両テーマで視認性・コントラストが確保される

## Approach
foundation の Button, Sheet（モバイルメニュー）, Avatar, Separator 等を使用。Tailwind で flex/grid/固定配置を再現。CSS Modules を削除し、E2E `layout.spec.ts` で回帰確認。

## Scope
- **In**: LayoutWrapper, Sidebar, Header, BottomNav, 関連 CSS Modules 削除
- **Out**: 各ページ本体、ThemeProvider（foundation）、BottomNav 項目の IA 変更

## Boundary Candidates
- `src/components/layout/*`
- `layout-wrapper.module.css` 削除

## Out of Boundary
- ページコンテンツ（discovery, personal 等）
- 認証ロジック（AuthProvider）

## Upstream / Downstream
- **Upstream**: quizetika-ui-foundation
- **Downstream**: 全ページ（シェル内レンダリング）、quizetika-sidebar-layout spec 更新

## Existing Spec Touchpoints
- **Extends**: quizetika-sidebar-layout
- **Adjacent**: quizetika-user-settings-ui（設定ポップアップ導線）

## Constraints
- `/play` パスでのシェル非表示契約を維持
- 既存 `data-testid` を可能な限り維持
