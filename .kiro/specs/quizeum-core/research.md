# Research & Design Decisions: quizeum-core (Phase 5)

## Summary
- **Feature**: quizeum-core - dual leaderboard and play-history API
- **References (Phase 5)**: docs F-801/F-802, api updateLeaderboard, roadmap Phase 5

---

# Gap Analysis: quizeum-core - Phase 6 genre metadata alignment (2026-06-03)

## Analysis Summary

- **Scope**: Phase 6 roadmap + docs canonical: genre virtual merge, write-time canonicalGenreId, canonical query optimization, Security Rules, saveQuiz pipeline (quizeum-core boundary).
- **Current**: tagMerge governance mostly done; quiz save/queries/rules diverge from docs/api_specification.md.
- **Top gap**: saveQuiz does not set canonicalGenreId/canonicalTagIds; getQuizzesByGenre/Tag and getFailedQuestions use raw genre/tags only.
- **Recommended for design**: Option C Hybrid - new src/lib/metadata-resolution.ts, extend quiz.ts saveQuiz and queries, port firestore.rules from detailed_design section 6.5.
- **Size/Risk**: L effort, Medium risk (empty canonical on legacy quizzes, indexes, dual-query fallback tests).

## Document Status

- Inputs: requirements.md (req 7,2), design.md, docs/api_specification.md, db_design.md, detailed_design.md section 6, roadmap Phase 6 (canonical optimization In)
- Method: gap-analysis.md framework, codebase grep/read
- Steering: only roadmap.md + security.md; docs treated as canonical

## 1. Current State

| Module | Genre relevance |
|--------|-----------------|
| tagMerge.ts | High - merge, genre requests, voteGenreRequest |
| quiz.ts | Low - saveQuiz no canonical; getQuizzesByGenre genre== only |
| quiz-validation.ts | Low - genre non-empty only |
| moderation.ts | Harmful duplicate genre APIs (unused) |
| attempt.ts | Low - genreFilter uses quiz.genre |
| firestore.rules | Missing metadata_genres, genreRequests, mergeRequests |
| firestore.indexes.json | Missing canonicalGenreId composites |

## 2. Requirement-to-Asset Gaps

| Source | Expected | Gap |
|--------|----------|-----|
| api_spec save | master validation + canonical fields | Missing in saveQuiz |
| api_spec search perf | canonicalGenreId == / canonicalTagIds | Missing (In scope per user) |
| detailed_design 6.4.2 | mergedGenreIds + genre in | Missing |
| detailed_design 6.5 | metadata rules | Missing |
| spec req 2.1 vs docs F-203 | draft genre required | Constraint - pick canonical source |
| searchQuizzes | composite search service | Not implemented in src |

## 3. Options

### A: Extend quiz.ts inline - M / Medium risk
### B: New genre-metadata services - M-L / Low-Medium risk
### C: Hybrid (recommended candidate)
- metadata-resolution.ts + quiz/attempt extensions + rules/indexes
- Read C2: canonical query + genre-in fallback for legacy
- Write: always resolve canonicalGenreId on publish/update

## 4. Research Needed

- Draft genre required: requirements 2.1 vs docs
- Merge approval 70% vs genre 80%
- Include searchQuizzes in Phase 6 core?
- Optional backfill batch for empty canonicalGenreId

## 5. Effort

| Workstream | Effort | Risk |
|------------|--------|------|
| metadata-resolution + saveQuiz | M | Medium |
| queries + canonical C2 | M | Medium |
| firestore.rules | M | High |
| indexes + searchQuizzes optional | M-L | Medium |
| tests + dead code removal | S | Low |

Overall: L / Medium

## 6. Design Phase Recommendations

1. Option C + read C2 + write-time canonical required
2. APIs: listActiveGenres(), resolveCanonicalGenreId(), extended getQuizzesByGenre()
3. Indexes: status + canonicalGenreId + createdAt|playCount|bookmarksCount
4. Tests: metadata-resolution.test.ts, quiz-genre-query.test.ts
5. UI specs depend on core listActiveGenres (roadmap order)

## References (Phase 6)

- .kiro/steering/roadmap.md Phase 6
- docs/api_specification.md L140-148
- docs/detailed_design.md section 6.4.2, 6.5
- src/services/quiz.ts, tagMerge.ts, firestore.rules

---

# Design Synthesis: Phase 6 (2026-06-04)

