# Research & Design Decisions

---
**Purpose**: Capture discovery findings, architectural investigations, and rationale that inform the technical design.
---

## Summary
- **Feature**: `quizetika-ui-editor`
- **Discovery Scope**: Extension（既存エディタ UI のスタイル層 Strangler 移行）
- **Key Findings**:
  - `quiz-editor.tsx` は約 2,028 LOC で最大ファイル。段階的サブコンポーネント化が実装リスク低減に必須
  - DnD は二系統: sorting 問題のみ @dnd-kit、リスト/問題添付は HTML5 DnD — 統合禁止
  - エディタ関連 CSS Modules 合計約 1,096 LOC（`create.module.css` 550 行が最大）
  - foundation 時点で Form/Textarea/Select 等は未追加 — 本スペックで shadcn CLI add が必要

## Research Log

### 既存エディタコンポーネント構成
- **Context**: brief.md の Boundary Candidates と実装 LOC の確認
- **Sources Consulted**: `src/components/quiz/quiz-editor.tsx`, `quiz-list-editor.tsx`, `question-list-attach-panel.tsx`
- **Findings**:
  - QuizEditor: 8 形式 × 8 問題タイプ、参照問題 COW、バリデーション表示、save/publish/test-play
  - QuizListEditor: 497 LOC、クイズ検索添付 + HTML5 並べ替え、問題リスト時は QuestionListAttachPanel
  - QuestionListAttachPanel: 231 LOC、3 タブ検索、`useQuestionAttachSearch` hook 利用
- **Implications**: 大ファイルは見た目移行と同時に責務分割。ロジック（services/hooks）は触らない

### DnD 実装の二系統
- **Context**: brief.md「DnD 動作退行禁止」
- **Sources Consulted**: `sortable-sorting-list.tsx`, `quiz-list-editor.tsx`, `question-list-attach-panel.tsx`, `package.json`
- **Findings**:
  - @dnd-kit（core ^6.3.1, sortable ^10.0.0）: SortableSortingList のみ。PointerSensor distance: 8, KeyboardSensor
  - HTML5 DnD: リスト内クイズ並べ替え、問題リスト添付済み問題並べ替え
  - `create.module.css` に未使用 `.sortingMoveBtn` 残存（@dnd-kit 移行済み）
- **Implications**: SortableSortingList はスタイル層のみ Tailwind 化。@dnd-kit 設定は維持。リスト側 DnD を @dnd-kit に統一しない

### CSS Modules 削除対象
- **Context**: 移行完了条件の特定
- **Sources Consulted**: grep on `*.module.css` imports in editor scope
- **Findings**:
  | File                                    | ~LOC | Consumer                                     |
  | --------------------------------------- | ---- | -------------------------------------------- |
  | `src/app/quiz/create/create.module.css` | 550  | quiz-editor                                  |
  | `src/app/list/create/edit.module.css`   | 344  | quiz-list-editor, question-list-attach-panel |
  | `sortable-sorting-list.module.css`      | 60   | sortable-sorting-list                        |
  | `markdown.module.css`                   | 33   | markdown-*                                   |
  | `editor-skeleton.module.css`            | 53   | editor-skeleton                              |
  | `list-skeleton.module.css`              | 56   | list-skeleton                                |
- **Implications**: quiz-list-editor と question-list-attach-panel は同一 CSS を共有 — 同タスク群で移行

### E2E と data-testid 契約
- **Context**: 回帰テスト要件の根拠
- **Sources Consulted**: `e2e/quiz-creation.spec.ts`, `e2e/quiz-list.spec.ts`, `e2e/phase8.spec.ts`, `e2e/creator-streaming-skeleton.spec.ts`
- **Findings**:
  - 主要 testid: `quiz-editor-skeleton`, `genre-editor-select`, `auto-grow-*`, `list-type-*`, `question-list-attach-panel`, `attach-question-{id}`
  - E2E は placeholder テキスト（`下書き保存`, `公開`, `リストを保存する`）も使用
  - `beforeunload` 未保存警告はコードベースに存在しない — 要件に含めない
