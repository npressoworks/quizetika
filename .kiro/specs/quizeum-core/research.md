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
- **Auth Session**: クライアント側で `quizeum_banned` Cookie を付与し、BAN検知時に強制ログアウトおよび制限画面へのルーティングを行う。

## Risks
- Missing firestore.rules blocks client tag create on save ? Phase 6 must ship rules with saveQuiz changes
- Index deployment lag causes query failures until indexes propagated
- BANされたユーザーのセッションキャッシュやトークン有効期間中のローカル処理による不整合 -> セキュリティルールでの直接チェックにより、Firestoreに対する不正なデータの永続化は即時エラーとなり防御される。

---

# Gap Analysis: quizeum-core — Phase 8 ブックマーク・リスト・問題再利用（2026-06-05）

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
7. **隣接スペック**: `quizeum-play-flow-ui` / `quizeum-creator-dash-ui` は core API 契約確定後に requirements 更新（roadmap 順）。

## References (Phase 8)

- `.kiro/steering/roadmap.md` — Phase 8（アプローチ 1、問題リスト B）
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

---

# Research: quizeum-core — Phase 13 Stripe サブスクリプション（2026-06-07）

## Summary
- **Feature**: quizeum-core — Pro プラン Stripe サブスクリプション（Checkout / Webhook / Portal / Entitlements）
- **Discovery Scope**: Extension（既存 `ask-ai` 制限・Admin SDK・auth-verify パターンを拡張）
- **Key Findings**:
  - `ask-ai` は既にサーバー側 `isPremium` 参照パターンを実装。`EntitlementService` へ集約すれば tier 拡張が容易。
  - `firestore.rules` で課金フィールドが未保護 — showstopper。Rules を先にデプロイ。
  - Stripe v22 + Checkout Sessions API が要件（リダイレクト Checkout）に最適。`payment_method_types` 省略で dynamic methods 有効。
  - `.env.local` に Stripe キー・Webhook secret は既設定。`STRIPE_PRICE_PRO_MONTHLY/YEARLY` のみ追加必要。

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

| Option | Description | Strengths | Risks | Selected |
|--------|-------------|-----------|-------|----------|
| A. Full vertical slice | Checkout + Webhook + Portal + tier | E2E 価値完結 | Webhook 運用コスト | Yes |
| B. Checkout only | 表示 + Checkout、Webhook 後回し | 早い | 購入後即時反映不可 | No |
| C. Pricing Table embed | Stripe ホスト UI | 実装最小 | デザイン不整合、tier 拡張弱い | No |

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
- `quizeum-billing-subscription-ui/brief.md` — UI 境界
- `roadmap.md` Phase 13 — 依存順序

---

# Gap Analysis: quizeum-core — Phase 13 Stripe サブスクリプション（2026-06-07）

## Analysis Summary

- **スコープ**: 要件 19（サブスクリプション契約とエンタイトルメント）および要件 4.2–4.4（tier ベース AI 制限）の実装ギャップ。Wave 0–11 のコア機能は概ね実装済み。本分析は **未実装の Phase 13 Stripe** に焦点を当てる。
- **現状**: Stripe npm 依存・`.env.local` の API キーは存在するが、**課金 API / Webhook / 型 / Rules / サービス層はゼロ**。`ask-ai` のみ ad-hoc な `isPremium` 直読（部分実装）。
- **クリティカルギャップ**: `firestore.rules` で `isPremium` / `subscriptionTier` が未保護 → クライアント改ざん可能（showstopper）。
- **推奨アプローチ**: 設計どおり **Option C（Hybrid）** — 新規 `entitlement.ts` / `subscription.ts` / billing API + `ask-ai` 改修 + Rules 更新。
- **メタギャップ**: `tasks.md` の Phase 13 は旧「難易度5段階化」（完了済み）のまま。Stripe 用タスクの再生成が必要。

## 1. Current State Investigation

### 1.1 再利用可能な資産

