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

---

# Research & Design Decisions: quizeum-core（Phase 10 差分 — 2026-06-05）

## Summary
- **Feature**: `listActiveTags` + `searchQuizzes({ tags })` 複数タグ AND
- **Discovery Scope**: Extension（`listActiveGenres` / `getQuizzesByTag` / Phase 9 `searchQuizzes` パターン踏襲）
- **Key Findings**:
  - `metadata_tags` に `isActive` は無く、存続判定は `canonicalId == null` が正本（`db_design.md`）。
  - `SearchFilters` に `tags` 未実装。タグのみ検索時は `needle` 空で `getLatestQuizzes` に落ちる。
  - `getQuizzesByTag` は既に `resolveCanonicalTagIds` + canonical/legacy 併用 — AND 照合は純関数抽出が妥当。

## Design Decisions

### Decision: 存続タグ = `canonicalId == null`
- **Rationale**: ジャンルの `isActive` とは異なり、タグはマージで `canonicalId` が設定される。吸収済みタグをサジェストから除外できる。
- **Trade-offs**: マスタに存在しないチップタグはサジェストに無いが、検索時は `normalizeTag` + legacy 照合でヒットしうる。

### Decision: 複数タグ AND は getQuizzesByTag 積集合 + quizMatchesAllTags
- **Alternatives**: (1) 常に latest 100 から後段フィルタ (2) タグごと intersect (3) Firestore 複合 array-contains（不可）
- **Selected**: 2 + 後段 `quizMatchesAllTags` で legacy 漏れ防止。キーワードあり時は Phase 9 母集団の後段 AND。
- **Rationale**: タグごとの既存クエリを再利用し、要件 11.3 と照合規則を一致させる。

### Decision: quiz-tag-match を lib に分離
- **Rationale**: `getQuizzesByTag`・`searchQuizzes`・将来の author 検索で共有。テスト容易。

## Risks & Mitigations
- **intersect 上限 100/タグ** — ホーム探索用途では十分。極端な件数は Phase 10 Out。
- **play-flow 先行実装** — core タスクを先にマージし、`useHomeQuizFeed` は `tags` 配列を渡すのみ。

## Document Status（Phase 10）
- Discovery 種別: **Light（Extension）**
- 外部調査: 不要

---

# Gap Analysis: quizeum-core（Phase 10 実装後 & Phase 11 — 2026-06-05）

## Analysis Summary

- **Phase 10（要件 16）**: **実装済み**。`listActiveTags`・`searchQuizzes({ tags })` 複数タグ AND・`quiz-tag-match` 分離・単体テスト（`quiz-list-active-tags.test.ts`, `quiz-search-tags-and.test.ts`）が存在。
- **Phase 11（要件 17）**: **未着手**。`SearchFilters` に `format` なし。`searchQuizzes` 末尾フィルタに出題形式照合なし。
- **scoped 検索（要件 17.4–5）**: **部分実装**。`filters.genreId` + `expandGenreIdsForQuery` によるジャンル固定 AND は既存。Phase 11 では `format` 追加とテスト強化のみでジャンルページ向け API 契約を完結可能。
- **推奨（設計フェーズ）**: **Option A（既存 `searchQuizzes` 拡張）** — `SearchFilters.format?: QuizFormat` 追加、返却直前に `resolveQuizFormat` で後段フィルタ。新 API・インデックス不要。
- **規模 / リスク**: Phase 11 のみ **S（1–2日）/ Low** — 既存パターン踏襲、UI 非包含。

## Document Status

- **入力**: `requirements.md` 要件 16–17、roadmap Phase 10–11、`src/services/quiz.ts`, `src/lib/quiz-format.ts`, `tests/services/quiz-search-tags-and.test.ts`
- **手法**: gap-analysis.md フレームワーク、Grep/Read
- **分析日**: 2026-06-05

## 1. Requirement-to-Asset Map

| 要件 | 期待 | 現状 | ギャップ |
|------|------|------|----------|
| 16.1–5 `listActiveTags` | 存続タグ一覧 | `quiz.ts` L87–101、`useActiveTags` | ✅ なし |
| 16.6–13 タグ AND | `SearchFilters.tags` + AND 照合 | `buildTagMatchSpecs`, `intersectQuizzesById`, `quizMatchesAllTags` | ✅ なし |
| 17.1 形式フィルタ | 指定形式のみ返却 | 未実装 | ❌ **Missing** |
| 17.2 条件 AND 合成 | format + 既存フィルタ | genre/tags/difficulty あり、format なし | ❌ **Missing** |
| 17.3 format 未指定 | 従来挙動維持 | 暗黙的に満たす（追加後も default 未指定で OK） | ⚠️ テスト要 |
| 17.4–5 scoped genre | ジャンル固定 + 他条件 AND | `filters.genreId` + `expandGenreIdsForQuery` L817–824 | ✅ ロジックあり（format 追加後に結合テスト要） |
| 17.6 判定規則一致 | UI ラベルと同一 | `resolveQuizFormat` が lib に存在、core 未使用 | ❌ **Missing**（import + filter） |
| 17.7–8 境界 | UI/インデックス Out | 該当なし | ✅ |

## 2. Current State Investigation

### 再利用可能アセット

