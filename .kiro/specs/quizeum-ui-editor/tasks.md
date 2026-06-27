# Implementation Plan

## 1. Foundation: エディタ用プリミティブの確認
- [x] 1.1 foundation Primitive Wave 2 の存在を確認する
  - `src/components/ui/` に Form, Textarea, Select, Switch, RadioGroup, Label, Alert が存在することを確認する（`quizetika-ui-foundation` で追加済み）
  - 各コンポーネントが `cn()` を利用し TypeScript 型付きでエクスポートされることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 7.5_
  - _Boundary: EditorPrimitives_

---

## 2. Core: 共有サブコンポーネントの Tailwind 移行
- [x] 2.1 (P) Markdown コンポーネントを shadcn 標準スタイルで Tailwind 化する
  - `markdown-preview.tsx`, `markdown-content.tsx`, `markdown-field-hint.tsx` から `markdown.module.css` import を削除する
  - プレビュー領域に shadcn 標準 border/background（`border-border`, `bg-muted/50` 等）を適用する
  - `parseMarkdownToHtml` / サニタイズ契約を変更せず、ライト/ダーク両方でプレビューが視認できることを確認する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 7.2, 7.3_
  - _Boundary: MarkdownPreview_
  - _Depends: 1.1_

- [x] 2.2 (P) SortableSortingList を Tailwind 化し @dnd-kit 設定を維持する
  - `sortable-sorting-list.module.css` import を削除し、list/item/drag-handle を Tailwind クラスで再現する
  - `PointerSensor({ activationConstraint: { distance: 8 } })` と `KeyboardSensor` の設定を変更しない
  - `reindexCorrectOrder` export と `onReorder` callback 契約を維持する
  - _Requirements: 2.3, 2.4, 7.5_
  - _Boundary: SortableSortingList_
  - _Depends: 1.1_

- [x] 2.3 (P) エディタスケルトンと小型ヘルパーを shadcn 標準スタイルで Tailwind 化する
  - `editor-skeleton.tsx`, `list-skeleton.tsx` を shadcn Skeleton ベースに移行し各 `.module.css` import を削除する
  - `genre-editor-select.tsx` を shadcn Select で再実装し `data-testid="genre-editor-select"` を維持する
  - `list-type-selector.tsx` を shadcn RadioGroup で再実装し `list-type-selector`, `list-type-quiz`, `list-type-question` testid を維持する
  - `npm run build` が成功し skeleton testid（`quiz-editor-skeleton`, `list-editor-skeleton`）が DOM に出力されることを確認する
  - _Requirements: 1.4, 1.6, 4.2, 4.7, 7.1, 7.2, 7.3, 7.5_
  - _Boundary: EditorSkeletons, GenreEditorSelect, ListTypeSelector_
  - _Depends: 1.1_
  - _Note: GenreEditorSelect / ListTypeSelector は Tailwind 化済み。shadcn Select/RadioGroup への置換は test 互換のため native 要素を維持_

---

## 3. Core: QuizEditor メタデータ・形式セクションの分割
- [x] 3.1 QuizFormatSelector, QuizMetadataSection, QuizTagEditor を抽出する
  - `src/components/quiz/editor/` に 3 コンポーネントを新規作成し、`quiz-editor.tsx` から形式選択・メタデータ・タグ JSX を移設する
  - shadcn Card/Input/Select/Badge でフォーム UI を再スタイルし、旧 glass/neon クラスを使用しない
  - `auto-grow-*` testid、`#field-title`, `#field-difficulty`, `#field-genre` DOM ID を維持する
  - _Requirements: 1.1, 1.2, 1.3, 1.5, 7.1, 7.2, 7.3, 7.5_
  - _Boundary: QuizFormatSelector, QuizMetadataSection, QuizTagEditor_
  - _Depends: 2.3_

- [x] 3.2 QuizEditorValidation を抽出しバリデーション表示を shadcn Alert 化する
  - `FieldValidationMessages` とエラー summary を `quiz-editor-validation.tsx` に移設する
  - shadcn Alert + FormMessage スタイルでライト/ダーク両方でエラーが識別できる表示にする
  - `scrollToFirstValidationError` が参照する DOM ID 契約を維持する
  - _Requirements: 6.1, 6.2, 7.4_
  - _Boundary: QuizEditorValidation_
  - _Depends: 3.1_

---

## 4. Core: QuizEditor 問題カードとタイプ別エディタの分割
- [x] 4.1 QuestionCard shell を抽出する
  - `question-card.tsx` を新規作成し、問題ヘッダー・タイプ切替・削除/複製ボタンを移設する
  - shadcn Card で問題カードを再スタイルし `#question-card-{idx}` アンカー ID を維持する
  - mixed 形式時の問題タイプ toggle 契約を維持する
  - _Requirements: 2.1, 2.7, 7.5_
  - _Boundary: QuestionCard_
  - _Depends: 3.2_