| 資産 | パス | 再利用方法 |
|------|------|------------|
| Bearer 認証パターン | `src/lib/firebase/auth-verify.ts` | Checkout / Portal API で同一 |
| Admin Firestore | `src/lib/firebase/admin.ts` (`getAdminFirestore`) | Webhook・エンタイトルメント書き込み |
| BAN API ルート構造 | `src/app/api/admin/users/ban/route.ts` | billing API の骨格 |
| AI 制限純関数 | `src/services/ask-ai-utils.ts` (`isAiTurnLimitExceeded`) | `EntitlementService` から呼び出し継続可 |
| ask-ai サーバー検証 | `src/app/api/attempt/ask-ai/route.ts` L92–103 | `EntitlementService` へ置換対象 |
| Stripe パッケージ | `package.json` (`stripe` ^22.2.0) | 未 import — 導入のみ残 |
| 環境変数（部分） | `.env.local` | `STRIPE_SECRET_KEY`, `WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` あり。**`STRIPE_PRICE_PRO_*` なし** |

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

| Requirement | 必要アセット | 現状 | ギャップ |
|-------------|-------------|------|----------|
| 19.1 | デフォルト `free` tier | 暗黙（フィールドなし） | **Missing** — 型・読み取りデフォルト未定義 |
| 19.2–19.3 | `subscriptionTier` enum + 拡張点 | なし | **Missing** |
| 19.4 | 契約状態の一貫解釈 | なし | **Missing** — `EntitlementService` |
| 19.5–19.8 | Checkout Session API | なし | **Missing** |
| 19.9–19.12 | Webhook + 冪等 | なし | **Missing** |
| 19.13–19.14 | Portal Session API | なし | **Missing** |
| 19.15–19.17 | tier ベース AI 無制限 | `isPremium` 直読のみ | **Partial** — tier / status 未考慮 |
| 19.18 | Rules 課金フィールド保護 | `moderationTier` のみ保護 | **Missing（Critical）** |
| 19.19 | サーバー正本参照 | ask-ai は DB 直読（良） | **Partial** — クライアント `isPremium` 送信は無視済み |
| 4.2 | 無料 20回制限 | 実装済み | **Constraint** — tier ではなく boolean |
| 4.3 | Pro 無制限 | `isPremium===true` のみ | **Partial** — `subscriptionTier` 未連動 |
| 4.4 | サーバー契約参照 | ask-ai で実装 | **Partial** — `EntitlementService` 未集約 |

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

| ファイル | 変更内容 |
|----------|----------|
| `src/types/index.ts` | `User` に課金フィールド追加 |
| `src/app/api/attempt/ask-ai/route.ts` | `EntitlementService` 利用 |
| `firestore.rules` | 課金フィールド不変 + `stripe_processed_events` deny |
| `src/context/auth-context.tsx` | 読み取り時 `subscriptionTier` デフォルト（任意・UI 連携用） |
| `docs/db_design.md`, `docs/api_specification.md` | 同期（direct impl） |

### 2.3 隣接スペック（コア外だが E2E に必須）

| 領域 | スペック | ギャップ |
|------|--------|----------|
| `/pricing` UI | `quizeum-billing-subscription-ui` | 未着手（spec 未 init） |
| プレイ画面 tier 表示 | `quizeum-play-flow-ui` | `isPremium: false` 固定 |

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

| 項目 | 評価 | 根拠 |
|------|------|------|
| **Effort** | **M（3–7日）** | 新規 7 ファイル + Rules + ask-ai 改修 + 結合テスト。UI は別スペック |
| **Risk** | **Medium** | Webhook 署名・冪等・Stripe テストモード運用は既知パターン。未知技術なし |
| **Blocker** | Rules 未更新 | 実装前に `deploy:rules` で課金フィールド保護必須 |

## 5. Research Needed（設計フェーズへ引き継ぎ済み／残確認）

| 項目 | 状態 |
|------|------|
| Stripe Checkout Sessions + subscription mode | design.md で決定済み |
| Webhook raw body + Node runtime | design.md で決定済み |
| **Stripe Dashboard Pro Product/Price 作成** | 運用タスク — `STRIPE_PRICE_PRO_MONTHLY/YEARLY` を `.env` に設定 |
| Customer Portal 有効化（Dashboard） | 運用タスク |
| ローカル Webhook 転送（`stripe listen`） | 開発時 Research Needed（手順のみ） |

