# Design Document: quizetika-ui-editor

## Overview

本機能は Phase 24 UI 刷新の**エディタスライス**である。Quizetika のクイズエディタ（約 2,028 LOC）、リストエディタ、問題添付パネル、および関連サブコンポーネント（@dnd-kit ソート、Markdown プレビュー、エディタスケルトン）を `quizetika-ui-foundation` の shadcn 標準テーマと Tailwind ユーティリティ上に再構築する。問題 CRUD、DnD 並べ替え、バリデーション表示、下書き/公開/テストプレイ/リスト保存フローは変更しない。

**Users**: クリエイターが `/quiz/create`, `/quiz/[id]/edit`, `/list/create`, `/list/[id]/edit` でコンテンツを編集する。開発者は foundation Primitive Wave 2 の Form 系プリミティブを利用する。

**Impact**: エディタ関連 CSS Modules（約 1,096 LOC）を削除し、最大ファイル `quiz-editor.tsx` を 8 サブコンポーネントへ分割。旧 glass/neon スタイルを shadcn 標準フォーム UI に置換する。

### Goals
- クイズ/リストエディタの shadcn + Tailwind 再実装
- @dnd-kit（sorting 問題）と HTML5 DnD（リスト並べ替え）の挙動維持
- バリデーション・保存/公開フロー・`data-testid` 契約の維持
- `quiz-editor.tsx` の段階的サブコンポーネント化（機能変更なし）
- エディタ関連 `.module.css` 完全削除
- エディタ E2E・Jest 回帰グリーン

### Non-Goals
- Firestore サービス層・バリデーション lib の変更
- AI 生成 API UI
- プレイ/結果 UI（`quizetika-ui-quiz-lifecycle`）
- @dnd-kit への HTML5 DnD 統一
- `variables.css` 削除
- react-hook-form 全面導入

---

## Boundary Commitments

### This Spec Owns
- `src/components/quiz/quiz-editor.tsx` および分割サブコンポーネント（`src/components/quiz/editor/*`）
- `src/components/quiz-list/quiz-list-editor.tsx`, `question-list-attach-panel.tsx`
- `src/components/quiz/genre-editor-select.tsx`, `list-type-selector.tsx`, `editor-skeleton.tsx`
- `src/components/quiz-list/list-skeleton.tsx`
- `src/components/sorting/sortable-sorting-list.tsx`
- `src/components/markdown/*`（preview, content, field-hint）
- エディタルート loader（`quiz-editor-loader.tsx`, `list-editor-loader.tsx`）の CSS import 除去
- エディタ関連 `.module.css` 削除
- エディタ E2E 回帰確認

### Out of Boundary
- `@/services/quiz`, `@/services/quiz-list`, `@/services/question`, `@/services/quiz-validation` 等のロジック
- `useQuestionAttachSearch` hook の検索ロジック
- `AuthorQuizReferencePanel`, `ReferenceQuestionBadge` の機能ロジック（スタイル追随のみ本スペックで touch 可）
- `AutoGrowTextarea`, `TrueFalseCorrectToggle`, `DifficultyVoteStars` の挙動ロジック（Tailwind 化は本スペック）
- クリエイターダッシュボード（`quizetika-ui-admin-creator`）
- シェルコンポーネント（`quizetika-ui-layout-shell`）

### Allowed Dependencies
- **`quizetika-ui-foundation`**: Tailwind, `globals.css`, `cn()`, Button, Input, Card, Dialog, Tabs, Skeleton, Badge（P0）
- **`quizetika-ui-layout-shell`**: シェル内 `main` 描画（P0）
- **`@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`**: SortableSortingList（P0、設定変更禁止）
- **`useAuth`**: 認可・authorId（P0、読み取りのみ）
- **`useActiveGenres`, `useQuestionAttachSearch`**: データ取得 hook（P0、ロジック不変）
- **既存 services/lib**: quiz-validation, test-play, markdown sanitize 等（P0、import 維持）
- **foundation Primitive Wave 2**: Form, Textarea, Select, Switch, RadioGroup, Label, Alert（P0、存在確認のみ）

### Revalidation Triggers
- 問題タイプ追加・削除（QuestionCard / PerTypeEditor 影響）
- DnD ライブラリまたはセンサー設定変更
- 保存/公開フローの遷移先 URL 変更
- バリデーション lib のエラー shape 変更
- 既存 `data-testid` または DOM ID（`#field-*`, `#question-card-*`）の変更
- foundation の CSS 変数名または shadcn プリミティブ API の破壊的変更

---

## Architecture

