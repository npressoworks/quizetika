# Requirements Document

## Project Description (Input)

Quizetika のエンドユーザーは、ホーム・検索・ジャンル/タグ探索・リスト探索画面を通じてクイズやリストを発見している。現状、これらの探索系 UI は CSS Modules が多く（`explore` 14 コンポーネント、`lists` 4 コンポーネント）、カルーセル・フィルタチップ・アコーディオン等の独自実装が散在しており、Phase 24 の shadcn/ui + Tailwind 刷新方針と整合しない。

本スペック（`quizetika-ui-discovery`）は、`quizetika-ui-foundation` と `quizetika-ui-layout-shell` の上に探索・リスト画面を shadcn 標準寄せのビジュアルで再構築する。検索・フィルタ・カルーセル・タブ切替・無限スクロール等の機能、Phase 22 の URL 状態（`search-url-state`）との同期、既存 `data-testid` は維持する。シェル、クイズ詳細/プレイ、`search-url-state` ライブラリのロジック変更、Core API は範囲外とする。

## Introduction

Quizetika は Next.js 16 + React 19 のクイズ SNS である。Phase 22 でホームディスカバリー（3 カルーセル）と検索 URL 状態管理が確立され、Phase 23 でリスト探索（`/lists`）が追加された。Phase 24 では UI 刷新のドメイン垂直スライスとして、探索系画面を strangler パターンで Tailwind + shadcn に移行し、関連 CSS Modules を削除する。

本スペックは `quizetika-ui-layout-shell` に依存し、シェル内 `main` でページを描画する前提を維持する。移行完了時に `e2e/home-discovery.spec.ts`、`e2e/quiz-search.spec.ts`、`e2e/lists-discovery.spec.ts` および関連 Jest テストがグリーンであることを要求する。`quizetika-play-flow-ui` と `quizetika-lists-discovery-ui` は本移行完了後に design 更新が必要（roadmap 依存順）。

**Phase 26（2026-06-10）**: リスト機能完全廃止に伴い、本スペックの Phase 24 移行スコープから **リスト探索（`/lists`）・リスト詳細（`/list/[id]`）・`src/components/lists/*`** を除外する（要件 11 参照）。要件 5・6 および要件 9・10 のリスト関連部分は **廃止**。`quizetika-lists-discovery-ui` は **obsolete**。

## Boundary Context

- **In scope**:
  - ホーム（`/`）ディスカバリー（3 セクション・カルーセル・もっと見る導線）
  - 検索画面（`/search`）の検索バー・タブ・フィルタ・アコーディオン・フィード・無限スクロール
  - ジャンル探索（`/genres/[genreName]`）とタグ探索（`/tags/[tagName]`）
  - リスト探索（`/lists`）のタブ・検索バー・グリッド・カード
  - リスト詳細（`/list/[id]`）ページと `list.module.css` の Tailwind 移行
  - `src/components/explore/*` および `src/components/lists/*` の再実装
  - 探索ルート関連の route-level CSS Modules 削除（`home-discovery.module.css`、`lists.module.css`、`explore/*.module.css` 等）
  - 探索画面が参照する `page.module.css` クラスの Tailwind 置換（ファイル自体は未移行ドメインのため残存可）
  - 横スクロールカルーセルの UX 維持（scroll-snap 等）
  - 既存 `data-testid` の維持
  - 探索関連 E2E・Jest 回帰確認
- **Out of scope**:
  - シェル（Sidebar / Header / BottomNav / LayoutWrapper）（`quizetika-ui-layout-shell`）
  - クイズ詳細・プレイ・結果画面（`quizetika-ui-quiz-lifecycle`）
  - リスト作成・編集（`/list/create`, `/list/[id]/edit`）（`quizetika-ui-editor`）
  - `QuizCard` 本体の全面再設計（既存コンポーネント再利用。スタイル調整は本スペック内の利用箇所に限定）
  - `lib/search-url-state.ts` および `useSearchUrlState` のロジック変更
  - Core API / Firestore / 認可ロジック変更
  - ブックマーク・設定・カスタムクイズ等の未移行ドメインが依存する `page.module.css` 残存クラスの削除
  - `variables.css` の完全削除
- **Adjacent expectations**:
  - `quizetika-ui-foundation` は Tailwind、shadcn テーマ、`cn()`、初期プリミティブ（Button, Input, Tabs, Badge, Card, Skeleton 等）を提供済みであること
  - `quizetika-ui-layout-shell` はシェル chrome を提供済みであること
  - Phase 22 の URL ↔ フィルタ状態契約（`tab`, `genreId`, `openFilters`, `playStatus` 等）は変更しないこと
  - `quizetika-play-flow-ui` / `quizetika-lists-discovery-ui` は本移行完了後に design を更新する（roadmap 既存 spec update 候補）