## Summary
- **Approach**: Option C Hybrid + read C2 (canonical query + genre-in fallback)
- **Central module**: `src/lib/metadata-resolution.ts`
- **Governance**: `tagMerge.ts` only; remove `moderation.ts` genre stubs

## Design Decisions

### Decision: metadata-resolution lib
- **Rationale**: Same pattern as `leaderboard-ranking.ts` for Phase 5
- **Follow-up**: Unit tests in `metadata-resolution.test.ts`

### Decision: C2 read path for getQuizzesByGenre
- **Rationale**: Legacy quizzes with empty `canonicalGenreId` stay visible without mandatory batch
- **Trade-off**: Up to 2x queries per sort until backfill optional task

### Decision: searchQuizzes in core
- **Rationale**: Requirement 11.5; genre filter uses `resolveCanonicalGenreId` + expand

### Decision: User Ban and Security Rules Access Control (12.x)
- **Rationale**: BANされたユーザーによるシステムへの書き込みをリアルタイムで確実に遮断するため、JWT トークンの有効期限（最大1時間）に依存せず、Firestore Security Rules で `isNotBanned()` ヘルパーを適用して各コレクションへの書き込みを即座にブロックする。
- **Auth Session**: クライアント側で `quizeum_banned` Cookie を付与し、BAN検知時に強制ログアウトおよび制限画面へのルーティングを行う。

## Risks
- Missing firestore.rules blocks client tag create on save ? Phase 6 must ship rules with saveQuiz changes
- Index deployment lag causes query failures until indexes propagated
- BANされたユーザーのセッションキャッシュやトークン有効期間中のローカル処理による不整合 -> セキュリティルールでの直接チェックにより、Firestoreに対する不正なデータの永続化は即時エラーとなり防御される。

---

# Gap Analysis: quizeum-core — Phase 8 ブックマーク・リスト・設問再利用（2026-06-05）

## Analysis Summary

- **Scope**: 要件 13–15（分類ブックマーク、クイズリスト／設問リスト、`question-list` プレイ、自作クイズ検索・参照リンク再利用）。UI は隣接スペック。roadmap Phase 8 + アプローチ 1（`listType` 単一コレクション）を前提。
- **Brownfield 資産**: `bookmarks` の 3 `targetType`、`QuizList.questionIds`、`toggleBookmark` / `getBookmarked*` / `addQuestionToList` の断片は既存。`docs/` と `api_specification.md` は Phase 8 機能を先行記述済み。
- **最大ギャップ**: (1) `createQuiz` / `updateQuiz` が常に新規 `questions/{id}` を生成し参照リンク未対応、(2) `listType` と設問リストプレイパイプライン未実装、(3) ブックマーク取得・設問追加時の「親クイズ published」検証と設問ブックマーク通知が未接続。
- **設計へ持ち越し（Research Needed）**: 参照リンク設問の編集時ポリシー（切り離し vs 元へ波及）、複数 `quizId` にまたがる `question-list` プレイのセッション組み立て。
- **推奨（design 候補）**: Option C Hybrid — `quiz.ts` / `quiz-list.ts` / `bookmark.ts` / `question.ts` を拡張し、参照リンク解決と設問リストプレイは専用モジュール（例: `linked-question.ts`, `question-list-play.ts`）に分離。
- **規模 / リスク**: Phase 8 単体 **L**（1–2週）、**Medium**（共有設問の保存セマンティクスと横断プレイ）。

## Document Status

- **Inputs**: `requirements.md`（要件 13–15）、`roadmap.md` Phase 8、`docs/requirements_definition.md` F-403/408/504/506、`docs/db_design.md`、`docs/api_specification.md`
- **Method**: `gap-analysis.md` フレームワーク + `src/services/*`, `src/types/index.ts`, `firestore.rules`, `tests/` grep
- **Requirements approval**: `spec.json` — `generated: true`, `approved: false`（ギャップ分析は未承認でも実施）
- **並行フェーズ**: Phase 6（ジャンル canonical）・Phase 7（BAN）は roadmap 上未完了 — Phase 8 design は依存最小化を推奨

## 1. Current State Investigation

### 1.1 関連モジュール

