# Requirements Document

## Project Description (Input)

Quizetika のエンドユーザーは、全画面のナビゲーション体験の基盤となるアプリシェル（Sidebar, Header, BottomNav, LayoutWrapper）を利用している。現状、これらは CSS Modules と旧 Quizetika ビジュアル（glass-card、ネオン色）で実装されており、Phase 24 の shadcn/ui + Tailwind 刷新方針と整合しない。

本スペック（`quizetika-ui-layout-shell`）は、`quizetika-ui-foundation` が提供する shadcn 標準テーマと共通プリミティブの上にシェルコンポーネントを再構築する。レスポンシブ挙動（PC 275px / タブレット 70px Sidebar、モバイル BottomNav 固定）、アクティブナビ判定、ログイン状態による表示切替、`/play` パスでのシェル非表示契約、既存 `data-testid` は維持する。各ページ本体、ThemeProvider 実装、BottomNav 項目の IA 変更、認証ロジックは範囲外とする。

## Introduction

Quizetika は Next.js 16 + React 19 のクイズ SNS である。Phase 22–23 で確立したハイブリッドレイアウト（PC Sidebar、モバイル Header + BottomNav）は `quizetika-sidebar-layout` スペックにより機能要件が満たされている。Phase 24 では UI 刷新の最初のユーザー可視スライスとして、シェルコンポーネントのみを shadcn 標準寄せのビジュアルに移行し、関連 CSS Modules を削除する。

本スペックは `quizetika-ui-foundation` に依存し、後続スペック（discovery, personal, quiz-lifecycle 等）がシェル内でページをレンダリングする前提を維持する。移行完了時に `e2e/layout.spec.ts` および関連 Jest テストがグリーンであることを要求する。

## Boundary Context

- **In scope**:
  - `LayoutWrapper`, `Sidebar`, `Header`, `BottomNav` の shadcn + Tailwind 再実装
  - レスポンシブ表示切替（1024px+ / 768–1023px / 767px-）と `/play` シェル非表示
  - 既存ナビゲーション IA・導線・アクティブ判定・ログイン状態表示の挙動維持
  - ライト/ダーク両テーマでの視認性・コントラスト確保（shadcn 標準パレット）
  - 既存 `data-testid` の維持
  - シェル関連 `.module.css` の削除
  - シェル単体 Jest テスト更新および E2E 回帰確認
- **Out of scope**:
  - 各ページ本体コンテンツ（discovery, personal, quiz-lifecycle 等）
  - `ThemeProvider` / `localStorage` 永続化ロジックの変更（`quizetika-ui-foundation` / `quizetika-user-settings-ui`）
  - 認証ロジック（`AuthProvider`, Firebase signOut）
  - BottomNav 項目の追加・削除・IA 変更
  - 未読通知バッジ等のリアルタイム更新
  - `variables.css` の完全削除（`css-modules-cleanup` 候補）
- **Adjacent expectations**:
  - `quizetika-ui-foundation` は Tailwind、shadcn テーマ、`cn()`、初期プリミティブ（Button, Card 等）を提供済みであること
  - `quizetika-sidebar-layout` で定義されたナビ導線・到達先ルート・アクティブ契約は本移行後も同一であること
  - `quizetika-sidebar-layout` スペックは本移行完了後に Tailwind 禁止条項を削除・更新する（roadmap 依存順）
  - `quizetika-user-settings-ui` は設定ページ本体とテーマ切替 UI を担当し、本スペックは Sidebar/Header ポップアップからの `/settings` 導線のみ維持する

## Requirements

### Requirement 1: レスポンシブシェル表示
**Objective:** As a ユーザー, I want 画面サイズに応じて適切なナビゲーション要素が表示されること, so that PC・タブレット・モバイルいずれでも迷わず操作できる。