### Existing Architecture Analysis
- **クイズエディタ**: 単一 `quiz-editor.tsx` に形式選択、メタデータ、タグ、問題 CRUD、参照問題、バリデーション、save/publish/test-play が集約。`create.module.css`（550 行）を import
- **リストエディタ**: `quiz-list-editor.tsx` + `question-list-attach-panel.tsx` が `edit.module.css`（344 行）を共有
- **DnD**: sorting 問題のみ `SortableSortingList`（@dnd-kit）。リストは HTML5 DnD
- **Markdown**: `MarkdownPreview` + `MarkdownContent` + `parseMarkdownToHtml` / sanitize
- **ルート**: Server loader が genres/tags/quiz/list を fetch し Client Editor に props 渡し
- **テスト**: E2E 6+ spec、Jest は限定的（エディタ専用単体テスト少）

### Architecture Pattern & Boundary Map

**Strangler Style Migration + Presentational Split**: スタイル層を CSS Modules → Tailwind + shadcn に置換。`quiz-editor.tsx` は Container（state/services）を残し UI を `editor/*` サブコンポーネントへ抽出。

```mermaid
graph TD
    subgraph Foundation [quizetika-ui-foundation]
        Globals[globals.css CSS vars]
        CN[cn utility]
        Primitives[Button Card Input Dialog Tabs]
    end

    subgraph EditorSpec [quizetika-ui-editor]
        QuizEditor[QuizEditorContent Container]
        SubComps[editor/* Presentational]
        ListEditor[QuizListEditor]
        AttachPanel[QuestionListAttachPanel]
        Sortable[SortableSortingList]
        Markdown[MarkdownPreview Content]
        EditorUI[Form Textarea Select Alert]
    end

    subgraph Services [Out of Boundary]
        QuizSvc[services/quiz]
        Validation[quiz-validation]
        AttachHook[useQuestionAttachSearch]
    end

    subgraph Routes [App Router]
        QuizCreate[/quiz/create]
        ListEdit[/list/id/edit]
    end

    Foundation --> EditorUI
    Foundation --> SubComps
    CN --> SubComps
    QuizEditor --> SubComps
    QuizEditor --> Sortable
    QuizEditor --> Markdown
    QuizEditor --> QuizSvc
    QuizEditor --> Validation
    ListEditor --> AttachPanel
    AttachPanel --> AttachHook
    Routes --> QuizEditor
    Routes --> ListEditor
```

**Architecture Integration**:
- Selected pattern: Strangler Fig + Presentational Component Split
- Domain boundaries: 本スペックはエディタ UI chrome のみ。永続化・バリデーションは services
- Existing patterns preserved: props 契約、save フロー、testid、DOM ID、@dnd-kit センサー
- New components rationale: 2,028 LOC 分割でレビュー可能単位を確保
- Steering compliance: shadcn 標準テーマ、glass/neon 非再現

### Technology Stack

| Layer    | Choice / Version      | Role in Feature                        | Notes               |
| -------- | --------------------- | -------------------------------------- | ------------------- |
| Frontend | Next.js 16, React 19  | App Router, Client Components          | 既存維持            |
| Styling  | Tailwind CSS v4       | フォーム・カードレイアウト             | foundation 経由     |
| UI       | shadcn/ui             | Form, Textarea, Select, Card, Alert 等 | foundation Wave 1+2 |
| DnD      | @dnd-kit ^6.3 / ^10.0 | sorting 問題のみ                       | 設定不変            |
| DnD      | HTML5 Drag API        | リスト/問題並べ替え                    | 統一しない          |
| Markdown | 既存 sanitize + parse | プレビュー                             | ロジック不変        |
| Testing  | Jest, Playwright      | 回帰                                   | 既存 spec           |

---

## File Structure Plan