| 領域 | 主要ファイル | 状態 |
|------|-------------|------|
| ブックマーク | `src/services/bookmark.ts` | `toggleBookmark`（quiz/list/question）、`getBookmarkedQuizzes` / `getBookmarkedLists`、E2E 用 localStorage モック |
| 設問 | `src/services/question.ts` | `getQuestion`, `getQuestionsByQuiz`, `toggleBookmarkQuestion`, `getBookmarkedQuestions`, `addQuestionToList` / `removeQuestionFromList` |
| リスト | `src/services/quiz-list.ts`, `quiz-list-utils.ts` | クイズリスト CRUD、`reorderQuizList`, `exportQuizList`（クイズのみ） |
| クイズ保存 | `src/services/quiz.ts` | `createQuiz` / `updateQuiz` — 全入力設問を新規 or 同一クイズ内 ID で upsert、**他クイズ ID 参照なし** |
| 型 | `src/types/index.ts` | `Bookmark.targetType`, `QuizList.questionIds`, `Attempt.mode` に **`question-list` なし**、`Question` に参照フィールドなし |
| 通知 | `src/services/notification.ts` | `type: 'bookmark'` あり、`toggleBookmark` からの発火なし |
| Rules | `firestore.rules` | `targetType in ['quiz','list','question']` のみ — `listType`・参照リンク検証なし |
| UI（参考） | `src/app/bookmarks/page.tsx` | クイズブックマークのみ（コア外だが統合テスト観点でギャップ） |
| テスト | `tests/services/` | `bookmark` / `question-list` / `linked-question` の Phase 8 専用テスト **なし** |

### 1.2 確立済みパターン（拡張時に踏襲）

- ブックマーク: `${userId}_${targetId}` + トランザクションで対象 `bookmarksCount` 更新（`bookmark.ts`）
- リスト IN クエリ: 10 件チャンク（`bookmark.ts`, `quiz-list.ts`, `question.ts`）
- クイズ保存: `writeBatch` で `questions` + `quizzes` 同期（`quiz.ts`）
- リストプレイ: `attempts.listId` + `mode: 'list'`（要件 5、既存実装）
- サービス層を App から直接呼び出し（ブックマーク用 API Route なし）

### 1.3 docs との整合

| docs | Phase 8 記述 | コード |
|------|-------------|--------|
| `db_design.md` | `questionIds` on lists/questions | 型・サービスにフィールドあり、`listType` **なし** |
| `api_specification.md` | `toggleBookmarkQuestion`, 分類一覧 | 関数は分散、統合取得・親クイズメタ **未実装** |
| `requirements_definition.md` F-408, F-506 | 設問 BM / マイリスト | コア関数のみ、UI・検証未接続 |

## 2. Requirement-to-Asset Map

### 要件 13: 分類ブックマーク

| AC | 期待 | 既存 | ギャップ |
|----|------|------|----------|
| 13.1 | 3種トグル + カウント | `toggleBookmark` | **OK**（設問は `toggleBookmarkQuestion` 経由） |
| 13.2 | 登録時 parent published | `toggleBookmark` | **Missing** — 設問登録時に親 `quizzes.status` 未検証 |
| 13.3 | 非公開親は登録拒否 | 同上 | **Missing** |
| 13.4 | 3分類一覧・降順 | 3 getter 分散 | **Partial** — 統合 API なし（UI が 3 呼び出しで可） |
| 13.5 | クイズ BM は公開のみ | `getBookmarkedQuizzes` | **OK**（`isPublished` フィルタ） |
| 13.6 | 設問 BM に親タイトル、非公開除外 | `getBookmarkedQuestions` | **Missing** — 親クイズ join・published フィルタなし |
| 13.7 | 他者設問 BM → 作成者通知 | `notification.ts` | **Missing** — `toggleBookmark` 後の通知未実装 |

### 要件 14: クイズリスト / 設問リスト

| AC | 期待 | 既存 | ギャップ |
|----|------|------|----------|
| 14.1 | 作成時タイプ指定 | `createQuizList` | **Missing** — `listType` フィールドなし |
| 14.2 | タイプ未設定 → クイズリスト | 読み取り全般 | **Missing** — デフォルト解釈ロジックなし |
| 14.3–14.4 | タイプ別メンバー更新 | `quiz-list` / `question.ts` | **Partial** — `addQuestionToList` あり、**listType ガードなし** |
| 14.5–14.6 | 公開設問のみ、他者可 | `addQuestionToList` | **Missing** — 親クイズ `published` 検証なし |
| 14.7 | タイプ不一致操作拒否 | — | **Missing** |
| 14.8 | `question-list` 連続プレイ | `Attempt.mode` | **Missing** — 型・保存・プレイ組み立て全体 |
| 14.9 | 作者別タイプ別一覧 | `getQuizListsByAuthor` | **Missing** — `listType` フィルタなし |
| 14.10 | 設問リストエクスポート | `exportQuizList` | **Missing** — クイズパッケージのみ |