## 6. Spec / ドキュメント整合ギャップ

| ドキュメント | 問題 |
|-------------|------|
| `tasks.md` §13 | 「難易度5段階化」完了済み — **要件 19 Stripe タスク未生成** |
| `requirements.md` / `design.md` | Phase 13 = Stripe（整合） |
| `User` 型 vs `ask-ai` 実行時 | `isPremium` が型にないが Firestore では参照（型ギャップ） |

## 7. Recommendations for Implementation

1. **`/kiro-spec-tasks quizeum-core -y`** で Phase 13 Stripe タスクを再生成（旧 §13 は完了のまま、新 §14 または Phase 13 差し替えを検討）
2. 実装順序: **Rules → 型 + EntitlementService → Webhook → Checkout/Portal → ask-ai 切替 → テスト**
3. 並行: `/kiro-spec-init quizeum-billing-subscription-ui` で UI スペック開始
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

| 箇所 | 挙動 |
|------|------|
| `route.ts` L112–135 | `verifyKeywords` 全一致 → 即 `isCorrect=true`、else AI |
| `buildVerifyTruthPrompt` | `aiContextDetails` + `playerTruth` のみ（キーワード未渡し） |
| `test-play.ts` | `checkTruthKeywordsLocally` — 独立実装、本番 API 非使用 |

### 2. 要件とのギャップ

| 要件 | 現行 | 必要な変更 |
|------|------|------------|
| 4.7 | キーワード検証が先 | AI に3要素を渡す |
| 4.8 | 全一致で即合格 | バイパス削除 |
| 4.9 | キーワードは AI 非参照 | プロンプトにエッセンス追加 |
| 4.10 | キーワード全一致なら AI 不要 | AI 失敗時 503 のみ |

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

# Gap Analysis: quizeum-core — Phase 17 ウミガメ認証・二層制限・諦めフロー改定（2026-06-08）

## Analysis Summary

- **スコープ**: 要件 4（Phase 17 節）および要件 19 のエンタイトルメント整合。隣接 UI（`quizeum-play-flow-ui` / `quizeum-billing-subscription-ui`）は要件境界外だがギャップ表に参照として記載。
- **実装済み（部分）**: ウミガメのみログイン必須の骨格、サーバー側 `resolveUserEntitlements`、クイズ別 `dailyAiTurnCounts`、同一質問キャッシュ（サーバー完全一致）、Pro 向け `limit-exceeded` API 文言、クイズ詳細の「会員登録してプレイする」ボタン。
- **主要ギャップ**: 制限値 20→30/150 未反映、横断日次カウンタ未実装、キャッシュ正規化のサーバー/クライアント不一致、諦め時の真相表示（API+UI）、チャット内ナビ、プレイ画面の entitlements 未連携と Pro 誘導 UI 不足。
- **推奨（設計フェーズ）**: Option C（Hybrid）— `ask-ai-utils.ts` を制限・正規化の単一正本に拡張し、API・クライアント・表示文言を同期。諦め API は `revealText` 廃止、UI は play-flow スペックでチャット内 CTA へ移行。
- **規模/リスク**: **M**（3–7日相当の変更面）、**Low–Medium**（横断カウンタのトランザクション原子性のみ設計要検討）。

## Document Status

- **入力**: `requirements.md`（Phase 17）、`spec.json`（`requirements.approved: false`）、既存 `src/` / `tests/` / `docs/`
- **方法**: gap-analysis.md フレームワーク + Grep/Read
- **注意**: 要件は未承認だが、ギャップ分析は設計判断の入力として実施

## 1. 要件 → 資産マッピング（Phase 17）

