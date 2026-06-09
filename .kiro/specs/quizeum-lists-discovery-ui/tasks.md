# Implementation Plan

## 1. Foundation: ルートとページシェルの構築
- [x] 1.1 `/lists` App Router ページシェルの作成
  - ブックマークページ（`bookmarks/page.tsx`）と同様に、戻るリンク・タイトル「リスト」・説明文・Suspense 境界を持つサーバーコンポーネントを新設する
  - ルートコンテナに `data-testid="lists-page-container"` を付与する
  - **完了状態**: `/lists` にアクセスすると日本語タイトルと説明が表示され、ビルドエラーがないこと
  - _Requirements: 1.1, 1.2, 1.4_
  - _Boundary: ListsPage_

- [x] 1.2 リスト探索用 CSS Modules のベース作成
  - ページコンテナ、タイトルセクション、グリッドレイアウトの基本スタイルを bookmarks / profile パターンに合わせて定義する
  - **完了状態**: 空の `ListsClient` をマウントしてもレイアウト崩れがないこと
  - _Requirements: 1.1_
  - _Boundary: ListsPage_

---

## 2. Core: データ取得フックと UI コンポーネント
- [x] 2.1 (P) `useListsSearch` フックの実装
  - `visibility`（`ListSearchVisibility`: public/private）、`keyword`、デバウンス（300ms）、`loading`/`error`/`retry` を管理する
  - `searchLists` を呼び出し、public では `{ visibility: 'public', keyword, limit: 50 }`、private では `{ visibility: 'private', authorId: userId, keyword, limit: 50 }` を渡す
  - private かつ未ログイン時は fetch しない
  - **完了状態**: Jest で public/private/keyword デバウンスの呼び出し契約が検証できること
  - _Requirements: 2.2, 2.3, 2.6, 3.2, 3.3, 3.5, 5.3, 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: useListsSearch_
  - _Depends: quizeum-core searchLists 実装（モックで先行開発可）_

- [x] 2.2 (P) 公開/非公開タブコンポーネントの実装
  - `BookmarksTabs` と同型のタブバーで「公開リスト」「非公開リスト」を切り替える
  - `data-testid="lists-tab-public"` / `lists-tab-private` を付与する
  - **完了状態**: タブクリックで active スタイルが切り替わり、親へ visibility 変更が通知されること
  - _Requirements: 2.1, 2.5_
  - _Boundary: ListsVisibilityTabs_

- [x] 2.3 (P) キーワード検索バーの実装
  - controlled input で親の `keyword` / `setKeyword` に接続する
  - `data-testid="lists-search-input"` を付与する
  - **完了状態**: 入力値がフック側デバウンス経由で fetch に反映されること
  - _Requirements: 3.1, 3.4_
  - _Boundary: ListsSearchBar_

- [x] 2.4 (P) リストカードとグリッドコンポーネントの実装
  - `ListDiscoveryCard`: 種別バッジ、タイトル、説明、収録件数、`/list/[id]` リンク、`data-testid="lists-discovery-card"`
  - `ListsGrid`: カード一覧、空状態（`lists-empty-state`）、エラー + 再試行 UI
  - `profile-list-display` ヘルパーを再利用する
  - **完了状態**: モックデータでグリッド・空状態・エラー表示が切り替わること
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 5.1, 5.2, 5.3, 5.4_
  - _Boundary: ListsGrid, ListDiscoveryCard_

---

## 3. Integration: クライアントページ統合
- [x] 3.1 `ListsClient` の組み立てと認証ガード
  - `useAuth` + `useListsSearch` を統合し、検索バー・タブ・グリッドを配置する
  - ローディング中はスケルトン（既存 `ListSkeleton` または同等）を表示する
  - 未ログインで非公開タブ選択時は `/login?redirect=/lists` へ誘導する
  - リスト作成リンク（`/list/create`）をページ内に配置する
  - **完了状態**: 公開タブで一覧表示、非公開タブでログイン誘導または本人未公開リスト表示、カードクリックで `/list/[id]` 遷移ができること
  - _Requirements: 1.3, 1.4, 2.3, 2.4, 3.2, 4.4_
  - _Boundary: ListsClient_
  - _Depends: 2.1, 2.2, 2.3, 2.4_

- [x] 3.2 ページシェルとクライアントの接続
  - `page.tsx` から `ListsClient` を Suspense 配下で読み込む
  - **完了状態**: `/lists` 端到端でタブ・検索・一覧が動作すること
  - _Requirements: 1.1, 1.2_
  - _Boundary: ListsPage_
  - _Depends: 1.1, 3.1_

---

## 4. Validation: テストと E2E
- [x] 4.1 (P) ユニット・コンポーネントテストの追加
  - `useListsSearch.test.ts`: visibility/keyword/debounce/retry
  - `lists-grid.test.tsx`: 空状態・エラー・カード件数
  - `lists-visibility-tabs` の active 切替
  - **完了状態**: 関連 Jest スイートがグリーンであること
  - _Requirements: 2.1, 2.5, 3.2, 5.1, 5.4, 6.2, 6.3_
  - _Boundary: Testing_
  - _Depends: 2.1, 2.2, 2.4_

- [x] 4.2 Playwright E2E（リスト探索）の実装
  - `/lists` 直接アクセスで公開タブ・検索バー表示を検証
  - ログインユーザーで非公開タブ切替（Emulator シードデータ使用）
  - カードクリック → `/list/[id]` 遷移
  - キーワード検索で結果変化または空状態
  - **完了状態**: `e2e/lists-discovery.spec.ts` が CI/ローカルでパスすること
  - _Requirements: 1.2, 2.2, 2.3, 3.1, 3.2, 4.4, 5.1_
  - _Boundary: Testing_
  - _Depends: 3.2_

---

## Implementation Notes

- **型名**: 公開/非公開区分は Core 契約 `ListSearchVisibility` を正とする。UI フックでは `ListsVisibility` をエイリアスとして使用可。
- **Core 依存**: タスク 2.1 は `quizeum-core` の `searchLists` 実装完了前でもモックで UI 開発可能。結合前に Core タスク完了を確認すること。
- **ナビ導線**: Sidebar「リスト」リンクは `quizeum-sidebar-layout` Phase 23 タスクが `/lists` 確定後に実装。本 E2E は URL 直接アクセスで検証。
- **実装順**: 2.1–2.4 は並行可 → 3.1 → 3.2 → 4.1（4.2 と並行可）→ 4.2。
- **モバイル**: BottomNav へのリスト追加は sidebar-layout design 次第。本スペックはページ本体のみ。