追加ギャップ: `questionIds` の DnD 並び替え、設問リスト用 `getQuestionsInList` 相当、既存リストのマイグレーション方針（読み取り時 `quiz` デフォルト）。

### 要件 15: 自作検索・参照リンク

| AC | 期待 | 既存 | ギャップ |
|----|------|------|----------|
| 15.1 | キーワード/タグ検索（下書き含む） | `getQuizzesByAuthor` | **Partial** — author 絞りのみ、**タグ/説明のサーバ検索なし** |
| 15.2 | 設問詳細返却 | `getQuestionsByQuiz` | **OK**（検索 UI 用にラップ必要） |
| 15.3 | 参照リンク追加（複製なし） | `createQuiz` / `updateQuiz` | **Missing** — 常に新規 `questions` 作成 |
| 15.4 | 非自作リンク拒否 | — | **Missing** |
| 15.5 | 保存時重複レコード禁止 | `updateQuiz` | **Missing** — 参照 ID パス未定義 |
| 15.6 | 参照解除のみ、元削除しない | `updateQuiz` 削除ロジック | **Constraint** — 共有 ID の「削除」が他クイズを壊すリスク（design 必須） |

## 3. Implementation Approach Options

### Option A: 既存サービスへの集中拡張

- **拡張先**: `bookmark.ts`, `question.ts`, `quiz-list.ts`, `quiz.ts`, `types/index.ts`, `attempt.ts`
- **内容**: `listType`、検証、参照 ID を既存関数内に追加
- **Trade-offs**: ✅ ファイル数最小 / ❌ `quiz.ts` が既に大きく、参照リンクで更新ロジックが複雑化

### Option B: 新規モジュール中心

- **新規**: `linked-question.ts`（参照解決・detach）、`question-list-play.ts`（横断設問セッション）、`author-quiz-search.ts`（自作検索）
- **既存**: 薄いラッパーのみ
- **Trade-offs**: ✅ 責務分離・テスト容易 / ❌ 初期インターフェース設計コスト

### Option C: Hybrid（design フェーズの第一候補）

- **拡張**: `bookmark.ts`（検証・通知・設問一覧 enrich）、`quiz-list.ts`（`listType`、フィルタ、設問エクスポート）、`types`
- **新規**: 参照リンク + 設問リストプレイの専用モジュール、`quiz.ts` から呼び出し
- **Trade-offs**: ✅ Phase 5–7 と同パターン（`leaderboard-ranking.ts` 等）/ ❌ モジュール間契約の明文化が必要

## 4. Research Needed（design へ）

1. **参照リンク設問の編集**: 要件 Out — 切り離し（コピー新規）vs 元更新 vs 読み取り専用表示。`updateQuiz` の `authorId` 上書き（L252）が参照設問と衝突する。
2. **`question-list` プレイ**: 設問ごとに `quizId` が異なる場合のルーティング（`/quiz/[id]/play` 再利用 vs 専用 `/list/[id]/play-questions`）、`Attempt.quizId` の代表値、`failedQuestionIds` の集約。
3. **共有設問の削除ガード**: 複数クイズの `questionIds` に同一 ID があるとき、`updateQuiz` の `batch.delete` を抑止する参照カウント or `linkedQuizIds` 非正規化。
4. **インデックス**: `quizLists` の `authorId` + `listType` + `createdAt` 複合が必要か。
5. **通知ペイロード**: 設問 BM 時の `notifications` — `targetType` 拡張 or `questionId` + `quizId` メタ。
6. **Phase 6/7 との実装順**: Phase 8 は `saveQuiz` / Rules に触れる — Phase 6 canonical とのマージコンフリクトに注意。

## 5. Effort and Risk

| ワークストリーム | 内容 | Effort | Risk |
|------------------|------|--------|------|
| ブックマーク検証・一覧 enrich・通知 | 13.x | S–M | Low |
| `listType` + リスト CRUD/検証/エクスポート | 14.1–14.7, 14.9–14.10 | M | Low–Medium |
| `question-list` プレイ + Attempt 拡張 | 14.8 | M–L | **Medium** |
| 自作検索 API | 15.1–15.2 | S | Low |
| 参照リンク `createQuiz`/`updateQuiz` | 15.3–15.6 | M–L | **High**（共有設問・削除） |
| 型・Rules・docs 同期 | 横断 | S–M | Medium |
| テスト（Jest 結合 + E2E 触媒） | 横断 | M | Low |

