# Implementation Plan

## 1. Foundation: レイアウト基本構造の構築
- [x] 1.1 クライアントサイドレイアウトラッパーの構築
  - アプリケーション全体のパス（特に対象パス `/play`）を監視し、レイアウト状態を切り替えるラッパーコンポーネントを構築する。
  - パスに `/play` が含まれる場合はナビゲーション類（サイドバー、ヘッダー、ボトムナビ）を表示せず、余白も適用しない。
  - パスに `/play` が含まれない場合は、サイドバー, ヘッダー, ボトムナビ, および余白制御クラスを持つ基本の2カラム/ボトムレイアウトを描画する。
  - *検証結果*: クイズプレイパス（`/play/`）にアクセスした際、ナビゲーション用の表示枠やマージンが完全に排除され、全画面表示されること。
  - _Requirements: 1.6, 2.3, 3.3, 4.4_
  - _Boundary: LayoutWrapper_

- [x] 1.2 ルートレイアウトへのラッパー統合
  - アプリケーションのベースとなるルートレイアウトを修正し、新設したレイアウトラッパーでメインコンテンツを包む構成に変更する。
  - 従来のグローバルヘッダーの直接配置を排除し、ラッパー配下でレスポンシブ配置されるようにする。
  - *検証結果*: ローカル開発環境でアプリがエラーなしでビルド・起動し、表示が正常に行われること。
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: RootLayout_

---

## 2. Core: 主要ナビゲーションコンポーネントの実装
- [x] 2.1 (P) PC/タブレット用サイドバーの作成とレスポンシブスタイリング
  - デスクトップ幅（1024px以上）では幅 275px のテキストラベル付きサイドバーを表示し、タブレット幅（768px〜1023px）では幅 70px のアイコンのみのサイドバーを表示する。
  - モバイル幅（767px以下）ではサイドバーを完全に非表示にする。
  - *検証結果*: ブラウザ of 画面幅を伸縮させたとき、PC版（ラベルあり）とタブレット版（アイコンのみ）がブレークポイント（1024px, 768px）で正しく伸縮し、スマホサイズでは非表示になること。
  - _Requirements: 1.1, 1.2_
  - _Boundary: Sidebar_

- [x] 2.2 (P) サイドバーのメニュー動的表示とアバターポップアップの実装
  - 認証状態と現在のアクティブパスを監視し、メニュー項目を動的に切り替える。
  - 未ログイン時はログインボタンを表示し、ログイン時はホーム、通知、ブックマーク、作問、ダッシュボード等の各メニューを縦に並べる。現在のアクティブパスに合致するメニューをハイライトする。
  - フッター部分にログインユーザーのアバターと表示名を表示し、クリック時に上方向へ「マイページ」「ログアウト」などのポップアップを展開する。ログアウト押下時は認証サインアウト処理を実行し、ホーム画面へリダイレクトする。
  - *検証結果*: ログイン／未ログインの状態でサイドバーの表示項目が正しく出し分けられ、アクティブなパスがハイライトされ、ログアウト時にリダイレクト処理が成功すること。
  - _Requirements: 1.3, 1.4, 1.5_
  - _Boundary: Sidebar_

- [x] 2.3 (P) モバイル用ボトムナビゲーションの実装
  - モバイル幅（767px以下）において、画面最下部に固定される高さ約60pxのボトムナビゲーションを構築する。768px以上では非表示にする。
  - ログイン時はホーム、通知、ブックマーク、プロフィール（アバター）の4つの主要リンクを横並びで表示する。未ログイン時はホームリンクのみを表示する。
  - *検証結果*: スマホ表示時に画面下部にボトムバーが表示され、ログイン状態に応じて正しくリンクが切り替わること。
  - _Requirements: 2.1, 2.2_
  - _Boundary: BottomNav_

- [x] 2.4 (P) モバイル専用ミニヘッダーへの軽量化
  - 既存のグローバルヘッダーをリファクタリングし、PC用のナビゲーション、ログインアバターのドロップダウン、およびスライドドロワーメニューのコードを削除する。
  - 767px以下でのみ表示（768px以上は非表示）し、左端にロゴ、右端に「作問する（アイコン）」および「ユーザーアバター」を配置する。未ログイン時はログインリンクを表示する。
  - *検証結果*: PC表示で上部ヘッダーが表示されず、モバイル表示（767px以下）のみで上部にロゴとアバターを配置した最小限のヘッダーが固定表示されること。
  - _Requirements: 3.1, 3.2_
  - _Boundary: Header_

---

