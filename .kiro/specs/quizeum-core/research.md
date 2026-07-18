# Research & Design Decisions: quizetika-core (Phase 5)

## Summary
- **Feature**: quizetika-core - dual leaderboard and play-history API
- **References (Phase 5)**: docs F-801/F-802, api updateLeaderboard, roadmap Phase 5

---

# Gap Analysis: quizetika-core - Phase 6 genre metadata alignment (2026-06-03)

## Analysis Summary

- **Scope**: Phase 6 roadmap + docs canonical: genre virtual merge, write-time canonicalGenreId, canonical query optimization, Security Rules, saveQuiz pipeline (quizetika-core boundary).
- **Current**: tagMerge governance mostly done; quiz save/queries/rules diverge from docs/api_specification.md.
- **Top gap**: saveQuiz does not set canonicalGenreId/canonicalTagIds; getQuizzesByGenre/Tag and getFailedQuestions use raw genre/tags only.
- **Recommended for design**: Option C Hybrid - new src/lib/metadata-resolution.ts, extend quiz.ts saveQuiz and queries, port firestore.rules from detailed_design section 6.5.
- **Size/Risk**: L effort, Medium risk (empty canonical on legacy quizzes, indexes, dual-query fallback tests).

## Document Status

- Inputs: requirements.md (req 7,2), design.md, docs/api_specification.md, db_design.md, detailed_design.md section 6, roadmap Phase 6 (canonical optimization In)
- Method: gap-analysis.md framework, codebase grep/read
- Steering: only roadmap.md + security.md; docs treated as canonical

## 1. Current State

| Module                 | Genre relevance                                             |
| ---------------------- | ----------------------------------------------------------- |
| tagMerge.ts            | High - merge, genre requests, voteGenreRequest              |
| quiz.ts                | Low - saveQuiz no canonical; getQuizzesByGenre genre== only |
| quiz-validation.ts     | Low - genre non-empty only                                  |
| moderation.ts          | Harmful duplicate genre APIs (unused)                       |
| attempt.ts             | Low - genreFilter uses quiz.genre                           |
| firestore.rules        | Missing metadata_genres, genreRequests, mergeRequests       |
| firestore.indexes.json | Missing canonicalGenreId composites                         |

## 2. Requirement-to-Asset Gaps

| Source                     | Expected                              | Gap                                |
| -------------------------- | ------------------------------------- | ---------------------------------- |
| api_spec save              | master validation + canonical fields  | Missing in saveQuiz                |
| api_spec search perf       | canonicalGenreId == / canonicalTagIds | Missing (In scope per user)        |
| detailed_design 6.4.2      | mergedGenreIds + genre in             | Missing                            |
| detailed_design 6.5        | metadata rules                        | Missing                            |
| spec req 2.1 vs docs F-203 | draft genre required                  | Constraint - pick canonical source |
| searchQuizzes              | composite search service              | Not implemented in src             |

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

| Workstream                       | Effort | Risk   |
| -------------------------------- | ------ | ------ |
| metadata-resolution + saveQuiz   | M      | Medium |
| queries + canonical C2           | M      | Medium |
| firestore.rules                  | M      | High   |
| indexes + searchQuizzes optional | M-L    | Medium |
| tests + dead code removal        | S      | Low    |

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
- **Auth Session**: クライアント側で `quizetika_banned` Cookie を付与し、BAN検知時に強制ログアウトおよび制限画面へのルーティングを行う。

## Risks
- Missing firestore.rules blocks client tag create on save ? Phase 6 must ship rules with saveQuiz changes
- Index deployment lag causes query failures until indexes propagated
- BANされたユーザーのセッションキャッシュやトークン有効期間中のローカル処理による不整合 -> セキュリティルールでの直接チェックにより、Firestoreに対する不正なデータの永続化は即時エラーとなり防御される。

---

# Gap Analysis: quizetika-core — Phase 8 ブックマーク・リスト・問題再利用（2026-06-05）

## Analysis Summary

- **Scope**: 要件 13–15（分類ブックマーク、クイズリスト／問題リスト、`question-list` プレイ、自作クイズ検索・参照リンク再利用）。UI は隣接スペック。roadmap Phase 8 + アプローチ 1（`listType` 単一コレクション）を前提。
- **Brownfield 資産**: `bookmarks` の 3 `targetType`、`QuizList.questionIds`、`toggleBookmark` / `getBookmarked*` / `addQuestionToList` の断片は既存。`docs/` と `api_specification.md` は Phase 8 機能を先行記述済み。
- **最大ギャップ**: (1) `createQuiz` / `updateQuiz` が常に新規 `questions/{id}` を生成し参照リンク未対応、(2) `listType` と問題リストプレイパイプライン未実装、(3) ブックマーク取得・問題追加時の「親クイズ published」検証と問題ブックマーク通知が未接続。
- **設計へ持ち越し（Research Needed）**: 参照リンク問題の編集時ポリシー（切り離し vs 元へ波及）、複数 `quizId` にまたがる `question-list` プレイのセッション組み立て。
- **推奨（design 候補）**: Option C Hybrid — `quiz.ts` / `quiz-list.ts` / `bookmark.ts` / `question.ts` を拡張し、参照リンク解決と問題リストプレイは専用モジュール（例: `linked-question.ts`, `question-list-play.ts`）に分離。
- **規模 / リスク**: Phase 8 単体 **L**（1–2週）、**Medium**（共有問題の保存セマンティクスと横断プレイ）。

## Document Status

- **Inputs**: `requirements.md`（要件 13–15）、`roadmap.md` Phase 8、`docs/requirements_definition.md` F-403/408/504/506、`docs/db_design.md`、`docs/api_specification.md`
- **Method**: `gap-analysis.md` フレームワーク + `src/services/*`, `src/types/index.ts`, `firestore.rules`, `tests/` grep
- **Requirements approval**: `spec.json` — `generated: true`, `approved: false`（ギャップ分析は未承認でも実施）
- **並行フェーズ**: Phase 6（ジャンル canonical）・Phase 7（BAN）は roadmap 上未完了 — Phase 8 design は依存最小化を推奨

## 1. Current State Investigation

### 1.1 関連モジュール

| 領域         | 主要ファイル                                      | 状態                                                                                                                                    |
| ------------ | ------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| ブックマーク | `src/services/bookmark.ts`                        | `toggleBookmark`（quiz/list/question）、`getBookmarkedQuizzes` / `getBookmarkedLists`、E2E 用 localStorage モック                       |
| 問題         | `src/services/question.ts`                        | `getQuestion`, `getQuestionsByQuiz`, `toggleBookmarkQuestion`, `getBookmarkedQuestions`, `addQuestionToList` / `removeQuestionFromList` |
| リスト       | `src/services/quiz-list.ts`, `quiz-list-utils.ts` | クイズリスト CRUD、`reorderQuizList`, `exportQuizList`（クイズのみ）                                                                    |
| クイズ保存   | `src/services/quiz.ts`                            | `createQuiz` / `updateQuiz` — 全入力問題を新規 or 同一クイズ内 ID で upsert、**他クイズ ID 参照なし**                                   |
| 型           | `src/types/index.ts`                              | `Bookmark.targetType`, `QuizList.questionIds`, `Attempt.mode` に **`question-list` なし**、`Question` に参照フィールドなし              |
| 通知         | `src/services/notification.ts`                    | `type: 'bookmark'` あり、`toggleBookmark` からの発火なし                                                                                |
| Rules        | `firestore.rules`                                 | `targetType in ['quiz','list','question']` のみ — `listType`・参照リンク検証なし                                                        |
| UI（参考）   | `src/app/bookmarks/page.tsx`                      | クイズブックマークのみ（コア外だが統合テスト観点でギャップ）                                                                            |
| テスト       | `tests/services/`                                 | `bookmark` / `question-list` / `linked-question` の Phase 8 専用テスト **なし**                                                         |

### 1.2 確立済みパターン（拡張時に踏襲）

- ブックマーク: `${userId}_${targetId}` + トランザクションで対象 `bookmarksCount` 更新（`bookmark.ts`）
- リスト IN クエリ: 10 件チャンク（`bookmark.ts`, `quiz-list.ts`, `question.ts`）
- クイズ保存: `writeBatch` で `questions` + `quizzes` 同期（`quiz.ts`）
- リストプレイ: `attempts.listId` + `mode: 'list'`（要件 5、既存実装）
- サービス層を App から直接呼び出し（ブックマーク用 API Route なし）

### 1.3 docs との整合

| docs                                      | Phase 8 記述                       | コード                                            |
| ----------------------------------------- | ---------------------------------- | ------------------------------------------------- |
| `db_design.md`                            | `questionIds` on lists/questions   | 型・サービスにフィールドあり、`listType` **なし** |
| `api_specification.md`                    | `toggleBookmarkQuestion`, 分類一覧 | 関数は分散、統合取得・親クイズメタ **未実装**     |
| `requirements_definition.md` F-408, F-506 | 問題 BM / マイリスト               | コア関数のみ、UI・検証未接続                      |

## 2. Requirement-to-Asset Map

### 要件 13: 分類ブックマーク

| AC   | 期待                             | 既存                     | ギャップ                                             |
| ---- | -------------------------------- | ------------------------ | ---------------------------------------------------- |
| 13.1 | 3種トグル + カウント             | `toggleBookmark`         | **OK**（問題は `toggleBookmarkQuestion` 経由）       |
| 13.2 | 登録時 parent published          | `toggleBookmark`         | **Missing** — 問題登録時に親 `quizzes.status` 未検証 |
| 13.3 | 非公開親は登録拒否               | 同上                     | **Missing**                                          |
| 13.4 | 3分類一覧・降順                  | 3 getter 分散            | **Partial** — 統合 API なし（UI が 3 呼び出しで可）  |
| 13.5 | クイズ BM は公開のみ             | `getBookmarkedQuizzes`   | **OK**（`isPublished` フィルタ）                     |
| 13.6 | 問題 BM に親タイトル、非公開除外 | `getBookmarkedQuestions` | **Missing** — 親クイズ join・published フィルタなし  |
| 13.7 | 他者問題 BM → 作成者通知         | `notification.ts`        | **Missing** — `toggleBookmark` 後の通知未実装        |

### 要件 14: クイズリスト / 問題リスト

| AC        | 期待                        | 既存                        | ギャップ                                                        |
| --------- | --------------------------- | --------------------------- | --------------------------------------------------------------- |
| 14.1      | 作成時タイプ指定            | `createQuizList`            | **Missing** — `listType` フィールドなし                         |
| 14.2      | タイプ未設定 → クイズリスト | 読み取り全般                | **Missing** — デフォルト解釈ロジックなし                        |
| 14.3–14.4 | タイプ別メンバー更新        | `quiz-list` / `question.ts` | **Partial** — `addQuestionToList` あり、**listType ガードなし** |
| 14.5–14.6 | 公開問題のみ、他者可        | `addQuestionToList`         | **Missing** — 親クイズ `published` 検証なし                     |
| 14.7      | タイプ不一致操作拒否        | —                           | **Missing**                                                     |
| 14.8      | `question-list` 連続プレイ  | `Attempt.mode`              | **Missing** — 型・保存・プレイ組み立て全体                      |
| 14.9      | 作者別タイプ別一覧          | `getQuizListsByAuthor`      | **Missing** — `listType` フィルタなし                           |
| 14.10     | 問題リストエクスポート      | `exportQuizList`            | **Missing** — クイズパッケージのみ                              |

追加ギャップ: `questionIds` の DnD 並び替え、問題リスト用 `getQuestionsInList` 相当、既存リストのマイグレーション方針（読み取り時 `quiz` デフォルト）。

### 要件 15: 自作検索・参照リンク

| AC   | 期待                              | 既存                        | ギャップ                                                                 |
| ---- | --------------------------------- | --------------------------- | ------------------------------------------------------------------------ |
| 15.1 | キーワード/タグ検索（下書き含む） | `getQuizzesByAuthor`        | **Partial** — author 絞りのみ、**タグ/説明のサーバ検索なし**             |
| 15.2 | 問題詳細返却                      | `getQuestionsByQuiz`        | **OK**（検索 UI 用にラップ必要）                                         |
| 15.3 | 参照リンク追加（複製なし）        | `createQuiz` / `updateQuiz` | **Missing** — 常に新規 `questions` 作成                                  |
| 15.4 | 非自作リンク拒否                  | —                           | **Missing**                                                              |
| 15.5 | 保存時重複レコード禁止            | `updateQuiz`                | **Missing** — 参照 ID パス未定義                                         |
| 15.6 | 参照解除のみ、元削除しない        | `updateQuiz` 削除ロジック   | **Constraint** — 共有 ID の「削除」が他クイズを壊すリスク（design 必須） |

## 3. Implementation Approach Options

### Option A: 既存サービスへの集中拡張

- **拡張先**: `bookmark.ts`, `question.ts`, `quiz-list.ts`, `quiz.ts`, `types/index.ts`, `attempt.ts`
- **内容**: `listType`、検証、参照 ID を既存関数内に追加
- **Trade-offs**: ✅ ファイル数最小 / ❌ `quiz.ts` が既に大きく、参照リンクで更新ロジックが複雑化

### Option B: 新規モジュール中心

- **新規**: `linked-question.ts`（参照解決・detach）、`question-list-play.ts`（横断問題セッション）、`author-quiz-search.ts`（自作検索）
- **既存**: 薄いラッパーのみ
- **Trade-offs**: ✅ 責務分離・テスト容易 / ❌ 初期インターフェース設計コスト

### Option C: Hybrid（design フェーズの第一候補）

