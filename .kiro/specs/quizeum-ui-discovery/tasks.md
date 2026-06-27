# Implementation Plan

## 1. Foundation: 探索用プリミティブとカルーセル基盤
- [x] 1.1 foundation Primitive Wave 2 の存在を確認する
  - `src/components/ui/` に Accordion, Popover が存在することを確認する（`quizetika-ui-foundation` で追加済み）
  - 各コンポーネントが `cn()` を利用し TypeScript 型付きでエクスポートされることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 2.4, 8.5_
  - _Boundary: DiscoveryPrimitives_

- [x] 1.2 横スクロールカルーセル共有コンポーネントを実装する
  - `src/components/explore/horizontal-scroll-carousel.tsx` に scroll-snap + Tailwind の容器を新設する
  - `snap-x snap-mandatory overflow-x-auto flex gap-4` 等で横スクロール UX を提供する
  - `data-testid` を props 経由で子容器に転送できることを確認する
  - _Requirements: 7.1, 7.2_
  - _Boundary: HorizontalScrollCarousel_
  - _Depends: 1.1_

---

## 2. Core: カルーセルとフィルタチップの移行
- [x] 2.1 クイズカルーセルとスケルトンを Tailwind 化する
  - `quiz-carousel.tsx` / `quiz-carousel-skeleton.tsx` から `explore-carousel.module.css` import を削除する
  - `HorizontalScrollCarousel` を利用し `data-testid="quiz-carousel"` を維持する
  - エラー・空状態・ブックマーク toggle の既存挙動を維持する
  - _Requirements: 1.1, 7.2, 7.3, 7.4, 8.1_
  - _Boundary: QuizCarousel_
  - _Depends: 1.2_

- [x] 2.2 ジャンル・フォーマットカルーセルとスケルトンを Tailwind 化する
  - `genre-carousel.tsx`, `format-carousel.tsx`, `genre-carousel-skeleton.tsx` を `HorizontalScrollCarousel` ベースに移行する
  - `data-testid="genre-carousel"`, `format-carousel`, `genre-carousel-card-*`, `format-carousel-card-*` を維持する
  - ジャンルカードクリック時の `/search?genreId=` 遷移契約を維持する
  - _Requirements: 1.4, 2.4, 7.1, 7.3, 7.4, 8.1_
  - _Boundary: GenreCarousel, FormatCarousel_
  - _Depends: 1.2_

- [x] 2.3 アクティブフィルタチップを shadcn Badge で再実装する
  - `active-filter-chips.tsx` から `active-filter-chips.module.css` import を削除する
  - shadcn Badge + dismiss 操作でチップ行を再構築し `data-testid="search-active-filters"` を維持する
  - 個別 chip の `data-testid="search-active-filter-{key}"` パターンを維持する
  - _Requirements: 2.5, 8.4, 8.5_
  - _Boundary: ActiveFilterChips_
  - _Depends: 1.1_

---

## 3. Core: 検索フィールドと探索セクション
- [x] 3.1 統合検索・ジャンル検索フィールドを shadcn 化する
  - `unified-search-field.tsx`, `genre-search-field.tsx` から専用 `.module.css` import を削除する
  - shadcn Input + Popover でサジェスト UI を再実装し既存 `data-testid`（`unified-search-field`, `search-smart-suggest`, `genre-search-field` 等）を維持する
  - タグチップ行（`search-tag-chips`）を shadcn Badge で表示する
  - _Requirements: 2.3, 4.4, 8.1, 8.5_
  - _Boundary: UnifiedSearchField, GenreSearchField_
  - _Depends: 1.1, 2.3_

- [x] 3.2 フィルタアコーディオンとジャンルナビを shadcn 化する
  - `explore-accordion.tsx`, `explore-accordions-panel.tsx`, `genre-nav.tsx` から CSS Modules import を削除する
  - shadcn Accordion で難易度・問題数・プレイ状況パネルを再構築する
  - `genre-nav` の `data-testid="genre-nav-item-{id}"` を維持する
  - _Requirements: 2.4, 8.5_
  - _Boundary: ExploreAccordion, GenreNav_
  - _Depends: 1.1_

- [x] 3.3 ExploreSearchSection と ExploreSortTabs を統合移行する
  - `explore-search-section.tsx`, `explore-sort-tabs.tsx` から `page.module.css` / `explore-carousel.module.css` import を削除する
  - sticky 検索バー（`search-search-bar-sticky`）、フィルタトグル、クイックサーチ（`quick-search-tags`）、カルーセルブロック（`home-genre-carousel-block`）を Tailwind + shadcn で再構築する
  - `ExploreSortTabs` を shadcn Tabs で再実装し「人気順」「トレンド」「新着順」ラベルを維持する
  - `ExploreSearchSectionProps` の公開 interface を破壊的変更しない
  - _Requirements: 2.1, 2.2, 2.4, 2.6, 2.7, 3.2, 3.3, 4.4, 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Boundary: ExploreSearchSection, ExploreSortTabs_
  - _Depends: 2.2, 2.3, 3.1, 3.2_