## 3. Integration: レイアウト結合と余白調整
- [x] 3.1 全体レスポンシブレイアウトのパディング調整
  - レイアウトラッパーおよびグローバルスタイルを修正し、表示されるナビゲーションのサイズに応じてメインコンテンツエリアのパディング（左・下）をレスポンシブに制御する。
  - 1024px以上では左パディング 275px、768px〜1023px では左パディング 70px、767px以下では下パディング 60px を適用。
  - 各画面（ホームページ、プロフィール等）の表示を確認し、ナビゲーションやコンテンツの重なり・スクロール崩れがないよう微調整を行う。
  - *検証結果*: PC、タブレット、モバイルの各シミュレータ環境で、コンテンツエリアがナビゲーションと重ならずに末尾まで正常にスクロール・操作できること。
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: LayoutWrapper_
  - _Depends: 2.1, 2.3, 2.4_

---

## 4. Validation: 検証とテスト
- [x] 4.1 Playwrightによるレイアウト＆ナビゲーションのE2Eテストの実装
  - デスクトップ（1200px）、タブレット（800px）、モバイル（375px）の各ビューポートで、対応するナビゲーション（Sidebar, BottomNav, Header）の表示・非表示、およびリンク遷移が動作するテストを記述する。
  - クイズプレイ画面（パスに `/play` を含む画面）において、すべてのナビゲーションが非表示になることをアサーションする。
  - *検証結果*: 新規追加・更新されたPlaywrightのレイアウトテストがローカル環境で100%パスすること。
  - _Requirements: 1.6, 2.3, 3.3, 4.4_
  - _Boundary: LayoutWrapper_
  - _Depends: 3.1_

- [x] 4.2 コンポーネント描画および状態出し分けの単体テストの追加
  - ログイン状態やパス変更時のコンポーネント出し分けに関する Jest コンポーネントテストを記述する。
  - *検証結果*: サイドバーおよびボトムナビの認証分岐に関する Jest テストスイートがパスすること。
  - _Requirements: 1.3, 1.4, 2.1, 2.2_
  - _Boundary: Sidebar, BottomNav_

---

## 5. Phase 22: ホーム／検索 IA 分離に伴うナビ更新（2026-06-09）

- [x] 5.1 サイドバーへの検索導線と active 判定
  - ホーム直後に「検索」（`/search`）メニュー項目を追加し、`Search` アイコンと `data-testid="nav-search"` を付与する
  - ホーム項目に `data-testid="nav-home"` を付与する
  - パスが `/` のときのみホームを active、`/search` のときのみ検索を active とし、両方同時ハイライトしないこと
  - **完了状態**: Sidebar から `/search` へ遷移でき、各パスで正しい項目のみ active になること
  - _Requirements: 1.1, 1.6, 1.7, 1.8, 1.9, 1.10, 5.1, 5.4_
  - _Boundary: Sidebar_

- [x] 5.2 ボトムナビへの検索導線と5アイコン配置
  - ログイン時: ホーム・検索・通知・ブックマーク・プロフィールの5リンクを均等配置する
  - 未ログイン時: ホーム・検索の2リンクを表示する
  - `data-testid="bottom-nav-home"`（`/`）と `data-testid="bottom-nav-search"`（`/search`）を付与する
  - `/` と `/search` でそれぞれ正しいリンクのみ active になること
  - **完了状態**: 375px 幅で5（または2）アイコンが表示され、検索タップで `/search` へ遷移すること
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 5.3, 5.5_
  - _Boundary: BottomNav_

- [x] 5.3 (P) Phase 22 ナビ更新のテスト
  - Sidebar / BottomNav の active 判定と検索リンク存在をコンポーネントテストで検証する
  - 既存レイアウト E2E に `/search` 遷移と active 状態のアサーションを追加する
  - **完了状態**: 関連 Jest / Playwright がグリーンであること
  - _Requirements: 5.2, 5.6_
  - _Depends: 5.1, 5.2_
  - _Boundary: Testing_

## Implementation Notes (Phase 22)

- 実装順: 5.1 と 5.2 は並行可。5.3 は両方完了後。
- ディスカバリーホーム・検索画面コンテンツは `quizeum-play-flow-ui` Phase 27 が担当。
- ロゴリンクは引き続き `/` を正とする（要件 5.2）。

---

## 6. Phase 23: リスト・マイクイズ・設定ナビ拡張（2026-06-09）