#### Acceptance Criteria
1. While 画面幅が 1024px 以上かつパスに `/play` を含まないとき, the Layout Shell shall テキストラベル付き Sidebar を表示し、Header と BottomNav を非表示にする。
2. While 画面幅が 768px 以上 1023px 以下かつパスに `/play` を含まないとき, the Layout Shell shall アイコンのみの縮小 Sidebar を表示し、Header と BottomNav を非表示にする。
3. While 画面幅が 767px 以下かつパスに `/play` を含まないとき, the Layout Shell shall Header と BottomNav を表示し、Sidebar を非表示にする。
4. While パスに `/play` を含むとき, the Layout Shell shall Sidebar・Header・BottomNav をすべて非表示にし、ページコンテンツのみを全画面表示する。
5. The Layout Shell shall 非プレイ画面におけるブレークポイント（1024px / 768px / 767px）を既存シェルと同一に維持する。

### Requirement 2: デスクトップ・タブレット Sidebar ナビゲーション
**Objective:** As a デスクトップ・タブレットユーザー, I want Sidebar から既存と同じ導線で各機能へ遷移できること, so that UI 刷新後も操作習慣を維持できる。

#### Acceptance Criteria
1. The Sidebar Component shall ロゴ、ホーム（`/`）、検索（`/search`）、Proプラン（`/pricing`）を主要ナビに含める。
2. When ユーザーがログイン状態であるとき, the Sidebar Component shall 「リスト」（`/lists`）、「カスタムクイズ」（`/my-quiz`）、通知、ブックマーク、ダッシュボード、作問ボタンを表示する。
3. When ユーザーが未ログイン状態であるとき, the Sidebar Component shall ログイン専用ユーザー項目を非表示にし、ログインボタンを表示する。
4. When ログインユーザーがフッターのアカウントボタンを操作したとき, the Sidebar Component shall マイページ・設定・ログアウトを含むポップアップメニューを表示する。
5. While 現在のパスが各メニュー項目の対象ルートと一致するとき, the Sidebar Component shall 該当項目をアクティブ状態としてハイライト表示する（`/` と `/search` の相互排他を含む）。
6. While 現在のパスが `/lists` または `/list/` で始まるとき, the Sidebar Component shall 「リスト」項目をアクティブ表示する。
7. While 現在のパスが `/my-quiz` または `/my-quiz/` で始まるとき, the Sidebar Component shall 「カスタムクイズ」項目をアクティブ表示する。
8. The Sidebar Component shall 主要ナビ項目に既存の `data-testid`（`nav-home`, `nav-search`, `nav-lists`, `nav-my-quiz`）を維持する。
9. The Sidebar Component shall ポップアップ内設定リンクに `data-testid="sidebar-settings-link"`、アカウントボタンに `data-testid="sidebar-profile-btn"` を維持する。

### Requirement 3: モバイル Header と BottomNav
**Objective:** As a モバイルユーザー, I want 画面上部の軽量 Header と下部 BottomNav から主要画面へ遷移できること, so that 片手操作で快適にアプリを利用できる。

#### Acceptance Criteria
1. While 画面幅が 767px 以下であるとき, the Header Component shall ロゴ、作問ボタン（ログイン時）、ユーザーアバターまたはログインリンクを上部に表示する。
2. When ログインユーザーが Header のプロフィールボタンを操作したとき, the Header Component shall リスト・カスタムクイズ・マイページ・設定・ログアウトを含むポップアップを表示する。
3. The Header Component shall ポップアップに既存の `data-testid`（`header-profile-btn`, `header-profile-popup`, `header-nav-lists`, `header-nav-my-quiz`, `header-settings-link`）を維持する。
4. The Header Component shall 作問ボタンに `data-testid="mobile-header-create-btn"` を維持する。
5. While 画面幅が 767px 以下かつユーザーがログイン状態であるとき, the Bottom Navigation Component shall ホーム、検索、通知、ブックマーク、プロフィールを下部固定表示する。
6. While 画面幅が 767px 以下かつユーザーが未ログイン状態であるとき, the Bottom Navigation Component shall ホームと検索のみを下部固定表示する。
7. While 現在のパスが `/` または `/search` であるとき, the Bottom Navigation Component shall 対応リンクをアクティブ表示し、もう一方を非アクティブにする。
8. The Bottom Navigation Component shall 既存の `data-testid`（`bottom-nav-home`, `bottom-nav-search`, `bottom-nav-notifications`, `bottom-nav-bookmarks`, `bottom-nav-profile`）を維持する。