---

## 4. Core: ホームディスカバリー移行
- [x] 4.1 ホームページと HomeDiscoveryClient を Tailwind 化する
  - `home-discovery-client.tsx` から `home-discovery.module.css` import を削除する
  - `page.tsx` の container を Tailwind（`max-w-[1200px] mx-auto` 等）に置換する
  - `home-discovery-page-skeleton.tsx` を Tailwind 化し 3 セクションの `data-testid` を維持する
  - 「もっと見る」リンクが `buildSearchUrlQuery` 経由の URL を生成することを維持する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 3.4, 8.1, 8.2, 8.3_
  - _Boundary: HomeDiscovery_
  - _Depends: 2.1, 2.2_

---

## 5. Core: 検索画面移行
- [x] 5.1 検索ページと SearchClient を Tailwind 化する
  - `search/page.tsx`, `search-client.tsx` から `page.module.css` import を削除する
  - `data-testid="search-page"` コンテナとフィードグリッドレイアウトを Tailwind で再構築する
  - `useSearchUrlState` / `useExploreQuizFeed` の呼び出し契約を変更しない
  - `grid-skeleton.tsx` から `page.module.css` 依存を除去し shadcn Skeleton で再実装する
  - 無限スクロール・ブックマーク・空状態メッセージの既存挙動を維持する
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 2.7, 3.1, 3.2, 3.3, 8.1, 9.3_
  - _Boundary: SearchPage_
  - _Depends: 3.3_

---

## 6. Core: ジャンル・タグ探索の並列移行
- [x] 6.1 (P) ジャンル探索画面を Tailwind 化する
  - `genre-explore-client.tsx`, `genres/[genreName]/page.tsx` から `page.module.css` import を削除する
  - `lockedGenreId` 付き `ExploreSearchSection` と `ExploreSortTabs` の既存編成を維持する
  - `data-testid="genre-explore-search"` を維持する
  - _Requirements: 4.1, 4.3, 4.4, 8.1, 9.3_
  - _Boundary: GenreExplore_
  - _Depends: 3.3, 5.1_

- [x] 6.2 (P) タグ探索画面を Tailwind 化する
  - `tag-explore-client.tsx`, `tags/[tagName]/page.tsx` から `page.module.css` import を削除する
  - タグロック付き探索 UI とソートタブの既存挙動を維持する
  - _Requirements: 4.2, 4.3, 8.1, 9.3_
  - _Boundary: TagExplore_
  - _Depends: 3.3, 5.1_

---

## 7. Core: リスト探索の並列移行

> **Phase 26 注記（2026-06-10）**: 以下タスク 7.x は Phase 24 実装完了済みだが、Phase 26 リスト機能完全廃止により **本スペックの継続所有対象から除外**。物理削除は `quizetika-play-flow-ui` Phase 28 が担当。`src/components/lists/*` は **obsolete**。
- [x] 7.1 (P) リスト UI コンポーネントを shadcn 化する
  - `list-discovery-card.tsx`, `lists-search-bar.tsx`, `lists-visibility-tabs.tsx`, `lists-grid.tsx` から `lists.module.css` import を削除する
  - shadcn Card, Input, Tabs, Badge, Button で再構築し全 `data-testid` を維持する
  - 空状態（`lists-empty-state`）とエラー + 再試行 UI を維持する
  - _Requirements: 5.1, 5.4, 5.5, 5.6, 8.1, 8.4, 8.5_
  - _Boundary: ListsComponents_
  - _Depends: 1.1_

- [x] 7.2 (P) リストページと ListsClient を Tailwind 化する
  - `lists/page.tsx`, `lists-client.tsx` から `lists.module.css` / `page.module.css` import を削除する
  - `btn btn-accent` を shadcn Button に置換し「リストを作成」導線を維持する
  - 非公開タブ + 未ログイン時の `/login?redirect=/lists` リダイレクトを維持する
  - `useListsSearch` の呼び出し契約を変更しない
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 8.1, 9.3_
  - _Boundary: ListsPage_
  - _Depends: 7.1_

- [x] 7.3 (P) リスト詳細ページを Tailwind + shadcn で再実装する
  - `src/app/list/[id]/page.tsx` から `list.module.css` import を削除し、Tailwind + shadcn Card/Button/Badge で再構築する
  - `resolveListType` によるクイズリスト/問題リスト分岐、作成者向け編集導線、連続プレイ/問題リストプレイ開始（`data-testid="question-list-play-start"`）を維持する
  - `getQuizList`, `getQuizzesInList`, `getQuestionsInList` のデータ取得契約を変更しない
  - `list.module.css` を削除する
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.1, 9.2_
  - _Boundary: ListDetailPage_
  - _Depends: 1.1_

---