## Requirements

### Requirement 1: ホームディスカバリー画面
**Objective:** As a ユーザー, I want トップページでおすすめクイズ・おすすめジャンル・新着クイズの 3 セクションを閲覧できること, so that ログイン前でも興味のあるコンテンツを素早く発見できる。

#### Acceptance Criteria
1. When ユーザーが `/` にアクセスしたとき, the Discovery UI shall おすすめクイズ・おすすめジャンル・新着クイズの 3 セクションを表示する。
2. The Discovery UI shall ホーム画面に検索 UI（検索入力・ソートタブ）を表示しない。
3. When 各セクションの「もっと見る」を操作したとき, the Discovery UI shall 対応する検索画面 URL（トレンドタブ / 新着タブ / フィルタ展開付き）へ遷移する。
4. When ジャンルカードを操作したとき, the Discovery UI shall ジャンルフィルタ付きの検索画面へ遷移する。
5. The Discovery UI shall 各セクションと「もっと見る」リンクに既存の `data-testid`（`home-discovery-trending`, `home-discovery-genres`, `home-discovery-latest`, `discovery-see-more-*`）を維持する。
6. While 初期データ読み込み中であるとき, the Discovery UI shall スケルトン表示（`home-discovery-page-skeleton`）を提供する。

### Requirement 2: 検索画面の探索フィード
**Objective:** As a ユーザー, I want 検索画面でキーワード・タブ・フィルタを組み合わせてクイズを探索できること, so that 目的に合ったクイズを効率的に見つけられる。

#### Acceptance Criteria
1. When ユーザーが `/search` にアクセスしたとき, the Discovery UI shall 検索バー・ソートタブ（人気順 / トレンド / 新着順）・クイズフィードを表示する。
2. When ユーザーがソートタブを切り替えたとき, the Discovery UI shall フィードの並び順を切り替え、URL の `tab` パラメータと同期する。
3. When ユーザーがキーワードを入力したとき, the Discovery UI shall タイトル・説明・作成者・タグに基づく検索結果を表示し、該当なしの場合は空状態メッセージを表示する。
4. When ユーザーがフィルターボタンを操作したとき, the Discovery UI shall 難易度・問題数・プレイ状況・ジャンル・フォーマット等のフィルタ UI を展開する。
5. When フィルタが適用されているとき, the Discovery UI shall アクティブフィルタチップ（`search-active-filters`）を表示し、個別解除および一括クリアを可能にする。
6. While フィード末尾がビューポートに近づいたとき, the Discovery UI shall 追加クイズを読み込む（無限スクロール）。
7. The Discovery UI shall 検索画面の主要 UI に既存の `data-testid`（`search-page`, `search-search-bar-sticky`, `search-feed-skeleton`, `search-active-filters` 等）を維持する。

### Requirement 3: 検索 URL 状態の維持
**Objective:** As a ユーザー, I want 検索条件が URL と同期されること, so that ブックマーク・共有・ブラウザ戻る/進むで同じ探索状態を復元できる。

#### Acceptance Criteria
1. The Discovery UI shall Phase 22 で確立した URL パラメータ契約（`tab`, `genreId`, `format`, `openFilters`, `playStatus`, タグチップ等）を変更しない。
2. When ユーザーがフィルタ・タブ・プレイ状況を変更したとき, the Discovery UI shall URL を `router.replace` で更新し、ページ全体のリロードを発生させない。
3. When ユーザーが URL 付きで検索画面に直接アクセスしたとき, the Discovery UI shall URL からフィルタ・タブ状態を復元してフィードを表示する。
4. When ホームの「もっと見る」やジャンルカードから遷移したとき, the Discovery UI shall 遷移先 URL の状態に応じたフィルタ・タブ・パネル展開を反映する。

### Requirement 4: ジャンル・タグ探索画面
**Objective:** As a ユーザー, I want ジャンル名またはタグ名の専用探索画面で絞り込み検索できること, so that 特定トピックのクイズを深掘りできる。

#### Acceptance Criteria
1. When ユーザーが `/genres/[genreName]` にアクセスしたとき, the Discovery UI shall 該当ジャンルにロックされた探索 UI とクイズフィードを表示する。
2. When ユーザーが `/tags/[tagName]` にアクセスしたとき, the Discovery UI shall 該当タグにロックされた探索 UI とクイズフィードを表示する。
3. When ジャンルまたはタグ探索画面でソートタブを切り替えたとき, the Discovery UI shall フィードの並び順を切り替える。
4. The Discovery UI shall ジャンル探索の検索セクションに `genre-explore-search` 等の既存 `data-testid` を維持する。