| モジュール | 役割 |
|-----------|------|
| `src/services/quiz.ts` | `SearchFilters`, `searchQuizzes`, `listActiveTags`, `listActiveGenres` |
| `src/lib/quiz-format.ts` | `resolveQuizFormat`, `QuizFormat` 型 |
| `src/lib/quiz-format-labels.ts` | UI 側ラベル（core は format id のみ照合） |
| `src/lib/quiz-tag-match.ts` | タグ AND 照合（形式フィルタも同様に lib 純関数化可） |
| `tests/services/quiz-search-tags-and.test.ts` | タグ AND / genreId 結合テストのテンプレ |

### 既存 `searchQuizzes` フロー（形式追加の挿入点）

1. 母集団取得（keyword / tags / genreId / latest）
2. needle 部分一致フィルタ
3. タグ AND（`quizMatchesAllTags`）
4. ジャンル展開フィルタ（`expandGenreIdsForQuery`）
5. difficulty / questionCount フィルタ
6. **← ここに `resolveQuizFormat` 一致フィルタを追加（Phase 11）**

## 3. Implementation Approach Options

### Option A: `searchQuizzes` 後段フィルタ拡張（推奨候補）

- **変更**: `SearchFilters.format?: QuizFormat`、`searchQuizzes` 末尾で `resolveQuizFormat(quiz) === filters.format`
- **Pros**: 最小 diff、Phase 9–10 パターン一致、インデックス不要
- **Cons**: 母集団が `getLatestQuizzes(100)` 等のとき形式不一致クイズが母集団に含まれうる（keyword/tags/genre 指定時は問題小）
- **Effort**: S / **Risk**: Low

### Option B: 形式別 Firestore クエリ

- **変更**: `where('format', '==', ...)` または composite index
- **Pros**: 大規模データで理論上効率化
- **Cons**: 要件 17.7 Out、旧データは `format` 欠落で `resolveQuizFormat` 必須 — 二重ロジック
- **Effort**: M / **Risk**: Medium

### Option C: 純関数 `quizMatchesFormat` を lib に分離（Hybrid）

- **変更**: Option A + `src/lib/quiz-format-match.ts`（タグ match と対称）
- **Pros**: 単体テスト容易、UI カルーセル定数と format id を共有しやすい
- **Cons**: ファイル 1 つ増
- **Effort**: S / **Risk**: Low

## 4. Research Needed（設計フェーズへ）

| 項目 | 内容 |
|------|------|
| 母集団上限 | keyword 空 + format のみ指定時、ベースを `getLatestQuizzes(100)` で足りるか（要件上は可。必要なら将来 `format` 専用取得） |
| `mixed` 旧データ | `format` 無しクイズの推定形式がカルーセル選択と一致するか — フィクスチャで検証 |
| scoped + sort | ジャンルページが `searchQuizzes` 切替時、ソート順をクライアント `sortQuizzesForList` で再適用するか（play-flow 設計） |

## 5. Effort & Risk Summary

| ワークストリーム | Effort | Risk |
|-----------------|--------|------|
| `SearchFilters.format` + 後段フィルタ | S | Low |
| `quiz-format-match` 純関数 + テスト | S | Low |
| scoped genre + format 結合テスト | S | Low |
| **Phase 11 合計** | **S** | **Low** |
| Phase 10 残差 | — | —（実装完了） |

## 6. Design Phase Recommendations

1. **Option A または C** を採用。Firestore index 新設は見送り。
2. 形式判定は **`resolveQuizFormat` のみ** — `quiz.format` 直読み禁止（要件 17.6）。
3. テスト: `quiz-search-format-filter.test.ts` — 各形式 1 件、`mixed` 推定、genreId + format AND、format 未指定 regression。
4. play-flow への契約: `useHomeQuizFeed` / ジャンルページ hook が `format` を `searchQuizzes` 第 2 引数に渡す。

---

# Research & Design Decisions: quizeum-core（Phase 11 差分 — 2026-06-05）

## Summary
- **Feature**: `SearchFilters.format` + `searchQuizzes` 出題形式後段フィルタ + `quiz-format-match` lib
- **Discovery Type**: Light（Extension）— Phase 10 `quiz-tag-match` パターン踏襲
- **Key Findings**:
  - Phase 10 実装済み。Phase 11 のみ未着手。
  - `resolveQuizFormat` は `src/lib/quiz-format.ts` に既存。UI `QuizCard` と同一規則で足りる。
  - scoped genre は `expandGenreIdsForQuery` 既存。形式追加は後段フィルタのみ。

## Design Decisions

### Decision: 後段 `quizMatchesFormat` フィルタ（Firestore index なし）
- **Context**: 要件 17.7、gap analysis Option A。
- **Selected**: 母集団取得（Phase 9/10）→ 既存 AND フィルタ → `quizMatchesFormat` → difficulty/questionCount。
- **Rejected**: `where('format','==',...)` — 旧データ推定不可、二重ロジック。
- **Rationale**: 探索母集団上限 100 件規模で十分。UI カードと判定 lib を共有。

### Decision: `quiz-format-match.ts` を新規 lib に分離
- **Context**: `quiz-tag-match` と対称。単体テスト容易。
- **Selected**: `quizMatchesFormat` + `applyFormatFilter` 薄いラッパ。
- **Rationale**: `searchQuizzes` 本体を肥大化させない。

## Document Status（Phase 11）
- 設計: `design.md` Phase 11 節追記済み
- 外部調査: 不要

### validate-design 反映（2026-06-05）
- **パイプライン順序**: `needle → tags AND → genre → format → difficulty/questionCount` を canonical 順序として固定。
- **レガシー形式推定**: `format` 未設定 + `questions: []` → `mixed` のみヒット。テストフィクスチャで期待値固定。