| 要件 ID | 期待動作 | 現行資産 | 状態 | ギャップ詳細 |
|--------|----------|----------|------|-------------|
| 4.1 | 未登録時ボタン「会員登録してプレイする」 | `quiz-detail-client.tsx` L330–336 | ✅ 実装済 | play-flow-ui 境界。テスト未整備 |
| 4.2 | 未登録のウミガメ開始→ログイン誘導 | `quiz-detail-client.tsx` L72–74、`quiz-play-client.tsx` L86–88 | ⚠️ 部分 | 詳細は `redirect` 付き。プレイ直アクセスは `/login` のみ（戻り先なし） |
| 4.3 | 他モードはゲスト可 | 通常プレイ `user?.id \|\| 'guest'` | ✅ 実装済 | 横断確認のみ |
| 4.4 | 認証済みで lateral attempt 作成 | `createLateralAttemptSession` (`attempt.ts`) | ✅ 実装済 | `listId` は常に `null`（4.23 と関連） |
| 4.5 | AI 質問（履歴20件） | `ask-ai/route.ts` + Gemini | ✅ 実装済 | — |
| 4.6 | 無料：同一クイズ 30回/日 | `FREE_TIER_DAILY_TURN_LIMIT = 20`、`ask-ai/route.ts` | ❌ 未実装 | 定数・API・`attempt.aiTurnLimit: 20`・UI 表示すべて 20 |
| 4.7 | 無料：横断 150回/日 | なし | ❌ 未実装 | `dailyAiTurnCounts` は `{quizId}` のみ。グローバル doc 未設計 |
| 4.8 | Pro 無制限 | `entitlement.ts` `hasUnlimitedAiQuestions` | ✅ 実装済 | 上限値変更後もロジックは流用可 |
| 4.9 | サーバー側 tier 判定 | `ask-ai/route.ts` `resolveUserEntitlements` | ✅ 実装済 | — |
| 4.10 | 正規化一致で全カウンタ非消費 | クライアント: `useAiPlayState` 正規化 / サーバー: `findCachedAnswer` 完全一致 | ⚠️ 部分 | 表記ゆれで API 呼び出し＆カウント発生。クライアント重複時は履歴に毎回追加（表示上の重複） |
| 4.11 | 上限到達→質問拒否・真相可・Pro 誘導 | API: `limit-exceeded` + Pro 文言 / UI: 汎用エラー | ⚠️ 部分 | 上限値誤り。`/pricing` リンクなし。`turnsRemaining` はクイズ別のみ |
| 4.12–4.20 | レイアウト・真相判定・経過時間 | `quiz-play-client.tsx`、`verify-truth/route.ts` | ✅ 実装済 | ルール説明に「最大20回」表記が残存（L731） |
| 4.21 | 諦め→真相非表示 | `give-up-lateral/route.ts` → `revealText`、UI 右パネル表示 | ❌ 未実装 | Phase 16 仕様のまま。テストも `revealText` 期待 |
| 4.22 | チャット内「結果画面へ」 | 右パネル内ボタン（真相表示後） | ❌ 未実装 | チャット内 CTA なし |
| 4.23 | リスト文脈で「次の問題へ」 | なし | ❌ 未実装 | lateral は `listId` 未伝播。結果画面の list ナビは別実装 |
| 4.24–4.27 | 入力ロック・完了保存・API 認証 | 既存 give-up / verify-truth | ✅ 実装済 | 4.21–4.23 と組み合わせて UI 改修が必要 |
| 19.11, 19.15, 19.17–18 | tier と 30/150 制限整合 | `requirements` 更新済 / コードは 20 | ❌ 未実装 | 要件と実装の乖離 |

## 2. 現行アーキテクチャ（関連モジュール）

| モジュール | 役割 | Phase 17 への影響 |
|-----------|------|------------------|
| `src/services/ask-ai-utils.ts` | キャッシュ検索・制限判定定数 | **拡張先**: 正規化関数、30/150 定数、二重制限判定、エラーコード |
| `src/app/api/attempt/ask-ai/route.ts` | AI 質問 API | 横断カウンタ読み書き、制限種別付き 429、正規化キャッシュ |
| `src/hooks/useAiPlayState.ts` | クライアント質問状態 | 正規化の共通化、サーバー `turnsRemaining` 同期、Pro メッセージ |
| `src/app/quiz/[id]/play/quiz-play-client.tsx` | ウミガメ UI | 諦め UI、チャット CTA、`isPremium` ハードコード除去、制限表示 |
| `src/app/api/attempt/give-up-lateral/route.ts` | 諦め API | `revealText` 返却廃止、完了のみ |
| `src/services/attempt.ts` | lateral session 作成 | `aiTurnLimit: 30`、`listId` 引き継ぎ検討 |
| `src/lib/pricing-display.ts` | 料金表示文言 | 「20回」→「30回/クイズ・150回/日」 |
| `src/services/entitlement.ts` | tier 解決 | 変更不要（上限ロジックは ask-ai 側） |
| `docs/*.md` | 正本ドキュメント | 20回制限・諦め解説開示の記述が旧仕様 |

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