- [x] 6.1 サイドバーへのリスト・マイクイズ導線と active 判定
  - ログイン時のみ、ホーム・検索の直後（通知・ブックマークの前）に「リスト」（`/lists`）と「マイクイズ」（`/my-quiz`）を追加する（`List` / `ClipboardList` アイコン）
  - 未ログイン時は両項目を非表示とし、既存のログインボタン導線を維持する
  - `isNavItemActive` を拡張し、`/lists` および `/lists/` 配下（例: `/lists/create`）で「リスト」のみ active、`/my-quiz` および `/my-quiz/` 配下で「マイクイズ」のみ active とする
  - `data-testid="nav-lists"` と `data-testid="nav-my-quiz"` を付与する
  - **完了状態**: デスクトップ幅でログイン時に Sidebar から `/lists`・`/my-quiz` へ遷移でき、各パスで正しい項目のみ active になること
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7_
  - _Boundary: Sidebar_

- [x] 6.2 サイドバーアカウントポップアップへの設定リンク
  - フッターアカウントボタンで開くポップアップに、「マイページ」の直下・区切り線（`<hr>`）の上に「設定」（`/settings`）リンクを追加する（`Settings` アイコン、`data-testid="sidebar-settings-link"`）
  - クリック時は `/settings` へ遷移しポップアップを閉じる
  - `/settings` 表示中の Sidebar 主要ナビ active 化は初版では行わない（任意）
  - **完了状態**: ポップアップを開くと `sidebar-settings-link` が表示され、クリックで `/settings` へ遷移してポップアップが閉じること
  - _Requirements: 6.8, 6.9, 6.10, 6.11_
  - _Boundary: Sidebar_
  - _Depends: 6.1_

- [x] 6.3 (P) モバイル Header プロフィールポップアップ
  - 767px 以下かつログイン時、Header アバターの `<Link>` 直行を廃止し、Sidebar と同型のポップアップシート入口（`data-testid="header-profile-btn"`）に変更する
  - ポップアップ（`data-testid="header-profile-popup"`）にリスト・マイクイズ・マイページ・設定・ログアウトを表示し、到達先は Sidebar と同一ルート（`/lists`・`/my-quiz`・`/settings`・`/profile/${user.id}`）とする
  - `data-testid="header-nav-lists"`、`header-nav-my-quiz`、`header-settings-link` を付与する
  - BottomNav は 5 項目（ホーム・検索・通知・ブックマーク・プロフィール）のまま維持し、プロフィールタップは引き続きマイページ直行とする
  - **完了状態**: 375px 幅で Header アバタータップ → ポップアップから「リスト」「マイクイズ」「設定」へ遷移できること
  - _Requirements: 6.12, 6.13_
  - _Boundary: Header_

- [x] 6.4 (P) Phase 23 コンポーネントテスト（Sidebar / Header）
  - Sidebar: 未ログイン時 `nav-lists` / `nav-my-quiz` 不在、ログイン時表示・testid、`/lists`・`/lists/create`・`/my-quiz` での active、ポップアップ内 `sidebar-settings-link` の表示とクリック時閉じる挙動
  - Header: `header-profile-btn` → ポップアップ表示 → `header-nav-lists` / `header-nav-my-quiz` / `header-settings-link` の存在
  - **完了状態**: 関連 Jest コンポーネントテストがグリーンであること
  - _Requirements: 6.1, 6.2, 6.5, 6.6, 6.7, 6.8, 6.10, 6.12, 6.13_
  - _Depends: 6.1, 6.2, 6.3_
  - _Boundary: Testing_

- [x] 6.5 Phase 23 ナビ E2E 検証
  - Desktop: Sidebar「リスト」→ `/lists`、Sidebar ポップアップ「設定」→ `/settings` 遷移を Playwright で検証する
  - Mobile 375px: Header アバター → ポップアップ → 「マイクイズ」→ `/my-quiz` 遷移を検証する
  - BottomNav 5 項目維持・プロフィール直行の回帰を確認する
  - **完了状態**: 既存レイアウト E2E に Phase 23 アサーションが追加され、ローカルでパスすること
  - _Requirements: 6.3, 6.4, 6.9, 6.12, 6.13_
  - _Depends: 6.1, 6.2, 6.3_
  - _Boundary: Testing_

- [ ]* 6.5* Phase 23 E2E 拡張（任意・MVP 後）
  - 6.5 の Desktop / Mobile シナリオを CI 常時実行に組み込む、または `/lists/create` 子ルート active の E2E を追加する
  - **完了状態**: 6.5 コアシナリオが CI で安定してグリーンであること（本タスクは 6.5 完了後に実施可）
  - _Requirements: 6.5, 6.6_
  - _Depends: 6.5_
  - _Boundary: Testing_

## Implementation Notes (Phase 23)