- **Implications**: testid と placeholder テキストは変更禁止。class 依存 selector（`[class*="choiceRow"]`）は Tailwind 化時に同等 DOM 構造を維持

### shadcn プリミティブ不足
- **Context**: foundation 提供分の確認
- **Sources Consulted**: `quizetika-ui-foundation/design.md`, `src/components/ui/`
- **Findings**:
  - foundation 初期 7 種: Button, Input, Dialog, Tabs, Skeleton, Badge, Card
  - layout-shell 追加: Avatar, DropdownMenu, Separator
  - エディタに必要: Form, Textarea, Select, Switch, RadioGroup, Label, Alert（+ 既存 Tabs）
- **Implications**: タスク 1 で shadcn CLI add。AutoGrowTextarea は shadcn Textarea をラップして Tailwind 化

### 保存・バリデーションフロー（読み取り専用境界）
- **Context**: Out of boundary の確認
- **Sources Consulted**: `handleSave` in quiz-editor, quiz-list-editor
- **Findings**:
  - Quiz: `validateQuizForPublish`, `saveQuiz`/`updateQuiz`, draft → dashboard, publish → success page
  - List: title のみ client validation, `createQuizList`/`updateQuizList`
  - `scrollToFirstValidationError` が `#field-*`, `#question-card-*` を参照
- **Implications**: DOM ID とフロー順序を維持。services import は変更しない

## Architecture Pattern Evaluation

| Option                  | Description                                     | Strengths              | Risks / Limitations                  | Notes              |
| ----------------------- | ----------------------------------------------- | ---------------------- | ------------------------------------ | ------------------ |
| A: 一括スタイル置換     | quiz-editor.tsx を分割せず CSS Modules のみ削除 | 最小 diff              | 2,028 LOC レビュー不能、並列実装不可 | 却下               |
| B: Strangler + 段階分割 | スタイル層置換 + サブコンポーネント抽出         | レビュー可能、並列化可 | 一時的ファイル数増                   | **採用**           |
| C: @dnd-kit 統一        | リスト DnD も @dnd-kit 化                       | DnD 実装統一           | 機能変更、E2E 退行リスク             | brief Out of scope |

## Design Decisions

### Decision: 段階的サブコンポーネント分割（quiz-editor）
- **Context**: 2,028 LOC 単一ファイルの保守・レビュー限界
- **Alternatives Considered**:
  1. 分割なし — CSS のみ Tailwind 化
  2. 8 サブコンポーネントに完全分割 — FormatSelector, MetadataSection, QuestionCard, PerTypeEditors, ActionBar 等
- **Selected Approach**: スタイル移行と同時に design で定義した 8 サブコンポーネントへ抽出。props/state は親 QuizEditorContent が保持（Container/Presentational）
- **Rationale**: 機能変更なしで LOC 分散。タスクを 1.3h 単位に分割可能
- **Trade-offs**: 初回 PR 数増 vs 長期保守性向上
- **Follow-up**: 分割後も公開 props（QuizEditor export）不変を Jest で確認

### Decision: DnD 二系統維持
- **Context**: sorting 問題 vs リスト並べ替え
- **Alternatives Considered**:
  1. 全 DnD を @dnd-kit に統一
  2. 現状維持（@dnd-kit + HTML5）
- **Selected Approach**: 現状維持。SortableSortingList のみ Tailwind ラップ
- **Rationale**: brief「DnD 動作退行禁止」。HTML5 DnD は list attach で十分動作
- **Trade-offs**: 二種類の DnD UX パターンが残る
- **Follow-up**: E2E で sorting 問題と list reorder を個別確認

### Decision: shadcn Form の採用範囲
- **Context**: バリデーション表示と react-hook-form 導入判断
- **Alternatives Considered**:
  1. react-hook-form + shadcn Form 全面導入
  2. 既存 state + shadcn FormField 風ラッパーのみ
  3. 既存 FieldValidationMessages + shadcn Alert/Label のみ