| 項目 | 内容 |
|------|------|
| 横断カウンタの doc ID | `dailyAiTurnCounts/_global` vs 別コレクション。Firestore Rules 影響 |
| 二重制限のトランザクション | クイズ別 + 横断を1トランザクションで increment する際の読み取り順序 |
| `limit-exceeded` のサブタイプ | `per-quiz` / `global-daily` を `error` フィールドで区別（要件 19.18） |
| lateral + リスト連続プレイ | `createLateralAttemptSession` が `listId` を受け取るか。問題リストの lateral 親クイズの遷移 URL |
| 諦め後の結果画面 | 真相を結果画面でも出さないか（要件はプレイ画面のみ明示。結果画面は別確認可） |
| `turnsRemaining` レスポンス | クイズ別・横断の2値を返すか、表示優先ルール |

## 5. テストギャップ

| テスト | 現状 | 必要な更新 |
|--------|------|-----------|
| `tests/services/ask-ai-utils.test.ts` | 20回制限・厳格キャッシュ | 30/150、正規化キャッシュ、二重制限 |
| `tests/api/give-up-lateral.test.ts` | `revealText` 期待 | 非返却・完了のみ |
| `tests/api/ask-ai*.test.ts` | **なし**（統合除外コメント） | 新規 API 統合テスト推奨（制限・キャッシュ） |
| `tests/lib/pricing-display.test.ts` | 文言 id のみ検証 | 30/150 文言アサーション |
| `tests/services/useAiPlayState.test.ts` | モック正規化のみ | フック本体または統合テスト不足 |

## 6. Effort & Risk

| ラベル | 評価 | 根拠 |
|--------|------|------|
| **Effort** | **M** | 6–10 ファイル + docs + 隣接 UI 2 スペック。新規インフラ不要 |
| **Risk** | **Low–Medium** | 既存 Stripe/entitlement パターン流用。横断カウンタ原子性と list 連続プレイのみ設計要確認 |

## 7. 設計フェーズへの推奨事項

1. **正本**: `ask-ai-utils.ts` に制限定数・正規化・`AiTurnLimitResult` 型を集約（design Boundary Commitments）。
2. **API 契約**: `limit-exceeded` に `limitType: 'per-quiz' \| 'global-daily'` を追加。キャッシュヒット時は `turnsRemaining` に両残数を含めるか設計で決定。
3. **諦め API**: 成功応答は `{ completed: true }` のみ（`revealText` 破壊的変更 — クライアント同時デプロイ）。
4. **タスク分割案**: (T1) utils+API 制限、(T2) キャッシュ正規化、(T3) give-up API+UI、(T4) play UI Pro 誘導・entitlements、(T5) pricing-display + docs。
5. **隣接スペック**: `quizeum-play-flow-ui` / `quizeum-billing-subscription-ui` の requirements 追従を design で明示。

## 8. 設計フェーズ確定事項（2026-06-08）

| 持ち越し項目 | 設計決定 |
|-------------|---------|
| 横断カウンタ doc ID | `users/{uid}/dailyAiTurnCounts/_global`（reserved ID） |
| 二重制限トランザクション | attempt + per-quiz + global を単一 Transaction で increment |
| `limit-exceeded` サブタイプ | `limitType: 'per-quiz' \| 'global-daily'` |
| lateral + リスト連続プレイ | `createLateralAttemptSession` が `listId` を受け取り attempt に保存 |
| 諦め後の結果画面 | プレイ画面のみ真相非表示を要件化。結果画面は現行どおり真相を出さない |
| `turnsRemaining` | `{ perQuiz, globalDaily }` の2値を成功応答に含める |

**Synthesis**: Option C（Hybrid）採用。`ask-ai-utils.ts` を正本化し、諦め API は応答のみ変更、UI は play-flow / billing 境界に委譲。