### Requirement 5: リスト探索画面 — **Phase 26 で全体廃止**
**Objective:** As a ユーザー, I want 公開リストを探索し、ログイン時は非公開リストも閲覧できること, so that キュレーションされたクイズ集合を発見・管理できる。

#### Acceptance Criteria
1. When ユーザーが `/lists` にアクセスしたとき, the Discovery UI shall 公開リストタブ・キーワード検索バー・リストグリッドを表示する。
2. When ユーザーが公開/非公開タブを切り替えたとき, the Discovery UI shall 対応するリスト一覧を表示する。
3. When 未ログインユーザーが非公開タブを選択したとき, the Discovery UI shall ログインページへリダイレクトする。
4. When キーワードを入力したとき, the Discovery UI shall デバウンス後にリスト検索を実行する。
5. When リストが存在しないとき, the Discovery UI shall 空状態（`lists-empty-state`）を表示する。
6. The Discovery UI shall リスト探索 UI に既存の `data-testid`（`lists-page-container`, `lists-tab-public`, `lists-tab-private`, `lists-search-input`, `lists-discovery-card`, `lists-empty-state`）を維持する。

### Requirement 6: リスト詳細画面（`/list/[id]`） — **Phase 26 で全体廃止**
**Objective:** As a ユーザー, I want リスト詳細を shadcn 標準 UI で閲覧しプレイを開始できること, so that 探索導線から到達したリストの内容を快適に確認できる。

#### Acceptance Criteria
1. When ユーザーが `/list/[id]` にアクセスしたとき, the Discovery UI shall リストタイトル・説明・カバー画像・作成者情報を表示する。
2. When `listType` がクイズリストであるとき, the Discovery UI shall 収録クイズのカード一覧とリスト連続プレイ開始導線を表示する。
3. When `listType` が問題リストであるとき, the Discovery UI shall 収録問題の順序付き一覧（問題文抜粋・親クイズタイトル）と「問題リストプレイ開始」ボタン（`data-testid="question-list-play-start"`）を表示する。
4. When ログインユーザーが当該リストの作成者であるとき, the Discovery UI shall 「リストを編集する」導線（`/list/[id]/edit`）を表示する。
5. When 指定 ID のリストが存在しないとき, the Discovery UI shall 空状態メッセージとトップへ戻る導線を表示する。
6. The Discovery UI shall リスト詳細画面で旧 Quizetika ビジュアル（`btn btn-primary`, glass-card、ネオン色クラス）を使用しない。
7. When 本スペックの実装が完了したとき, the Discovery UI shall `src/app/list/[id]/list.module.css` を削除する。

### Requirement 7: 横スクロールカルーセル UX
**Objective:** As a ユーザー, I want クイズ・ジャンル・フォーマットの横スクロールカルーセルを快適に操作できること, so that 多数の候補をコンパクトに閲覧できる。

#### Acceptance Criteria
1. The Discovery UI shall ホームおよび検索画面の横スクロールカルーセルで scroll-snap によるスナップスクロールを提供する。
2. When カルーセルに複数アイテムがあるとき, the Discovery UI shall 横方向のオーバーフロースクロールを可能にする。
3. While カルーセルデータ読み込み中であるとき, the Discovery UI shall スケルトンカルーセル（`quiz-carousel-skeleton`, `genre-carousel-skeleton`）を表示する。
4. The Discovery UI shall カルーセルに既存の `data-testid`（`quiz-carousel`, `genre-carousel`, `format-carousel`, `genre-carousel-card-*`, `format-carousel-card-*`）を維持する。

### Requirement 8: shadcn 標準ビジュアルとテーマ対応
**Objective:** As a ユーザー, I want 探索画面が shadcn 標準のクリーンな見た目でライト/ダーク両方で視認できること, so that Phase 24 UI 刷新の一貫性を体感できる。

#### Acceptance Criteria
1. The Discovery UI shall 旧 Quizetika ビジュアル（glass-card、ネオン色クラス、`btn btn-accent` 等のレガシーグローバルクラス）を探索画面で使用しない。
2. When ライトモードが適用されているとき, the Discovery UI shall shadcn 標準ライトパレットで探索 UI を表示する。
3. When ダークモードが適用されているとき, the Discovery UI shall shadcn 標準ダークパレットで探索 UI を表示する。
4. Where フィルタチップ・アクティブタブ・カードが表示される, the Discovery UI shall ライト/ダークいずれでも十分なコントラストで状態を識別できる。
5. The Discovery UI shall 検索入力・タブ・バッジ・カード・アコーディオンに shadcn プリミティブ（Input, Tabs, Badge, Card, Accordion 等）および Tailwind ユーティリティを用いる。

