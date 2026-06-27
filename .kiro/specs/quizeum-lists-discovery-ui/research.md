# Research & Design Decisions: quizetika-lists-discovery-ui

## Summary
- **Feature**: quizetika-lists-discovery-ui
- **Discovery Scope**: Extension（既存リスト CRUD・ブックマーク UI パターンの再利用）
- **Key Findings**:
  - `src/services/quiz-list.ts` には `getLatestQuizLists` / `getQuizListsByAuthor` があるが、`searchLists` は未実装（Phase 23 で `quizetika-core` が追加予定）
  - ブックマークページ（`bookmarks-client.tsx` + `BookmarksTabs`）がタブ切り替え UI の参照実装
  - リストカード表示は `ProfileListCard` / `BookmarkListGrid` と `profile-list-display.ts` の種別ラベル・件数ヘルパーを再利用可能
  - Sidebar には現時点で `/lists` 導線なし（`quizetika-sidebar-layout` Phase 23 更新が担当）

## Research Log

### 既存リスト取得 API
- **Context**: 公開/非公開タブのデータソース設計
- **Sources Consulted**: `src/services/quiz-list.ts`, roadmap Phase 23
- **Findings**:
  - 公開: `getLatestQuizLists(limit)` は `isPublished === true` + `createdAt desc`
  - 作者別: `getQuizListsByAuthor(authorId, includeUnpublished)` で非公開含む取得可能
  - キーワード検索 API は存在しない → `searchLists` 新設が必要
- **Implications**: UI スペックは Core 契約に依存。初版は Firestore 取得後クライアント側 `includes` フィルタでも可（Core design で確定）

### UI パターン調査
- **Context**: タブ + 検索バー + グリッドの一貫性
- **Sources Consulted**: `bookmarks-client.tsx`, `bookmarks-tabs.tsx`, `profile-lists-panel.tsx`, `explore-search-section.tsx`
- **Findings**:
  - タブ: `BookmarksTabs` の `tabBar` / `tabActive` パターン
  - 検索デバounce: `useQuestionAttachSearch` が 300ms デバウンス先例
  - 種別バッジ: `getProfileListTypeLabel`, `getProfileListItemCount` が共通化済み
- **Implications**: 新規 CSS Modules は bookmarks / profile と視覚的一貫性を保つ

### ナビゲーション境界
- **Context**: Phase 23 責務分割
- **Sources Consulted**: roadmap Boundary Strategy, `sidebar.tsx`
- **Findings**: Sidebar メニューにリスト項目なし。BottomNav 5項目過密のためモバイル導線は sidebar-layout design で決定
- **Implications**: 本スペックは `/lists` ルートとページ本体のみ所有。ナビリンクは adjacent

## Architecture Pattern Evaluation

| Option                         | Description                              | Strengths                               | Risks / Limitations                       | Notes                    |
| ------------------------------ | ---------------------------------------- | --------------------------------------- | ----------------------------------------- | ------------------------ |
| A. 専用 hook + Client Page     | `useListsSearch` が `searchLists` を呼ぶ | ブックマーク/検索画面と同型、テスト容易 | Core 未実装時はモック必要                 | **採用**                 |
| B. Server Component 直接 fetch | RSC で Firestore 取得                    | 初回表示高速                            | タブ/検索のインタラクションが Client 必須 | 不採用                   |
| C. ProfileListCard 直再利用    | プロフィール用カード流用                 | 実装最小                                | プロフィール CSS 依存が強い               | 部分採用（ヘルパーのみ） |

## Design Decisions

### Decision: Core `searchLists` 契約の採用
- **Context**: 要件 6 — 公開/非公開/キーワードの一貫取得
- **Alternatives Considered**:
  1. UI 内で `getLatestQuizLists` + `getQuizListsByAuthor` を直接呼ぶ
  2. 新規 `searchLists` API（Core）
- **Selected Approach**: `searchLists({ visibility, keyword?, authorId?, limit })` を Core に定義し UI は単一入口
- **Rationale**: roadmap Phase 23 の Core 更新と整合。将来の Firestore インデックス最適化を Core に集約
- **Trade-offs**: Core 実装が先行または並行必要
- **Follow-up**: `quizetika-core` tasks に `searchLists` 追加タスクが必要（本スペック外）

### Decision: キーワードフィルタの初版実装位置
- **Context**: Firestore 前方一致クエリは title/description 複合が複雑
- **Selected Approach**: Core `searchLists` 内で取得後にタイトル/説明を case-insensitive `includes` フィルタ（limit 件数内）
- **Rationale**: brief および roadmap が「クライアントまたは Firestore 前方一致」を許容
- **Follow-up**: 件数増加時は Firestore インデックス + prefix クエリへ移行

### Decision: 非公開タブの未ログイン UX
- **Context**: 要件 2.4
- **Selected Approach**: 非公開タブ選択時に `/login?redirect=/lists` へ `router.push`（bookmarks と同型）
- **Rationale**: 既存認証 UX との一貫性

## Risks & Mitigations
- **Core `searchLists` 未実装** — 実装前は Jest/E2E で `searchLists` をモック。Core タスク完了を前提に結合
- **Firestore インデックス不足** — Core が composite index を `firestore.indexes.json` に追加
- **Sidebar 導線未追加** — E2E は直接 `/lists` アクセスで検証。ナビ E2E は sidebar-layout 側

## References
- `.kiro/specs/quizetika-lists-discovery-ui/brief.md`
- `.kiro/steering/roadmap.md` Phase 23
- `src/app/bookmarks/bookmarks-client.tsx`
- `src/services/quiz-list.ts`
