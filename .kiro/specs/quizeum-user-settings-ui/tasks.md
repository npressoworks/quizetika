# Implementation Plan

## 1. Foundation: テーマ定数とライブラリ
- [x] 1.1 `theme.ts` の実装
  - `Theme` 型、`THEME_STORAGE_KEY`（`quizeum-theme`）、`DEFAULT_THEME`（`dark`）を定義する
  - `parseTheme`、`readStoredTheme`、`writeStoredTheme` を実装し、不正値は `dark` にフォールバックする
  - inline script 用の `getThemeInitScript()` を export し、キー名・許可値が `theme.ts` と一致する文字列を返す
  - **完了状態**: Jest で valid/invalid/null の `parseTheme` と storage モックが検証できること
  - _Requirements: 3.1, 3.3, 3.4, 4.3_
  - _Boundary: theme.ts_

---

## 2. Core: ThemeProvider と layout 統合
- [x] 2.1 (P) `ThemeProvider` / `useTheme` の実装
  - `src/context/theme-context.tsx` に Context を新設し、`setTheme` で Context・`document.documentElement.dataset.theme`・`localStorage` を同期する
  - マウント時に `readStoredTheme()` で初期化し、inline script 適用後の DOM と一致させる
  - Provider 外の `useTheme` 呼び出しは throw する（`auth-context` と同型）
  - **完了状態**: クライアントコンポーネントから `setTheme('light')` で `data-theme` と storage が更新されること
  - _Requirements: 2.2, 2.3, 3.1, 3.2, 6.1, 6.2, 6.3_
  - _Boundary: ThemeProvider_
  - _Depends: 1.1_

- [x] 2.2 `layout.tsx` への ThemeProvider とフラッシュ防止 script の統合
  - `<html lang="ja" suppressHydrationWarning>` を設定する
  - `<head>` 内に `getThemeInitScript()` の inline script を配置し、React ハイドレーション前に `data-theme` を設定する
  - Provider 順序: `PostHogProvider` → `AuthProvider` → `ThemeProvider` → `LayoutWrapper`（シェル骨格は **sidebar-layout** 所有、本タスクは Provider / script のみ追加）
  - **完了状態**: ライト保存済み状態でリロードしても初回描画から `html[data-theme="light"]` が維持され、一瞬ダークに戻るフラッシュが目視で発生しないこと
  - _Requirements: 4.1, 4.2, 4.3, 6.1_
  - _Boundary: RootLayout（theme-only; sidebar-layout coordination）_
  - _Depends: 1.1, 2.1_

---

## 3. Styles: ライトトークンと globals 調整
- [x] 3.1 (P) `variables.css` のライト / ダークトークン整備
  - `:root`（ダーク）と `[data-theme='light']` のトークンを揃え、ライトでも紫アクセント（`--color-primary` 等）を維持する
  - 不足トークン（`--text-inverse`、`--border-glow`、`--shadow-neon-*` 等）をライト向けに補完する
  - 任意で `[data-theme='dark']` を明示し `:root` と同等値を設定する
  - **完了状態**: `data-theme` 切替で `--bg-main`・`--text-main` がダーク / ライトで切り替わること
  - _Requirements: 2.2, 2.3, 2.6, 2.7_
  - _Boundary: variables.css_

- [x] 3.2 (P) `globals.css` のテーマ依存スタイル調整（theme-only scope）
  - `body` 背景グラデーションのハードコード `rgba` を変数化、または `[data-theme='light']` 下で弱いグラデーションに上書きする
  - `.form-input:focus`、`.glass-card-hover:hover` 等のハードコード色を CSS 変数参照へ寄せ、ライトテーマで破綻しないようにする
  - Sidebar / シェルレイアウト用スタイルは変更しない（**sidebar-layout** 所有）
  - **完了状態**: ライトテーマ時に body 背景・glass-card が白基調で表示され、テキストが読めること
  - _Requirements: 2.6, 2.7_
  - _Boundary: globals.css（theme-only scope）_
  - _Depends: 3.1_

---