- **拡張**: `bookmark.ts`（検証・通知・問題一覧 enrich）、`quiz-list.ts`（`listType`、フィルタ、問題エクスポート）、`types`
- **新規**: 参照リンク + 問題リストプレイの専用モジュール、`quiz.ts` から呼び出し
- **Trade-offs**: ✅ Phase 5–7 と同パターン（`leaderboard-ranking.ts` 等）/ ❌ モジュール間契約の明文化が必要

## 4. Research Needed（design へ）

1. **参照リンク問題の編集**: 要件 Out — 切り離し（コピー新規）vs 元更新 vs 読み取り専用表示。`updateQuiz` の `authorId` 上書き（L252）が参照問題と衝突する。
2. **`question-list` プレイ**: 問題ごとに `quizId` が異なる場合のルーティング（`/quiz/[id]/play` 再利用 vs 専用 `/list/[id]/play-questions`）、`Attempt.quizId` の代表値、`failedQuestionIds` の集約。
3. **共有問題の削除ガード**: 複数クイズの `questionIds` に同一 ID があるとき、`updateQuiz` の `batch.delete` を抑止する参照カウント or `linkedQuizIds` 非正規化。
4. **インデックス**: `quizLists` の `authorId` + `listType` + `createdAt` 複合が必要か。
5. **通知ペイロード**: 問題 BM 時の `notifications` — `targetType` 拡張 or `questionId` + `quizId` メタ。
6. **Phase 6/7 との実装順**: Phase 8 は `saveQuiz` / Rules に触れる — Phase 6 canonical とのマージコンフリクトに注意。

## 5. Effort and Risk

| ワークストリーム                           | 内容                  | Effort | Risk                       |
| ------------------------------------------ | --------------------- | ------ | -------------------------- |
| ブックマーク検証・一覧 enrich・通知        | 13.x                  | S–M    | Low                        |
| `listType` + リスト CRUD/検証/エクスポート | 14.1–14.7, 14.9–14.10 | M      | Low–Medium                 |
| `question-list` プレイ + Attempt 拡張      | 14.8                  | M–L    | **Medium**                 |
| 自作検索 API                               | 15.1–15.2             | S      | Low                        |
| 参照リンク `createQuiz`/`updateQuiz`       | 15.3–15.6             | M–L    | **High**（共有問題・削除） |
| 型・Rules・docs 同期                       | 横断                  | S–M    | Medium                     |
| テスト（Jest 結合 + E2E 触媒）             | 横断                  | M      | Low                        |

**Phase 8 全体**: **L** / **Medium**（参照リンクと横断プレイが支配的）

## 6. Design Phase Recommendations（決定は design で）

1. **第一候補**: Option C — `listType` は `QuizList` 型と `createQuizList` に追加、読み取りデフォルト `'quiz'`。
2. **参照リンク**: `Question` に `sourceQuestionId?: string`（または `isLinked: boolean`）+ `quiz.ts` 保存パスで「既存 ID・他クイズ所属・author 一致」なら `batch.set` スキップし `questionIds` のみ追加。
3. **ブックマーク**: `getBookmarkedQuestions` 内で親 `quizzes` を chunk 取得し `status === 'published'` フィルタ + `parentQuizTitle` 付与；`toggleBookmark`（question）で事前検証；通知は `createNotification` を bookmark 成功分岐に追加。
4. **問題リストプレイ**: 新ヘルパー `resolveQuestionListSession(listId)` → 順序付き `Question[]`；完了時 `mode: 'question-list'`, `listId` 設定（`quizId` は先頭問題の親 or 専用センチネルは design で固定）。
5. **検索**: `searchAuthorQuizzes(authorId, { keyword?, tag? })` — Firestore の全文検索限界のため、初版は `getQuizzesByAuthor` + クライアントフィルタ or `title` 前方一致の複合（性能は design で明記）。
6. **テスト**: `tests/services/bookmark-question.test.ts`, `quiz-list-question-type.test.ts`, `quiz-linked-question.test.ts` を新設。
7. **隣接スペック**: `quizetika-play-flow-ui` / `quizetika-creator-dash-ui` は core API 契約確定後に requirements 更新（roadmap 順）。

## References (Phase 8)

- `.kiro/steering/roadmap.md` — Phase 8（アプローチ 1、問題リスト B）
- `.kiro/specs/quizetika-core/requirements.md` — 要件 13–15
- `src/services/bookmark.ts`, `question.ts`, `quiz-list.ts`, `quiz.ts`
- `docs/api_specification.md`, `docs/db_design.md`, `docs/detailed_design.md` §1.6

---

# Design Synthesis: Phase 8（2026-06-05）

## Summary

- **Feature**: quizetika-core Phase 8 — bookmarks, question lists, linked question reuse
- **Discovery Scope**: Extension（light discovery + gap 分析再利用）
- **Key Findings**:
  - 既存 `toggleBookmark` / `questionIds` 断片を Option C Hybrid で拡張
  - 参照問題編集は Copy-on-Write 切り離しで要件 Out の UX ギャップを解消
  - 問題リストプレイはクイズリストと同様「メンバーごと1 attempt」

## Design Decisions

### Decision: Copy-on-Write for referenced question edits

- **Context**: 要件 15.3 は参照リンク（複製なし）。編集時の元クイズ波及は Out。
- **Alternatives**: (1) 元ドキュメント直接更新 (2) 読み取り専用 (3) Copy-on-Write
- **Selected**: 内容変更時のみ新規 `questions` doc を作成し当該クイズの `questionIds` を差し替え。未変更参照は ID のみ追加。
- **Rationale**: 自作クイズ間の再利用と編集自由度を両立。他クイズの参照は `canDeleteQuestionDoc` で保護。
- **Trade-offs**: エディタが `linkKind` を送る必要あり。浅い比較で変更検知。

### Decision: One attempt per question in question-list play

- **Context**: 14.8 と既存 5.5 の対称性
- **Selected**: `mode: 'question-list'`, `listId`, 各問題の `quizId` で attempt を個別記録
- **Rationale**: `saveAttempt` / プレイ履歴 / LB ロジックへの侵入が最小

### Decision: searchAuthorQuizzes in-memory filter

- **Context**: Firestore に全文検索なし、自作のみ下書き含む
- **Selected**: `getQuizzesByAuthor` + keyword/tag フィルタ
- **Rationale**: 作者スコープは件数有限。インデックス追加不要。

## Risks & Mitigations

- 共有問題の誤削除 — `canDeleteQuestionDoc` + 参照パスでは delete しない
- `updateQuiz` の authorId 上書き — 参照 ID は `batch.set` スキップ
- Phase 6 saveQuiz とのコンフリクト — 参照パスを `saveQuiz` 内の独立分岐としてマージ

## References

- `.kiro/specs/quizetika-core/design.md` — Phase 8 セクション
- Gap analysis 本ファイル Phase 8 節

---

# Research & Design Decisions: quizetika-core（Phase 10 差分 — 2026-06-05）

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

# Gap Analysis: quizetika-core（Phase 10 実装後 & Phase 11 — 2026-06-05）

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

| 要件                    | 期待                            | 現状                                                               | ギャップ                                      |
| ----------------------- | ------------------------------- | ------------------------------------------------------------------ | --------------------------------------------- |
| 16.1–5 `listActiveTags` | 存続タグ一覧                    | `quiz.ts` L87–101、`useActiveTags`                                 | ✅ なし                                        |
| 16.6–13 タグ AND        | `SearchFilters.tags` + AND 照合 | `buildTagMatchSpecs`, `intersectQuizzesById`, `quizMatchesAllTags` | ✅ なし                                        |
| 17.1 形式フィルタ       | 指定形式のみ返却                | 未実装                                                             | ❌ **Missing**                                 |
| 17.2 条件 AND 合成      | format + 既存フィルタ           | genre/tags/difficulty あり、format なし                            | ❌ **Missing**                                 |
| 17.3 format 未指定      | 従来挙動維持                    | 暗黙的に満たす（追加後も default 未指定で OK）                     | ⚠️ テスト要                                    |
| 17.4–5 scoped genre     | ジャンル固定 + 他条件 AND       | `filters.genreId` + `expandGenreIdsForQuery` L817–824              | ✅ ロジックあり（format 追加後に結合テスト要） |
| 17.6 判定規則一致       | UI ラベルと同一                 | `resolveQuizFormat` が lib に存在、core 未使用                     | ❌ **Missing**（import + filter）              |
| 17.7–8 境界             | UI/インデックス Out             | 該当なし                                                           | ✅                                             |

## 2. Current State Investigation

### 再利用可能アセット

| モジュール                                    | 役割                                                                   |
| --------------------------------------------- | ---------------------------------------------------------------------- |
| `src/services/quiz.ts`                        | `SearchFilters`, `searchQuizzes`, `listActiveTags`, `listActiveGenres` |
| `src/lib/quiz-format.ts`                      | `resolveQuizFormat`, `QuizFormat` 型                                   |
| `src/lib/quiz-format-labels.ts`               | UI 側ラベル（core は format id のみ照合）                              |
| `src/lib/quiz-tag-match.ts`                   | タグ AND 照合（形式フィルタも同様に lib 純関数化可）                   |
| `tests/services/quiz-search-tags-and.test.ts` | タグ AND / genreId 結合テストのテンプレ                                |

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

| 項目             | 内容                                                                                                                      |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------- |
| 母集団上限       | keyword 空 + format のみ指定時、ベースを `getLatestQuizzes(100)` で足りるか（要件上は可。必要なら将来 `format` 専用取得） |
| `mixed` 旧データ | `format` 無しクイズの推定形式がカルーセル選択と一致するか — フィクスチャで検証                                            |
| scoped + sort    | ジャンルページが `searchQuizzes` 切替時、ソート順をクライアント `sortQuizzesForList` で再適用するか（play-flow 設計）     |

## 5. Effort & Risk Summary

| ワークストリーム                      | Effort | Risk          |
| ------------------------------------- | ------ | ------------- |
| `SearchFilters.format` + 後段フィルタ | S      | Low           |
| `quiz-format-match` 純関数 + テスト   | S      | Low           |
| scoped genre + format 結合テスト      | S      | Low           |
| **Phase 11 合計**                     | **S**  | **Low**       |
| Phase 10 残差                         | —      | —（実装完了） |

## 6. Design Phase Recommendations

1. **Option A または C** を採用。Firestore index 新設は見送り。
2. 形式判定は **`resolveQuizFormat` のみ** — `quiz.format` 直読み禁止（要件 17.6）。
3. テスト: `quiz-search-format-filter.test.ts` — 各形式 1 件、`mixed` 推定、genreId + format AND、format 未指定 regression。
4. play-flow への契約: `useHomeQuizFeed` / ジャンルページ hook が `format` を `searchQuizzes` 第 2 引数に渡す。

---

# Research & Design Decisions: quizetika-core（Phase 11 差分 — 2026-06-05）

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

---

# Research: quizetika-core — Phase 13 Stripe サブスクリプション（2026-06-07）

## Summary
- **Feature**: quizetika-core — Pro プラン Stripe サブスクリプション（Checkout / Webhook / Portal / Entitlements）
- **Discovery Scope**: Extension（既存 `ask-ai` 制限・Admin SDK・auth-verify パターンを拡張）
- **Key Findings**:
  - `ask-ai` は既にサーバー側 `isPremium` 参照パターンを実装。`EntitlementService` へ集約すれば tier 拡張が容易。
  - `firestore.rules` で課金フィールドが未保護 — showstopper。Rules を先にデプロイ。
  - Stripe v22 + Checkout Sessions API が要件（リダイレクト Checkout）に最適。`payment_method_types` 省略で dynamic methods 有効。
  - `.env.local` に Stripe キー・Webhook secret は既設定。`STRIPE_PRICE_CREATOR_MONTHLY/YEARLY` のみ追加必要。

## Research Log

### 既存 ask-ai エンタイトルメント
- **Context**: 要件 4.2–4.4、19.15–19.17 の実装接点
- **Sources**: `src/app/api/attempt/ask-ai/route.ts`, `src/services/ask-ai-utils.ts`
- **Findings**: `isPremium` は Firestore 直読 + モデレーター免除。クライアント送信値は無視済み。プレイ UI は `isPremium: false` 固定（play-flow が修正担当）。
- **Implications**: Core は `resolveUserEntitlements` に置換し、`hasUnlimitedAiQuestions` を export。`isPremium` 同期書き込みで後方互換。

### Stripe 統合パターン
- **Context**: エンドツーエンド購読フロー選定
- **Sources**: `.agents/skills/stripe-best-practices/references/payments.md`, Stripe Checkout Sessions docs
- **Findings**: Checkout Sessions + Customer Portal が初版に最適。Webhook は raw body + Node runtime 必須。冪等は `event.id` ドキュメントで十分。
- **Implications**: `SubscriptionService` / `StripeWebhookAPI` を分離。Elements は Non-Goal。

### Firestore Rules ギャップ
- **Context**: 要件 19.18
- **Sources**: `firestore.rules` users match block
- **Findings**: `moderationTier` / `reputationScore` は保護済みだが `isPremium` / `subscriptionTier` は未保護
- **Implications**: owner update に課金フィールド不変条件を追加。書き込みは `getAdminFirestore()` のみ

## Architecture Pattern Evaluation

| Option                 | Description                        | Strengths    | Risks                         | Selected |
| ---------------------- | ---------------------------------- | ------------ | ----------------------------- | -------- |
| A. Full vertical slice | Checkout + Webhook + Portal + tier | E2E 価値完結 | Webhook 運用コスト            | Yes      |
| B. Checkout only       | 表示 + Checkout、Webhook 後回し    | 早い         | 購入後即時反映不可            | No       |
| C. Pricing Table embed | Stripe ホスト UI                   | 実装最小     | デザイン不整合、tier 拡張弱い | No       |

## Design Decisions