### Requirement 9: レガシースタイル削除と構造維持
**Objective:** As a 開発者, I want 探索関連 CSS Modules が削除されデータフローと DOM 契約が維持されること, so that 後続ドメインスライスとスタイル基盤が一貫する。

#### Acceptance Criteria
1. When 本スペックの実装が完了したとき, the Discovery UI shall `src/components/explore/` 配下の `.module.css` ファイルをすべて削除する。
2. When 本スペックの実装が完了したとき, the Discovery UI shall `home-discovery.module.css`、`src/app/lists/lists.module.css`、`src/components/lists/lists.module.css`、`src/app/list/[id]/list.module.css` を削除する。
3. The Discovery UI shall 探索ルートのデータ取得フック（`useSearchUrlState`, `useExploreQuizFeed`, `useListsSearch` 等）とサービス呼び出し契約を変更しない。
4. The Discovery UI shall 既存ルートパス（`/`, `/search`, `/genres/*`, `/tags/*`, `/lists`, `/list/[id]`）を変更しない。

### Requirement 10: 回帰テストと品質維持
**Objective:** As a オペレーター, I want 探索 UI 移行後も既存テストが通過すること, so that 機能退行なく UI 刷新をリリースできる。

#### Acceptance Criteria
1. When 本スペックの実装がマージされたとき, the Discovery UI shall `e2e/home-discovery.spec.ts` がグリーンである。
2. When 本スペックの実装がマージされたとき, the Discovery UI shall `e2e/quiz-search.spec.ts` がグリーンである。
3. When 本スペックの実装がマージされたとき, the Discovery UI shall `e2e/lists-discovery.spec.ts` がグリーンである。
4. When 本スペックの実装がマージされたとき, the Discovery UI shall `npm run build` と `npm run lint` が新規エラーなく成功する。
5. When 本スペックの実装がマージされたとき, the Discovery UI shall 既存 Jest テスト（`search-url-state` 等）がグリーンである。

---

## Phase 26: リスト探索の移行スコープ除外（2026-06-10）

**Phase 26（2026-06-10）**: `quizetika-core` Phase 26 によるリスト機能完全廃止に伴い、本スペックの Phase 24 移行スコープから **リスト探索（`/lists`）・リスト詳細（`/list/[id]`）・`src/components/lists/*`** を除外します。要件 5・6 および要件 9・10 のリスト関連部分は本フェーズで **廃止** します。ホーム・検索・ジャンル/タグ探索（`src/components/explore/*`）の shadcn 移行成果は維持します。

### 要件 11: リスト関連移行スコープの除外（Phase 26）
**Objective:** As a 開発者, I want Phase 24 探索 UI 移行の所有境界からリスト画面を除外すること, so that 廃止済み機能の再実装・保守対象が残らない。

#### Acceptance Criteria
1. The Discovery UI shall [`/lists` ルートおよび `/list/[id]` 詳細ルートを本スペックの In scope から除外する]。
2. The Discovery UI shall [`src/components/lists/*` を本スペックの所有コンポーネントから除外し、**obsolete（廃止済み）** とする]。
3. When [Phase 26 以降に本スペックを参照するとき], the [Discovery UI] shall [リスト探索・リスト詳細の Tailwind/shadcn 移行を要求してはならない（要件 5・6 は履歴参照のみ）]。
4. When [リスト関連ルート・コンポーネントの物理削除が必要なとき], the [Discovery UI] shall [実装責務を `quizetika-play-flow-ui` Phase 26 および `quizetika-core` Phase 26 に委譲すること]。
5. The [Discovery UI] shall [`e2e/lists-discovery.spec.ts` を本スペックの回帰対象から除外する（削除は play-flow-ui Phase 26 が担当）]。

**境界・隣接**
6. The [Discovery UI] shall [ホーム（`/`）・検索（`/search`）・ジャンル/タグ探索の移行成果および `src/components/explore/*` の所有を維持すること]。
7. The [Discovery UI] shall [`quizetika-lists-discovery-ui` スペック全体を **obsolete** とし、リスト探索 UI の正本としないこと]。
8. The [Discovery UI] shall [`useListsSearch`・`searchLists` 等のリスト API 契約を本スペックで定義・維持してはならない]。