**Document Status（Phase 17 設計）**: `design.md` Phase 17 節に反映済。`spec.json` → `phase: design-generated`。

---

## Phase 18: 模擬試験・フラッシュカード LB 非対象（2026-06-09）

### Summary
既存 `leaderboard-update.ts` の `isLeaderboardEligibleAttempt` を拡張し `exam` / `flashcard` を除外する。prior 件数は `countPriorCompletedAttempts` が既に全モードをカウントしているため、追加スキーマ不要で「exam 先プレイ → 通常は replay のみ」を満たす。

### Research Log

| Topic | Findings | Implications |
|-------|----------|--------------|
| 現行 eligibility | guest / test-play のみ除外 | exam / flashcard を同関数に追加 |
| prior count | LB 対象試行保存時のみ query、フィルタは completedAt のみ | 変更不要。exam 後 normal で prior >= 1 |
| verify-truth | トランザクション前に全モード prior 集計済 | `buildLeaderboardUpdatesForQuiz` 経由で自動除外 |

### Design Decisions
1. **Option A 採用** — 単一関数拡張。別カウンタやユーザーフラグは不要。
2. **後方互換** — 既存 LB エントリは削除しない（新規更新のみ制御）。

**Document Status（Phase 18 設計）**: `design.md` Phase 18 節に反映済。

---

## Phase 20: 〇×問題形式（`true-false`）（2026-06-09）

### Summary
`true-false` は型・バリデーション・採点経路が既存。ギャップは `Quiz.format` 未登録、`resolveQuizFormat` が単一形式を `mixed` に落とす、ラベル／探索未整備。専用 lib `true-false-defaults.ts` で固定「〇」「✕」生成を集約し、既存 `choices` + `isChoiceAnswerCorrect` を維持。

### Research Log

| Topic | Findings | Implications |
|-------|----------|--------------|
| データモデル | `Question.type: 'true-false'`、validation 2択 | `Quiz.format` 拡張のみ |
| 形式解決 | `only === 'true-false'` → `mixed` | `SINGLE_FORMAT_TYPES` へ追加 |
| 採点 | `usePlayState` + `isChoiceAnswerCorrect` | API 変更不要 |
| 作問方針 | 正解トグルのみ（ユーザー確定） | 保存時正規化でラベル固定 |

### Design Decisions
1. **Build** — `true-false-defaults.ts` 新設。`correctTextAnswerList` 移行は却下。
2. **後方互換** — 既存 Firestore データは読み取り拒否せず、新規保存のみ正規化。

**Document Status（Phase 20 設計）**: `design.md` Phase 20 節に反映済。

---

## Phase 21: ホームフィード段階的取得（2026-06-09）

### Summary
現行 `getLatestQuizzes` / `searchQuizzes` は一括返却（30〜100件）。`listUserPlayHistory` の `limit+1` + base64url カーソルパターンを踏襲し、タブ別は Firestore `startAfter`、検索は既存 `materialize` パイプライン + オフセットカーソル（cap 200）で段階化する。

### Research Log

| Topic | Findings | Implications |
|-------|----------|--------------|
| タブ API | 単一 orderBy クエリ | ネイティブカーソル適用可 |
| searchQuizzes | マルチクエリ + クライアント合成 | 全面 cursor 化は高コスト。offset + fingerprint |
| 既存利用者 | ジャンル scoped は一括維持 | `searchQuizzes` 非ページング版を残す |
| ページサイズ | play history 20件 | `HOME_FEED_PAGE_SIZE=20` で統一 |

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

## Phase 23: リスト探索・マイクイズ Core API（2026-06-09）

### Summary

`quiz-list.ts` に `searchLists`（公開/本人非公開 + in-memory keyword、`DEFAULT_LIST_SEARCH_LIMIT=50`）を追加。マイクイズは `my-quiz-pool.ts` で4ソース合成、`my-quiz-session.ts` で `question-list-session` 同型の sessionStorage 契約、`Attempt.mode: 'my-quiz'` + 任意 `sessionId` を追加。`saveAttempt` は `question-list` / `my-quiz` の1問試行で親クイズ全問数検証をバイパス（`totalQuestions=1` 固定検証）。LB は `question-list` と同方針（eligible）。Firestore に `quizLists` の `isPublished+createdAt` / `authorId+isPublished+createdAt` 複合 index を追加。

