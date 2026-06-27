# Research & Design Decisions: quizetika-ui-discovery

## Summary
- **Feature**: `quizetika-ui-discovery`
- **Discovery Scope**: Extension（既存探索 UI のスタイル層 strangler 移行）
- **Key Findings**:
  - `explore` 14 コンポーネント + `lists` 4 コンポーネントが CSS Modules 依存。7 つの `.module.css` が `explore/` に存在し、`explore-carousel.module.css` は 6 コンポーネントで共有
  - `page.module.css`（411 行）は search / genres / tags / home container が参照。bookmarks / settings / my-quiz / grid-skeleton も依存しており**全面削除不可**
  - Phase 22 の `useSearchUrlState` + `lib/search-url-state` が検索・ホーム導線の URL 契約の正。ロジック変更は out-of-boundary
  - shadcn Carousel は `embla-carousel-react` 依存を追加。brief の「npm 依存最小化」方針により **CSS scroll-snap + Tailwind** を採用
  - 既存 E2E: `home-discovery.spec.ts`（5 ケース）、`quiz-search.spec.ts`（複数）、`lists-discovery.spec.ts`（2 ケース）。`data-testid` 維持が必須

## Research Log

### 既存コンポーネント構成
- **Context**: 移行対象ファイルと責務の洗い出し
- **Sources Consulted**: `src/components/explore/*`, `src/components/lists/*`, `src/app/*-client.tsx`
- **Findings**:
  - ホーム: `HomeDiscoveryClient` + 3 カルーセル（QuizCarousel, GenreCarousel）+ `home-discovery.module.css`
  - 検索: `SearchClient` が `ExploreSearchSection`, `ActiveFilterChips`, `QuizCard`, `GridSkeleton` を編成。`page.module.css` 依存
  - ジャンル/タグ: `GenreExploreClient` / `TagExploreClient` が `ExploreSearchSection` + `ExploreSortTabs` + フィードを共有
  - リスト: `ListsClient` + `ListsVisibilityTabs`, `ListsSearchBar`, `ListsGrid`, `ListDiscoveryCard`
  - 認証連携: ブックマーク toggle（`QuizCarousel`, `SearchClient`）、未ログイン時 `/login` リダイレクト（リスト非公開タブ）
- **Implications**: 共有コンポーネント（`ExploreSearchSection`, カルーセル群）を先に移行し、ルートクライアントは後段でスタイル接続する順序が最適