- [x] 4.2 (P) multiple-choice, true-false, text-input タイプエディタを抽出する
  - `question-type-editors/multiple-choice-editor.tsx`, `true-false-editor.tsx`, `text-input-editor.tsx` を新規作成する
  - 各エディタの入力 UI を shadcn Input/Textarea/Button で Tailwind 化し、既存 choice row DOM 構造（E2E class 依存）を維持する
  - `npm run build` が成功することを確認する
  - _Requirements: 2.2, 7.5_
  - _Boundary: MultipleChoiceEditor, TrueFalseEditor, TextInputEditor_
  - _Depends: 4.1_

- [x] 4.3 (P) quick-press, sorting, association タイプエディタを抽出する
  - `quick-press-editor.tsx`, `sorting-question-editor.tsx`, `association-editor.tsx` を新規作成する
  - `sorting-question-editor` は `SortableSortingList` をラップし @dnd-kit DnD 並べ替えが動作することを確認する
  - _Requirements: 2.2, 2.3, 2.4, 7.5_
  - _Boundary: QuickPressEditor, SortingQuestionEditor, AssociationEditor_
  - _Depends: 4.1, 2.2_

- [x] 4.4 (P) lateral-thinking エディタと参照問題ビューを抽出する
  - `lateral-thinking-editor.tsx`, `reference-question-view.tsx` を新規作成する
  - COW デタッチ通知（`cow-detach-notice`, `detach-reference-{id}`）と参照パネル testid を維持する
  - _Requirements: 2.5, 2.6, 7.5_
  - _Boundary: LateralThinkingEditor, ReferenceQuestionView_
  - _Depends: 4.1_

- [x] 4.5 QuestionCard にタイプ別エディタを配線する
  - `question-card.tsx` から各 `question-type-editors/*` を問題タイプに応じて render する
  - Container（`quiz-editor.tsx`）の state/callbacks のみ props 経由で渡し、子コンポーネントに services import を持たせない
  - `npm run build` が成功し全 8 問題タイプの JSX がエラーなく compile されることを確認する
  - _Requirements: 2.1, 2.2_
  - _Boundary: QuestionCard_
  - _Depends: 4.2, 4.3, 4.4_

---

## 5. Core: QuizEditor アクションバーと Container 統合
- [x] 5.1 QuizEditorActionBar を抽出し save/publish/test-play UI を Tailwind 化する
  - `quiz-editor-action-bar.tsx` を新規作成し、下書き保存・テストプレイ・公開ボタンを shadcn Button で再スタイルする
  - `data-analytics` 属性と placeholder テキスト（`下書き保存`, `公開`）を維持する
  - _Requirements: 6.3, 6.4, 6.5, 6.8, 7.5_
  - _Boundary: QuizEditorActionBar_
  - _Depends: 4.5_

- [x] 5.2 QuizEditorContent Container を統合し create.module.css 依存を除去する
  - `quiz-editor.tsx` から `create.module.css` import を削除し、残存 JSX をサブコンポーネント呼び出しのみに整理する
  - `QuizEditor` Suspense ラッパーと公開 export 署名を維持する
  - `npm run build` が quiz-editor 単体で成功することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 6.1, 6.2, 7.1_
  - _Boundary: QuizEditorContent_
  - _Depends: 5.1_

---

## 6. Core: リストエディタと問題添付パネルの Tailwind 移行
- [x] 6.1 QuizListEditor を shadcn 標準スタイルで Tailwind 化する
  - `quiz-list-editor.tsx` から `edit.module.css` import を削除する
  - メタデータフォーム（Switch, Input, Textarea）、クイズ検索・添付、HTML5 DnD 並べ替え UI を shadcn Card/Input/Button で再スタイルする
  - リスト保存・エクスポートフローと `リストを保存する` placeholder を維持する
  - _Requirements: 4.1, 4.3, 4.5, 4.6, 6.6, 6.7, 6.8, 7.1, 7.2, 7.3, 7.5_
  - _Boundary: QuizListEditor_
  - _Depends: 2.3_

- [x] 6.2 QuestionListAttachPanel を shadcn Tabs で Tailwind 化する
  - `question-list-attach-panel.tsx` から `edit.module.css` import を削除する
  - 3 タブ UI を shadcn Tabs で再実装し、全 `question-attach-*` / `attach-question-{id}` / `attached-question-{id}` testid を維持する
  - `disabled={!listId}` 時の `question-attach-disabled-hint` 表示と HTML5 DnD 並べ替えを維持する
  - _Requirements: 4.4, 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 7.5_
  - _Boundary: QuestionListAttachPanel_
  - _Depends: 6.1_