### Directory Structure
```
src/components/quiz/
├── quiz-editor.tsx                    # [MODIFY] Container のみ。UI を editor/* へ委譲
├── genre-editor-select.tsx            # [MODIFY] shadcn Select + Tailwind
├── editor-skeleton.tsx                # [MODIFY] shadcn Skeleton、module.css 削除
└── editor/
    ├── quiz-format-selector.tsx       # [NEW] 8 形式選択グリッド
    ├── quiz-metadata-section.tsx      # [NEW] タイトル/説明/サムネ/難易度/ジャンル
    ├── quiz-tag-editor.tsx            # [NEW] タグ入力・サジェスト・バッジ
    ├── quiz-editor-validation.tsx     # [NEW] FieldValidationMessages + エラー summary
    ├── question-card.tsx              # [NEW] 問題カード shell + type toggle
    ├── question-type-editors/
    │   ├── multiple-choice-editor.tsx # [NEW]
    │   ├── true-false-editor.tsx      # [NEW]
    │   ├── text-input-editor.tsx      # [NEW]
    │   ├── quick-press-editor.tsx     # [NEW]
    │   ├── sorting-question-editor.tsx # [NEW] SortableSortingList ラップ
    │   ├── association-editor.tsx     # [NEW]
    │   └── lateral-thinking-editor.tsx # [NEW]
    ├── reference-question-view.tsx    # [NEW] 参照問題読取 + COW detach
    └── quiz-editor-action-bar.tsx     # [NEW] 下書き/テストプレイ/公開

src/components/quiz-list/
├── quiz-list-editor.tsx               # [MODIFY] Tailwind + shadcn、module.css 削除
├── question-list-attach-panel.tsx     # [MODIFY] shadcn Tabs + Tailwind
└── list-skeleton.tsx                  # [MODIFY] shadcn Skeleton
├── list-type-selector.tsx             # [MODIFY] shadcn RadioGroup（quiz-list 配下または quiz/）

src/components/sorting/
└── sortable-sorting-list.tsx          # [MODIFY] Tailwind、module.css 削除

src/components/markdown/
├── markdown-preview.tsx               # [MODIFY] Tailwind
├── markdown-content.tsx               # [MODIFY] Tailwind
└── markdown-field-hint.tsx            # [MODIFY] Tailwind

src/app/quiz/create/
├── page.tsx                           # [UNCHANGED]
└── quiz-editor-loader.tsx             # [UNCHANGED]

src/app/quiz/[id]/edit/
├── page.tsx                           # [UNCHANGED]
└── quiz-editor-loader.tsx             # [UNCHANGED]

src/app/list/create/
├── page.tsx                           # [UNCHANGED]
└── list-editor-loader.tsx             # [UNCHANGED]

src/app/list/[id]/edit/
├── page.tsx                           # [UNCHANGED]
└── list-editor-loader.tsx             # [UNCHANGED]

tests/components/quiz/
└── quiz-editor-validation.test.tsx    # [NEW] バリデーション表示 smoke（任意）

[DELETE]
src/app/quiz/create/create.module.css
src/app/list/create/edit.module.css
src/components/sorting/sortable-sorting-list.module.css
src/components/markdown/markdown.module.css
src/components/quiz/editor-skeleton.module.css
src/components/quiz-list/list-skeleton.module.css
```

### Modified Files
- `quiz-editor.tsx` — state/handlers 保持。JSX を `editor/*` へ移設。`create.module.css` import 削除
- `quiz-list-editor.tsx` — `edit.module.css` 削除、shadcn Form 要素で再スタイル
- `question-list-attach-panel.tsx` — shadcn Tabs、共有 CSS 依存除去
- `sortable-sorting-list.tsx` — Tailwind クラスで list/item/handle スタイル。DnD ロジック不変
- `genre-editor-select.tsx` — shadcn Select、`genre-editor-select` testid 維持

---

## System Flows

### クイズ保存フロー（UI 層）

```mermaid
sequenceDiagram
    participant User
    participant ActionBar as QuizEditorActionBar
    participant Editor as QuizEditorContent
    participant Validation as quiz-validation
    participant Svc as services/quiz

    User->>ActionBar: 下書き保存 / 公開
    ActionBar->>Editor: handleSave(mode)
    alt publish
        Editor->>Validation: validateQuizForPublish
        Validation-->>Editor: errors or ok
        Editor->>Editor: scrollToFirstValidationError
    end
    Editor->>Svc: saveQuiz / updateQuiz
    Svc-->>Editor: quizId
    Editor->>User: alert + redirect
```

### sorting 問題 DnD フロー

```mermaid
graph LR
    QEditor[SortingQuestionEditor] --> SSL[SortableSortingList]
    SSL --> DndCtx[DndContext]
    DndCtx --> Sensors[PointerSensor 8px KeyboardSensor]
    DndCtx --> Items[SortableContext items]
    Items --> Reorder[onReorder callback]
    Reorder --> QEditor
```

---

## Requirements Traceability

