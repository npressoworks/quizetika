# Research & Design Decisions — quizeum-my-quiz-ui

---
**Purpose**: マイクイズ UI のディスカバリーと設計判断の記録。

---

## Summary
- **Feature**: `quizeum-my-quiz-ui`
- **Discovery Scope**: Extension（Phase 26: 4→3ソース縮小）
- **Key Findings**:
  - `my-quiz-source-panel.tsx` の4チェックボックスのうち「ブックマークリスト」1件を除去すれば UI 縮小は完了。
  - Core の `buildMyQuizQuestionPool` から `includeBookmarkedLists` を除去するため、クライアントのソース状態型も同期が必須。
  - 既存 `mode=my-quiz` プレイフロー・結果画面はリスト非依存のため変更不要。

## Phase 23: マイクイズ初版（2026-06-09）

### Summary
4ソース（自作・ブックマーククイズ・ブックマークリスト・ブックマーク問題）から問題プールを合成する `/my-quiz` 画面。`MyQuizClient` + `buildMyQuizQuestionPool`（core）連携。

### Design Decisions
1. **ソーストグル** — チェックボックス群でプール再取得をトリガ。
2. **プレイ開始** — `mode=my-quiz` で play-flow に委譲。

**Document Status（Phase 23 設計）**: `design.md` 初版に反映済。

---

## Phase 26: ブックマークリストソースの除去（2026-06-10）

### Summary
- **Discovery Type**: Extension（削除・縮小）。
- **Key Findings**:
  - `MyQuizSourcePanel` は `bookmarkedLists` プロップとラベル `bookmarked-list` を持つ — 両方削除。
  - デフォルトソース選択は3件すべて ON のまま維持可能（リスト除去後も UX 一貫）。
  - E2E はマイクイズ専用 spec のリスト関連アサーションのみ更新。

### Design Decisions
1. **3ソース固定** — 将来のリスト復活は別 spec とし、トグル追加は行わない。
2. **Core 同期** — `includeBookmarkedLists` 除去後にクライアント型を更新（Core 先行実装）。

**Document Status（Phase 26 設計）**: `design.md` Phase 26 節に反映済。
