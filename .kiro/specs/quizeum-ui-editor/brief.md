# Brief: quizetika-ui-editor

## Problem
クイズエディタ（~1882 LOC）とリストエディタはフォーム密度・DnD ソート・Markdown プレビュー等、最も複雑な UI。CSS Modules も大きい（create.module.css ~549 行）。

## Current State
- `quiz-editor.tsx`, `quiz-list-editor.tsx`, `question-list-attach-panel.tsx`
- `@dnd-kit` による SortableSortingList
- Markdown フィールド（markdown-preview, markdown-content）
- `/quiz/create`, `/list/create`, `/list/[id]/edit`

## Desired Outcome
- エディタ UI が shadcn + Tailwind で再構築
- 問題 CRUD、DnD 並べ替え、ジャンル/タグ選択、Markdown 入力、問題添付検索が機能維持
- バリデーション表示・保存/公開フローが維持

## Approach
shadcn Form, Textarea, Select, Dialog, DropdownMenu + 既存 @dnd-kit を Tailwind スタイルでラップ。大ファイルは段階的にサブコンポーネント化（機能変更なし）。Markdown は shadcn Textarea + 既存 preview コンポーネントを Tailwind 化。

## Scope
- **In**: quiz-editor, quiz-list-editor, sorting, markdown コンポーネント, create/edit ルート CSS Modules
- **Out**: プレイ/結果 UI, Core バリデーション lib

## Boundary Candidates
- `src/components/quiz/quiz-editor.tsx`
- `src/components/quiz-list/*`
- `src/components/sorting/*`, `src/components/markdown/*`
- `src/app/quiz/create/*`, `src/app/list/create/*`, `src/app/list/[id]/edit/*`

## Out of Boundary
- AI 生成 API（verify-truth 等）
- Firestore 保存ロジック

## Upstream / Downstream
- **Upstream**: quizetika-ui-foundation, quizetika-ui-layout-shell
- **Downstream**: クリエイター体験全体、question-attach-search 共有 lib（スタイルのみ）

## Existing Spec Touchpoints
- **Adjacent**: quizetika-core, quizetika-my-quiz-ui（question pool lib 共有）

## Constraints
- DnD 動作退行禁止
- エディタの未保存警告等 UX 契約維持
- 最大 LOC — タスク分割を design で細分化