### Decision: tier マスタ + `subscriptionTier` enum
- **Context**: Pro のみ販売、Premium 将来追加
- **Selected**: `subscription-plans.ts` に `PAID_TIER_DEFINITIONS` + `priceIdToTier`
- **Rationale**: UI は `paidTiers.map()`、Webhook は priceId 解決のみ変更で Premium 追加可
- **Trade-offs**: 機能差分は `featureKeys` で表現（初版は `unlimited_ai_questions` のみ）

### Decision: `isPremium` 同期維持
- **Context**: 既存 `ask-ai` が `isPremium === true` を参照
- **Selected**: Webhook 更新時に `isPremium` を `hasPaidEntitlements` と同期書き込み
- **Rationale**: 段階的移行。最終的に `EntitlementService` 単一参照へ収束可能

### Decision: `stripe_processed_events` コレクション
- **Context**: 要件 19.10 冪等性
- **Selected**: `eventId` をドキュメント ID にした存在チェック
- **Rationale**: シンプル、Firestore トランザクション不要

## Risks & Mitigations
- **Webhook 遅延** — Checkout 成功直後は UI が `refreshUser` + 短いポーリングまたは success パラメータで再取得を促す（billing-ui 側）
- **Price ID 不一致** — 起動時 env バリデーション、`priceIdToTier` unknown はログ + スキップ
- **既存手動 isPremium** — Migration 段階で維持。長期は tier 正本へ

