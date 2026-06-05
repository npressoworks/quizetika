# Research & Design Decisions: quizeum-creator-dash-ui

## Summary
- **Feature**: quizeum-creator-dash-ui
- **Discovery Scope**: Extension（Phase 8 — 既存エディタ・リスト編集の拡張）
- **Key Findings**:
  - `quizeum-core` Phase 8 API は実装済み。`QuizListEditor` は新規作成時 `listType: 'quiz'` 固定が唯一のギャップ。
  - 他者公開設問のキーワード検索用の専用 core API はなく、`searchQuizzes` + 設問フラット化で要件 6.4 を満たす。
  - リスト詳細の `listType` 表示・設問一覧は `quizeum-play-flow-ui` が実装済み。本スペックは編集画面と参照リンク UI に集中。

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

## References
- `.kiro/specs/quizeum-core/design.md` — Phase 8 契約
- `.kiro/specs/quizeum-play-flow-ui/design.md` — リスト詳細・設問リストプレイ（Out of boundary）
- `src/components/quiz-list/quiz-list-editor.tsx` — 現行クイズリスト編集

## Document Status
- 分析: Grep/Read + core API 確認
- Discovery 種別: **Light（Extension）**
- 外部 Web 調査: 不要