**Phase 8 全体**: **L** / **Medium**（参照リンクと横断プレイが支配的）

## 6. Design Phase Recommendations（決定は design で）

1. **第一候補**: Option C — `listType` は `QuizList` 型と `createQuizList` に追加、読み取りデフォルト `'quiz'`。
2. **参照リンク**: `Question` に `sourceQuestionId?: string`（または `isLinked: boolean`）+ `quiz.ts` 保存パスで「既存 ID・他クイズ所属・author 一致」なら `batch.set` スキップし `questionIds` のみ追加。
3. **ブックマーク**: `getBookmarkedQuestions` 内で親 `quizzes` を chunk 取得し `status === 'published'` フィルタ + `parentQuizTitle` 付与；`toggleBookmark`（question）で事前検証；通知は `createNotification` を bookmark 成功分岐に追加。
4. **設問リストプレイ**: 新ヘルパー `resolveQuestionListSession(listId)` → 順序付き `Question[]`；完了時 `mode: 'question-list'`, `listId` 設定（`quizId` は先頭設問の親 or 専用センチネルは design で固定）。
5. **検索**: `searchAuthorQuizzes(authorId, { keyword?, tag? })` — Firestore の全文検索限界のため、初版は `getQuizzesByAuthor` + クライアントフィルタ or `title` 前方一致の複合（性能は design で明記）。
6. **テスト**: `tests/services/bookmark-question.test.ts`, `quiz-list-question-type.test.ts`, `quiz-linked-question.test.ts` を新設。
7. **隣接スペック**: `quizeum-play-flow-ui` / `quizeum-creator-dash-ui` は core API 契約確定後に requirements 更新（roadmap 順）。

## References (Phase 8)

- `.kiro/steering/roadmap.md` — Phase 8（アプローチ 1、設問リスト B）
- `.kiro/specs/quizeum-core/requirements.md` — 要件 13–15
- `src/services/bookmark.ts`, `question.ts`, `quiz-list.ts`, `quiz.ts`
- `docs/api_specification.md`, `docs/db_design.md`, `docs/detailed_design.md` §1.6

---

# Design Synthesis: Phase 8（2026-06-05）

## Summary

- **Feature**: quizeum-core Phase 8 — bookmarks, question lists, linked question reuse
- **Discovery Scope**: Extension（light discovery + gap 分析再利用）
- **Key Findings**:
  - 既存 `toggleBookmark` / `questionIds` 断片を Option C Hybrid で拡張
  - 参照設問編集は Copy-on-Write 切り離しで要件 Out の UX ギャップを解消
  - 設問リストプレイはクイズリストと同様「メンバーごと1 attempt」

## Design Decisions

### Decision: Copy-on-Write for referenced question edits

- **Context**: 要件 15.3 は参照リンク（複製なし）。編集時の元クイズ波及は Out。
- **Alternatives**: (1) 元ドキュメント直接更新 (2) 読み取り専用 (3) Copy-on-Write
- **Selected**: 内容変更時のみ新規 `questions` doc を作成し当該クイズの `questionIds` を差し替え。未変更参照は ID のみ追加。
- **Rationale**: 自作クイズ間の再利用と編集自由度を両立。他クイズの参照は `canDeleteQuestionDoc` で保護。
- **Trade-offs**: エディタが `linkKind` を送る必要あり。浅い比較で変更検知。

### Decision: One attempt per question in question-list play

- **Context**: 14.8 と既存 5.5 の対称性
- **Selected**: `mode: 'question-list'`, `listId`, 各設問の `quizId` で attempt を個別記録
- **Rationale**: `saveAttempt` / プレイ履歴 / LB ロジックへの侵入が最小

### Decision: searchAuthorQuizzes in-memory filter

- **Context**: Firestore に全文検索なし、自作のみ下書き含む
- **Selected**: `getQuizzesByAuthor` + keyword/tag フィルタ
- **Rationale**: 作者スコープは件数有限。インデックス追加不要。

## Risks & Mitigations

- 共有設問の誤削除 — `canDeleteQuestionDoc` + 参照パスでは delete しない
- `updateQuiz` の authorId 上書き — 参照 ID は `batch.set` スキップ
- Phase 6 saveQuiz とのコンフリクト — 参照パスを `saveQuiz` 内の独立分岐としてマージ

## References

- `.kiro/specs/quizeum-core/design.md` — Phase 8 セクション
- Gap analysis 本ファイル Phase 8 節