## References
- [Stripe Checkout Sessions](https://docs.stripe.com/api/checkout/sessions) — 購読開始
- [Stripe Customer Portal](https://docs.stripe.com/customer-management/portal-deep-dive) — 契約管理
- [Stripe Webhooks](https://docs.stripe.com/webhooks) — 署名検証・raw body
- `quizetika-billing-subscription-ui/brief.md` — UI 境界
- `roadmap.md` Phase 13 — 依存順序

---

# Gap Analysis: quizetika-core — Phase 13 Stripe サブスクリプション（2026-06-07）

## Analysis Summary

- **スコープ**: 要件 19（サブスクリプション契約とエンタイトルメント）および要件 4.2–4.4（tier ベース AI 制限）の実装ギャップ。Wave 0–11 のコア機能は概ね実装済み。本分析は **未実装の Phase 13 Stripe** に焦点を当てる。
- **現状**: Stripe npm 依存・`.env.local` の API キーは存在するが、**課金 API / Webhook / 型 / Rules / サービス層はゼロ**。`ask-ai` のみ ad-hoc な `isPremium` 直読（部分実装）。
- **クリティカルギャップ**: `firestore.rules` で `isPremium` / `subscriptionTier` が未保護 → クライアント改ざん可能（showstopper）。
- **推奨アプローチ**: 設計どおり **Option C（Hybrid）** — 新規 `entitlement.ts` / `subscription.ts` / billing API + `ask-ai` 改修 + Rules 更新。
- **メタギャップ**: `tasks.md` の Phase 13 は旧「難易度5段階化」（完了済み）のまま。Stripe 用タスクの再生成が必要。

## 1. Current State Investigation

### 1.1 再利用可能な資産

| 資産                | パス                                                     | 再利用方法                                                                                                          |
| ------------------- | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Bearer 認証パターン | `src/lib/firebase/auth-verify.ts`                        | Checkout / Portal API で同一                                                                                        |
| Admin Firestore     | `src/lib/firebase/admin.ts` (`getAdminFirestore`)        | Webhook・エンタイトルメント書き込み                                                                                 |
| BAN API ルート構造  | `src/app/api/admin/users/ban/route.ts`                   | billing API の骨格                                                                                                  |
| AI 制限純関数       | `src/services/ask-ai-utils.ts` (`isAiTurnLimitExceeded`) | `EntitlementService` から呼び出し継続可                                                                             |
| ask-ai サーバー検証 | `src/app/api/attempt/ask-ai/route.ts` L92–103            | `EntitlementService` へ置換対象                                                                                     |
| Stripe パッケージ   | `package.json` (`stripe` ^22.2.0)                        | 未 import — 導入のみ残                                                                                              |
| 環境変数（部分）    | `.env.local`                                             | `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` あり。**`STRIPE_PRICE_CREATOR_*` なし** |

### 1.2 命名・レイヤー規約

- API Routes: `src/app/api/<domain>/route.ts`
- ビジネスロジック: `src/services/*.ts`
- 共有型: `src/types/index.ts` または `src/types/subscription.ts`
- lib 純関数: `src/lib/*.ts`
- テスト: `tests/services/*.test.ts`, `tests/lib/*.test.ts`

### 1.3 統合サーフェス（既存）

- `users/{uid}` — プロフィール正本。課金フィールド未追加
- `users/{uid}/dailyAiTurnCounts/{quizId}` — AI 日次カウンタ（ask-ai が使用、Rules 未マッチ → クライアント deny）
- Firebase Auth ID Token — 全 billing API で必須

## 2. Requirement-to-Asset Map（Phase 13）

| Requirement | 必要アセット                     | 現状                      | ギャップ                                              |
| ----------- | -------------------------------- | ------------------------- | ----------------------------------------------------- |
| 19.1        | デフォルト `free` tier           | 暗黙（フィールドなし）    | **Missing** — 型・読み取りデフォルト未定義            |
| 19.2–19.3   | `subscriptionTier` enum + 拡張点 | なし                      | **Missing**                                           |
| 19.4        | 契約状態の一貫解釈               | なし                      | **Missing** — `EntitlementService`                    |
| 19.5–19.8   | Checkout Session API             | なし                      | **Missing**                                           |
| 19.9–19.12  | Webhook + 冪等                   | なし                      | **Missing**                                           |
| 19.13–19.14 | Portal Session API               | なし                      | **Missing**                                           |
| 19.15–19.17 | tier ベース AI 無制限            | `isPremium` 直読のみ      | **Partial** — tier / status 未考慮                    |
| 19.18       | Rules 課金フィールド保護         | `moderationTier` のみ保護 | **Missing（Critical）**                               |
| 19.19       | サーバー正本参照                 | ask-ai は DB 直読（良）   | **Partial** — クライアント `isPremium` 送信は無視済み |
| 4.2         | 無料 20回制限                    | 実装済み                  | **Constraint** — tier ではなく boolean                |
| 4.3         | Pro 無制限                       | `isPremium===true` のみ   | **Partial** — `subscriptionTier` 未連動               |
| 4.4         | サーバー契約参照                 | ask-ai で実装             | **Partial** — `EntitlementService` 未集約             |

### 2.1 存在しないファイル（設計 vs 実装）

```
src/lib/subscription-plans.ts          — Missing
src/lib/stripe/server.ts               — Missing
src/services/entitlement.ts            — Missing
src/services/subscription.ts           — Missing
src/types/subscription.ts              — Missing
src/app/api/billing/checkout-session/  — Missing
src/app/api/billing/portal-session/    — Missing
src/app/api/webhooks/stripe/           — Missing
```

### 2.2 改修が必要な既存ファイル

| ファイル                                         | 変更内容                                                    |
| ------------------------------------------------ | ----------------------------------------------------------- |
| `src/types/index.ts`                             | `User` に課金フィールド追加                                 |
| `src/app/api/attempt/ask-ai/route.ts`            | `EntitlementService` 利用                                   |
| `firestore.rules`                                | 課金フィールド不変 + `stripe_processed_events` deny         |
| `src/context/auth-context.tsx`                   | 読み取り時 `subscriptionTier` デフォルト（任意・UI 連携用） |
| `docs/db_design.md`, `docs/api_specification.md` | 同期（direct impl）                                         |

### 2.3 隣接スペック（コア外だが E2E に必須）

| 領域                 | スペック                            | ギャップ                |
| -------------------- | ----------------------------------- | ----------------------- |
| `/pricing` UI        | `quizetika-billing-subscription-ui` | 未着手（spec 未 init）  |
| プレイ画面 tier 表示 | `quizetika-play-flow-ui`            | `isPremium: false` 固定 |

## 3. Implementation Approach Options

### Option A: 既存 `ask-ai` のみ拡張

- `ask-ai/route.ts` に Stripe ロジックを直書き、Webhook も単一ファイルに集約
- **Trade-offs**: ファイル数最小 / 責務混在・テスト困難・Portal/Checkout 再利用不可
- **評価**: Phase 13 エンドツーエンドには不適切

### Option B: 設計どおり新規モジュール（推奨）

- `entitlement.ts` + `subscription.ts` + 3 API Routes + `subscription-plans.ts` を新規作成
- `ask-ai` は `EntitlementService` のみ依存
- **Trade-offs**: 境界明確・テスト容易・ファイル増 / 初回実装コスト中程度
- **評価**: `design.md` Phase 13 と一致。**推奨**

### Option C: Hybrid（段階ロールアウト）

1. Rules + `EntitlementService` + `ask-ai` 改修（セキュリティ先行）
2. Webhook + Checkout + Portal
3. docs / テスト / billing-ui 連携

- **Trade-offs**: リスク分散 / 計画複雑
- **評価**: 本番前の Rules 先行デプロイに有効。設計の Migration Strategy と整合

## 4. Effort & Risk

| 項目        | 評価           | 根拠                                                                    |
| ----------- | -------------- | ----------------------------------------------------------------------- |
| **Effort**  | **M（3–7日）** | 新規 7 ファイル + Rules + ask-ai 改修 + 結合テスト。UI は別スペック     |
| **Risk**    | **Medium**     | Webhook 署名・冪等・Stripe テストモード運用は既知パターン。未知技術なし |
| **Blocker** | Rules 未更新   | 実装前に `deploy:rules` で課金フィールド保護必須                        |

## 5. Research Needed（設計フェーズへ引き継ぎ済み／残確認）

| 項目                                         | 状態                                                                |
| -------------------------------------------- | ------------------------------------------------------------------- |
| Stripe Checkout Sessions + subscription mode | design.md で決定済み                                                |
| Webhook raw body + Node runtime              | design.md で決定済み                                                |
| **Stripe Dashboard Pro Product/Price 作成**  | 運用タスク — `STRIPE_PRICE_CREATOR_MONTHLY/YEARLY` を `.env` に設定 |
| Customer Portal 有効化（Dashboard）          | 運用タスク                                                          |
| ローカル Webhook 転送（`stripe listen`）     | 開発時 Research Needed（手順のみ）                                  |

## 6. Spec / ドキュメント整合ギャップ

| ドキュメント                    | 問題                                                        |
| ------------------------------- | ----------------------------------------------------------- |
| `tasks.md` §13                  | 「難易度5段階化」完了済み — **要件 19 Stripe タスク未生成** |
| `requirements.md` / `design.md` | Phase 13 = Stripe（整合）                                   |
| `User` 型 vs `ask-ai` 実行時    | `isPremium` が型にないが Firestore では参照（型ギャップ）   |

## 7. Recommendations for Implementation

1. **`/kiro-spec-tasks quizetika-core -y`** で Phase 13 Stripe タスクを再生成（旧 §13 は完了のまま、新 §14 または Phase 13 差し替えを検討）
2. 実装順序: **Rules → 型 + EntitlementService → Webhook → Checkout/Portal → ask-ai 切替 → テスト**
3. 並行: `/kiro-spec-init quizetika-billing-subscription-ui` で UI スペック開始
4. E2E は Stripe テストモード + `stripe listen --forward-to localhost:3000/api/webhooks/stripe`

## Document Status

- **方法**: gap-analysis.md フレームワーク + コードベース Grep/Read
- **入力**: `requirements.md`（要件 19）、`design.md`（Phase 13）、既存 `src/` / `firestore.rules`
- **出力先**: 本節（`research.md` 追記）

---

# Research: Phase 14 — ウミガメのスープ真相判定 AI 意味判定改定（2026-06-08）

## Summary

- **Feature**: `verify-truth` の B2 ハイブリッド（キーワード全一致 → AI バイパス）を廃止し、裏設定 + `truthKeywords` + プレイヤー要約の AI 意味判定に一本化。
- **Discovery type**: Extension（light）— 既存 `VerifyTruthAPI` 境界内の分岐・プロンプト改修のみ。
- **変更ファイル**: `verify-truth-utils.ts`, `verify-truth/route.ts`, `verify-truth-utils.test.ts`（+ docs 同期）。

## Research Log

### 1. 現行実装

| 箇所                     | 挙動                                                        |
| ------------------------ | ----------------------------------------------------------- |
| `route.ts` L112–135      | `verifyKeywords` 全一致 → 即 `isCorrect=true`、else AI      |
| `buildVerifyTruthPrompt` | `aiContextDetails` + `playerTruth` のみ（キーワード未渡し） |
| `test-play.ts`           | `checkTruthKeywordsLocally` — 独立実装、本番 API 非使用     |

### 2. 要件とのギャップ

| 要件 | 現行                         | 必要な変更                 |
| ---- | ---------------------------- | -------------------------- |
| 4.7  | キーワード検証が先           | AI に3要素を渡す           |
| 4.8  | 全一致で即合格               | バイパス削除               |
| 4.9  | キーワードは AI 非参照       | プロンプトにエッセンス追加 |
| 4.10 | キーワード全一致なら AI 不要 | AI 失敗時 503 のみ         |

### 3. 設計判断

- **Build**: 既存 Gemini 連携・`parseTruthVerifyResponse` を再利用。新規 API・型不要。
- **Keep**: `verifyKeywords` export（テストプレイ／単体テスト）。`checkTruthKeywordsLocally` は触らない。
- **Reject**: キーワード一致の高速パス維持（要件 4.8 と矛盾）。

### 4. リスク

- コスト増: 真相提出のたびに Gemini 1 回 — 要件で明示されたトレードオフ。
- `docs/` 正本に B2 / `isBypass` 記述が残存 — `docs-sync-truth-verify` で同期。

## Document Status

- **方法**: コードベース Read + requirements Phase 14
- **出力先**: `design.md` Phase 14 節、`research.md` 本節

---

# Gap Analysis: quizetika-core — Phase 17 ウミガメ認証・二層制限・諦めフロー改定（2026-06-08）

## Analysis Summary

- **スコープ**: 要件 4（Phase 17 節）および要件 19 のエンタイトルメント整合。隣接 UI（`quizetika-play-flow-ui` / `quizetika-billing-subscription-ui`）は要件境界外だがギャップ表に参照として記載。
- **実装済み（部分）**: ウミガメのみログイン必須の骨格、サーバー側 `resolveUserEntitlements`、クイズ別 `dailyAiTurnCounts`、同一質問キャッシュ（サーバー完全一致）、Pro 向け `limit-exceeded` API 文言、クイズ詳細の「会員登録してプレイする」ボタン。
- **主要ギャップ**: 制限値 20→30/150 未反映、横断日次カウンタ未実装、キャッシュ正規化のサーバー/クライアント不一致、諦め時の真相表示（API+UI）、チャット内ナビ、プレイ画面の entitlements 未連携と Pro 誘導 UI 不足。
- **推奨（設計フェーズ）**: Option C（Hybrid）— `ask-ai-utils.ts` を制限・正規化の単一正本に拡張し、API・クライアント・表示文言を同期。諦め API は `revealText` 廃止、UI は play-flow スペックでチャット内 CTA へ移行。
- **規模/リスク**: **M**（3–7日相当の変更面）、**Low–Medium**（横断カウンタのトランザクション原子性のみ設計要検討）。

## Document Status

- **入力**: `requirements.md`（Phase 17）、`spec.json`（`requirements.approved: false`）、既存 `src/` / `tests/` / `docs/`
- **方法**: gap-analysis.md フレームワーク + Grep/Read
- **注意**: 要件は未承認だが、ギャップ分析は設計判断の入力として実施

## 1. 要件 → 資産マッピング（Phase 17）

| 要件 ID                | 期待動作                                 | 現行資産                                                                      | 状態     | ギャップ詳細                                                                              |
| ---------------------- | ---------------------------------------- | ----------------------------------------------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| 4.1                    | 未登録時ボタン「会員登録してプレイする」 | `quiz-detail-client.tsx` L330–336                                             | ✅ 実装済 | play-flow-ui 境界。テスト未整備                                                           |
| 4.2                    | 未登録のウミガメ開始→ログイン誘導        | `quiz-detail-client.tsx` L72–74、`quiz-play-client.tsx` L86–88                | ⚠️ 部分   | 詳細は `redirect` 付き。プレイ直アクセスは `/login` のみ（戻り先なし）                    |
| 4.3                    | 他モードはゲスト可                       | 通常プレイ `user?.id \|\| 'guest'`                                            | ✅ 実装済 | 横断確認のみ                                                                              |
| 4.4                    | 認証済みで lateral attempt 作成          | `createLateralAttemptSession` (`attempt.ts`)                                  | ✅ 実装済 | `listId` は常に `null`（4.23 と関連）                                                     |
| 4.5                    | AI 質問（履歴20件）                      | `ask-ai/route.ts` + Gemini                                                    | ✅ 実装済 | —                                                                                         |
| 4.6                    | 無料：同一クイズ 30回/日                 | `FREE_TIER_DAILY_TURN_LIMIT = 20`、`ask-ai/route.ts`                          | ❌ 未実装 | 定数・API・`attempt.aiTurnLimit: 20`・UI 表示すべて 20                                    |
| 4.7                    | 無料：横断 150回/日                      | なし                                                                          | ❌ 未実装 | `dailyAiTurnCounts` は `{quizId}` のみ。グローバル doc 未設計                             |
| 4.8                    | Pro 無制限                               | `entitlement.ts` `hasUnlimitedAiQuestions`                                    | ✅ 実装済 | 上限値変更後もロジックは流用可                                                            |
| 4.9                    | サーバー側 tier 判定                     | `ask-ai/route.ts` `resolveUserEntitlements`                                   | ✅ 実装済 | —                                                                                         |
| 4.10                   | 正規化一致で全カウンタ非消費             | クライアント: `useAiPlayState` 正規化 / サーバー: `findCachedAnswer` 完全一致 | ⚠️ 部分   | 表記ゆれで API 呼び出し＆カウント発生。クライアント重複時は履歴に毎回追加（表示上の重複） |
| 4.11                   | 上限到達→質問拒否・真相可・Pro 誘導      | API: `limit-exceeded` + Pro 文言 / UI: 汎用エラー                             | ⚠️ 部分   | 上限値誤り。`/pricing` リンクなし。`turnsRemaining` はクイズ別のみ                        |
| 4.12–4.20              | レイアウト・真相判定・経過時間           | `quiz-play-client.tsx`、`verify-truth/route.ts`                               | ✅ 実装済 | ルール説明に「最大20回」表記が残存（L731）                                                |
| 4.21                   | 諦め→真相非表示                          | `give-up-lateral/route.ts` → `revealText`、UI 右パネル表示                    | ❌ 未実装 | Phase 16 仕様のまま。テストも `revealText` 期待                                           |
| 4.22                   | チャット内「結果画面へ」                 | 右パネル内ボタン（真相表示後）                                                | ❌ 未実装 | チャット内 CTA なし                                                                       |
| 4.23                   | リスト文脈で「次の問題へ」               | なし                                                                          | ❌ 未実装 | lateral は `listId` 未伝播。結果画面の list ナビは別実装                                  |
| 4.24–4.27              | 入力ロック・完了保存・API 認証           | 既存 give-up / verify-truth                                                   | ✅ 実装済 | 4.21–4.23 と組み合わせて UI 改修が必要                                                    |
| 19.11, 19.15, 19.17–18 | tier と 30/150 制限整合                  | `requirements` 更新済 / コードは 20                                           | ❌ 未実装 | 要件と実装の乖離                                                                          |

## 2. 現行アーキテクチャ（関連モジュール）

| モジュール                                     | 役割                         | Phase 17 への影響                                               |
| ---------------------------------------------- | ---------------------------- | --------------------------------------------------------------- |
| `src/services/ask-ai-utils.ts`                 | キャッシュ検索・制限判定定数 | **拡張先**: 正規化関数、30/150 定数、二重制限判定、エラーコード |
| `src/app/api/attempt/ask-ai/route.ts`          | AI 質問 API                  | 横断カウンタ読み書き、制限種別付き 429、正規化キャッシュ        |
| `src/hooks/useAiPlayState.ts`                  | クライアント質問状態         | 正規化の共通化、サーバー `turnsRemaining` 同期、Pro メッセージ  |
| `src/app/quiz/[id]/play/quiz-play-client.tsx`  | ウミガメ UI                  | 諦め UI、チャット CTA、`isPremium` ハードコード除去、制限表示   |
| `src/app/api/attempt/give-up-lateral/route.ts` | 諦め API                     | `revealText` 返却廃止、完了のみ                                 |
| `src/services/attempt.ts`                      | lateral session 作成         | `aiTurnLimit: 30`、`listId` 引き継ぎ検討                        |
| `src/lib/pricing-display.ts`                   | 料金表示文言                 | 「20回」→「30回/クイズ・150回/日」                              |
| `src/services/entitlement.ts`                  | tier 解決                    | 変更不要（上限ロジックは ask-ai 側）                            |
| `docs/*.md`                                    | 正本ドキュメント             | 20回制限・諦め解説開示の記述が旧仕様                            |

## 3. 実装アプローチ Options

### Option A: 既存モジュール拡張のみ

- `ask-ai-utils` に `normalizeQuestionText`、 `FREE_TIER_PER_QUIZ_LIMIT`、`FREE_TIER_GLOBAL_DAILY_LIMIT`、`checkAiTurnLimits()` を追加。
- `ask-ai/route.ts` で `dailyAiTurnCounts/_global`（または設計で決める reserved doc ID）を同一トランザクションで更新。
- `give-up-lateral` から `revealText` 削除。UI は `quiz-play-client` のみ改修。

**Trade-offs**: 最小ファイル数、既存パターン踏襲。`ask-ai-utils` がやや肥大化。

### Option B: 新規 `ai-turn-limit.ts` サービス

- 制限・カウンタ・正規化を専用モジュールに分離。API は薄いオーケストレーション。

**Trade-offs**: 責務分離は明確。新規境界のテスト・import 増。現規模ではやや過剰。

### Option C: Hybrid（推奨）

- **Core**: Option A と同様に `ask-ai-utils` を正本化。諦めは `lateral-give-up-utils` は残し API 応答のみ変更。
- **Play UI**（play-flow 境界）: チャット内ナビ、`listId` 有無でボタン出し分け、ログイン `redirect` 統一。
- **Billing UI**（billing 境界）: `pricing-display.ts` 文言更新。
- **Docs**: `docs-sync-phase17` タスクで `api_specification.md` / `detailed_design.md` / `screen_transition.md` 同期。

**Trade-offs**: スペック境界と一致。コア・UI・docs の3ストリーム並行可能。

## 4. Research Needed（設計フェーズへ持ち越し）

| 項目                          | 内容                                                                                            |
| ----------------------------- | ----------------------------------------------------------------------------------------------- |
| 横断カウンタの doc ID         | `dailyAiTurnCounts/_global` vs 別コレクション。Firestore Rules 影響                             |
| 二重制限のトランザクション    | クイズ別 + 横断を1トランザクションで increment する際の読み取り順序                             |
| `limit-exceeded` のサブタイプ | `per-quiz` / `global-daily` を `error` フィールドで区別（要件 19.18）                           |
| lateral + リスト連続プレイ    | `createLateralAttemptSession` が `listId` を受け取るか。問題リストの lateral 親クイズの遷移 URL |
| 諦め後の結果画面              | 真相を結果画面でも出さないか（要件はプレイ画面のみ明示。結果画面は別確認可）                    |
| `turnsRemaining` レスポンス   | クイズ別・横断の2値を返すか、表示優先ルール                                                     |

## 5. テストギャップ

| テスト                                  | 現状                         | 必要な更新                                  |
| --------------------------------------- | ---------------------------- | ------------------------------------------- |
| `tests/services/ask-ai-utils.test.ts`   | 20回制限・厳格キャッシュ     | 30/150、正規化キャッシュ、二重制限          |
| `tests/api/give-up-lateral.test.ts`     | `revealText` 期待            | 非返却・完了のみ                            |
| `tests/api/ask-ai*.test.ts`             | **なし**（統合除外コメント） | 新規 API 統合テスト推奨（制限・キャッシュ） |
| `tests/lib/pricing-display.test.ts`     | 文言 id のみ検証             | 30/150 文言アサーション                     |
| `tests/services/useAiPlayState.test.ts` | モック正規化のみ             | フック本体または統合テスト不足              |

## 6. Effort & Risk

| ラベル     | 評価           | 根拠                                                                                     |
| ---------- | -------------- | ---------------------------------------------------------------------------------------- |
| **Effort** | **M**          | 6–10 ファイル + docs + 隣接 UI 2 スペック。新規インフラ不要                              |
| **Risk**   | **Low–Medium** | 既存 Stripe/entitlement パターン流用。横断カウンタ原子性と list 連続プレイのみ設計要確認 |

## 7. 設計フェーズへの推奨事項

1. **正本**: `ask-ai-utils.ts` に制限定数・正規化・`AiTurnLimitResult` 型を集約（design Boundary Commitments）。
2. **API 契約**: `limit-exceeded` に `limitType: 'per-quiz' \| 'global-daily'` を追加。キャッシュヒット時は `turnsRemaining` に両残数を含めるか設計で決定。
3. **諦め API**: 成功応答は `{ completed: true }` のみ（`revealText` 破壊的変更 — クライアント同時デプロイ）。
4. **タスク分割案**: (T1) utils+API 制限、(T2) キャッシュ正規化、(T3) give-up API+UI、(T4) play UI Pro 誘導・entitlements、(T5) pricing-display + docs。
5. **隣接スペック**: `quizetika-play-flow-ui` / `quizetika-billing-subscription-ui` の requirements 追従を design で明示。

## 8. 設計フェーズ確定事項（2026-06-08）

| 持ち越し項目                | 設計決定                                                             |
| --------------------------- | -------------------------------------------------------------------- |
| 横断カウンタ doc ID         | `users/{uid}/dailyAiTurnCounts/_global`（reserved ID）               |
| 二重制限トランザクション    | attempt + per-quiz + global を単一 Transaction で increment          |
| `limit-exceeded` サブタイプ | `limitType: 'per-quiz' \| 'global-daily'`                            |
| lateral + リスト連続プレイ  | `createLateralAttemptSession` が `listId` を受け取り attempt に保存  |
| 諦め後の結果画面            | プレイ画面のみ真相非表示を要件化。結果画面は現行どおり真相を出さない |
| `turnsRemaining`            | `{ perQuiz, globalDaily }` の2値を成功応答に含める                   |

**Synthesis**: Option C（Hybrid）採用。`ask-ai-utils.ts` を正本化し、諦め API は応答のみ変更、UI は play-flow / billing 境界に委譲。

**Document Status（Phase 17 設計）**: `design.md` Phase 17 節に反映済。`spec.json` → `phase: design-generated`。

---

## Phase 18: 模擬試験・フラッシュカード LB 非対象（2026-06-09）

### Summary
既存 `leaderboard-update.ts` の `isLeaderboardEligibleAttempt` を拡張し `exam` / `flashcard` を除外する。prior 件数は `countPriorCompletedAttempts` が既に全モードをカウントしているため、追加スキーマ不要で「exam 先プレイ → 通常は replay のみ」を満たす。

### Research Log

| Topic            | Findings                                                 | Implications                                    |
| ---------------- | -------------------------------------------------------- | ----------------------------------------------- |
| 現行 eligibility | guest / test-play のみ除外                               | exam / flashcard を同関数に追加                 |
| prior count      | LB 対象試行保存時のみ query、フィルタは completedAt のみ | 変更不要。exam 後 normal で prior >= 1          |
| verify-truth     | トランザクション前に全モード prior 集計済                | `buildLeaderboardUpdatesForQuiz` 経由で自動除外 |

### Design Decisions
1. **Option A 採用** — 単一関数拡張。別カウンタやユーザーフラグは不要。
2. **後方互換** — 既存 LB エントリは削除しない（新規更新のみ制御）。

**Document Status（Phase 18 設計）**: `design.md` Phase 18 節に反映済。

---

## Phase 20: 〇✕問題形式（`true-false`）（2026-06-09）

### Summary
`true-false` は型・バリデーション・採点経路が既存。ギャップは `Quiz.format` 未登録、`resolveQuizFormat` が単一形式を `mixed` に落とす、ラベル／探索未整備。専用 lib `true-false-defaults.ts` で固定「〇」「✕」生成を集約し、既存 `choices` + `isChoiceAnswerCorrect` を維持。

### Research Log

| Topic        | Findings                                      | Implications                 |
| ------------ | --------------------------------------------- | ---------------------------- |
| データモデル | `Question.type: 'true-false'`、validation 2択 | `Quiz.format` 拡張のみ       |
| 形式解決     | `only === 'true-false'` → `mixed`             | `SINGLE_FORMAT_TYPES` へ追加 |
| 採点         | `usePlayState` + `isChoiceAnswerCorrect`      | API 変更不要                 |
| 作問方針     | 正解トグルのみ（ユーザー確定）                | 保存時正規化でラベル固定     |

### Design Decisions
1. **Build** — `true-false-defaults.ts` 新設。`correctTextAnswerList` 移行は却下。
2. **後方互換** — 既存 Firestore データは読み取り拒否せず、新規保存のみ正規化。

**Document Status（Phase 20 設計）**: `design.md` Phase 20 節に反映済。

---

## Phase 21: ホームフィード段階的取得（2026-06-09）

### Summary
現行 `getLatestQuizzes` / `searchQuizzes` は一括返却（30〜100件）。`listUserPlayHistory` の `limit+1` + base64url カーソルパターンを踏襲し、タブ別は Firestore `startAfter`、検索は既存 `materialize` パイプライン + オフセットカーソル（cap 200）で段階化する。

### Research Log

| Topic         | Findings                        | Implications                                   |
| ------------- | ------------------------------- | ---------------------------------------------- |
| タブ API      | 単一 orderBy クエリ             | ネイティブカーソル適用可                       |
| searchQuizzes | マルチクエリ + クライアント合成 | 全面 cursor 化は高コスト。offset + fingerprint |
| 既存利用者    | ジャンル scoped は一括維持      | `searchQuizzes` 非ページング版を残す           |
| ページサイズ  | play history 20件               | `HOME_FEED_PAGE_SIZE=20` で統一                |

### Design Decisions
1. **ハイブリッド** — タブは Firestore、検索は offset（roadmap 採用案）。
2. **materialize 抽出** — `searchQuizzes` と `searchQuizzesPaginated` でパイプライン共有。
3. **無効カーソル** — throw のみ。UI リセット前提。

**Document Status（Phase 21 設計）**: `design.md` Phase 21 節に反映済。

---

## Phase 22: ホーム／検索 IA — URL 状態 lib（2026-06-09）

### Summary
新 ranking API は不要。`getTrendingQuizzes(10)` / `getLatestQuizzes(10)` / `listActiveGenres` を再利用。検索深いリンク用に `search-url-state.ts` を新設し、Next.js 非依存の parse/serialize を core に集約。

### Design Decisions
1. **Build** — 専用 lib（sessionStorage や router 依存は play-flow hook へ）。
2. **playStatus** — URL に含め、フィルタチップ表示と整合。
3. **既定値省略** — 共有 URL を短く保つ。

**Document Status（Phase 22 設計）**: `design.md` Phase 22 節に反映済。

---

## Phase 23: リスト探索・カスタムクイズ Core API（2026-06-09）

### Summary

`quiz-list.ts` に `searchLists`（公開/本人非公開 + in-memory keyword、`DEFAULT_LIST_SEARCH_LIMIT=50`）を追加。カスタムクイズは `my-quiz-pool.ts` で4ソース合成、`my-quiz-session.ts` で `question-list-session` 同型の sessionStorage 契約、`Attempt.mode: 'my-quiz'` + 任意 `sessionId` を追加。`saveAttempt` は `question-list` / `my-quiz` の1問試行で親クイズ全問数検証をバイパス（`totalQuestions=1` 固定検証）。LB は `question-list` と同方針（eligible）。Firestore に `quizLists` の `isPublished+createdAt` / `authorId+isPublished+createdAt` 複合 index を追加。

### Discovery Type

**Extension（light）** — 既存 `getLatestQuizLists` / `getQuizListsByAuthor` / `question-list-session` / `question-attach-search` / `bookmark.ts` / `leaderboard-update.test.ts` パターンの拡張。外部 API 調査不要。

### Research Log

| Topic        | Findings                                                                                                             | Implications                                                                  |
| ------------ | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| リスト一覧   | `getLatestQuizLists` が `isPublished+orderBy createdAt` を既使用。`searchLists` 未実装                               | public クエリは既存パターン流用 + keyword 後段 filter                         |
| 非公開探索   | `getQuizListsByAuthor(uid, true)` は公開/非公開混在。探索は `isPublished===false` 限定が必要                         | 専用 composite query + `authorId` 必須バリデーション                          |
| インデックス | `firestore.indexes.json` に `isPublished+createdAt` および `authorId+isPublished+createdAt`（listType なし）が未登録 | Phase 23 で2件追加                                                            |
| 問題プール   | `useQuestionAttachSearch` が own/bookmarked 収集済。ブックマークリスト経路は `getQuizzesInList`                      | `buildMyQuizQuestionPool` に集約。問題リスト型 bookmark list は除外           |
| Dedupe       | `dedupeQuestionCandidates` が questionId 先勝ち                                                                      | ソース priority 順 flat 化後に reuse                                          |
| セッション   | `question-list-session.ts` が CRUD + URL 生成の正本                                                                  | `my-quiz-session` は `sessionId` + `mode=my-quiz` URL。別 sessionStorage キー |
| saveAttempt  | L92–95 が常に `quiz.questions.length` と照合                                                                         | `question-list` も現状バグ潜在。1問モード分岐で両方修正                       |
| LB           | `isLeaderboardEligibleAttempt` は exam/flashcard/test-play/guest のみ除外                                            | `my-quiz` は追加除外不要（`question-list` と同 eligible）                     |

### Architecture Pattern Evaluation

| Option                                              | searchLists keyword        | my-quiz session      | Verdict            |
| --------------------------------------------------- | -------------------------- | -------------------- | ------------------ |
| A. Firestore prefix 検索                            | composite + 全文近似       | サーバー session doc | 過剰               |
| B. 取得後 in-memory filter + sessionStorage（採用） | 既存 normalize-search-text | question-list 同型   | **採用**           |
| C. クライアントのみ（Core なし）                    | UI が全件 fetch            | —                    | 要件 23/24/25 違反 |

### Design Decisions

1. **`searchLists` in `quiz-list.ts`** — service 層に配置（lists-discovery-ui 契約どおり）。keyword は in-memory（初版 limit 50 内で十分）。
2. **`my-quiz-pool.ts` 新設** — UI フィルタは core 外。pool は raw 候補のみ返却。
3. **`mode=my-quiz` URL** — `question-list` と分離し、play client 分岐を明確化（my-quiz-ui 所有）。
4. **`saveAttempt` 分岐** — `isSingleQuestionAttemptMode` で検証パス共有。通常モード挙動は不変。
5. **LB** — 新規ポリシー不要。既存 eligible 集合に `my-quiz` が自然包含されることをテストで固定。

### Risks

| Risk                    | Mitigation                                                  |
| ----------------------- | ----------------------------------------------------------- |
| 4ソース N+1 クエリ      | 初版は既存 attach search と同程度。将来バッチ化は follow-up |
| private `authorId` 漏洩 | サーバー側 query + 未指定 throw。Rules は既存 author 制約   |
| saveAttempt 分岐漏れ    | 専用テスト + `question-list` 回帰                           |

**Synthesis**: Build — 新規 lib 2本 + service 拡張 + types/attempt 最小変更。Adopt — dedupe/session/bookmark 既存パターン。

**Document Status（Phase 23 設計）**: `design.md` Phase 23 節に反映済。

---

## Phase 26: リスト機能の完全廃止（2026-06-10）

### Summary
- **Discovery Type**: Extension（削除・縮小）。`quiz-list.ts` ほか専用モジュール約6本、Rules/Indexes、`searchLists` / `question-list-session` を除去。
- **Key Findings**:
  - リスト機能は Phase 8/23 で `quizLists` + 4ソースプールに拡張済み。削除は **Core-first** が安全（UI が `searchLists` 等を参照）。
  - マイグレーションは `reset-firestore.mjs` と同型の Admin SDK バッチ削除で足りる。
  - `QuizListSkeleton` / `QuizListSort` は別機能 — 削除対象外。

### Design Decisions
1. **履歴ラベル** — 過去 `attempts` は残し、表示は `レガシープレイ` に正規化。
2. **廃止 URL** — UI 側はルート削除で 404（Core は関与しない）。
3. **Attempt.mode** — union にレガシー値を残し、**保存時のみ拒否**。

**Document Status（Phase 26 設計）**: `design.md` Phase 26 節に反映済。

---

## Phase 27: クイズ公開範囲（2026-06-10）

### Summary
- **Discovery Type**: Extension（brownfield）。`status` のみの現行モデルに `visibility` 二軸を追加。Phase 13 で Out だった「プライベートクイズ」を Pro 特典として In。
- **Key Findings**:
  - フィードは `published` フィルタ済みだが、`getQuiz` は ID 直アクセスで draft も閲覧可能 — **フィード除外だけでは不十分**。
  - フォローは `follows/{followerId}_{followingId}` で実装済み。Rules でも `exists()` 参照可能。
  - Pro ゲートパターンは `ai-authoring-route-helpers` + `resolveUserEntitlements` が正本。
- **User Decision（A1 確定）**: `private` **および** `followers` の設定は Pro 必須（無料は既存限定公開維持、`public → 限定` のみ拒否）。

### Design Decisions
1. **`quiz-access.ts` 新設** — `canViewQuiz` / `assertCanSetQuizVisibility` を1か所集約。
2. **バックフィル** — 既存 published に `visibility: 'public'`。読み取り時フォールバックも二重化。
3. **Rules + サーバー API** — tier 検証は API 正本、Rules は read 漏洩防止。

**Document Status（Phase 27 設計）**: `design.md` Phase 27 節に反映済。

---

## Phase 30: プロフィールSNSリンク登録・表示機能（2026-06-21 ギャップ分析）

### 1. 現状のコードベース調査 (Current State Investigation)
* **関連資産と配置**:
  * [src/types/index.ts](file:///d:/quizetika/src/types/index.ts): `User` 型定義。現在 `snsLinks` フィールドは存在しない。
  * [src/services/user.ts](file:///d:/quizetika/src/services/user.ts): プロフィール情報更新API（`updateProfile`）および検証ロジック（`validateProfileData`）が実装されている。
  * [src/services/storage.ts](file:///d:/quizetika/src/services/storage.ts): Firebase Storage上のファイルアップロード・削除処理が配置されている。現在、アセットロゴの取得用ヘルパーは存在しない。
* **データモデルとAPI連携**:
  * Firestore `users` コレクションの各ドキュメントが `User` 型に対応している。
  * `firestore.rules` において、`isOwner(userId)` の場合は特権情報の変更（`moderationTier`, `reputationScore`, `deleteStatus`）や課金関連以外のフィールド更新は特段制限されていないため、`snsLinks` フィールドの書き込みは可能。

### 2. 要件の実現可能性分析 (Requirements Feasibility Analysis)
* **技術的ニーズ**:
  * **データモデル**: `User` インターフェースに `snsLinks` オブジェクト（`youtube?: string; x?: string; instagram?: string; tiktok?: string;`）を追加。
  * **バリデーションロジック**: `validateProfileData` 関数を拡張し、送信された各SNSの値が有効なURLであること、またそれぞれの正規ドメイン（`youtube.com`, `x.com`, `twitter.com`, `instagram.com`, `tiktok.com`）に合致することを検証する。
  * **Storage画像URL取得**: Storage内の `assets/logos/{snsName}.png` から `getDownloadURL` でダウンロードURLを取得するユーティリティ関数を `storage.ts` に追加。
* **ギャップと制約 (Gaps & Constraints)**:
  * **MIME制限**: `storage.rules` で `request.resource.contentType.matches('image/(png|jpeg|gif)')` のみが許可されており、SVGは禁止されているため、SNSのロゴ画像は `png` 等の形式で事前にアップロードされている必要がある（アップロード時の拡張子とパスの固定が必要）。
  * **ダウンロードURLの非同期取得**: クライアント側で都度 `getDownloadURL` を呼ぶと遅延が発生する可能性があるため、UIレンダリングに影響を及ぼさない形でURLを取得・保持する設計が必要。

### 3. 実装アプローチのオプション (Implementation Options)
#### Option A: 既存機能の拡張 (Extend Existing Components) - 推奨
* **対象モジュール**: `src/types/index.ts`、`src/services/user.ts`、`src/services/storage.ts`
* **メリット**: 
  * 既存のプロフィール更新フロー（`updateProfile`）とアセット管理（`storage.ts`）に直接ロジックを追加するため、不要なコードの重複が発生しない。
  * Firebase Security Rules の変更が不要。
* **デメリット**:
  * プロフィール検証ロジック（`validateProfileData`）が若干複雑化するが、標準的なヘルパーで対応可能。

#### Option B: 新規モジュールの作成 (Create New Components)
* **対象モジュール**: `src/services/sns.ts` を新設し、SNS関連のバリデーションやStorageからのロゴURL取得を一元管理。
* **メリット**: SNSリンク機能の関心の分離が明確になる。
* **デメリット**: 既存の `updateProfile` 内で結局インポートして連携する必要があり、ファイル数が増えるだけで結合度が低くならない。

#### **比較まとめ**:
Option A（既存機能の拡張）が最も一貫性があり、無駄のない実装となります。

### 4. 開発見積もりとリスク (Complexity & Risk)
* **開発規模 (Effort)**: S (1〜2日程度)
  * データ型の追加、バリデーションの実装、Storageヘルパーの実装、単体テストの追加。
* **リスク (Risk)**: Low
  * 既存のデータ構造やフローへの破壊的変更はなく、機能の単純な拡張に留まる。

### 5. 設計フェーズに向けた推奨事項 (Recommendations)
* `src/services/storage.ts` に各SNS名から `assets/logos/` 配下のロゴURLを取得する `getSnsLogoUrl(snsName: string)` 関数を実装する。
* 各SNSのURLドメイン検証用に、正規表現（例: `^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.*$` など）を定義し、堅牢にバリデーションを行う。

## Phase 39: NGワードマスタ参照によるコンテンツ検証への移行（2026-07 軽量ディスカバリー）

### Extension Point Analysis
- **既存コード**: `src/services/quiz-validation.ts` はファイル冒頭のコメントで「Supabase に依存しない純粋関数群（テスト容易性のため分離）」と明記されており、`NG_WORD_LIST` のコメント自体にも「実際のプロダクションでは外部設定ファイルや Supabase の moderation テーブルから動的ロードすることを推奨」と将来の拡張余地が既に示唆されていた。
- **呼び出し元**: `containsNgWord` は同ファイル内の `validateQuizForPublish` からのみ呼ばれ、`validateQuizForPublish` は `src/services/quiz.ts`（公開処理、サーバー側）と `src/components/quiz/quiz-editor.tsx`（クライアント側事前検証）の2箇所から呼ばれる。
- **統合アプローチ**: 純粋関数の境界を壊さず、NGワード一覧を引数化する。DB取得は新規サービス `ng-words.ts` に分離し、既存の「サービス層 = Supabase依存、lib層 = 純粋関数」という構造的な役割分担（`structure.md` の `src/lib/` と `src/services/` の区分）に整合させる。

### Dependency Check
- 新規外部ライブラリの追加は不要（既存の `@/lib/supabase/client` パターンを再利用）。

### Integration Risk Assessment
- **既存機能への影響**: `containsNgWord`／`validateQuizForPublish` の呼び出し元が2箇所のみのため、影響範囲は限定的。
- **パフォーマンス**: 公開処理ごとに `ng_words` を1回 SELECT する追加コストが生じるが、既存の `saveQuiz` 自体が複数のSupabaseクエリ（ジャンル検証、タグ解決等）を伴う処理であり、影響は軽微と判断（要件にレイテンシ目標なし）。
- **セキュリティ**: `ng_words` の SELECT を全員に許可する設計（`supabase-governance` 側RLS）のため、NGワード一覧がクライアントバンドル外でも取得可能になる。現状もハードコード配列としてクライアントバンドルに含まれていたため、露出度は同等以下。

## Design Decisions（Phase 39 追記）

### Decision: `containsNgWord`/`validateQuizForPublish` を非同期化せず引数化で対応する
- **Context**: NGワード一覧の取得元をハードコード配列からDBへ変更する必要があるが、`quiz-validation.ts` は意図的にSupabase非依存の純粋関数群として設計されている。
- **Alternatives Considered**:
  1. `containsNgWord`／`validateQuizForPublish` 自体を `async` 化し、内部で `listActiveNgWords()` を呼び出す — 純粋関数としてのテスト容易性（Jestでの同期テスト）が失われ、既存の `quiz-validation.test.ts` の大半を非同期化する必要がある。
  2. NGワード一覧を引数として受け取る形に変更し、DB取得は呼び出し元（`quiz.ts`／`quiz-editor.tsx`）に委譲する。
- **Selected Approach**: 案2を採用。
- **Rationale**: 既存のファイル冒頭コメントが明示する設計意図（純粋関数としての分離）を維持しつつ、最小限の変更（引数追加のみ）でDB化を実現できる。
- **Trade-offs**: 呼び出し元2箇所でNGワード一覧の事前取得コードが必要になるが、変更範囲は小さく限定的。
- **Follow-up**: なし。

## Risks & Mitigations（Phase 39 追記）
- **クライアント側事前検証の取得失敗時の挙動** — `quiz-editor.tsx` でのNGワード一覧取得が失敗した場合、事前チェックをスキップしサーバー側検証（最終防衛線）に委ねる。UXとしては公開ボタン押下後にサーバーエラーとして表示される。
- **将来的なキャッシュ導入の要否** — 現状は都度クエリで十分だが、クイズ公開頻度が大幅に増加した場合はレイテンシ・DB負荷を再評価する必要がある（本フェーズでは要件外のため対応しない）。

# Research & Design Decisions: quizetika-core — Phase 41 有料プラン多層化と tier 識別子リネーム（2026-07-13）

## Summary
- **Feature**: `quizetika-core` Phase 41（要件33）
- **Discovery Scope**: Extension（既存サブスクリプション基盤の拡張）
- **主要な発見**:
  - `subscription_tier` は DB 上 `TEXT`（CHECK 制約・ENUM なし）であり、スキーマ変更なしで `'pro'` → `'creator'` のデータリネームが可能。
  - 有料特典の判定が `hasPaidEntitlements`（tier が `free` 以外かどうかの単一フラグ）に一本化されており、クイズ限定公開（`quiz-access.ts`）と AI 作問アシスタント（`ai-authoring-utils.ts`）の双方がこのフラグを直接参照している。`player` tier を追加すると、この単一フラグでは「広告非表示・AI質問無制限は許可するが限定公開・AI作問は許可しない」という差分を表現できない。
  - `subscription-plans.ts` は既にコメントで「Premium 追加時は配列に1エントリ追加する」という拡張を見込んだ `PaidTierDefinition[]` 配列設計になっているが、`getPriceIdForInterval()` は `'pro'` tier を決め打ちで検索しており、複数有料 tier を区別した価格解決ができない。
  - `/api/billing/prices` は Pro 単一 tier の価格のみを返す形状（`ProPricesResult`）であり、`quizetika-billing-subscription-ui` が Player・Creator 両方の価格を同一画面に表示するには複数 tier 分の価格を返せる形状への変更が必要。

## Research Log

### tier 判定ロジックの分布
- **Context**: `player` tier 追加により「支払い済みかどうか」の二値判定では特典を正しく差配できないことが判明。
- **Sources Consulted**: `entitlement-shared.ts`（正本の判定関数）、`quiz-access.ts`（限定公開ゲート）、`ai-authoring-utils.ts` / `ai-authoring-route-helpers.ts`（AI作問ゲート）、`useAds.ts`（広告表示）、`pricing-entitlement.ts`（UI表示用複製ロジック）。
- **Findings**:
  - `computeUserEntitlements()`（`entitlement-shared.ts`）が唯一の正本判定関数で、`hasPaidEntitlements` と `hasUnlimitedAiQuestions` の2フィールドのみを提供している。
  - `quiz-access.ts` の `canAccessProVisibility()` はモデレーター免除 OR `hasPaidEntitlements` で判定しており、`player` tier もこの条件を満たしてしまう（意図しない特典漏れ）。
  - `ai-authoring-utils.ts` の `canAccessAiAuthoring()` も同様に `hasPaidEntitlements || hasUnlimitedAiQuestions` で判定しており、同じ問題を抱える。
  - `useAds.ts` は独自にクライアント側で `subscriptionTier === 'pro' || subscriptionTier === 'premium'` を再実装しており（`entitlement-shared.ts` と重複するロジック）、tier 追加のたびに個別に修正が必要な状態。
- **Implications**: tier ごとの特典差分を単一の「有料/無料」フラグではなく、tier→特典キー集合のマッピング（capability モデル）として `entitlement-shared.ts` に一本化し、既存の呼び出し側（`canAccessProVisibility`, `canAccessAiAuthoring`, `useAds.ts`）は新モデルに委譲する形へリファクタリングする。

### 価格・Checkout の tier 決め打ち箇所
- **Context**: `player` tier 追加により「Pro 1種類」を前提にしたコードが複数箇所で機能しなくなる。
- **Findings**:
  - `subscription-plans.ts` の `getPriceIdForInterval(interval)` は tier 引数を取らず、内部で `.find((d) => d.tier === 'pro')` と決め打ちしている。
  - `billing-prices.ts` の `fetchProPricesFromStripe()` も同様に `'pro'` 決め打ちで、戻り値の型 `ProPricesResult` は単一 tier 分の形状。
  - `services/subscription.ts` の `createCheckoutSession()` は `priceInterval` のみを受け取り、tier 選択を受け付けていない（Pro のみが購読対象だったため）。
  - `stripe-webhook.ts` の `buildSnapshotFromSubscription()` は `mappedTier === 'pro' || mappedTier === 'premium'` を決め打ちで「有料判定」しており、`player` を有料として扱わない不具合を生む。
- **Implications**: tier を引数として受け取る形へ関数シグネチャを一般化する。Webhook 側の「有料判定」は `mappedTier !== 'free'` へ単純化できる（tier 列挙が増えても個別列挙が不要になる）。

## Architecture Pattern Evaluation（Phase 41）

| Option                              | 説明                                                                        | 強み                                                                                  | リスク・制約                                                                                           | 備考 |
| ----------------------------------- | --------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | ---- |
| Capability マップ方式               | tier → 特典キー集合の静的マップを正本とし、各ゲートは capability 有無で判定 | 新 tier 追加時にマップへ1行足すだけで済む。既存呼び出し側の関数シグネチャを維持できる | マップの整合性はコードレビューで担保する必要がある（DBやテストでの自動検証なし）                       | 選定 |
| tier ごとの if 分岐を個別箇所に追加 | 各ゲート関数に `tier === 'player'` 等の分岐を都度追加                       | 変更範囲が局所的                                                                      | tier が増えるたびに全ゲート箇所を修正する必要があり、Phase 41 で発見したのと同種の漏れが将来も再発する | 却下 |

## Design Decisions（Phase 41）

### Decision: tier→特典の capability マップへの一般化
- **Context**: `player` tier は「広告非表示・AI質問無制限」のみ、`creator`/`premium` はそれに加えて「限定公開・AI作問アシスタント」を持つという非対称な特典差分がある。
- **Alternatives Considered**:
  1. 各ゲート関数に tier 個別分岐を追加（却下: 保守性が低い）
  2. tier→capability 集合のマップを `entitlement-shared.ts` に一本化（選定）
- **Selected Approach**: `SubscriptionCapability`（`'ad_free' | 'unlimited_ai_questions' | 'quiz_visibility_control' | 'ai_authoring_assist'`）を定義し、tier ごとの capability 集合を静的マップで表現。`computeUserEntitlements()` の戻り値に `hasCreatorEntitlements`（`quiz_visibility_control`/`ai_authoring_assist` の可否、両者は常に同一 tier 集合のため1フィールドに統合）を追加する。
- **Rationale**: 既存の `hasPaidEntitlements` / `hasUnlimitedAiQuestions` は「広告非表示・AI質問無制限」の意味では引き続き有効（player 含む全有料 tier で true）なため、既存フィールドの意味を変えず新フィールドを1つ追加するだけで済み、破壊的変更を避けられる。
- **Trade-offs**: 呼び出し側（`quiz-access.ts`, `ai-authoring-utils.ts`）を `hasPaidEntitlements` から `hasCreatorEntitlements` 参照へ切り替える改修が必須になる（Phase 41 の変更範囲に含む）。
- **Follow-up**: `useAds.ts` の独自 tier 判定ロジックを `computeUserEntitlements()` 呼び出しへ置き換え、判定ロジックの重複を解消する。

### Decision: 価格取得・Checkout API の tier パラメータ化
- **Context**: Player・Creator 2つの有料 tier の価格を同一画面で表示し、購読開始 API に tier を指定できるようにする必要がある。
- **Selected Approach**: `getPaidTierDefinitions()` を tier 引数で検索するヘルパーに統一し、`getPriceIdForInterval(tier, interval)` へシグネチャ変更。`/api/billing/prices` のレスポンス形状を `Record<'player' | 'creator', ProPriceQuote ペア>` に変更。`POST /api/billing/checkout-session` のリクエストボディに必須の `plan: 'player' | 'creator'` を追加。
- **Trade-offs**: 既存のリクエスト/レスポンス契約を破壊的に変更するため、`quizetika-billing-subscription-ui` 側の実装同時更新が前提となる（並行実装不可、依存順を明示）。

### Decision: 既存 `pro` 契約者データの移行方式
- **Context**: 契約状態・請求サイクルを変更せず tier 識別子のみをリネームする必要がある。
- **Selected Approach**: 単一の UPDATE 文（`UPDATE users SET subscription_tier = 'creator' WHERE subscription_tier = 'pro'`）を含む Supabase migration ファイルを追加する。Stripe 側の Price/Product は変更しないため、Webhook 経由の同期には影響しない（`priceIdToTier()` が返す tier 文字列を `'pro'` から `'creator'` に変更するだけで、既存 Stripe Price ID とのマッピングは維持される）。
- **Trade-offs**: マイグレーション実行は単一トランザクションの UPDATE のため、`pro`/`creator` が混在するウィンドウは発生しない。

## Risks & Mitigations（Phase 41）
- **`hasPaidEntitlements` 参照漏れ** — 呼び出し箇所の一部を見落とし、`player` tier に限定公開・AI作問が誤って開放されるリスク。軽減策: `hasPaidEntitlements` の全参照箇所を grep で洗い出し、限定公開・AI作問関連の2箇所を `hasCreatorEntitlements` へ置き換えたことをタスクの検証項目に含める。
- **`/api/billing/prices` 契約変更の波及** — レスポンス形状変更が `quizetika-billing-subscription-ui` の未更新箇所を壊すリスク。軽減策: 依存順（core → billing-ui）を明示し、billing-ui 側のタスクで新形状への追随を必須項目とする。
- **データ移行漏れ** — UPDATE 文の実行漏れにより本番で `pro` と `creator` が混在するリスク。軽減策: migration ファイルをコードデプロイと同一パイプラインに含め、デプロイ後に `SELECT count(*) FROM users WHERE subscription_tier = 'pro'` が 0 件であることを確認する検証手順をタスクに含める。

## References（Phase 41）
- 既存実装: `src/lib/subscription-plans.ts`, `src/services/entitlement-shared.ts`, `src/lib/quiz-access.ts`, `src/services/ai-authoring-utils.ts`, `src/services/stripe-webhook.ts`, `src/services/billing-prices.ts`, `src/services/subscription.ts`

## Design Decisions（要件34 二重課金防止 追記・2026-07-13）

### Decision: 事前チェックは Stripe ライブ参照、事後安全網は Webhook 側検知
- **Context**: `createCheckoutSession()` の既存重複チェックは `resolveUserEntitlements()`（Supabase DB 参照）に依存しており、Webhook による DB 反映が遅延している間に2つ目の Checkout セッションを作成・完了させると、DB チェックだけではすり抜けてしまう（ユーザーヒアリングで確認済みの懸念）。
- **Alternatives Considered**:
  1. Checkout 開始時の DB チェック強化のみ（例: 楽観ロック用フラグを `users` テーブルに追加）— Webhook 反映前の短時間ウィンドウでの二重タブ操作等は防げない。
  2. Checkout 開始時に Stripe API を直接ライブ参照 + Webhook 受信時に重複検知・自動解消する二段構え（選定）。
- **Selected Approach**: 案2。購読開始時は `stripe.subscriptions.list({ customer, status: 'active' })` をライブ参照して事前拒否を強化し、それでも発生し得るレースコンディション（ほぼ同時刻の二重 Checkout 完了）に対しては Webhook 受信時に `DuplicateSubscriptionGuard` が事後検知・自動解約・返金を行う。
- **Rationale**: ユーザーヒアリングで「Webhook側の安全網も必須」と明示された。事前チェックのみでは真の意味でのレースコンディション（数秒以内の同時実行）を排除できないため、事後の是正機構が不可欠。
- **Trade-offs**: 実装・テストコストが増える（Stripe API 呼び出し増加、返金処理の正確性が求められる）が、実際の金銭的リスクを考慮すると許容範囲。

### Decision: 「最古のサブスクリプションを正とする」統一ルール
- **Context**: 重複検知時にどちらを正とするか（同一プランの二重契約、Player/Creator の同時契約の双方に共通のルールが必要）。
- **Selected Approach**: ユーザーヒアリングの結果「後から完了した方を自動キャンセル（既存契約を優先）」を採用。実装上は Stripe `created` タイムスタンプが最も古いサブスクリプションを正とし、それ以外を全て解約する単一ルールに一般化した。
- **Rationale**: 「先着優先」は同一プランの二重契約にも Player/Creator 同時契約にも共通して適用できる一貫したルールであり、tier の組み合わせごとに個別分岐を持たずに済む（Simplification 原則）。
- **Trade-offs**: ユーザーが意図的に Player→Creator へアップグレードするつもりで先に Creator の Checkout を開始し、後から誤って Player の Checkout も完了させた場合、想定通り Creator（先に作成された方）が残る。逆に誤操作で先に Player を完了させ、本来欲しかった Creator を後から完了させた場合は Player が残ってしまう — この場合はユーザーが契約管理からアップグレードし直す必要がある（許容されたトレードオフとして記録）。

### Decision: 返金は解約対象の直近支払い済み Invoice に対して全額実行
- **Context**: サブスクリプション解約だけでは既に確定した支払いは返金されない。
- **Selected Approach**: 解約対象サブスクリプションの直近の支払い済み Invoice に紐づく PaymentIntent に対し `refunds.create` で全額返金する。
- **Rationale**: ユーザーに意図しない二重請求分の金銭的負担を残さないことが要件34.5 の目的そのもの。
- **Follow-up**: 返金 API 呼び出し自体が失敗した場合のフォールバック（監査レコードに `refunded_amount: NULL` で記録し運用側の手動対応に委ねる）を Risks に記録済み。

## Risks & Mitigations（要件34 追記）
- **返金処理の失敗** — Stripe 側の一時障害等で `refunds.create` が失敗すると、解約は完了しているのに返金だけが漏れる状態になり得る。軽減策: 監査テーブルに `refunded_amount: NULL` で記録し、運用側が定期的に未返金インシデントを確認できるようにする。
- **タイムゾーン・時刻精度による「最古」判定の誤り** — Stripe の `created` は UTC epoch 秒であり誤差要因は小さいが、念のため比較ロジックの単体テストで境界値（同一秒での作成）を検証する。
- **Stripe API レート制限** — `subscriptions.list` の追加呼び出しにより Checkout 開始・Webhook 処理のレイテンシがわずかに増加する。既存のリクエスト量から見て許容範囲と判断（Performance 節では特別な対策を設けない）。

## Design Decisions（要件35 プラン変更 追記・2026-07-13）

### Decision: 新規サブスクリプション作成ではなく既存サブスクリプションの `items` 更新
- **Context**: ユーザーから「PlayerとCreatorを切り替えできるように。Stripeでサブスクリプションを更新する」という明示的な指示があり、既存設計（要件33.11 の「ダウングレードは Portal 経由」）を上書きする形でプラン間の直接切替を実装する必要が生じた。
- **Alternatives Considered**:
  1. アップグレードは新規 Checkout、ダウングレードは Customer Portal（旧設計）— 両方向で解約・再契約に近い手順が必要になり、ユーザー体験・実装とも一貫しない。
  2. Stripe `subscriptions.update()` で既存サブスクリプションの Price のみ差し替える（選定）。
- **Selected Approach**: 案2。同一サブスクリプション ID を維持したまま Price（tier）のみを切り替える。
- **Rationale**: Stripe が公式に推奨するプラン変更方式であり、請求サイクル・サブスクリプション ID を維持できるため、要件34（二重課金防止）の対象外にできる（新規サブスクリプションを作成しないため重複が原理的に発生しない）。
- **Trade-offs**: 新規実装として `ChangePlanAPI` を追加する必要があるが、既存の Checkout/Webhook 基盤（Stripe クライアント、tier マッピング）をそのまま再利用できるため実装コストは小さい（Effort: S）。

### Decision: 比例配分は Stripe 標準の `create_prorations`
- **Context**: プラン変更時の課金・返金方針が未定義だった。
- **Selected Approach**: `proration_behavior: 'create_prorations'` を指定し、Stripe 標準の日割り計算に従う（アップグレード時は差額を即時課金、ダウングレード時は次回請求へクレジット）。
- **Rationale**: ユーザーヒアリングで「即時切替え＋日数比例課金/返金（Stripe標準）」が明示的に選択された。カスタム比例配分ロジックを自前実装するより Stripe の実績あるロジックに委ねる方が正確かつ低リスク（Build vs Adopt: Adopt を選択）。

### Decision: ダウングレード確認は UI 側の責務、API 側は無条件実行
- **Context**: ユーザーヒアリングで「確認ダイアログを挟む（失われる特典を明示）」が選択されたが、これは UI 上のユーザー体験の話であり、API 自体に確認ステップを設けるべきかが論点になった。
- **Selected Approach**: `ChangePlanAPI` は確認ステップを持たず、呼び出されたら即座にプラン変更を実行する。確認ダイアログは `quizetika-billing-subscription-ui` 側の責務とし、API 呼び出し前にユーザーの最終確認を得る。
- **Rationale**: API に確認フローを持たせると2段階リクエスト（確認トークン発行→実行）が必要になり複雑化する。UI 側で確認を完結させる方がシンプル（Simplification 原則）。

## Risks & Mitigations（要件35 追記）
- **API 呼び出しパラメータ誤りによる誤課金** — `subscriptions.update()` の `items`/`proration_behavior` パラメータ誤りは実際の請求額に直結する。軽減策: Stripe mock を用いた単体テストでパラメータの正確性を重点検証する。
- **UI側の確認ダイアログをスキップした直接 API 呼び出し** — API 自体が無条件実行のため、UI 側の確認ダイアログを経由しない不正なクライアントからの呼び出しでは確認なしにダウングレードが実行され得る。軽減策: 本要件では認証済み本人操作であることのみを保証し、確認 UX の徹底は `quizetika-billing-subscription-ui` 側のタスクとする（Out of Boundary として明記済み）。

# Research & Design Decisions: quizetika-core — Phase 42 支払い失敗時の状態遷移と失効検知の安全網（2026-07-16）

## Summary
- **Feature**: `quizetika-core` Phase 42（要件36）
- **Discovery Scope**: Extension（既存 Stripe Webhook 基盤の是正 + 定期バッチ処理の新規追加）
- **主要な発見**:
  - `stripe-webhook.ts` の `buildSnapshotFromSubscription()` は `subscriptionTier: hasPaid ? mappedTier : 'free'` という実装になっており、`status` が `active`/`trialing` 以外（`past_due` 等）の場合、契約 tier を即座に `free` へ書き換えていた。ユーザーからの依頼時点の想定（「tier は維持されステータスのみ変わる」）とは異なり、現行コードは既に tier ごと失っていたことが判明。
  - `entitlement-shared.ts` の `computeUserEntitlements()` は `subscriptionTier`（DB の生値）と `subscriptionStatus` を独立した入力として受け取り、`hasPaidEntitlements` 等の可否判定は `PAID_ACTIVE_STATUSES = ['active', 'trialing']` によるステータスゲートのみで行っている。tier の生値そのものは可否判定に使われていないため、`buildSnapshotFromSubscription()` 側の tier 書き換えは元来不要な二重判定だった。
  - `pricing-entitlement.ts` の全ヘルパー（`hasProVisibilityEntitlementsForUser` 等）は `computeUserEntitlements()` に完全委譲しており、tier 生値を直接エンタイトルメント判定に使っている呼び出し箇所は見つからなかった。
  - 手動スクリプト `scripts/sync-subscriptions.ts` は Stripe 側を正として tier を決定するロジック（`active`/`trialing`/`past_due` を有効とみなし最古の1件を採用）を既に実装済みだが、手動実行のみで自動化されていない。
  - 本プロジェクトのホスティング先は Vercel（ユーザー確認済み）であり、`vercel.json` および `.vercel` ディレクトリは未作成。Vercel Cron はスケジュールを UTC で解釈するため、日本時間午前4時台の起動には UTC 19:00（前日）を指定する必要がある。

## Research Log

### tier 書き換えロジックの実態確認
- **Context**: ユーザー要望（過去の支払い失敗時に tier を維持しステータスのみ変更する設計）が、現行実装とどう異なるかを確認する必要があった。
- **Sources Consulted**: `src/services/stripe-webhook.ts`（`buildSnapshotFromSubscription`, `handleStripeSubscriptionEvent`）, `src/app/api/webhooks/stripe/route.ts`, `src/services/entitlement.ts`, `src/services/entitlement-shared.ts`, `src/lib/pricing-entitlement.ts`。
- **Findings**:
  - `buildSnapshotFromSubscription()` は `hasPaid = mappedTier !== 'free' && PAID_ACTIVE_STATUSES.includes(status)` を計算し、`subscriptionTier: hasPaid ? mappedTier : 'free'` を返す。つまり `past_due` 等の非アクティブ状態では tier が即座に `free` へ落ちる。
  - `handleStripeSubscriptionEvent()` 内で `status === 'canceled'` の分岐は `buildSnapshotFromSubscription()` を経由せず `clearPaidEntitlements()` を直接呼ぶ別経路であり、契約の真の終了とその他の非アクティブ状態（`past_due` 等）は元々コード上分離されていた。
  - `computeUserEntitlements()` は tier とステータスを独立変数として受け取り、可否判定はステータスのみに依存する。tier の生値は「表示用の現在契約プラン」としての意味のみを持つ設計であり、tier を `free` に書き換える必要は判定ロジック上ない。
- **Implications**: `buildSnapshotFromSubscription()` から「非アクティブなら tier を free にする」分岐を削除し、常に `mappedTier` を採用する変更が、要件36.1/36.2/36.5 を満たす最小かつ唯一の修正である（Simplification: 既存の重複判定を除去）。

### 定期整合性チェックの実行基盤
- **Context**: Webhook 不達時の安全網として、1日1回・日本時間午前4時台に実行する定期処理が必要（要件36.6, 36.7）。
- **Sources Consulted**: リポジトリ内 `vercel.json` / `.vercel` の有無（未存在を確認）、`scripts/sync-subscriptions.ts`（既存の手動整合性チェックロジック）、ユーザーへのヒアリング（本番ホスティングは Vercel）。
- **Findings**:
  - 本番ホスティングが Vercel であることをユーザーに確認済み。Vercel Cron は `vercel.json` の `crons` フィールドで設定し、指定した API Route を GET リクエストで定期起動する。
  - Vercel は `CRON_SECRET` 環境変数を設定すると、Cron からのリクエストに自動的に `Authorization: Bearer <CRON_SECRET>` ヘッダーを付与する。エンドポイント側でこの値を検証することで、外部からの不正起動を防止できる（`StripeWebhookAPI` の Stripe 署名検証とは異なる認可方式だが、同種の「サーバー間限定エンドポイント」パターン）。
  - Vercel Cron のスケジュールは UTC 基準で解釈されるため、日本時間 4:00 の起動には `0 19 * * *`（UTC 19:00）を指定する必要がある（日付またぎに注意）。
  - `scripts/sync-subscriptions.ts` は既に「Stripe 上の有効サブスクリプション一覧取得 → 最古の1件を正として tier を決定 → DB 更新」というロジックを実装済みであり、これをアプリケーションコード（`src/services/`）へ昇格させることで重複実装を避けられる。
- **Implications**: 新規サービス関数 `reconcileSubscriptions()` を追加し、既存スクリプトと同一の判定ロジックを流用する。起動契機は `vercel.json` の Cron 設定 + `CRON_SECRET` 検証を行う新規 API Route とする。

## Architecture Pattern Evaluation（Phase 42）

| Option                                              | 説明                                                                                          | 強み                                                                                           | リスク・制約                                                                                                                                                                                                                     | 備考 |
| --------------------------------------------------- | --------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| tier 決定ロジックの是正（zeroing 削除）             | `buildSnapshotFromSubscription()` から free 書き換え分岐を削除し、tier とステータスを完全分離 | 既存の `computeUserEntitlements()` ステータスゲートと責務が重複しなくなる。変更箇所が1関数のみ | tier 生値のみを参照する下流表示コードがあれば見た目上の不整合が生じ得る（Revalidation Trigger として明記）                                                                                                                       | 選定 |
| tier は変更せず新規 `pendingDowngrade` フラグを追加 | 既存の tier zeroing は残し、猶予状態を示す別フィールドを追加                                  | 既存ロジックに手を加えない                                                                     | フィールドが1つ増え、`computeUserEntitlements()` 側でも新フィールドを考慮する改修が必要になり複雑化。要件が求める「tier とステータスの独立参照」という単純なモデルに反する                                                       | 却下 |
| Vercel Cron + API Route                             | ホスティング基盤標準の Cron 機能を利用                                                        | 新規インフラ依存なし、`CRON_SECRET` による標準的な認可パターンが確立している                   | Vercel の Cron 実行時間・頻度制約（プランによる上限）に依存する                                                                                                                                                                  | 選定 |
| Supabase Edge Function の pg_cron                   | DB 側のスケジューラを利用                                                                     | Webhook 処理と分離できる                                                                       | 本プロジェクトの実行基盤（Vercel）と別のスケジューラを併用することになり、運用・監視の分散を招く。ホスティングが Vercel である以上、Vercel Cron の方が既存の API Route 資産（Stripe クライアント初期化等）をそのまま再利用できる | 却下 |

## Design Decisions（Phase 42）

### Decision: tier とステータスの完全分離（zeroing ロジックの削除）
- **Context**: 支払い失敗時に tier ごと失われる現行実装は、ユーザーが想定していた「tier は維持されエンタイトルメントのみ非活性化される」設計と乖離していた。
- **Alternatives Considered**:
  1. `buildSnapshotFromSubscription()` はそのままに、読み取り側で tier を復元する仕組みを追加（却下: 書き込み側で誤った値を保存しつつ読み取り側で補正するのは二重管理になり複雑）。
  2. 書き込み側（`buildSnapshotFromSubscription()`）の tier zeroing を削除し、常に実際の tier を記録する（選定）。
- **Selected Approach**: 案2。`hasPaid` 変数とその分岐を削除し、`subscriptionTier: mappedTier` を常に採用する。
- **Rationale**: `computeUserEntitlements()` が既にステータスベースの可否判定を単独で担っており、tier 側でも同じ判定をすることは冗長かつ不整合の原因だった（Generalization/Simplification 原則）。
- **Trade-offs**: `subscription_tier` の生値のみを参照している下流 UI（もしあれば）は、`past_due` 中も「契約中」の表示のままになる副作用が生じる。この対応は `quizetika-billing-subscription-ui` の担当範囲であり、本設計では Revalidation Trigger として明記するに留める。
- **Follow-up**: `quizetika-billing-subscription-ui` 側で、契約状態バッジ等が tier 生値だけでなく `hasPaidEntitlements` / `subscriptionStatus` も考慮した表示になっているか確認が必要（本スペックのタスクには含めない）。

### Decision: 定期整合性チェックは既存手動スクリプトのロジックを昇格
- **Context**: Webhook 不達時の安全網として自動実行される定期処理が必要だが、判定ロジック自体は `scripts/sync-subscriptions.ts` で既に検証済み。
- **Selected Approach**: `scripts/sync-subscriptions.ts` と同一の判定ロジック（Stripe の `active`/`trialing`/`past_due` を有効とみなし最古の1件を正とする）を `src/services/subscription-reconciliation.ts` の `reconcileSubscriptions()` として実装し、新規 Cron API Route から呼び出す。既存スクリプトはコード共有を必須とせず、手動の緊急対応ツールとして独立実行性を維持したまま残置する。
- **Rationale**: 判定ロジックは既に手動運用で実績があり、新規に設計し直す必要がない（Build vs Adopt: 既存ロジックの Adopt）。
- **Trade-offs**: スクリプトとサービス関数でロジックが将来乖離するリスクがあるが、手動スクリプトは緊急時のみの利用に限定されるため許容範囲と判断。

### Decision: 個別ユーザーのエラーはスキップ、致命的エラーのみバッチ中断
- **Context**: 要件36.10「実行中にエラーが発生した場合、安全に中断し次回全件再評価する」を、日次バッチのどの粒度に適用するかが論点だった。
- **Selected Approach**: 個々のユーザーに対する Stripe API 呼び出し失敗はそのユーザーをスキップして処理を継続し、ユーザー一覧取得など全体に影響する致命的エラーの場合のみバッチ全体を中断する。いずれの場合も次回日次実行では対象を絞らず全件を再評価する。
- **Rationale**: 単一ユーザーの一時的な Stripe API エラーで安全網全体が毎日止まってしまうと、安全網としての実効性が失われる。要件が求める「次回実行時に全対象を再評価する」という冪等性は、この粒度分けでも満たされる。
- **Trade-offs**: スキップされたユーザーは是正が最大1日遅延する可能性があるが、安全網はあくまで Webhook 到達後の二次防御であり許容範囲。

## Risks & Mitigations（Phase 42）
- **tier 生値のみを参照する下流コードの取りこぼし** — `subscription_tier` を直接参照し `hasPaidEntitlements` を経由しない表示・判定コードが将来追加された場合、`past_due` 中に誤って有料特典が見えてしまうリスク。軽減策: `hasPaidEntitlements` / `hasCreatorEntitlements` を経由しない tier 直接参照箇所がないか、実装時に既存コードベースを grep で再確認する。
- **是正バッチの誤判定による課金・エンタイトルメントの誤動作** — `reconcileSubscriptions()` の判定ロジックに誤りがあると、正常な契約者が誤って `free` に是正されるなど実害が生じる。軽減策: Stripe mock を用いたユニットテストで一致/不一致の全パターンを検証し、監査テーブルで是正内容を事後追跡可能にする。
- **対象ユーザー数増加時の実行時間超過** — 将来ユーザー数が大きく増えた場合、単一 Cron 実行で全件処理しきれない可能性。軽減策: 現時点では規模的に問題ないと判断し単純な全件走査とするが、Open Question として規模拡大時のページ分割実行方式への切替検討を残す。

## References（Phase 42）
- 既存実装: `src/services/stripe-webhook.ts`, `src/services/entitlement.ts`, `src/services/entitlement-shared.ts`, `src/lib/pricing-entitlement.ts`, `scripts/sync-subscriptions.ts`, `src/app/api/webhooks/stripe/route.ts`
- ユーザーヒアリング: 本番ホスティングは Vercel（2026-07-16 確認）

---

# Research & Design Decisions: quizetika-core — Phase 44 ダッシュボード集計と試行ライフサイクル（2026-07-18）

## Summary
- **Feature**: `quizetika-core` Phase 44（要件 37〜41）
- **Discovery Scope**: Extension（light）。事前調査は `quizetika-creator-dash-ui/research.md` の「Gap Analysis: Phase 44」で完了済み。本節は設計判断の記録に絞る。
- **主要な発見（ギャップ分析より再掲）**:
  - `attempts` の RLS は本人行のみ（`attempts_all`）。クリエイター集計は SECURITY DEFINER 必須。
  - ウミガメ以外の試行は完了時のみ INSERT（`handle_save_attempt`）。完走率にはライフサイクル記録の新設が必要（ユーザー判断で導入決定）。
  - `question_answer_details` JSONB に `questionType` が解答時点で記録済み — 設問形式別集計は過去データにも適用可能。
  - `handle_save_attempt` は SECURITY DEFINER で表示名導出・二重検証・リーダーボード振り分けを内包。UPDATE パス追加時もこれらを維持する必要がある。

## Design Decisions（Phase 44）

### Decision: 集計 RPC は JSONB 返却の粗粒度 API（1タブ=1呼び出し）
- **Alternatives**: (1) 指標ごとの細粒度 RPC 群、(2) タブ単位の一括 JSONB 返却。
- **Selected**: 案2。KPI・推移・内訳を単一 RPC で返す。
- **Rationale**: ダッシュボードはフィルタ変更ごとに全セクションを同時更新する（UI 要件 21.4）ため、細粒度化は往復増とレース管理の複雑化を招くだけ。5秒以内応答（37.13/40.11）にも有利。
- **Trade-offs**: RPC の戻り値スキーマが大きくなる。`src/types/dashboard.ts` の型契約と `dashboard.ts` のマッピングテストで固定する。

### Decision: 世代識別は `started_at IS NOT NULL`
- **Context**: 完走率・離脱分析を導入以降のデータに限定する必要（40.10 / 41.4）。
- **Selected**: 専用フラグやカットオフ日時設定を持たず、ライフサイクル世代の行にのみ存在する `started_at` の有無で判別する。
- **Rationale**: 追加状態を持たない最小構造。オフライン同期行は保存時に `started_at = completed_at` を設定して両側に数える（39.6）。

### Decision: `handle_save_attempt` のシグネチャ拡張（`p_attempt_id UUID DEFAULT NULL`）
- **Rationale**: DEFAULT NULL 追加は既存呼び出し（オフライン同期 `syncPendingAttempts` 含む）に対して完全後方互換。UPDATE パスでも既存の二重検証・リーダーボード振り分け・`play_count` 加算をそのまま通す（分岐は INSERT/UPDATE の書き込み部のみ）。
- **注意**: リーダーボード初回判定（`v_prior_completed_count`）は `completed_at IS NOT NULL` 条件のため、未完了のライフサイクル行が混在しても影響しない（既存条件のまま）。

### Decision: クイズ単体分析の累計部は既存キャッシュカウンタを再利用
- **Context**: 要件 41.1（設問別累計正答率・選択肢分布）は `questions.correct_count`/`incorrect_count`・`choices[].selectedCount` が既に保持している。
- **Selected**: RPC には含めず、UI が既存クイズ読み取りで取得（Build vs Adopt: Adopt）。RPC はライフサイクル依存のスコア分布・離脱分布・完走率のみ提供。

### Decision: タグフィルタ・タグ集計の正本は `quizzes.tags TEXT[]`
- **Context**: `quiz_tags` 正規化テーブルと `quizzes.tags` 配列が併存する。
- **Rationale**: 既存クライアント集計（`computePlayerStats`）・探索系が `quizzes.tags` を表示正本としており、ダッシュボードも同じ見え方に揃える。`quiz_tags` へ正本を切り替える場合は Revalidation Trigger（design.md 記載）。

### Decision: ワードクラウドのキーワード抽出はクライアント残置
- **Rationale**: `Intl.Segmenter` による日本語分かち書きは Phase 42 でクライアント実装済み。RPC はタイトル単位の集計（title/plays/correct/total）を返し、語への展開・除外語処理は既存ロジックを再利用する。DB 側での形態素処理は行わない。

## Risks & Mitigations（Phase 44）
- **進行 UPDATE の書き込み増（1問=1回）** — 単一行 UPDATE で軽量だが、書き込み失敗はプレイに影響させない（fire-and-forget、39.9）。規模拡大時はバッチ化を再検討。
- **JSONB 展開集計の性能** — 形式別集計は attempts 絞り込み後の `jsonb_array_elements` 展開。数万件規模を超えて 5 秒を突破した場合はマテリアライズドビュー化（design.md Open Questions）。
- **プレイ画面側の組み込み漏れ** — `startAttemptSession`/`updateAttemptProgress` の呼び出しはプレイ画面側スペックの実装に依存。未組み込みでも保存はフォールバック INSERT で成立する（完走率のサンプルが増えないだけで壊れない）縮退設計とした。

**Document Status（Phase 44 設計）**: `design.md` Phase 44 節に反映済（2026-07-18）。

### `/kiro-validate-design` レビュー結果の反映（2026-07-18）
- **指摘1（1問単位モードのライフサイクル汚染）**: `my-quiz`（1問単位契約）に開始時記録を適用すると完走率が上方汚染されるため、ライフサイクル対象を複数問一括モード（normal/exam/flashcard/review）に限定。要件 39.1 の字句も修正。
- **指摘2（形式フィルタ・ストリークのセマンティクス）**: 形式フィルタ時の試行単位指標／解答単位指標の母集団定義を design に追記し解釈を確定。
- **指摘3（DEFINER ハードニング）**: `SET search_path = public`・`auth.uid()` NULL 拒否・`anon` からの EXECUTE 剥奪を DEFINER 共通規約として Data Model 節に追記。
- 判定: **GO（修正適用済み）**。