### Discovery Type

**Extension（light）** — 既存 `getLatestQuizLists` / `getQuizListsByAuthor` / `question-list-session` / `question-attach-search` / `bookmark.ts` / `leaderboard-update.test.ts` パターンの拡張。外部 API 調査不要。

### Research Log

| Topic | Findings | Implications |
|-------|----------|--------------|
| リスト一覧 | `getLatestQuizLists` が `isPublished+orderBy createdAt` を既使用。`searchLists` 未実装 | public クエリは既存パターン流用 + keyword 後段 filter |
| 非公開探索 | `getQuizListsByAuthor(uid, true)` は公開/非公開混在。探索は `isPublished===false` 限定が必要 | 専用 composite query + `authorId` 必須バリデーション |
| インデックス | `firestore.indexes.json` に `isPublished+createdAt` および `authorId+isPublished+createdAt`（listType なし）が未登録 | Phase 23 で2件追加 |
| 問題プール | `useQuestionAttachSearch` が own/bookmarked 収集済。ブックマークリスト経路は `getQuizzesInList` | `buildMyQuizQuestionPool` に集約。問題リスト型 bookmark list は除外 |
| Dedupe | `dedupeQuestionCandidates` が questionId 先勝ち | ソース priority 順 flat 化後に reuse |
| セッション | `question-list-session.ts` が CRUD + URL 生成の正本 | `my-quiz-session` は `sessionId` + `mode=my-quiz` URL。別 sessionStorage キー |
| saveAttempt | L92–95 が常に `quiz.questions.length` と照合 | `question-list` も現状バグ潜在。1問モード分岐で両方修正 |
| LB | `isLeaderboardEligibleAttempt` は exam/flashcard/test-play/guest のみ除外 | `my-quiz` は追加除外不要（`question-list` と同 eligible） |

### Architecture Pattern Evaluation

| Option | searchLists keyword | my-quiz session | Verdict |
|--------|---------------------|-----------------|---------|
| A. Firestore prefix 検索 | composite + 全文近似 | サーバー session doc | 過剰 |
| B. 取得後 in-memory filter + sessionStorage（採用） | 既存 normalize-search-text | question-list 同型 | **採用** |
| C. クライアントのみ（Core なし） | UI が全件 fetch | — | 要件 23/24/25 違反 |

### Design Decisions

1. **`searchLists` in `quiz-list.ts`** — service 層に配置（lists-discovery-ui 契約どおり）。keyword は in-memory（初版 limit 50 内で十分）。
2. **`my-quiz-pool.ts` 新設** — UI フィルタは core 外。pool は raw 候補のみ返却。
3. **`mode=my-quiz` URL** — `question-list` と分離し、play client 分岐を明確化（my-quiz-ui 所有）。
4. **`saveAttempt` 分岐** — `isSingleQuestionAttemptMode` で検証パス共有。通常モード挙動は不変。
5. **LB** — 新規ポリシー不要。既存 eligible 集合に `my-quiz` が自然包含されることをテストで固定。

### Risks

| Risk | Mitigation |
|------|------------|
| 4ソース N+1 クエリ | 初版は既存 attach search と同程度。将来バッチ化は follow-up |
| private `authorId` 漏洩 | サーバー側 query + 未指定 throw。Rules は既存 author 制約 |
| saveAttempt 分岐漏れ | 専用テスト + `question-list` 回帰 |

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
  * [src/types/index.ts](file:///d:/quizeum/src/types/index.ts): `User` 型定義。現在 `snsLinks` フィールドは存在しない。
  * [src/services/user.ts](file:///d:/quizeum/src/services/user.ts): プロフィール情報更新API（`updateProfile`）および検証ロジック（`validateProfileData`）が実装されている。
  * [src/services/storage.ts](file:///d:/quizeum/src/services/storage.ts): Firebase Storage上のファイルアップロード・削除処理が配置されている。現在、アセットロゴの取得用ヘルパーは存在しない。
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