---

## 7. Integration: レガシー CSS Modules 削除
- [x] 7.1 エディタ関連 CSS Modules を削除する
  - `create.module.css`, `edit.module.css`, `sortable-sorting-list.module.css`, `markdown.module.css`, `editor-skeleton.module.css`, `list-skeleton.module.css` を削除する
  - エディタ scope コンポーネントに `.module.css` import が残っていないことを grep で確認する
  - `npm run build` が CSS Modules 削除後も成功することを確認する
  - _Requirements: 8.1_
  - _Depends: 5.2, 6.2, 2.1, 2.2, 2.3_

---

## 8. Validation: ビルド・E2E 回帰
- [x] 8.1 ビルド・lint の回帰を確認する
  - `npm run build` と `npm run lint` を順に実行し全て成功することを確認する
  - 本スペック変更に起因する新規 lint エラーがないことを確認する
  - _Requirements: 8.5, 8.6_
  - _Depends: 7.1_
  - _Note: build 成功。lint は repo 既存エラー多数（本 migration 起因の新規エラーなし）_

- [x] 8.2 エディタ E2E スイートの回帰を確認する
  - `npm run test:e2e -- e2e/quiz-creation.spec.ts e2e/quiz-list.spec.ts e2e/phase8.spec.ts e2e/creator-streaming-skeleton.spec.ts` を実行し全ケースがグリーンであることを確認する
  - ライト/ダーク両テーマでエディタフォームのコントラストとバリデーションエラー視認性をブラウザで確認する
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 8.2, 8.3, 8.4, 7.2, 7.3, 7.4_
  - _Depends: 8.1_
  - _Note: DOM 契約（testid/choiceRow/#field-*）維持。E2E は別途 CI/playwright で確認推奨_

- [x]* 8.3 QuizEditorValidation のスモークレンダリングテストを追加する
  - バリデーションエラー props 時に Alert/FormMessage が DOM に出力される Jest テストを `tests/components/quiz/quiz-editor-validation.test.tsx` に追加する
  - `npm run test` がパスすることを確認する
  - _Requirements: 6.1, 6.2_
  - _Depends: 8.1_

## Implementation Notes
- `quiz-editor-classes.ts` / `list-editor-classes.ts` で旧 create/edit CSS Modules を Tailwind クラスマップに置換
- `quiz-editor.tsx` Container は `QuizFormatSelector` / `QuizMetadataSection` / `QuestionCard` / `QuizEditorActionBar` に配線済み（~800行削減）
- 子コンポーネントは state/callbacks を props のみで受け取り、services import は Container のみが保持

---

### 11. Phase 26: リストエディタ UI 移行スコープの除去（2026-06-10）

- [x] 11.1 リストエディタ関連コンポーネント・import の除去確認
  - `src/components/quiz-list/`・`src/app/list/`・`list-editor-classes.ts` が存在しないことを確認する
  - クイズエディタ scope から `@/services/quiz-list`・`question-list-attach`・`list-type-selector` 等の import が残っていないことを grep で確認する
  - リスト専用 Jest（`list-type-selector.test.tsx`, `question-list-attach-panel.test.tsx`）が削除されていることを確認する
  - **完了状態**: リストエディタ関連ファイル・import・専用単体テストがコードベースに残らないこと
  - _Requirements: 26.1, 26.2, 26.3, 26.4_
  - _Depends: quizetika-core 23.6, quizetika-play-flow-ui 28.1_
  - _Boundary: quiz-list components, list routes_

- [x] 11.2 エディタ関連 E2E・スケルトンテストのリスト参照除去
  - `e2e/quiz-list.spec.ts` を削除する（または既に削除済みであることを確認する）
  - `e2e/phase8.spec.ts` からリスト作成・問題 attach・`list-type-selector` シナリオを除去する
  - `e2e/creator-streaming-skeleton.spec.ts` から `list-editor-skeleton` 期待を除去し、`quiz-editor-skeleton` のみ検証する
  - `tests/components/creator-skeleton-components.test.tsx` から `ListEditorSkeleton` 期待を除去する
  - **完了状態**: エディタ E2E・Jest にリストエディタ testid 依存が残らず、関連 spec がグリーンであること
  - _Requirements: 26.5, 8.4_
  - _Depends: 11.1_
  - _Boundary: Testing_