### Requirement 4: メインコンテンツ余白とスクロール
**Objective:** As a ユーザー, I want メインコンテンツがナビゲーションと重ならずスクロールできること, so that 情報を欠落なく閲覧できる。

#### Acceptance Criteria
1. While 画面幅が 1024px 以上かつ非プレイ画面であるとき, the Layout Shell shall メインコンテンツ左側に 275px の余白を確保する。
2. While 画面幅が 768px 以上 1023px 以下かつ非プレイ画面であるとき, the Layout Shell shall メインコンテンツ左側に 70px の余白を確保する。
3. While 画面幅が 767px 以下かつ非プレイ画面であるとき, the Layout Shell shall メインコンテンツ下部に 60px の余白を確保する。
4. While パスに `/play` を含むとき, the Layout Shell shall ナビゲーション用の追加余白を適用しない。
5. The Layout Shell shall メインコンテンツ領域の最大幅 1200px 中央寄せレイアウトを維持する。

### Requirement 5: shadcn 標準ビジュアルとテーマ対応
**Objective:** As a ユーザー, I want シェルが shadcn 標準のクリーンな見た目でライト/ダーク両方で視認できること, so that Phase 24 UI 刷新の一貫性を体感できる。

#### Acceptance Criteria
1. The Layout Shell shall 旧 Quizetika ビジュアル（glass-card、ネオン色クラス、Outfit ロゴスタイル）をシェルコンポーネントで使用しない。
2. When ライトモードが適用されているとき, the Layout Shell shall shadcn 標準ライトパレットで Sidebar・Header・BottomNav を表示する。
3. When ダークモードが適用されているとき, the Layout Shell shall shadcn 標準ダークパレットで Sidebar・Header・BottomNav を表示する。
4. Where アクティブナビ項目が表示される, the Layout Shell shall ライト/ダークいずれでも十分なコントラストでアクティブ状態を識別できる。
5. The Layout Shell shall シェルサーフェスに shadcn 標準の border と背景（`bg-background` / `border-border` 等）を用いる。

### Requirement 6: レガシースタイル削除と構造維持
**Objective:** As a 開発者, I want シェル関連 CSS Modules が削除され DOM 契約が維持されること, so that 後続ドメインスライスが Tailwind 正の基盤の上に実装できる。

#### Acceptance Criteria
1. When 本スペックの実装が完了したとき, the Layout Shell shall `src/components/layout/` 配下の `.module.css` ファイルをすべて削除する。
2. The Layout Shell shall `layout-wrapper.tsx` が `LayoutWrapper` として `src/app/layout.tsx` の Provider ツリー内で引き続き使用される構造を維持する。
3. The Layout Shell shall シェルコンポーネントのセマンティック要素（`aside`, `header`, `nav`, `main`）を維持する。
4. While ナビリンクがアクティブ状態であるとき, the Layout Shell shall リンク要素の `class` 属性に `active` 部分文字列を含める（既存 E2E セレクタ互換）。
5. The Layout Shell shall `data-analytics` 属性（`nav-create-quiz`, `nav-login`, `auth-logout`）を既存配置から削除しない。

### Requirement 7: 回帰テストと品質維持
**Objective:** As a オペレーター, I want シェル移行後も既存テストが通過すること, so that 機能退行なく UI 刷新をリリースできる。

#### Acceptance Criteria
1. When 本スペックの実装がマージされたとき, the Layout Shell shall `e2e/layout.spec.ts` がグリーンである。
2. When 本スペックの実装がマージされたとき, the Layout Shell shall 既存 Jest テストスイート（`layout-wrapper.test.tsx` 等）がグリーンである。
3. When 本スペックの実装がマージされたとき, the Layout Shell shall `npm run build` と `npm run lint` が新規エラーなく成功する。
4. The Layout Shell shall 既存ルート・認可・ナビゲーション到達先を変更しない。
