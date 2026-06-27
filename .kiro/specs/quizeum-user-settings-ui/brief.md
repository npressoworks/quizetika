# Brief: quizetika-user-settings-ui

## Problem
ユーザーは表示テーマ（ダーク/ライト）などのアプリ設定を変更したいが、現状はアカウントポップアップに「マイページ」「ログアウト」のみで、**設定画面もテーマ切替も存在しない**。アプリは `variables.css` のダークトークン固定で、ライトモード用の定義がない。

## Current State
- Sidebar フッターのアカウントポップアップ: マイページ / ログアウト（`sidebar.tsx`）
- `/profile/edit`: 表示名・自己紹介のみ
- `src/styles/variables.css`: `:root` にダーク/neon トークンのみ
- `layout.tsx` に ThemeProvider なし

## Desired Outcome
- アカウントアイコン（Sidebar ポップアップ）から「設定」で `/settings` に遷移できる
- 設定画面でダーク / ライトテーマを切り替えられる
- 選択はリロード後も維持される（`localStorage`、キー例: `quizetika-theme`）
- プロフィール編集への導線を設定内に配置できる

## Approach
`ThemeProvider`（React Context）を `layout.tsx` 直下に追加。初回マウント時に `localStorage` を読み `<html data-theme="dark|light">` を設定。`variables.css` に `[data-theme="light"]` ブロックでライト用トークンを定義（既存ダークは `:root` または `[data-theme="dark"]` を維持）。設定ページはテーマトグル＋プロフィール編集リンクのシンプル構成。Sidebar ポップアップへの「設定」リンクは `quizetika-sidebar-layout` と本スペックで同期。

## Scope
- **In**: `/settings` ページ、`ThemeProvider`、`useTheme` hook、ライトトークン CSS、テーマ切替 UI、localStorage 永続化、フラッシュ防止（script または useLayoutEffect）、E2E
- **Out**: サーバー側ユーザー設定同期、システム設定追従（`prefers-color-scheme` のみ follow-up）、通知・言語・アクセシビリティ設定

## Boundary Candidates
- テーマ状態管理と CSS トークン（本スペック + globals）
- 設定ページ UI
- ナビポップアップ導線（`quizetika-sidebar-layout` との shared seam）

## Out of Boundary
- プロフィール編集フォーム本体（`quizetika-auth-profile-ui` / `/profile/edit`）
- 課金・通知設定

## Upstream / Downstream
- **Upstream**: `layout.tsx`, `variables.css`, `globals.css`
- **Downstream**: 全画面の見た目一貫性（glass-card、neon 等のライト版調整）

## Existing Spec Touchpoints
- **Extends**: なし（新規スペック）
- **Adjacent**: `quizetika-sidebar-layout`（ポップアップ「設定」項目）、`quizetika-auth-profile-ui`（プロフィール編集リンク）

## Constraints
- Tailwind 不使用。CSS 変数のみでテーマ切替
- ライトテーマも Quizetika のブランド感（紫アクセント）を維持
- SSR 時のテーマちらつき防止必須
- 日本語 UI