- **Selected Approach**: 既存 React state と services バリデーションを維持。shadcn Form コンポーネントは Label + エラー表示の一貫性に使用。react-hook-form 全面移行は行わない
- **Rationale**: 機能維持優先。validation lib 連携は既存パターンが複雑
- **Trade-offs**: Form プリミティブの潜在能力を一部未使用
- **Follow-up**: FieldValidationMessages を shadcn Alert + FormMessage スタイルに置換

### Decision: AutoGrowTextarea の維持
- **Context**: 既存 auto-grow テキスト領域
- **Alternatives Considered**:
  1. shadcn Textarea に置換（固定高）
  2. AutoGrowTextarea を shadcn Textarea ラップで Tailwind 化
- **Selected Approach**: 既存 AutoGrowTextarea コンポーネントを維持し、内部スタイルを Tailwind + shadcn Textarea ベースに更新
- **Rationale**: auto-grow 挙動と testid 契約維持
- **Trade-offs**: カスタムコンポーネントが残る
- **Follow-up**: `auto-grow-*` testid が全フィールドで維持されることを E2E 確認

## Risks & Mitigations
- **quiz-editor 分割による state バグ** — 親 state 一元管理、分割は presentational のみ、E2E 全通し
- **DnD 退行** — @dnd-kit センサー設定変更禁止、手動 DnD テスト項目を design Testing Strategy に明記
- **共有 edit.module.css 部分移行** — quiz-list-editor と question-list-attach-panel を同一タスク境界で完了
- **class 依存 E2E selector** — choiceRow 等の DOM 構造維持、Tailwind 化後も同等要素階層

## References
- [shadcn/ui Form](https://ui.shadcn.com/docs/components/form) — Label/Message パターン
- [@dnd-kit Sortable](https://docs.dndkit.com/presets/sortable) — 既存 SortableSortingList 実装準拠
- `quizetika-ui-foundation/design.md` — テーマ bridge、プリミティブ共有 seam
- `quizetika-ui-layout-shell/design.md` — シェル内ページ描画前提
- `.kiro/steering/roadmap.md` Phase 24 — shadcn 標準寄せ Visual Direction

---

## Phase 27: ジャンル選択UIの検索バー化 (2026-06-18)

### Decision: バニラ React + Tailwind によるサジェスト検索ドロップダウンのカスタム実装
- **Context**: ジャンル選択をプルダウンから検索バーへリファクタリング。
- **Alternatives Considered**:
  1. shadcn / Radix UI の Popover + Command を使用する。
  2. バニラ React + Tailwind CSS によるカスタムドロップダウン。
- **Selected Approach**: 2. バニラ React + Tailwind CSS によるカスタム実装。
- **Rationale**:
  - E2Eテスト (Playwright) からのテストIDによるアクセスが容易で、Radix UI の複雑なDOMを回避できる。
  - 新たなライブラリ依存を追加せず、既存の React 19 / Next.js 16 環境と 100% 互換性を保てる。
  - `hasOrphanValue` 等の Quizetika 独自仕様（マスタ未登録ジャンルの一時表示など）をシンプルに統合できる。
- **Trade-offs**: ポップアップの表示位置などを自前で制御する必要があるが、シンプルなリスト選択で十分である。
- **Follow-up**: ドロップダウン候補クリック時の `onBlur` 競合（先にドロップダウンが閉じてしまう問題）を `onMouseDown`（`preventDefault` 併用）で制御する。

### Risks & Mitigations (Phase 27)
- **E2Eテストの破壊**: `selectOption` に依存している全 E2E テストが失敗する。
  - *Mitigation*: 各 E2E テストファイルにある `selectFirstGenre` などのテスト内操作を、検索バーへのフォーカス・文字入力・ドロップダウン候補選択のフローに一括修正する。
