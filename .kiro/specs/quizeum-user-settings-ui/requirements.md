# Requirements Document

## Introduction
Quizeum ユーザーは表示テーマ（ダーク / ライト）などのアプリ設定を変更したいが、現状は Sidebar フッターのアカウントポップアップに「マイページ」「ログアウト」のみで、**設定画面もテーマ切替も存在しない**。アプリは `variables.css` のダークトークン固定で、ライトモード用の定義はプレースホルダー程度であり、`layout.tsx` にテーマ Provider もない。
本スペックでは `/settings` ルートに設定ページを新設し、`ThemeProvider` と `localStorage`（キー `quizeum-theme`）によるダーク / ライト切替、初回描画時のテーマちらつき防止、およびプロフィール編集（`/profile/edit`）への導線を提供する。Sidebar アカウントポップアップへの「設定」リンクは `quizeum-sidebar-layout` が `/settings` ルート確定後に追加する。

## Boundary Context
- **In scope**:
  - `ThemeProvider` / `useTheme` によるクライアントテーマ状態管理
  - `<html data-theme="dark|light">` 属性による CSS 変数切替
  - `localStorage` キー `quizeum-theme` への永続化とリロード後の復元
  - 初回描画・リロード時のテーマフラッシュ防止（inline script または同等の同期初期化）
  - `variables.css` のライトトークン整備、`globals.css` のテーマ依存スタイル調整
  - `/settings` ページ（テーマ切替 UI、プロフィール編集リンク）
  - Jest ユニットテスト、Playwright E2E（テーマ切替・永続化）
- **Out of scope**:
  - Sidebar / BottomNav / Header のアカウントポップアップへの「設定」項目追加（`quizeum-sidebar-layout`）
  - プロフィール編集フォーム本体（`quizeum-auth-profile-ui` / `/profile/edit`）
  - サーバー側ユーザー設定同期（Firestore 等）
  - `prefers-color-scheme` によるシステム設定追従（follow-up）
  - 通知・言語・アクセシビリティ設定
  - Tailwind 導入
- **Adjacent expectations**:
  - `quizeum-sidebar-layout` が Sidebar フッターアカウントポップアップに「設定」リンク（`/settings`）を追加し、既存「マイページ」「ログアウト」と同型の `popupItem` パターンで配置すること
  - モバイル BottomNav / Header のプロフィール導線からの設定到達は sidebar-layout の Phase 23 方針に従う（初版は Sidebar ポップアップ優先）
  - `docs/screen_transition.md` への `/settings` 追記は Phase 23 直接実装候補が担当

## Requirements

### Requirement 1: 設定ページの基本表示
**Objective:** As a ユーザー, I want 専用の設定ページにアクセスできること, so that アプリ設定を一箇所で確認・変更できる。

#### Acceptance Criteria
1. When ユーザーが `/settings` にアクセスしたとき, the Settings Page shall ページタイトル「設定」と説明文を日本語で表示する。
2. The Settings Page shall ルートコンテナに `data-testid="settings-page-container"` を付与する。
3. The Settings Page shall 既存レイアウト（Sidebar / BottomNav 等）内に表示し、プレイ画面（`/play`）と同様の没入モードには入らない。
4. The Settings Page shall ページ内に「表示テーマ」セクションを表示する。

### Requirement 2: ダーク / ライトテーマの切り替え
**Objective:** As a ユーザー, I want ダークモードとライトモードを切り替えられること, so that 好みの表示環境でアプリを利用できる。

#### Acceptance Criteria
1. The Settings Page shall ダークモードとライトモードを選択できるテーマ切替 UI（トグルまたはラジオ形式）を表示する。
2. When ユーザーがライトモードを選択したとき, the Theme System shall `<html>` 要素に `data-theme="light"` を設定し、アプリ全体の CSS 変数がライトトークンに切り替わる。
3. When ユーザーがダークモードを選択したとき, the Theme System shall `<html>` 要素に `data-theme="dark"` を設定し、アプリ全体の CSS 変数がダークトークンに切り替わる。
4. When テーマが切り替わったとき, the Settings Page shall 切替 UI の選択状態が現在のテーマと一致する。
5. The Settings Page shall テーマ切替 UI に `data-testid="settings-theme-toggle"` を付与する。
6. The Theme System shall Tailwind を使用せず、CSS 変数（`variables.css`）のみでテーマを表現する。
7. The Theme System shall ライトテーマでも Quizeum のブランド感（紫アクセント等）を維持する。

### Requirement 3: テーマ設定の永続化
**Objective:** As a ユーザー, I want 選択したテーマがリロード後も維持されること, so that 毎回設定し直す必要がない。

#### Acceptance Criteria
1. When ユーザーがテーマを変更したとき, the Theme System shall `localStorage` キー `quizeum-theme` に `dark` または `light` を保存する。
2. When ユーザーがアプリを再読み込みしたとき, the Theme System shall `localStorage` の `quizeum-theme` を読み取り、保存値に応じて `data-theme` を復元する。
3. If `localStorage` に有効なテーマ値が存在しないとき, the Theme System shall デフォルトテーマとして `dark` を適用する。
4. If `localStorage` に `dark` / `light` 以外の値が保存されているとき, the Theme System shall デフォルトテーマ `dark` を適用し、不正値を上書きまたは無視する。

### Requirement 4: テーマフラッシュの防止
**Objective:** As a ユーザー, I want ページ読み込み時に一瞬だけ別テーマが表示されないこと, so that 快適な視覚体験を損なわない。

#### Acceptance Criteria
1. When ページの初回 HTML 描画が行われる前, the Theme System shall `localStorage` の `quizeum-theme` を同期的に読み取り `<html data-theme>` を設定する。
2. While React のクライアントハイドレーションが完了する前, the Theme System shall 初回描画時のテーマがユーザー保存値と一致する。
3. The Theme System shall テーマ初期化の失敗時（`localStorage` 不可等）にデフォルト `dark` を適用し、アプリの表示を継続する。

### Requirement 5: プロフィール編集への導線
**Objective:** As a ログインユーザー, I want 設定ページからプロフィール編集へ遷移できること, so that 表示名・自己紹介の変更を設定と関連付けて行える。

#### Acceptance Criteria
1. When ログインユーザーが設定ページを表示したとき, the Settings Page shall プロフィール編集（`/profile/edit`）へのリンクまたはボタンを日本語ラベルで表示する。
2. When ユーザーがプロフィール編集リンクをクリックしたとき, the Settings Page shall `/profile/edit` へ遷移する。
3. The Settings Page shall プロフィール編集リンクに `data-testid="settings-profile-edit-link"` を付与する。
4. When 未ログインユーザーが設定ページを表示したとき, the Settings Page shall プロフィール編集リンクを表示しない、またはログイン誘導を表示する（プロフィール編集フォーム本体の実装は範囲外）。
5. The Settings Page shall プロフィール編集フォームの入力・保存ロジックを実装してはならない。

### Requirement 6: グローバルテーマ Provider
**Objective:** As a 開発者, I want テーマ状態がアプリ全体で一貫すること, so that 任意のコンポーネントから現在テーマを参照・変更できる。

#### Acceptance Criteria
1. The Theme System shall `layout.tsx` 配下で `ThemeProvider` を提供し、子コンポーネントがテーマコンテキストにアクセスできる。
2. The Theme System shall `useTheme` フックで現在テーマ（`dark` | `light`）と `setTheme` 関数を返す。
3. When `setTheme` が呼び出されたとき, the Theme System shall `data-theme` 属性、`localStorage`、および React コンテキスト状態を同期更新する。