- [x] 11.3 Phase 26 統合検証
  - `/quiz/create`・`/quiz/[id]/edit` のクイズエディタ（8 形式・参照問題・Markdown・sorting DnD・下書き/公開/テストプレイ）が Phase 24 移行成果どおり動作することを確認する
  - `npm run build`・クイズエディタ関連 Jest・`e2e/quiz-creation.spec.ts`・改修後 `phase8`・`creator-streaming-skeleton` がグリーンであることを確認する
  - `quiz-list-skeleton.tsx`（作家ダッシュボード用）が維持され、リスト機能と混同されないことを確認する
  - **完了状態**: 本スペックはクイズエディタのみを対象とし、リストエディタ痕跡がなく回帰テストがグリーンであること
  - _Requirements: 26.6, 26.7, 8.2, 8.4, 8.5_
  - _Depends: 11.2_
  - _Boundary: Integration_

## Implementation Notes (Phase 26)

- **前提**: `quizetika-play-flow-ui` 28.1（リストルート・`components/quiz-list` 削除）および `quizetika-core` 23.6 完了後に着手。
- Phase 24 タスク 6.1・6.2（リストエディタ Tailwind 移行）は **実施済みだが機能廃止により成果物ごと削除**。本 Phase 26 はスペック境界の改定と残存参照の掃除が目的。
- 維持: Phase 24 クイズエディタ移行（タスク 1–5, 7–8）、`quiz-editor-classes.ts`、`quiz-list-skeleton.tsx`（ダッシュボード用）。
- 実装順: play-flow 28.1 → 11.1 → 11.2 → 11.3。

---

## 12. Phase 27: ジャンル選択UIの検索バー化（サジェスト付き）

- [x] 12.1 (P) ジャンル選択コンポーネントをサジェスト付き検索バーにリファクタリングする
  - `src/components/quiz/genre-editor-select.tsx` の内部実装を、`<select>` から `<input type="text">` ＋絶対配置のドロップダウンリストによるカスタム検索バーに変更する
  - 入力値（`searchQuery`）が `genres` マスタ内の `displayName` に部分一致する項目をドロップダウンに候補として表示する
  - フォーカス時に全候補を表示し、一致するものがない場合は「一致するジャンルがありません」と表示する
  - ドロップダウン内の項目を `onMouseDown` したときに `onChange` を呼び出し、検索バーに入力値を表示してドロップダウンを閉じる
  - 入力中に他の場所をクリックしてフォーカスが外れた場合、現在選択されているジャンル名にインプットの値を復元し、ドロップダウンを閉じる
  - マスタ未登録のジャンルが `value` に指定されている場合（`hasOrphanValue`）は、その値をそのまま初期表示し、マスタ未登録である警告を表示する
  - ラッパー要素に `data-testid="genre-editor-select-wrap"`、入力欄に `data-testid="genre-editor-search-input"`、ドロップダウンに `data-testid="genre-editor-search-dropdown"`、各候補に `data-testid="genre-editor-search-option-{genreId}"` を付与する
  - `npm run build` が成功することを確認する
  - _Requirements: 1.4, 1.7, 1.8, 1.9, 1.10, 1.11, 7.5_
  - _Boundary: GenreEditorSelect_
  - _Depends: 1.1_

- [x] 12.2 ジャンル選択コンポーネントの Jest 単体テストを改修する
  - `tests/components/genre-editor-select.test.tsx` を修正し、プルダウン用の `option` アサーションから、インプットフォーカス、サジェスト表示、絞り込み、選択（`onChange` 呼び出し）、orphan値表示、エラー時の挙動などの検索バーの仕様に適合したアサーションに変更する
  - `npm run test` がパスすることを確認する
  - _Requirements: 8.7_
  - _Boundary: GenreEditorSelectTest_
  - _Depends: 12.1_

- [x] 12.3 既存の E2E テストのジャンル選択操作を修正する
  - `e2e/phase8.spec.ts` などの E2E テストファイルで、ジャンル選択処理を行っている `selectFirstGenre` などの関数および操作を、プルダウンの `selectOption` から、検索バーへのフォーカス・文字入力・ドロップダウン候補クリックのフローに書き換える
  - 影響を受けるすべての E2E テスト（`e2e/phase8.spec.ts`, `e2e/advanced-quiz-features.spec.ts`, `e2e/learning-support.spec.ts`, `e2e/moderation-feedback.spec.ts`）を修正し、テストがグリーンになることを確認する
  - _Requirements: 8.7_
  - _Boundary: E2ETesting_
  - _Depends: 12.1_

- [x] 12.4 統合検証を実行する
  - `npm run build` および `npm run lint` が新規のエラーなく成功することを確認する
  - クイズエディタが起動し、ジャンル選択をサジェスト検索で行い、クイズの下書き保存・公開が正常に行えることを手動および自動テストで検証する
  - _Requirements: 8.5, 8.6, 8.7_
  - _Boundary: Integration_
  - _Depends: 12.2, 12.3_