## 4. UI: 設定ページとテーマ切替コンポーネント
- [x] 4.1 (P) `ThemeToggle` コンポーネントの実装
  - ダーク / ライトを選択できる UI（ラジオまたはスイッチ）を `useTheme` に接続する
  - ルートに `data-testid="settings-theme-toggle"` を付与する
  - **完了状態**: トグル操作で `setTheme` が呼ばれ、選択状態が現在テーマと一致すること
  - _Requirements: 2.1, 2.4, 2.5_
  - _Boundary: ThemeToggle_
  - _Depends: 2.1_

- [x] 4.2 `/settings` ページシェルとクライアントページの実装
  - `settings/page.tsx`: タイトル「設定」、説明文、Suspense（bookmarks パターン）
  - `settings-client.tsx`: `data-testid="settings-page-container"`、「表示テーマ」セクション、`ThemeToggle` を配置
  - **完了状態**: `/settings` にアクセスすると日本語タイトルとテーマセクションが表示されること
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: SettingsPage_
  - _Depends: 4.1_

- [x] 4.3 プロフィール編集導線の追加
  - `useAuth` でログイン状態を判定し、ログイン時のみ `data-testid="settings-profile-edit-link"` で `/profile/edit` リンクを表示する
  - 未ログイン時はリンクを非表示にするかログイン誘導を表示する（フォーム本体は実装しない）
  - **完了状態**: ログインユーザーがリンククリックで `/profile/edit` に遷移できること
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: SettingsClient_
  - _Depends: 4.2_

---

## 5. Validation: テストと E2E
- [x] 5.1 (P) ユニット・コンポーネントテストの追加
  - `tests/lib/theme.test.ts`: parseTheme、storage ヘルパー
  - `tests/components/settings/theme-toggle.test.tsx`: 選択切替と `setTheme` 呼び出し
  - **完了状態**: 関連 Jest スイートがグリーンであること
  - _Requirements: 3.3, 3.4, 2.4_
  - _Boundary: Testing_
  - _Depends: 1.1, 4.1_

- [x] 5.2 Playwright E2E（ユーザー設定・テーマ）の実装
  - `/settings` 直接アクセスで `settings-page-container`・`settings-theme-toggle` を検証
  - ライト選択 → `html[data-theme="light"]` と `localStorage quizeum-theme === 'light'`
  - リロード後もライトが維持されること
  - ログインユーザーで `settings-profile-edit-link` → `/profile/edit` 遷移（Emulator シード使用）
  - **完了状態**: `e2e/user-settings.spec.ts` が CI / ローカルでパスすること
  - _Requirements: 1.2, 2.2, 2.5, 3.1, 3.2, 4.1, 5.2, 5.3_
  - _Boundary: Testing_
  - _Depends: 2.2, 4.3_

---

## Implementation Notes

- **Sidebar ポップアップ導線**: アカウントポップアップへの「設定」リンク（`data-testid="sidebar-settings-link"`）は **`quizeum-sidebar-layout`** が実装する。本スペックは `/settings` ルートとページを先に提供し、E2E は URL 直接アクセスで検証する。
- **layout.tsx coordination**: シェル構造（Sidebar / Header / BottomNav）は **quizeum-sidebar-layout** が所有。本スペックは `ThemeProvider` + inline script + Provider 順序のみ担当: `PostHogProvider` → `AuthProvider` → `ThemeProvider` → `LayoutWrapper`。
- **globals.css scope**: テーマ切替に必要なスタイルのみ（body 背景・フォーム focus 等）。シェル / ナビ CSS は sidebar-layout 所有。
- **既存 light プレースホルダー**: `variables.css` に `[data-theme='light']` が存在するため、新規追加より **整備・globals 連携** が主作業。
- **実装順**: 1.1 → 2.1（3.1 と並行可）→ 2.2 → 3.2 → 4.1 → 4.2 → 4.3 → 5.1（5.2 と並行可）→ 5.2。
- **モバイル**: BottomNav / Header からの設定到達は sidebar-layout Phase 23 方針に従う。本スペックはページ本体のみ。