- **実装順**: 6.1 と 6.3 は並行可。6.2 は 6.1 完了後。6.4 は 6.1–6.3 完了後。6.5 は 6.1–6.3 完了後（6.4 と並行可）。6.5* は任意。
- **BottomNav**: Phase 23 では変更なし。モバイルのリスト・マイクイズ・設定到達は Header ポップアップ（案 A）が担う。
- **layout.tsx**: `ThemeProvider` 統合は `quizeum-user-settings-ui` が担当。本フェーズでは `layout.tsx` を変更しない。
- **隣接スペック境界（タスク対象外）**: 6.14 リスト探索 UI（`quizeum-lists-discovery-ui`）、6.15 マイクイズ UI（`quizeum-my-quiz-ui`）、6.16 設定・ThemeProvider（`quizeum-user-settings-ui`）、6.17 マイページリアクション履歴削除（`quizeum-auth-profile-ui`）。
- **要件カバレッジ**: 6.1–6.13 を 6.1–6.5 にマッピング。6.14–6.17 は Out of scope として Implementation Notes に記録。

---

## 7. Phase 26: リストナビ項目の除去（2026-06-10）

- [x] 7.1 Sidebar および Header からリストナビを除去
  - `sidebar.tsx`: ログイン時 `menuItems` から「リスト」（`/lists`）を削除し、`List` アイコン import および `data-testid="nav-lists"` を除去する
  - `header.tsx`: プロフィールポップアップから「リスト」リンクおよび `data-testid="header-nav-lists"` を削除する
  - マイクイズ（`nav-my-quiz` / `header-nav-my-quiz`）・設定（`sidebar-settings-link` / `header-settings-link`）・マイページ・ログアウト導線は維持する
  - **完了状態**: ログイン状態で Sidebar／Header にリスト項目が表示されず、マイクイズ・設定へは従来どおり遷移できること
  - _Requirements: 7.1, 7.2, 7.3, 7.5, 7.6, 7.7_
  - _Boundary: Sidebar, Header_

- [x] 7.2 nav-active およびコンポーネントテストの更新
  - `nav-active.ts` に `/lists` 分岐が残存する場合は除去する
  - `sidebar.test.tsx`: `nav-lists` 存在・`/lists` active 検証を削除し、マイクイズ表示・active 検証を維持する
  - `header-profile-popup.test.tsx`: `header-nav-lists` 検証を削除し、マイクイズ・設定導線検証を維持する
  - `shell-smoke.test.tsx`: `nav-lists` 存在検証を削除する
  - `nav-active.test.ts`: `/lists` 関連ケースがあれば削除する
  - **完了状態**: 関連 Jest テストがグリーンであり、リストナビに関するアサーションが残っていないこと
  - _Requirements: 7.8, 7.9, 7.10, 7.11_
  - _Depends: 7.1_
  - _Boundary: Testing_

- [x] 7.3 E2E テストの更新
  - `e2e/layout.spec.ts`: Phase 23 の Sidebar「リスト」→ `/lists` 遷移シナリオが残存する場合は削除する
  - `e2e/layout.spec.ts`: 既存の Phase 26 `/lists` 404 検証を維持する
  - Header ポップアップからリストへ遷移する E2E があれば削除する
  - **完了状態**: レイアウト E2E がグリーンであり、ナビから廃止ルートへ遷移するテストが存在しないこと
  - _Requirements: 7.12_
  - _Depends: 7.1_
  - _Boundary: Testing_

- [x] 7.4 統合検証
  - デスクトップ（1200px）: ログイン後 Sidebar にリスト項目がなく、マイクイズ・設定ポップアップが機能することを手動または E2E で確認する
  - モバイル（375px）: Header ポップアップにリストがなく、マイクイズへ遷移できることを確認する
  - `/lists` 直接アクセスが 404 であること（他スペック Phase 26 と整合）を確認する
  - BottomNav 5 項目・プロフィール直行の回帰がないことを確認する
  - **完了状態**: Phase 26 ナビ除去が他スペックのリスト廃止と整合し、デッドリンクが存在しないこと
  - _Requirements: 7.1–7.12, 7.13–7.16_
  - _Depends: 7.1, 7.2, 7.3_
  - _Boundary: Integration_

## Implementation Notes (Phase 26)

- **実装順**: 7.1 完了後に 7.2・7.3 を並行可。7.4 は 7.1–7.3 完了後。
- **隣接スペック**: `/lists` ルート・ブックマークリストタブ・プロフィールリストタブは他スペックが除去済み。本フェーズはナビシェルのみ。
- **回帰注意**: Phase 23 のマイクイズ・設定 E2E（`header-nav-my-quiz`、 `sidebar-settings-link`）は維持する。
