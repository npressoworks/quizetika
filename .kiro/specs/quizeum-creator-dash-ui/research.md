# Research & Design Decisions: quizeum-creator-dash-ui

## Summary
- **Feature**: quizeum-creator-dash-ui
- **Discovery Scope**: Extension（Phase 12 — 作問エディタ UX 改善）
- **Key Findings**:
  - テキストエリア自動伸長の既存実装なし。`field-sizing: content` は未使用。`scrollHeight` 同期の小さな制御コンポーネントが最も確実。
  - `filterAuthorQuizzes` はタイトル+説明のみ照合。設問照合には `getQuestionsByQuiz` のバッチ取得が必要だが、自作クイズ数は限定的でインデックス不要。
  - リンク成功フィードバックは `success-client.tsx` の `copyToast` パターンを参考に、パネル内インライン `role="status"` で十分。

## Research Log

### 既存 UI ギャップ（Phase 8）
- **Context**: 要件 6・7 の実装起点を特定
- **Sources Consulted**: `quiz-list-editor.tsx`, `quiz-editor.tsx`, `list/[id]/page.tsx`
- **Findings**:
  - `createQuizList` 呼び出しは `listType: 'quiz'` ハードコード（L173）
  - 設問アタッチ・`exportQuestionList`・参照リンクパネルは未実装
  - `GenreEditorSelect` / Phase 6 は完了
  - リスト詳細の設問リスト分岐は play-flow で完了
- **Implications**: Phase 8 タスクは `QuizListEditor` 分岐 + 新コンポーネント + `QuizEditor` パネルが中心

### Core API 利用可能性
- **Context**: 設計の Allowed Dependencies 確定
- **Sources Consulted**: `quiz-list.ts`, `question.ts`, `author-quiz-search.ts`, `linked-question.ts`
- **Findings**:
  - `createQuizList({ listType })`, `addQuestionToList`, `reorderQuestionList`, `exportQuestionList` 利用可能
  - `searchAuthorQuizzes` + `getQuestionsByQuiz` で自作検索（下書き含む）
  - `getBookmarkedQuestions` で BM 設問取得
  - 他者公開設問: `addQuestionToList` は検証済みだが検索 API なし
- **Implications**: `useQuestionAttachSearch` が3ソースを UI 層で統合

### 公開設問探索の代替手段
- **Context**: 要件 6.4 の3ソース目
- **Findings**:
  - `searchQuizzes(keyword, limit)` で公開クイズを取得し、各 `getQuestionsByQuiz` で設問を展開（上限 N=20 でコスト抑制）
  - `authorId !== currentUser` で他者のみにフィルタ
- **Implications**: 設計に `public-explore` タブとして明記。将来 core に専用 API があれば hook 内差し替え可

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks | 判定 |
|--------|-------------|-----------|-------|------|
| A | `QuizListEditor` 単体肥大化 | ファイル数少 | 600行超・テスト困難 | 却下 |
| B | `QuestionListAttachPanel` + hook 分離 | 境界明確、play-flow と同型 | 新規ファイル 4–5 | **採用** |
| C | 設問リスト専用 `/list/create-question` ルート | URL 分離 | 要件 4 と重複、ルート増 | 却下 |

## Design Synthesis

### Generalization
- **検索 UI**: 設問リスト（6.4）と参照パネル（7.2）はともに「キーワード → クイズ/設問候補 → 選択」だが、データソースが異なるため hook は分離（`useQuestionAttachSearch` / `useAuthorQuizReferenceSearch`）。共有は `question-attach-search.ts` のテキストフィルタのみ。

### Build vs. Adopt
- **採用**: 既存 HTML5 DnD（クイズリストと同型）、`searchAuthorQuizzes`、`getBookmarkedQuestions`、`searchQuizzes`（読み取り）
- **新規**: `ListTypeSelector`, `QuestionListAttachPanel`, `AuthorQuizReferencePanel` のみ

### Simplification
- リスト詳細（要件 3）の Phase 8 表示は play-flow 実装を信頼し、creator-dash は編集導線（3.5）と作成時 `listType`（6.1）にスコープを限定

## Design Decisions

### Decision: 他者公開設問検索は searchQuizzes 経由
- **Context**: 要件 6.4、専用 API なし
- **Selected Approach**: `searchQuizzes` 上位20件 → 設問フラット化 → 他者・公開のみ
- **Rationale**: core 変更なしで要件充足。リスト編集は低頻度操作のため許容
- **Trade-offs**: 大量ヒット時の網羅性不足 → UI に「探索は上位結果のみ」注記

### Decision: 参照設問は表示コピー + linkKind 送信
- **Context**: 要件 7.4, 7.9, core CoW
- **Selected Approach**: エディタ state に参照メタ付き設問を保持し `saveQuiz` に委譲
- **Rationale**: core `partitionReferenceAndOwned` が永続化を担当（7.10）

