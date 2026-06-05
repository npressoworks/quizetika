# Research & Design Decisions: quizeum-auth-profile-ui

## Summary
- **Feature**: quizeum-auth-profile-ui（Phase 5: 本人プレイ履歴 / Phase 8: 作成リスト listType 表示）
- **Discovery Scope**: Extension（Light）
- **Key Findings**:
  - Phase 5（プレイ履歴）は `ProfilePlayHistoryPanel` + `play-history-client` で実装済み。
  - Phase 8 ギャップ: プロフィールリストタブが `quizIds.length` 固定表示。`bookmark-list-grid.tsx` に種別ラベル分岐の先行実装あり。
  - `getQuizListsByAuthor` は `listType` フィルタオプション対応済み（`quizeum-core` Phase 8）。プロフィールは初回ロードで全件取得済みのため、任意フィルタはクライアント絞り込みで十分。

## Research Log

### プロフィールタブ構成（Phase 5）
- **Context**: ユーザー指定「履歴は専用タブに」。
- **Findings**: 既存2タブと同じ `tabsContainer` に第3ボタンを追加するのが最小差分。
- **Implications**: `ProfileContentTab` に `'history'` を追加。他人プロフィールではボタン非表示。
- **Status**: 実装済み。

### リストカード種別表示（Phase 8）
- **Context**: 要件 8 — クイズリストと設問リストの区別。
- **Findings**: `src/app/profile/[uid]/page.tsx` L417 が `list.quizIds?.length` のみ表示。`resolveListType` は `@/types` で後方互換定義済み。
- **Alternatives**: (A) ページ内インライン修正のみ (B) `ProfileListCard` + 純関数抽出。
- **Selected**: (B) — テスト容易性・`bookmark-list-grid` との文言統一・タスク境界明確化。
- **Implications**: `profile-list-display.ts` でラベルと件数ロジックを集約。

### フィルタ UI（要件 8.7 任意）
- **Alternatives**: フィルタ変更時に `getQuizListsByAuthor(uid, isMyProfile, { listType })` 再取得 / クライアント filter。
- **Selected**: クライアント filter（初版）— 既に全リストを `loadProfileData` で取得。Firestore インデックス追加不要。
- **Trade-offs**: リスト件数が極端に多い場合は将来サーバフィルタへ移行可能（Revalidation Trigger に記載済み）。

### 件数ラベル文言
- **Selected**: クイズリスト「収録クイズ: N 件」、設問リスト「収録設問: N 件」（現状「収録問題」から種別明示へ変更）。

## Design Decisions

### Decision: ProfileListsPanel 抽出
- **Rationale**: リストタブの JSX が肥大化。フィルタ state と空状態を1コンポーネントに閉じる。
- **Trade-offs**: `ProfilePage` から数十行移動 — 可読性向上。

### Decision: resolveListType を唯一の種別解決
- **Rationale**: core と play-flow / creator-dash で共有済み。プロフィールでも直参照 `list.listType` を避ける。

## Risks & Mitigations
- **レガシーリスト（listType 未設定）** — `resolveListType` → `quiz`、件数は `quizIds`（8.2 充足）。
- **空 questionIds の設問リスト** — 0 件表示で正しい（作成直後は creator-dash 側でアタッチ）。
- **フィルタとタブ件数表示** — タブラベル `(N)` は全件数固定とし、フィルタは一覧のみに適用（UX 混乱防止）。

## References
- `.kiro/specs/quizeum-core/design.md` — `getQuizListsByAuthor`, `resolveListType`
- `.kiro/specs/quizeum-creator-dash-ui/design.md` — listType 作成フロー
- `src/components/bookmark/bookmark-list-grid.tsx` — 種別ラベル先行パターン
- `src/app/profile/[uid]/page.tsx` — 現行リストタブ（ギャップ箇所）
