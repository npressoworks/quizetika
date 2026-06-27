# Brief: quizetika-ui-discovery

## Problem
探索系 UI（ホーム、検索、ジャンル/タグ、リスト）は CSS Modules が多く（explore 14 コンポーネント、lists 4 コンポーネント）、カルーセル・フィルタチップ・アコーディオン等の独自実装が散在している。

## Current State
- `/` HomeDiscoveryClient（3 カルーセル）、`/search` SearchClient
- `components/explore/*`: QuizCarousel, GenreCarousel, ActiveFilterChips, ExploreSearchSection 等
- `/lists` ListsClient, ListDiscoveryCard
- Phase 22 の URL 状態 lib（search-url-state）連携済み

## Desired Outcome
- 探索・リスト画面が shadcn + Tailwind で再構築され、検索・フィルタ・カルーセル・タブ切替の機能が維持される
- 横スクロールカルーセル（scroll-snap）の UX が同等以上
- 関連 CSS Modules（~20 ファイル）が削除される

## Approach
shadcn Carousel（または scroll-snap + Tailwind）、Badge（フィルタチップ）、Tabs、Input（検索）、Card（クイズ/リストカード）を活用。ドメイン単位で strangler 移行し、各ルート完了時に E2E 更新。

## Scope
- **In**: ホーム、検索、ジャンル/タグ探索、リスト探索、explore/lists コンポーネント、route-level CSS Modules
- **Out**: シェル（layout-shell）、クイズ詳細/プレイ、Core API

## Boundary Candidates
- `src/app/page.tsx`, `home-discovery-client.tsx`, `home-discovery.module.css`
- `src/app/search/*`, `src/app/genres/*`, `src/app/tags/*`
- `src/app/lists/*`, `src/components/explore/*`, `src/components/lists/*`

## Out of Boundary
- クイズカードの詳細ページ（→ quiz-lifecycle）
- search-url-state lib のロジック変更

## Upstream / Downstream
- **Upstream**: quizetika-ui-layout-shell, quizetika-ui-foundation
- **Downstream**: quizetika-play-flow-ui / quizetika-lists-discovery-ui spec 更新

## Existing Spec Touchpoints
- **Extends**: quizetika-play-flow-ui, quizetika-lists-discovery-ui
- **Adjacent**: quizetika-core（API 再利用のみ）

## Constraints
- URL ↔ フィルタ状態の同期（Phase 22 契約）を維持
- カルーセルは新規 npm 依存追加を最小化（shadcn Carousel または CSS scroll-snap）