## Risks & Mitigations
- **searchQuizzes による設問探索のレイテンシ** — デバウンス 300ms、limit 20、ローディング表示
- **参照設問の誤編集** — 読み取り専用デフォルト + CoW 警告（7.7）
- **listType 作成忘れ** — 新規保存ボタンを `listType` 未選択時 disabled（6.1）

## Research Log（Phase 12）

### テキストエリア自動伸長
- **Context**: 要件 8、既存 `quiz-editor.tsx` は固定 `minHeight`
- **Sources Consulted**: `quiz-editor.tsx`, `create.module.css`, プロジェクト全体 grep（`field-sizing` / `autosize` なし）
- **Findings**:
  - 対象4フィールド: 説明、問題文、真相（`aiContextDetails`）、解説
  - 新規 npm 依存はプロジェクト方針（Vanilla CSS、軽量）と不整合
- **Implications**: `AutoGrowTextarea` を `src/components/ui/` に新設し4箇所に適用

### 過去自作クイズ検索の設問照合
- **Context**: 要件 7.11、現行 `matchesKeyword` は title+description のみ
- **Sources Consulted**: `author-quiz-search.ts`, `lib/author-quiz-search.ts`, `canJudgeQuestion`（`test-play.ts`）
- **Findings**:
  - 正解テキストの型別ルールは `canJudgeQuestion` と対称（choices/correctTextAnswerList/truthKeywords/sortingItems）
  - `aiContextDetails`（真相裏設定）は GM 専用のため検索対象外とする（要件の「正解テキスト」は truthKeywords を指す）
  - `searchAuthorQuizzes` は既に `getQuizzesByAuthor` → `filterAuthorQuizzes` の2段構成
- **Implications**: キーワード時のみ `Promise.all(getQuestionsByQuiz)` を service 層で実行し、lib に questions map を渡す

### リンク成功フィードバック
- **Context**: 要件 7.13、現行 `handleLink` はサイレント
- **Findings**: グローバルトースト基盤なし。`copyToast` はボタン横インライン表示
- **Implications**: パネル内 `linkSuccessMessage` state + 3秒自動消去。`role="status"` でアクセシビリティ確保

## Architecture Pattern Evaluation（Phase 12）

| Option | Description | Strengths | Risks | 判定 |
|--------|-------------|-----------|-------|------|
| A | CSS `field-sizing: content` のみ | 実装最小 | Safari 等の互換・初回高さずれ | 補助手段に留める |
| B | `scrollHeight` 同期コンポーネント | 全ブラウザで予測可能、テスト容易 | 小コンポーネント追加 | **採用** |
| C | textarea ライブラリ（react-textarea-autosize 等） | 実績あり | 新規依存、Vanilla CSS 方針と不整合 | 却下 |

## Design Decisions（Phase 12）

### Decision: 設問照合は service 層バッチ取得 + lib 純関数
- **Context**: 要件 7.11、要件書は core 担当と記載
- **Selected Approach**: `searchAuthorQuizzes` 内でキーワード時に設問を並列取得し、`filterAuthorQuizzesWithQuestions` で OR 照合
- **Rationale**: 既存 Phase 8 パターン（`filterAuthorQuizzes` in lib）を拡張。UI hook は変更不要
- **Trade-offs**: 自作クイズ多数時のレイテンシ — ローディング表示で緩和（既存 `loading` state 再利用）

### Decision: 正解テキストから aiContextDetails を除外
- **Context**: 要件 7.11 の「正解テキスト」解釈
- **Selected Approach**: `truthKeywords` のみ（ウミガメ）。`aiContextDetails` は検索対象外
- **Rationale**: 裏設定は長文かつ GM 専用。ユーザー向け「回答文」はキーワード群

## Risks & Mitigations（Phase 12）
- **自作クイズ大量時の検索レイテンシ** — キーワード未指定時は設問取得スキップ。キーワード時は既存 loading UI
- **AutoGrow と手動 resize の競合** — `resize: vertical` 維持、自動伸長は最小高さ以上にのみ適用
- **jsdom での scrollHeight テスト** — テスト内で `Object.defineProperty(el, 'scrollHeight', { value: N })` を使用

## References
- `.kiro/specs/quizeum-core/design.md` — Phase 8 契約
- `.kiro/specs/quizeum-play-flow-ui/design.md` — リスト詳細・設問リストプレイ（Out of boundary）
- `src/lib/test-play.ts` — 設問タイプ別正解判定（Phase 12 正解テキスト抽出の対称ルール）
- `src/components/quiz-list/quiz-list-editor.tsx` — 現行クイズリスト編集

## Document Status
- 分析: Grep/Read + core API 確認
- Discovery 種別: **Light（Extension）**
- 外部 Web 調査: 不要