| Requirement | Summary              | Components                                                                        | Interfaces                    | Flows     |
| ----------- | -------------------- | --------------------------------------------------------------------------------- | ----------------------------- | --------- |
| 1.1–1.6     | メタデータ・形式 UI  | QuizMetadataSection, QuizFormatSelector, GenreEditorSelect, EditorSkeleton        | QuizEditor props              | —         |
| 2.1–2.7     | 問題 CRUD・DnD       | QuestionCard, question-type-editors/*, SortableSortingList, ReferenceQuestionView | onReorder, question state     | DnD flow  |
| 3.1–3.4     | Markdown             | MarkdownPreview, MarkdownContent, MarkdownFieldHint                               | markdown string               | —         |
| 4.1–4.7     | リストエディタ       | QuizListEditor, ListTypeSelector, ListSkeleton                                    | list props, handleSave        | Save flow |
| 5.1–5.6     | 問題添付             | QuestionListAttachPanel                                                           | useQuestionAttachSearch       | —         |
| 6.1–6.8     | バリデーション・保存 | QuizEditorValidation, ActionBar, handleSave                                       | validation errors, scroll IDs | Save flow |
| 7.1–7.5     | shadcn ビジュアル    | 全エディタコンポーネント                                                          | Tailwind + shadcn tokens      | —         |
| 8.1–8.6     | CSS 削除・回帰       | 全コンポーネント、E2E                                                             | testid, routes                | —         |

---

## Components and Interfaces

| Component               | Domain/Layer | Intent              | Req Coverage     | Key Dependencies (P0/P1)             | Contracts |
| ----------------------- | ------------ | ------------------- | ---------------- | ------------------------------------ | --------- |
| EditorPrimitives        | UI           | Form 系 shadcn 追加 | 7.5              | foundation cn() (P0)                 | State     |
| SortableSortingList     | UI           | @dnd-kit ソート UI  | 2.3, 2.4         | @dnd-kit (P0)                        | State     |
| MarkdownPreview         | UI           | Markdown プレビュー | 3.1–3.4          | sanitize lib (P0)                    | State     |
| QuizFormatSelector      | UI           | 8 形式選択          | 1.2, 1.3         | Card, Button (P0)                    | State     |
| QuizMetadataSection     | UI           | メタデータフォーム  | 1.1, 1.4, 1.5    | Input, Select, AutoGrowTextarea (P0) | State     |
| QuizTagEditor           | UI           | タグ編集            | 1.1              | Badge, Input (P0)                    | State     |
| QuestionCard            | UI           | 問題 shell          | 2.1, 2.7         | Card, question-type-editors (P0)     | State     |
| SortingQuestionEditor   | UI           | sorting 問題        | 2.3, 2.4         | SortableSortingList (P0)             | State     |
| QuizEditorValidation    | UI           | エラー表示          | 6.1, 6.2, 7.4    | Alert, FormMessage (P0)              | State     |
| QuizEditorActionBar     | UI           | 保存アクション      | 6.3–6.5, 6.8     | Button (P0)                          | Event     |
| QuizListEditor          | UI           | リスト編集          | 4.1–4.7, 6.6–6.8 | Switch, RadioGroup (P0)              | Event     |
| QuestionListAttachPanel | UI           | 問題添付            | 5.1–5.6          | Tabs, useQuestionAttachSearch (P0)   | State     |
| EditorSkeletons         | UI           | 読込中表示          | 1.6, 4.7         | Skeleton (P0)                        | State     |

### UI Layer

#### QuizEditorContent（Container）

| Field        | Detail                                              |
| ------------ | --------------------------------------------------- |
| Intent       | クイズ編集 state・services 呼び出しの単一 Container |
| Requirements | 1.1–2.7, 6.1–6.8                                    |

**Responsibilities & Constraints**
- 既存 `handleSave`, question state, format state を保持
- サブコンポーネントへ props/callbacks のみ渡す（presentational split）
- `QuizEditor` Suspense ラッパーと export 署名を維持

**Dependencies**
- Inbound: route loaders — initialGenres/Tags/Quiz（P0）
- Outbound: services/quiz, quiz-validation（P0）
- Outbound: editor/* サブコンポーネント（P0）

**Contracts**: State [x]

##### State Management
- State model: 既存 React useState/useMemo パターン維持
- 分割後も state は Container に集約。サブコンポーネントは controlled props

**Implementation Notes**
- Integration: 段階的に JSX ブロックをサブコンポーネント file へ cut-paste + props 抽出
- Validation: 各分割ステップ後 `npm run build` 通過
- Risks: props drilling — 深さ 1 段に抑え、QuestionCard が type editors を内包

#### SortableSortingList

| Field        | Detail                            |
| ------------ | --------------------------------- |
| Intent       | @dnd-kit ベースの汎用ソートリスト |
| Requirements | 2.3, 2.4                          |

**Responsibilities & Constraints**
- `DndContext`, `SortableContext`, `PointerSensor({ activationConstraint: { distance: 8 } })`, `KeyboardSensor` を維持
- `reindexCorrectOrder` export 維持
- CSS Modules → Tailwind（flex, gap, cursor-grab, opacity on drag）

**Contracts**: State [x]

#### QuizListEditor

| Field        | Detail                   |
| ------------ | ------------------------ |
| Intent       | リスト作成・編集フォーム |
| Requirements | 4.1–4.7, 6.6–6.8         |

**Responsibilities & Constraints**
- クイズリスト: 検索フォーム + 添付リスト + HTML5 DnD reorder
- 問題リスト: QuestionListAttachPanel 表示
- `handleSave`, `exportQuizList` ロジック不変

**Implementation Notes**
- Integration: shadcn Switch（公開）, RadioGroup（list type）, Card（セクション）
- Validation: `e2e/quiz-list.spec.ts` 通過

#### QuestionListAttachPanel

| Field        | Detail                   |
| ------------ | ------------------------ |
| Intent       | 問題検索・添付・並べ替え |
| Requirements | 5.1–5.6                  |

**Responsibilities & Constraints**
- shadcn Tabs で 3 タブ UI
- `disabled={!listId}` 契約維持
- HTML5 DnD reorder → `reorderQuestionList` callback

---

## Error Handling

### Error Strategy
- バリデーションエラー: `QuizEditorValidation` が Alert + フィールド下 FormMessage で表示。`scrollToFirstValidationError` で DOM ID スクロール
- 保存失敗: 既存 alert/console パターン維持（Dialog 化は optional、初版は alert 維持）
- 添付パネル listId 未確定: `question-attach-disabled-hint` 表示、操作無効

### Error Categories and Responses
- **User Errors**: 必須未入力 → フィールドエラー + summary Alert
- **Validation lib Errors**: publish 時 → エラー一覧 + scroll-to-first
- **System Errors**: save 失敗 → 既存 alert 表示

---

## Testing Strategy

### Unit Tests
1. `SortableSortingList` — `reindexCorrectOrder` が正しい order 配列を返す（既存あれば維持）
2. `QuizEditorValidation` — エラー props 時にメッセージ DOM 出力（新規 smoke）
3. `nav-active` 相当 — 不要（エディタ scope 外）

### Integration Tests
1. QuizEditorContent — mock services で handleSave draft が saveQuiz を呼ぶ（既存パターンあれば維持）
2. GenreEditorSelect — orphan genre 表示（既存あれば維持）

### E2E/UI Tests
1. `e2e/quiz-creation.spec.ts` — 下書き保存フルフロー
2. `e2e/quiz-list.spec.ts` — リスト作成・添付・保存
3. `e2e/phase8.spec.ts` — 公開、list-type、question attach、reference panel
4. `e2e/creator-streaming-skeleton.spec.ts` — skeleton testid 非表示タイミング
5. `e2e/advanced-quiz-features.spec.ts` — genre-editor-select 経由 publish（回帰）
6. sorting 問題 DnD — 手動または E2E 拡張で並べ替え後 save 確認（design follow-up）

### Build/Lint Validation
1. `npm run build` 成功
2. `npm run lint` 新規エラーなし
3. エディタ関連 `.module.css` ゼロ件

---

## Migration Strategy

```mermaid
flowchart LR
    E1[1: foundation Wave 2 確認]
    E2[2: Markdown Sortable Skeletons]
    E3[3: QuizEditor sub-components]
    E4[4: ListEditor AttachPanel]
    E5[5: CSS module delete]
    E6[6: E2E regression]

    E1 --> E2
    E2 --> E3
    E3 --> E4
    E4 --> E5
    E5 --> E6
```

- **Phase 1**: shadcn プリミティブ追加
- **Phase 2**: 小コンポーネント（Markdown, Sortable, Skeletons, GenreSelect）
- **Phase 3**: QuizEditor 分割 + Tailwind 化（最大工数）
- **Phase 4**: ListEditor + AttachPanel
- **Phase 5**: CSS Modules 削除
- **Phase 6**: E2E 全通し

**Rollback**: スライス単位 revert。CSS Modules は削除前コミットから復元可能。

---

## Phase 26: リストエディタ UI 移行スコープの除去

### 1. Overview

Phase 24 ではクイズエディタとリストエディタの両方を shadcn + Tailwind へ移行する計画だった。Phase 26 により **リスト機能全体が廃止** されたため、本スペックのスコープは **クイズエディタのみ** に縮小する。Phase 24 で実施済みのクイズエディタ移行（`quiz-editor.tsx` 分割、CSS Modules 削除、Markdown/Sortable 移行）は維持する。リストエディタ関連コンポーネント・ルート・E2E は削除し、design 上のリスト参照を除去する。

**Document Status（Phase 26 設計）**: 本節が正本。Overview・Boundary Commitments・File Structure Plan・Requirements Traceability・Components 表のリストエディタ記述は **歴史的参照** とし、実装・検証は本節および要件 26 に従う。

### 2. Boundary Commitments（Phase 26）

| Owns                                   | Out                                            |
| -------------------------------------- | ---------------------------------------------- |
| リストエディタコンポーネント削除の確認 | Core `quiz-list` サービス削除                  |
| エディタ E2E からリストシナリオ除去    | ブックマーク・探索 UI（play-flow）             |
| クイズエディタ Phase 24 成果の維持     | クリエイターダッシュボード CTA（creator-dash） |

**This Spec Owns（Phase 26 改定後）**
- `src/components/quiz/quiz-editor.tsx` および `editor/*` サブコンポーネント
- `src/components/quiz/genre-editor-select.tsx`, `editor-skeleton.tsx`
- `src/components/sorting/sortable-sorting-list.tsx`
- `src/components/markdown/*`
- クイズエディタルート loader（`quiz-editor-loader.tsx`）
- クイズエディタ E2E 回帰確認

**Out of Boundary（Phase 26 追加）**
- ~~`QuizListEditor` / `QuestionListAttachPanel` / `ListTypeSelector` / `ListEditorSkeleton`~~ — **削除済み、本スペック対象外**
- ~~`/list/create`, `/list/[id]/edit` ルート~~ — **削除済み**
- `@/services/quiz-list`, `list-editor-classes.ts`, `useQuestionAttachSearch`（リスト attach 専用）

### 3. File Structure Plan（Phase 26）

| ファイル                                                | 操作                              | 責務                                 |
| ------------------------------------------------------- | --------------------------------- | ------------------------------------ |
| `src/components/quiz-list/`                             | **Delete**（play-flow 28.1 正本） | リストエディタ一式                   |
| `src/app/list/`                                         | **Delete**（play-flow 28.1 正本） | リスト作成・編集ルート               |
| `src/lib/list-editor-classes.ts`                        | **Delete**                        | リストエディタ Tailwind クラスマップ |
| `tests/components/list-type-selector.test.tsx`          | **Delete**                        | —                                    |
| `tests/components/question-list-attach-panel.test.tsx`  | **Delete**                        | —                                    |
| `tests/components/creator-skeleton-components.test.tsx` | **Modify**                        | `ListEditorSkeleton` 期待除去        |
| `e2e/quiz-list.spec.ts`                                 | **Delete**                        | リスト E2E 専用                      |
| `e2e/phase8.spec.ts`                                    | **Modify**                        | リスト作成・attach シナリオ削除      |
| `e2e/creator-streaming-skeleton.spec.ts`                | **Modify**                        | `list-editor-skeleton` シナリオ削除  |

**維持**
- `src/app/quiz/create`, `src/app/quiz/[id]/edit`, `quiz-editor-loader.tsx`
- `src/components/quiz/quiz-list-skeleton.tsx` — クリエイターダッシュボード用（クイズ一覧 Suspense）。リスト機能とは無関係

### 4. Architecture（Phase 26 改定）

```mermaid
graph TD
    subgraph Foundation [quizetika-ui-foundation]
        Globals[globals.css CSS vars]
        Primitives[Button Card Input Dialog Tabs]
    end

    subgraph EditorSpec [quizetika-ui-editor Phase 26]
        QuizEditor[QuizEditorContent Container]
        SubComps[editor/* Presentational]
        Sortable[SortableSortingList]
        Markdown[MarkdownPreview Content]
    end

    subgraph Services [Out of Boundary]
        QuizSvc[services/quiz]
        Validation[quiz-validation]
    end

    subgraph Routes [App Router]
        QuizCreate[/quiz/create]
        QuizEdit[/quiz/id/edit]
    end

    Foundation --> SubComps
    QuizEditor --> SubComps
    QuizEditor --> Sortable
    QuizEditor --> Markdown
    QuizEditor --> QuizSvc
    QuizEditor --> Validation
    Routes --> QuizEditor
```

Phase 24 Migration Strategy の **Phase 4（ListEditor + AttachPanel）** および **Phase 6 E2E の `quiz-list.spec.ts`** は **キャンセル**。Phase 1–3・5–6（クイズエディタ部分）は完了済み。

### 5. Requirements Traceability（Phase 26）

| Req  | Summary                      | Component / Action                        |
| ---- | ---------------------------- | ----------------------------------------- |
| 26.1 | リストコンポーネント削除     | `components/quiz-list` 不存在確認         |
| 26.2 | リストルート削除             | `/list/*` 404                             |
| 26.3 | import 掃除                  | grep 確認                                 |
| 26.4 | リスト専用 Jest 削除         | tests/components                          |
| 26.5 | E2E 更新                     | quiz-list.spec 削除、phase8/skeleton 改修 |
| 26.6 | クイズエディタ回帰           | quiz-creation, phase8 クイズ部分          |
| 26.7 | ダッシュボード skeleton 維持 | `quiz-list-skeleton.tsx`                  |

### 6. Testing Strategy（Phase 26）

| 種別             | 検証                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| **Grep / build** | `quiz-list-editor`・`question-list-attach`・`list-editor-loader` import ゼロ                      |
| **E2E**          | `quiz-creation.spec.ts` 下書き保存フルフロー                                                      |
| **E2E**          | `phase8.spec.ts` — クイズ参照リンク・genre-editor のみ（リスト attach なし）                      |
| **E2E**          | `creator-streaming-skeleton.spec.ts` — `quiz-editor-skeleton` のみ（`list-editor-skeleton` なし） |
| **Regression**   | 8 形式・参照問題・Markdown・sorting DnD                                                           |
 
 **Effort**: **S**（0.5 日、`quizetika-play-flow-ui` 28.1 完了後の確認・E2E 掃除）
 
---

## Phase 27: ジャンル選択UIの検索バー化（サジェスト付き）

### 1. Overview
クイズエディタにおけるジャンル選択UIを、従来のプルダウン（`<select>`）から、入力に応じたサジェスト候補表示と選択が可能な検索バー（`<input type="text">` ＋絶対配置のドロップダウンリスト）に置き換えます。これにより、マスタデータ（`genres`）に登録されている多数のジャンルから目的のものを探しやすくなり、操作性が向上します。

### 2. Boundary Commitments（Phase 27）
* **This Spec Owns**:
  * `src/components/quiz/genre-editor-select.tsx` のUI/UXリファクタリング。
  * `tests/components/genre-editor-select.test.tsx` の Jest テスト修正。
  * 各種 E2E テスト内のジャンル選択手順の修正（`selectFirstGenre` 関数等の更新）。
* **Out of Boundary**:
  * データモデル（`Quiz` 型の `genre`, `canonicalGenreId` フィールド等）の構造変更。
  * `genres` マスタデータ取得サービス（`listActiveGenres` 等）のロジック変更。

### 3. File Structure Plan（Phase 27）

| ファイル                                        | 操作       | 責務                                                                                                   |
| ----------------------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| `src/components/quiz/genre-editor-select.tsx`   | **Modify** | プルダウンからサジェスト付き検索バー（インプット ＋ ポップオーバー）へのリファクタリング。             |
| `tests/components/genre-editor-select.test.tsx` | **Modify** | 検索バーの挙動（サジェスト、絞り込み、選択、orphan値表示、エラー表示等）に合わせた Jest テストの更新。 |
| `e2e/phase8.spec.ts`                            | **Modify** | `selectFirstGenre` を検索バー操作に変更。                                                              |
| `e2e/advanced-quiz-features.spec.ts`            | **Modify** | `genreSelect` 操作手順を検索バー操作に変更。                                                           |
| `e2e/learning-support.spec.ts`                  | **Modify** | `genreSelect` 操作手順を検索バー操作に変更。                                                           |
| `e2e/moderation-feedback.spec.ts`               | **Modify** | `genreSelect` 操作手順を検索バー操作に変更。                                                           |

### 4. Component Details & Flows

#### `GenreEditorSelect`
* **ローカルステート**:
  * `searchQuery` (`string`): 検索バーの入力値。初期値は `value`（ジャンルID）に合致する `genres` の `displayName` とする。見つからない場合は `value` そのもの（`hasOrphanValue`）を表示。
  * `isOpen` (`boolean`): ドロップダウンポップアップの表示・非表示フラグ。
  * `isFocused` (`boolean`): 入力バーのフォーカス状態。
* **レンダリング構成**:
  * 全体を囲むラッパー要素: `data-testid="genre-editor-select-wrap"`
  * インプット要素: `<input type="text">` に `data-testid="genre-editor-search-input"` を付与。
  * ポップアップ要素: `<div class="absolute z-50 ...">`。`isOpen` が `true` の時のみレンダリングし、`data-testid="genre-editor-search-dropdown"` を付与。
  * 候補リスト項目: 各項目は `data-testid={`genre-editor-search-option-${g.id}`}` を付与。
* **ユーザー操作とイベントの流れ**:
  1. **フォーカス / クリック**:
     * 検索バーにフォーカス、またはクリックしたとき、`isOpen` を `true` にし、入力内容が空なら全ジャンル候補を表示。
  2. **キーワード入力**:
     * ユーザーが文字を入力したとき、`searchQuery` を更新。
     * 表示候補を `g.displayName` に入力文字列が部分一致（大文字小文字を区別せず）するものにフィルタリング。
     * 一致するものが存在しない場合、「一致するジャンルがありません」とポップアップに表示。
  3. **候補選択**:
     * リスト内の候補を `onMouseDown`（`e.preventDefault()` を併用して blur による非表示を防ぐ）またはクリックしたとき、その候補の `id` で `onChange(genreId)` をトリガー。
     * `searchQuery` を選択したジャンルの `displayName` に更新し、`isOpen` を `false` に変更。
  4. **フォーカスアウト (Blur)**:
     * ドロップダウン以外をクリックしてフォーカスが外れた場合、`isOpen` を `false` に変更。
     * 選択されている有効なジャンルがある場合、`searchQuery` の値をそのジャンルの `displayName` にリセット（入力中の未選択テキストを破棄）。
  5. **マスタ未登録値のハンドリング (Orphan Value)**:
     * `value` が空ではなく、`genres` の中に一致するものが存在しない場合（`hasOrphanValue` が真）、インプットには `value`（または `value` が orphanLabel として渡された文字列）を表示。インプットの横または下に警告表示（「マスタ未登録」）を表示し、既存仕様を維持。

### 5. Testing Strategy

* **Unit Tests (`genre-editor-select.test.tsx`)**:
  * 検索入力による絞り込み表示のテスト（`history` と入力して「歴史」が表示されること）。
  * 候補クリックで `onChange` が期待するIDで呼ばれることのテスト。
  * フォーカス時に全候補が表示されることのテスト。
  * orphan 値が正しく初期値として検索バーに表示されることのテスト。
  * エラー・再試行ボタンの検証。
* **E2E Tests (`e2e/*.spec.ts`)**:
  * Playwright でのジャンル選択アクションを以下のように更新し、テストが通ることを検証：
    ```typescript
    // 例: 検索バー操作への更新
    async function selectFirstGenre(page: Page) {
      const searchInput = page.getByTestId('genre-editor-search-input');
      await expect(searchInput).toBeVisible({ timeout: 15000 });
      await searchInput.focus(); // フォーカスしてドロップダウンを表示
      
      const dropdown = page.getByTestId('genre-editor-search-dropdown');
      await expect(dropdown).toBeVisible({ timeout: 15000 });
      
      // 最初のアクティブなジャンル候補をクリック
      const firstOption = dropdown.locator('[data-testid^="genre-editor-search-option-"]').first();
      await expect(firstOption).toBeVisible({ timeout: 15000 });
      await firstOption.click();
    }

## Phase 31: 複合形式における許容問題形式の拡張 (2026-07 設計詳細)

### 1. 概要と目標
本フェーズでは、クイズ全体の出題形式が複合（`mixed`）の際、作問UIで「連想（`association`）」形式を切り替え・追加可能にし、また形式変換時も連想問題が維持されるように設計します。

### 2. UIコンポーネント設計
* `src/components/quiz/editor/question-card.tsx`
  * `format === 'mixed'` 条件時、問題タイプトグルのコンテナである `editorClasses.typeToggle` 内に「連想」用の `<button type="button">` を追加します。
  * 切り替え時のイベントハンドラとして `handlers.onToggleQuestionType(qIdx, 'association')` を紐付けます。
* `src/components/quiz/quiz-editor.tsx`
  * 全体の出題形式が `mixed` に変更された際、`handleFormatChange`（または対応するハンドラ）で問題形式の強制リセットルールである `allowedTypes` 配列に `'association'` を追加します。これにより、すでに「連想」問題が含まれている場合に強制的に「選択式」へ変換されてしまうのを防ぎます。

### 3. 表示ラベルと言語設計
* `src/lib/quiz-format-labels.ts`
  * `getFormatDescription` の `'mixed'` キーに対応する説明文を、「選択式・〇✕問題・記述式・並び替え・連想を自由に組み合わせ可能」へ変更します。

### 4. File Structure Plan（Phase 31）

| ファイル                                       | 操作       | 責務                                                                        |
| ---------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| `src/components/quiz/editor/question-card.tsx` | **Modify** | 複合形式時の問題タイプトグルに「連想」ボタンを追加                          |
| `src/components/quiz/quiz-editor.tsx`          | **Modify** | `format` が `mixed` に変更された際の `allowedTypes` に `association` を追加 |
| `src/lib/quiz-format-labels.ts`                | **Modify** | 複合形式の説明文（`getFormatDescription`）を更新                            |

### 5. Requirements Traceability（Phase 31）

| Req  | Summary                          | Component                                                         |
| ---- | -------------------------------- | ----------------------------------------------------------------- |
| 31.1 | 複合形式での「連想」トグル追加   | `question-card.tsx` の問題タイプトグルに「連想」ボタンを追加      |
| 31.2 | `mixed` 変更時の「連想」形式維持 | `quiz-editor.tsx` 内の `allowedTypes` 判定に `association` を追加 |
| 31.3 | 複合形式の説明文更新             | `quiz-format-labels.ts` の `getFormatDescription` 変更            |

### 6. Testing Strategy（Phase 31）

| 種別           | 検証                                                                                                                                      |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| **Component**  | `QuestionCard` — `format === 'mixed'` の際、「連想」切り替えボタンが表示され、クリック時に `onToggleQuestionType` がトリガーされること    |
| **Regression** | `QuizEditor` — 全体の出題形式を「連想」から「複合」に切り替えた際、既存の「連想」問題が「選択式」へ強制変換されずにそのまま維持されること |
| **Regression** | `QuizEditor` — 全体の出題形式を「早押し」から「複合」に切り替えた際、既存の「早押し」が「選択式」（デフォルト形式）へ強制変換されること   |

**Effort**: **XS** (既存のJSXボタン追加、説明文リフレッシュ、配列変更のみ)
**Risk**: **Low** (UIトグルおよび説明テキストの修正であり、全体へのリスクは極めて低い)

**Document Status（Phase 31 設計）**: 本節に反映。

    ```