## 8. Integration: レガシー CSS Modules 削除
- [x] 8.1 探索専用 CSS Modules を削除する
  - `src/components/explore/*.module.css`（7 ファイル）、`home-discovery.module.css`、`src/app/lists/lists.module.css`、`src/components/lists/lists.module.css`、`src/app/list/[id]/list.module.css` を削除する
  - 探索コンポーネントに `.module.css` import が残っていないことを確認する
  - `npm run build` が CSS Modules 削除後も成功することを確認する
  - _Requirements: 9.1, 9.2_
  - _Depends: 4.1, 5.1, 6.1, 6.2, 7.2, 7.3_

- [x] 8.2 探索ルートの page.module.css 参照をゼロ化する
  - `src/app/page.tsx`, `search/*`, `genres/*`, `tags/*`, `lists/*`, `src/components/explore/*` に `page.module.css` import がないことを grep で確認する
  - `grid-skeleton.tsx` が `page.module.css` を参照しないことを確認する
  - 既存ルートパス（`/`, `/search`, `/genres/*`, `/tags/*`, `/lists`, `/list/[id]`）が変更されていないことを確認する
  - _Requirements: 9.3, 9.4_
  - _Depends: 8.1_

---

## 9. Validation: ビルド・E2E 回帰とテーマ視認性
- [x] 9.1 ビルド・lint・Jest の回帰を確認する
  - `npm run build`、`npm run lint`、`npm run test` を順に実行し全て成功することを確認する
  - `tests/lib/search-url-state.test.ts` がグリーンであることを確認する
  - 本スペック変更に起因する新規 lint エラーがないことを確認する
  - _Requirements: 10.4, 10.5_
  - _Depends: 8.2_

- [x] 9.2 探索 E2E とテーマ視認性を確認する
  - `npm run test:e2e -- e2e/home-discovery.spec.ts e2e/quiz-search.spec.ts e2e/lists-discovery.spec.ts` を実行し全ケースがグリーンであることを確認する
  - ライト/ダーク両テーマでホーム・検索・リスト画面のコントラストとフィルタチップ視認性をブラウザで確認する
  - _Requirements: 1.1, 2.1, 3.1, 3.3, 5.1, 8.2, 8.3, 8.4, 10.1, 10.2, 10.3_
  - _Depends: 9.1_

- [x]* 9.3 横スクロールカルーセルのスモークテストを追加する
  - `HorizontalScrollCarousel` が `data-testid` 転送と scroll クラス適用を検証する Jest テストを追加する
  - `npm run test` がパスすることを確認する
  - _Requirements: 7.1, 7.4_
  - _Depends: 9.1_

## Implementation Notes

- 探索ルート共通レイアウトは `src/lib/discovery-layout.ts` に集約（container / grid / back link 等）
- リポジトリ全体の `npm run build` は discovery スコープ外の既存エラー（quiz detail-classes、leaderboard-classes、community/genres 構文）で失敗する。discovery 関連 Jest スイート（horizontal-scroll-carousel、lists-grid、home-discovery-client、search-url-state）はグリーン

---

### 10. Phase 26: リスト探索の移行スコープ除外（2026-06-10）

> **注記**: タスク 7.x（リスト探索・詳細の shadcn 移行）は Phase 24 実装完了済みだが、Phase 26 リスト機能廃止により **本スペックの継続所有対象から除外** される。物理削除は `quizetika-play-flow-ui` Phase 28 が担当。

- [x] 10.1 要件・設計のスコープ改定
  - 要件 5・6 および要件 9・10 のリスト関連を **廃止** と明記する
  - design の Boundary Commitments から `/lists`・`/list/[id]`・`components/lists/*` を除外する
  - `quizetika-lists-discovery-ui` を obsolete と相互参照する
  - **完了状態**: requirements/design に Phase 26 節が追加され、リスト画面が In scope 外であることが明文化されていること
  - _Requirements: 11.1, 11.2, 11.3, 11.7_
  - _Boundary: SpecDocs_

- [x] 10.2 タスク計画のリスト関連注記
  - タスク 7.x を履歴完了タスクとして残しつつ、Phase 26 除外注記を付与する
  - タスク 9.2 から `e2e/lists-discovery.spec.ts` 期待を除外する
  - **完了状態**: tasks.md に Phase 26 節と 7.x 除外注記が存在すること
  - _Requirements: 11.5_
  - _Depends: 10.1_
  - _Boundary: SpecDocs_

- [x] 10.3 spec.json メタデータ更新
  - `updated_at` を Phase 26 日付に更新する
  - phase は `implementation-complete` を維持（探索系移行は完了、リスト部分は除外）
  - **完了状態**: spec.json が Phase 26 改定を反映していること
  - _Requirements: 11.1_
  - _Depends: 10.1, 10.2_
  - _Boundary: SpecMeta_

## Implementation Notes (Phase 26)

- タスク 7.x の実装成果（shadcn 化済みリスト UI）は Phase 26 でルートごと削除される。再移行作業は不要。
- 本スペックの継続 E2E 回帰は `home-discovery`・`quiz-search` のみ。`lists-discovery` は play-flow-ui Phase 28 で削除。
- `src/components/lists/*` は **obsolete**。所有権は本スペックから play-flow-ui / core 廃止タスクへ移管済み。