### カルーセル実装方式
- **Context**: brief は shadcn Carousel または scroll-snap を許容。新規 npm 依存最小化
- **Sources Consulted**: [shadcn/ui Carousel](https://ui.shadcn.com/docs/components/carousel)（embla-carousel-react 依存）、既存 `explore-carousel.module.css`（scroll + flex レイアウト）
- **Findings**:
  - 既存実装は CSS `overflow-x: auto` + flex gap で横スクロール。scroll-snap は未使用だが追加容易
  - shadcn Carousel は Embla ラッパーで API が異なり、既存 `data-testid` DOM 構造変更リスクあり
  - 矢印ボタンは現行 UX に存在しない（タッチ/ホイールスクロール主体）
- **Implications**: `HorizontalScrollCarousel` 共有プリミティブ（scroll-snap + Tailwind）を新設。shadcn Carousel / embla は不採用

### page.module.css 共有問題
- **Context**: 1 ファイルに探索・ブックマーク・設定等のスタイルが混在
- **Sources Consulted**: `grep page.module.css` 全参照、`page.module.css` 内容
- **Findings**:
  - 探索専用クラス: `searchSection`, `searchBarSticky`, `tabBar`, `exploreCarouselBlock`, `quickSearch` 等
  - 他ドメイン依存: `grid`, `card`, `backBtn`（bookmarks, lists, settings）、`grid-skeleton` が `cardGrid` 使用
  - `QuizCard` は独自スタイル（`quiz-card` コンポーネント内）— 本スペックでは外観微調整のみ
- **Implications**: 探索コンポーネントから `page.module.css` import を除去。ファイルは未移行ドメインのため残存。探索専用クラスは参照ゼロ化を目標（クラス定義の物理削除は `quizetika-ui-personal` 等完了後の cleanup 候補）

### URL 状態契約
- **Context**: Phase 22 契約維持が hard constraint
- **Sources Consulted**: `src/lib/search-url-state.ts`, `src/hooks/useSearchUrlState.ts`, `tests/lib/search-url-state.test.ts`
- **Findings**:
  - `buildSearchUrlQuery` / `parseSearchUrlState` が tab, filters, openFilters, playStatus を管理
  - ホーム「もっと見る」は `buildSearchUrlQuery` で URL 生成（E2E で検証済み）
- **Implications**: フックと lib は untouched。UI 層のみ props/コールバック経由で既存 API を呼ぶ

### shadcn 追加プリミティブ
- **Context**: foundation は Button, Input, Tabs, Badge, Card, Skeleton, Dialog を提供。探索は Accordion（フィルタパネル）が必要
- **Sources Consulted**: `explore-accordion.tsx`, `explore-accordions-panel.tsx`, foundation design
- **Findings**:
  - 現行アコーディオンは独自 `<button>` + CSS transition
  - shadcn Accordion（Radix）でアクセシビリティ向上可能
  - UnifiedSearchField / GenreSearchField は shadcn Input + Popover パターンが適合（Popover は foundation 未提供 → 本 spec で `popover` add 検討）
- **Implications**: `accordion`, `popover` を shadcn CLI add。Input/Badge/Tabs/Card/Skeleton は foundation 再利用

## Architecture Pattern Evaluation

| Option                         | Description                                      | Strengths                | Risks / Limitations      | Notes                       |
| ------------------------------ | ------------------------------------------------ | ------------------------ | ------------------------ | --------------------------- |
| Strangler（採用）              | コンポーネント単位で CSS Modules → Tailwind 置換 | リスク分散、E2E 段階確認 | 短期混在                 | layout-shell と同一パターン |
| 一括 page.module.css 削除      | 探索完了時にファイル全削除                       | シンプル                 | bookmarks/settings 破綻  | **却下**                    |
| shadcn Carousel                | Embla ベース                                     | 公式パターン             | 新依存、DOM 変更         | brief 方針で **却下**       |
| scroll-snap + Tailwind（採用） | 軽量横スクロール                                 | 零追加依存、既存 UX 近似 | 矢印ナビなし（現行同等） | 既存に矢印なし              |

## Design Decisions

### Decision: 横スクロールは scroll-snap 共有コンポーネント
- **Context**: カルーセル UX 維持 + npm 依存最小化
- **Alternatives Considered**:
  1. shadcn Carousel（embla-carousel-react）
  2. CSS scroll-snap + Tailwind ラッパー
- **Selected Approach**: `HorizontalScrollCarousel` を `src/components/explore/horizontal-scroll-carousel.tsx` に新設。`snap-x snap-mandatory overflow-x-auto` + gap を Tailwind で定義
- **Rationale**: 既存 DOM/testid 構造を維持しやすく、新依存なし
- **Trade-offs**: プログラム的 scrollTo 等は未提供（現行も未使用）
- **Follow-up**: E2E でカルーセル可視性を確認

### Decision: page.module.css は参照除去のみ
- **Context**: 複数ドメイン共有ファイル
- **Alternatives Considered**:
  1. 探索用に `discovery-page.module.css` を分割新設
  2. 探索コンポーネントを Tailwind 化し import 除去（ファイル残存）
- **Selected Approach**: 2 を採用。探索ルート・コンポーネントから import をゼロにする
- **Rationale**: 未移行ドメインへの影響ゼロ。brief の「~20 CSS Modules 削除」は explore/lists/home 専用ファイルで充足
- **Trade-offs**: `page.module.css` 物理削除は後続 cleanup へ委譲
- **Follow-up**: `grid-skeleton.tsx` の `page.module.css` 依存を Tailwind 化（検索画面で使用）

### Decision: ドメイン移行順序
- **Context**: 共有コンポーネントの依存グラフ
- **Selected Approach**: Foundation（Accordion/Popover）→ 共有 explore 部品 → ホーム → 検索 → ジャンル/タグ（並列）→ リスト（並列）→ CSS 削除 → E2E
- **Rationale**: `ExploreSearchSection` が search/genres/tags で共有されるため先行移行が必須
- **Follow-up**: 各ルート完了時に関連 E2E をグリーン確認

## Risks & Mitigations
- **E2E class 依存** — `quiz-search.spec.ts` が `text=人気順` 等テキストセレクタ使用。shadcn Tabs 移行後もラベル文言維持で緩和
- **Sticky 検索バー z-index** — シェル Header（z-index）との競合。`z-40` 等で layout-shell 契約を尊重（シェル z-50 想定）
- **page.module.css 残存クラス孤立** — 探索参照除去後も dead code 残る。`css-modules-cleanup` 候補として記録、本 spec では削除しない
- **QuizCard 外観** — 旧 glass スタイル残存。探索画面内で親ラッパーのみ shadcn 化し、QuizCard 全面移行は quiz-lifecycle へ委譲

## References
- `.kiro/specs/quizetika-ui-foundation/design.md` — 基盤プリミティブ、テーマ bridge
- `.kiro/specs/quizetika-ui-layout-shell/design.md` — シェル境界、レスポンシブ余白
- `.kiro/steering/roadmap.md` Phase 24 — shadcn 標準寄せ、strangler 方針
- `e2e/home-discovery.spec.ts`, `e2e/quiz-search.spec.ts`, `e2e/lists-discovery.spec.ts` — 回帰契約
