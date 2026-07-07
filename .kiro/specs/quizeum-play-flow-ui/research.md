# Research & Design Decisions: quizetika-play-flow-ui

## Summary
- **Feature**: quizetika-play-flow-ui（Phase 5 差分: クイズ単位リーダーボードUI）
- **Discovery Scope**: Extension（`quizetika-core` 実装済み、UI仕上げ）
- **Key Findings**:
  - `src/app/quiz/[id]/page.tsx` に暫定の二表縦並び実装あり（`sortLb` インライン、リプレイ行に `leaderboard-entry` 未付与）。
  - 読み取りヘルパー `getLeaderboardFirstPlay` / `getLeaderboardReplay` は `@/lib/leaderboard-ranking` に既存。
  - E2E `leaderboard.spec.ts` は旧「ハイスコア／最速」前提のまま。

## Research Log

### 既存クイズ詳細LB実装
- **Context**: Phase 5 コア実装後のUIギャップ確認。
- **Sources Consulted**: `src/app/quiz/[id]/page.tsx`, `src/lib/leaderboard-ranking.ts`, `e2e/leaderboard.spec.ts`
- **Findings**:
  - 初回／リプレイの2セクション縦並びは要件9.1を満たすが、タブUXとコンポーネント分離が未了。
  - ページ内 `sortLb` は要件9.8（表示のみ）と境界が曖昧。保存順を信頼する方針に変更。
  - リプレイ表の行に `data-testid="leaderboard-entry"` が欠落。
- **Implications**: `QuizDualLeaderboard` へ抽出し、read helper + slice のみに統一。

### プラットフォームLBとのUI一貫性
- **Context**: `/leaderboard` は既にタブUI（`leaderboard-tab`）。
- **Sources Consulted**: `src/app/leaderboard/page.tsx`
- **Findings**: クイズ単位LBもタブパターンを採用すると学習コストが低い。
- **Implications**: `quiz-leaderboard-tab-first` / `quiz-leaderboard-tab-replay` を設計。初回テーブルは `highscore-leaderboard` を後方互換維持。

## Architecture Pattern Evaluation

| Option             | Description              | Strengths                       | Risks / Limitations                | Notes      |
| ------------------ | ------------------------ | ------------------------------- | ---------------------------------- | ---------- |
| 縦並び2表（現状）  | 初回・リプレイを連続表示 | 実装済み                        | モバイルで縦長、タブ要件の弱い充足 | 採用しない |
| タブ切替           | 1系統ずつ表示            | コンパクト、/leaderboard と一貫 | タブ操作がE2Eで1ステップ増         | **採用**   |
| ページ内インライン | page.tsx に表ロジック    | 差分小                          | 保守性・9.8境界が悪化              | 採用しない |

## Design Decisions

### Decision: 読み取りは `getLeaderboard*` + slice のみ
- **Context**: 要件9.8（更新・並び替えロジック禁止）。
- **Alternatives Considered**:
  1. ページ内 `compareLeaderboardRecords` で防御的ソート
  2. サーバー保存順を信頼し slice(0,5) のみ
- **Selected Approach**: 2 — `quizetika-core` が書き込み時に順位付け済み。
- **Rationale**: 責務分離。レガシー `leaderboard` の順序不整合はコア移行で解消。
- **Trade-offs**: 極稀にレガシーデータの表示順がずれる可能性。
- **Follow-up**: 移行後に legacy フィールド参照を廃止する際、本コンポーネントのフォールバック分岐を削除。

### Decision: `QuizDualLeaderboard` コンポーネント新設
- **Context**: 暫定実装のリファクタと E2E 契約の固定。
- **Selected Approach**: `src/components/quiz/quiz-dual-leaderboard.tsx` + CSS Module。
- **Rationale**: `QuizDetailPage` の責務をメタ・プレイ導線に集中。
- **Follow-up**: 単体テストは props で空配列／5件表示をスナップショットまたは RTL で検証（任意）。

## Risks & Mitigations
- **E2E破壊** — `fastest-leaderboard` 参照テストを `replay-leaderboard` に更新。
- **暫定縦並びからタブへ** — 同一 `data-testid="quiz-leaderboard"` を維持し既存シナリオの一部は継続可能。
- **legacy leaderboard 表示** — `getLeaderboardFirstPlay` に委譲しコアと同一ルール。

## References
- `.kiro/specs/quizetika-core/design.md` — LB永続化・`LeaderboardRecord`
- `docs/detailed_design.md` — 画面F-801/F-802（表示側）
- `src/types/index.ts` — `LeaderboardRecord`

---

# Gap Analysis: quizetika-play-flow-ui（Phase 6 差分 — 2026-06-03）

## Analysis Summary

- **スコープ**: 要件 1–9 はおおむね実装済み。Phase 6（要件 10）が未着手で、ホーム・ジャンル／タグ一覧・復習のジャンル周りが `docs/` / コア API と乖離している。
- **上流依存**: `quizetika-core` の `listActiveGenres` / C2 `getQuizzesByGenre` / `getQuizzesByTag` / `searchQuizzes` は **実装済み** — UI 接続のみで足りる。
- **最大ギャップ**: ハードコード `GENRES` / `REVIEW_GENRES`、ホームのクライアント側のみ絞り込み、`searchQuizzes` 未使用、探索ページのソートタブ欠如。
- **副次ギャップ**: 要件 1.3 の「プレイ状況」フィルタ UI はあるが `filteredQuizzes` に未接続（スタブ状態）。
- **推奨**: **Option C（ハイブリッド）** — `useActiveGenres` + `GenreNav` 新設、既存 `page.tsx` / 探索ページを段階的に差し替え。共有 `ExploreSortTabs` の抽出は任意。

## 1. Current State Investigation

### 既存アセット（再利用可能）

| 領域         | 現状                                                                                                                      | パターン                                      |
| ------------ | ------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| コア API     | `src/services/quiz.ts` に `listActiveGenres`, `getQuizzesByGenre(_,_,sort)`, `getQuizzesByTag(_,_,sort)`, `searchQuizzes` | クライアントから直接 import（既存と同型）     |
| ホーム       | `src/app/page.tsx` — タブ・複合フィルタ UI・`GENRES` 定数                                                                 | CSS Modules、`useMemo` クライアントフィルタ   |
| ジャンル一覧 | `src/app/genres/[genreName]/page.tsx` — `getQuizzesByGenre(id, 20)` のみ                                                  | 新着固定、ヘッダーは URL 生文字列             |
| タグ一覧     | `src/app/tags/[tagName]/page.tsx` — `getQuizzesByTag` のみ                                                                | ソート UI なし                                |
| 復習         | `src/app/quiz/review/page.tsx` — `REVIEW_GENRES` 定数                                                                     | `getFailedQuestions` はコア側でマージ展開済み |
| Phase 5 LB   | `QuizDualLeaderboard` + 単体テスト                                                                                        | 読み取り専用コンポーネント分離済み            |
| プレイ系     | `usePlayState`, `useAiPlayState`, play/result 各ページ                                                                    | 要件 3–5 は充足                               |

### 命名・レイヤー

- 探索ページは `src/app/page.module.css` をジャンル／タグで共有。
- 新規は `src/hooks/useActiveGenres.ts`、`src/components/explore/genre-nav.tsx` が設計案（未作成）。
- E2E は `e2e/additional-features.spec.ts` がホームの **「コンピュータ・IT」** ボタン名に依存 → Phase 6 で更新必須。

## 2. Requirement-to-Asset Map

| 要件                                 | 状態             | ギャップ / 備考                                                                                        |
| ------------------------------------ | ---------------- | ------------------------------------------------------------------------------------------------------ |
| **1.1** ホームタブ                   | ✅ 充足           | `getLatestQuizzes` 等                                                                                  |
| **1.2** ジャンルナビ                 | ⚠️ 部分           | `GENRES` ハードコード。`iconImageUrl` 未使用                                                           |
| **1.3** 複合検索                     | ⚠️ 部分           | UI あり。`searchQuizzes` 未使用。`playStatus` 未配線。ジャンルは `quiz.genre` のみ（canonical 未考慮） |
| **1.4** ゲスト BM                    | ✅ 充足           | `/login` リダイレクト                                                                                  |
| **2–8**                              | ✅ おおむね充足   | プレイ・結果・編集ガード・探索他画面は実装済み（別タスク検証済み）                                     |
| **9** 二系統 LB                      | ✅ 充足           | `QuizDualLeaderboard`                                                                                  |
| **10.1** `listActiveGenres` ナビ     | ❌ 欠落           | 未呼び出し                                                                                             |
| **10.2** ハードコード禁止            | ❌ 欠落           | `GENRES` / `REVIEW_GENRES` が正本                                                                      |
| **10.3** `/genres/[id]` 遷移         | ❌ 欠落           | 現状はホーム内 `selectedGenre` フィルタのみ（`docs/screen_transition.md` は遷移を期待）                |
| **10.4** `searchQuizzes`             | ❌ 欠落           | クライアント `useMemo` フィルタのみ                                                                    |
| **10.5** ジャンル一覧メタ            | ❌ 欠落           | `displayName` / `iconImageUrl` 未表示                                                                  |
| **10.6** ジャンル一覧ソート          | ❌ 欠落           | `sort` 引数未使用、タブなし（コアは対応済み）                                                          |
| **10.7** タグ一覧ソート              | ❌ 欠落           | 同上                                                                                                   |
| **10.8** 復習ジャンルマスタ          | ❌ 欠落           | `REVIEW_GENRES` 固定（API フィルタはコアでマージ対応済み）                                             |
| **10.9** 空ジャンル                  | ❌ 欠落           | 0 件時の UI なし                                                                                       |
| **10.10** エラー時フォールバック禁止 | ⚠️ 暗黙違反リスク | マスタ未取得時も `GENRES` が常に表示される                                                             |

## 3. Implementation Approach Options

### Option A: 既存ページへの直接拡張

- `page.tsx` 内で `listActiveGenres` を `useEffect` 取得し、`GENRES` を state 置換。
- ジャンル／タグ `page.tsx` にソート state を追加。

| 長所               | 短所                                    |
| ------------------ | --------------------------------------- |
| ファイル数が少ない | ホームが肥大化し続ける                  |
| 短期で動く         | `GenreNav` / エラー状態の再利用が難しい |

**Effort**: S–M | **Risk**: Low

### Option B: 新コンポーネント中心（設計どおり）

- `useActiveGenres` + `GenreNav` + 共有 `ExploreSortTabs`（任意）。
- ホーム・ジャンル・タグ・復習は薄いページラッパーに留める。

| 長所                                | 短所             |
| ----------------------------------- | ---------------- |
| 境界明確、テストしやすい            | 新規ファイル 3–4 |
| E2E の `data-testid` を固定しやすい | 初回の配線コスト |

**Effort**: M | **Risk**: Low–Medium（E2E 更新）

### Option C: ハイブリッド（推奨）

- **新規**: `useActiveGenres`, `GenreNav`（10.1）。
- **拡張**: `page.tsx`（10.2–10.4）、`genres/[genreName]`（10.5–10.6）、`tags/[tagName]`（10.7）、`review`（10.8）。
- **共有**: ホームのタブバーと同型のソート UI を探索ページにコピーまたは小コンポーネント化。

| 長所                    | 短所                                          |
| ----------------------- | --------------------------------------------- |
| 設計・tasks.md と一致   | ホームの「フィルタ vs 遷移」UX要決定          |
| コア API をそのまま利用 | `playStatus` は別途 Attempt 連携が必要（1.3） |

**Effort**: **M（3–7 日）** | **Risk**: **Low**（コア完了前提）

## 4. Research Needed（設計フェーズへ引き継ぎ）

| 項目                       | 状態                                                                                       |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| ジャンルナビのクリック挙動 | **確定**: アイコンは常に `/genres/[id]` 遷移。ホーム絞り込みは `GenreSearchField` のみ     |
| ホーム検索トリガー         | **確定**: フィルタ変更 + デバウンス（例 300ms）→ `searchQuizzes`                           |
| `playStatus`               | **確定**: 要件 1.3 完遂。`listUserPlayedQuizIds` + API、結果の後段フィルタ。未認証は無効化 |
| アイコン表示               | 実装時決定（`next/image` またはフォールバック）                                            |
| Firestore シード           | 実装時決定                                                                                 |
| E2E                        | `data-testid` 化・遷移アサーションへ更新                                                   |

## 5. Upstream / Downstream

| 依存                        | 状態                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------- |
| `quizetika-core` Phase 6    | ✅ API 利用可能（要: Rules/Indexes 本番デプロイは運用）                                   |
| `quizetika-creator-dash-ui` | 未確認 — エディタの動的セレクトは別スペック（ジャンル表示の一貫性は E2E で横断確認推奨） |
| `quizetika-auth-profile-ui` | プロフィールのフォロージャンル UI は別（`followedGenres` は表示名文字列のままの可能性）  |

## 6. Effort & Risk Summary

| フェーズ                | Effort | Risk   | 根拠                               |
| ----------------------- | ------ | ------ | ---------------------------------- |
| Phase 6 UI（10.1–10.6） | M      | Low    | 既存サービス・ページパターンの延長 |
| E2E 更新（10.6–10.7）   | S      | Medium | ハードコードラベル依存の除去       |
| 要件 1.3 playStatus     | S–M    | Medium | コア未対応なら UI のみでは不可     |

## 7. Design Phase Recommendations

1. **採用**: Option C（`tasks.md` セクション 10 と整合）。
2. **優先順**: 10.1 → 10.3（ジャンルページ）→ 10.2（searchQuizzes）→ 10.5（復習）→ 10.4（タグ）→ 10.6（検証）。
3. **設計で固定すること**: ジャンルクリック = `/genres/[id]` 遷移（フィルタ専用ボタン「すべて」はホーム残留）。
4. **テスト**: `useActiveGenres` モック単体 + `GenreNav` RTL + E2E の `data-testid="genre-nav-item-{id}"` 追加。
5. **設計更新**: 既存 `design.md` Phase 6 は概ね妥当。`ExploreSortTabs` の要否だけ実装時に決定。

## Document Status

- 分析手法: コードベース Grep/Read + 要件 10 トレース + `quizetika-core` API 存在確認
- 出力先: 本ファイル（`research.md`）に追記
- 外部 Web 調査: 不要（社内スタック確定済み）

---

# Phase 8 Gap Analysis（要件 11・2026-06-05）

## Summary

`quizetika-core` Phase 8 は実装済み（`getBookmarkFeed`, `getQuestionsInList`, `toggleBookmark` 問題対応, `saveAttempt` の `question-list` モード）。`quizetika-play-flow-ui` は `/bookmarks` がクイズのみ、`list/[id]` がクイズリスト専用、プレイ／結果に問題 BM なし、問題リスト連続プレイ未配線。本フェーズは **Extension（軽量 discovery）** で既存ページ拡張 + 小コンポーネント抽出が最適。

## 1. Current State vs Requirements 11

| 要件                                 | 現状                            | ギャップ                                |
| ------------------------------------ | ------------------------------- | --------------------------------------- |
| **11.1** 3タブ                       | 単一クイズ一覧                  | `getBookmarkFeed` + タブ UI 未実装      |
| **11.2** 未認証リダイレクト          | 実装済                          | 維持                                    |
| **11.3** クイズタブ                  | `getBookmarkedQuizzes` で実装済 | `BookmarkFeed.quizzes` へ移行           |
| **11.4** リストタブ                  | なし                            | 新規グリッド                            |
| **11.5** 問題タブ                    | なし                            | `BookmarkedQuestionEntry` + 日時降順    |
| **11.6** 問題カード→プレイ           | なし                            | `startAtQuestionId` 導線                |
| **11.7–11.9** プレイ/結果 BM・未認証 | なし                            | `QuestionBookmarkToggle` 新規           |
| **11.10–11.12** 問題リストプレイ     | `mode=list`（クイズ連続）のみ   | `question-list` セッション + 次問題遷移 |
| **11.13** クイズリスト維持           | 実装済                          | 問題分岐と混在させない                  |
| **11.14** コア永続化なし             | 準拠                            | UI はサービス呼び出しのみ               |

## 2. Core API 確認（利用可能）

| API                                     | 所在             | UI からの参照            |
| --------------------------------------- | ---------------- | ------------------------ |
| `getBookmarkFeed`                       | `bookmark.ts`    | ❌                        |
| `toggleBookmark(..., 'question')`       | `bookmark.ts`    | ❌                        |
| `getQuestionsInList`                    | `quiz-list.ts`   | ❌                        |
| `resolveListType`                       | `types/index.ts` | ❌                        |
| `saveAttempt` + `mode: 'question-list'` | `attempt.ts`     | ❌（play は `list` のみ） |

## 3. Design Synthesis（Phase 8）

### Generalization
- **ブックマーク解除**は3タブ共通で `toggleBookmark` + 楽観的配列除去。`useBookmarkFeed.removeBookmark` に集約。
- **リスト連続プレイ**はクイズリスト（`quizIds` + `mode=list`）と問題リスト（`question-list-session` + `mode=question-list`）でセッション形状が異なるが、結果画面の「次へ」パターンは共通化可能（先に `listType` / セッション種別を判定）。

### Build vs. Adopt
- **採用**: コア `getBookmarkFeed` 一括取得（3タブで再フェッチ不要）。`sessionStorage` で問題リスト進行（既存 `usePlayState` の `localStorage` キーと衝突しない別キー）。
- **新規**: `question-list-session.ts` のみ。外部ライブラリ不要。

### Simplification
- `BookmarksPage` を肥大化させず `components/bookmark/*` に分割。E2E 用 `data-testid` はタブバーに集中。
- 問題単体プレイ（11.12）は専用ルートを作らず `startAtQuestionId` クエリで既存プレイ画面を拡張。

## 4. Architecture Pattern Evaluation

| Option | 説明                              | 判定                                          |
| ------ | --------------------------------- | --------------------------------------------- |
| A      | 各ページに直書き                  | 却下（bookmarks/play/result が肥大化）        |
| B      | フック + 小コンポーネント（推奨） | **採用** — 設計・tasks 境界が明確             |
| C      | 専用 `/question-list/play` ルート | 却下 — コア契約は親 `quizId` ベースの attempt |

## 5. Risks & Mitigations

| リスク                                     | 緩和                                                                                           |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------- |
| クイズリストと問題リストの結果画面分岐競合 | `question-list-session` 存在を先に評価                                                         |
| 親クイズ跨ぎで `usePlayState` が全問ロード | `questionId` で1問にフィルタ                                                                   |
| 問題 BM 初期状態の N+1                     | プレイ画面は quiz ロード時に user's bookmarked questionIds を1回取得（または feed キャッシュ） |

## 6. Upstream / Downstream

| 依存                        | 状態                                                       |
| --------------------------- | ---------------------------------------------------------- |
| `quizetika-core` Phase 8    | ✅ 実装・テスト済                                           |
| `quizetika-creator-dash-ui` | 問題リスト作成 UI は別スペック（プレイ導線のみ本スペック） |
| `quizetika-auth-profile-ui` | プロフィール BM 表示は別（任意連携）                       |

## Document Status（Phase 8）

- 分析: Grep/Read（`bookmarks/page.tsx`, `list/[id]/page.tsx`, `play/page.tsx`, `result/page.tsx`, `bookmark.ts`）
- Discovery 種別: **Light（Extension）**
- 外部調査: 不要

---

# Research & Design Decisions: quizetika-play-flow-ui（Phase 10 差分 — 2026-06-05）

## Summary
- **Feature**: ホーム統合検索のタグチップ化・タグ／ジャンルサジェスト、クイズカードの★N難易度・ジャンル・出題形式、探索一覧の `QuizCard` 統一
- **Discovery Scope**: Extension（`GenreSearchField` / `filter-genre-suggestions` / `QuizCard` 既存パターンの拡張）
- **Key Findings**:
  - ホーム検索はプレーン `<input>` + `searchQuery` のみ。タグチップ・タグサジェスト未実装。
  - `searchQuizzes` は単一 `queryText` のみ。複数タグ AND は `SearchFilters.tags` 拡張が必要（`quizetika-core` Phase 10）。
  - `listActiveTags` は未実装。`TagMetadata` 型と `metadata-resolution` は存在。
  - ジャンル／タグ一覧はインライン `Link` カードで `QuizCard` と表示不整合（難易度バー、ジャンル／形式なし）。
  - `getFormatLabel` は `quiz-editor.tsx` 内ローカル関数。共有 lib へ抽出が妥当。

## Research Log

### 既存ジャンルサジェストパターン
- **Sources**: `genre-search-field.tsx`, `filter-genre-suggestions.ts`, `useActiveGenres.ts`
- **Findings**: listbox + 矢印キー + `data-testid="genre-suggest-{id}"` が確立済み。タグ／統合検索も同型で実装可能。
- **Implications**: `UnifiedSearchField` は `GenreSearchField` のキーボード契約を踏襲。フィルタパネル用 `GenreSearchField` は存続し `genreId` を双方向同期。

### searchQuizzes とタグチップ
- **Sources**: `quiz.ts` `searchQuizzes`, `home-feed-filters.ts`, `useHomeQuizFeed.ts`
- **Findings**: `hasActiveHomeSearchFilters` は `tagChips` 未対応。`needle` 空時は genre または latest のみ。複数タグ AND はクライアント後段フィルタまたはコア拡張が必要。
- **Implications**: `HomeFeedFilters.tagChips` 追加。コアに `tags?: string[]` を渡し、各タグを `normalizeTag` 後に `canonicalTagIds` / `tags` 配列へ AND マッチ（設計契約）。

### クイズカード表示
- **Sources**: `quiz-card.tsx`, `genres/[genreName]/page.tsx`, `success-client.tsx`（`★ {difficulty}` 先例）
- **Findings**: 結果画面は `★ N` 形式の先例あり。`QuizCard` は `難易度: N / 10` + プログレスバー。形式ラベルはエディタ内 7 種。
- **Implications**: 難易度は `★ {quiz.difficulty}` に統一。`quiz-format-labels.ts` + `resolveQuizFormat` でカード表示。

## Architecture Pattern Evaluation

| Option                     | Description            | Strengths            | Risks                 | Selected |
| -------------------------- | ---------------------- | -------------------- | --------------------- | -------- |
| A: UnifiedSearchField 新設 | チップ＋サジェスト一体 | 責務明確、テスト容易 | HomePage 状態増       | **Yes**  |
| B: page.tsx インライン     | 差分最小               | 短期速い             | 保守性悪化            | No       |
| C: サーバー suggest API    | 専用エンドポイント     | 将来拡張             | 過剰、Phase 10 範囲外 | No       |

## Design Decisions

### Decision: 難易度は数値併記 `★ N`
- **Context**: ユーザー確定（アプローチ1）。
- **Selected**: 星アイコン + 1〜10 整数。10段階塗りつぶしやプログレスバーは採用しない。
- **Rationale**: 結果画面と一貫。カード面積を節約。

### Decision: クイックサーチはタグチップ追加
- **Context**: 要件 12.11。
- **Selected**: `#tag` クリック → `normalizeTag` → チップ追加 → 即 `searchQuizzes`。
- **Rationale**: 複数タグ AND の意図が明確。

### Decision: 探索一覧は QuizCard に統一
- **Context**: 要件 12.19。ジャンル／タグページは別インライン実装。
- **Selected**: `QuizCard` + `genreDisplayName` prop + 親側ブックマーク状態管理。
- **Rationale**: 表示項目の単一正本。

## Risks & Mitigations
- **コア未実装ブロック** — `listActiveTags` / `searchQuizzes.tags` は `quizetika-core` Phase 10 を先に実装。UI はモックまたは feature flag なしで直列依存。
- **genreId 二重管理** — `UnifiedSearchField` と `GenreSearchField` で `filterGenreId` を HomePage が単一 state として保持。
- **旧クイズ format 欠落** — `resolveQuizFormat` で推定しラベル表示。テストで `format` 無しフィクスチャを検証。

## Document Status（Phase 10）
- 分析: Grep/Read（`page.tsx`, `quiz-card.tsx`, `genre-search-field.tsx`, `useHomeQuizFeed.ts`, `quiz.ts`）
- Discovery 種別: **Light（Extension）**
- 外部調査: 不要

### validate-design 反映（2026-06-05 再設計）
- **QuizCard ナビゲーション**: 探索一覧は `href` prop でルートを `Link` 化。ホームは `onPlayClick` 維持。`play-btn` testid を全画面で付与。
- **Enter 優先順位**: サジェスト open + 候補あり → 選択。それ以外 → チップ確定（`GenreSearchField` 同型）。
- **タグサジェスト**: 照合キー `id`、表示 `tagName ?? id`。`listActiveTags` は core 要件 16（存続タグのみ）に依存。

---

# Gap Analysis: quizetika-play-flow-ui（Phase 10 実装後 & Phase 11 — 2026-06-05）

## Analysis Summary

- **Phase 10（要件 12）**: **おおむね実装済み**。`UnifiedSearchField`（タグチップ・サジェスト）、`QuizCard`（★N・ジャンル・形式）、ジャンル／タグ一覧の `QuizCard` 統一、`getFormatLabel` 共有 lib 化、関連テストあり。
- **Phase 11（要件 13）**: **未着手**。アコーディオン・カルーセルなし。`GenreNav` がホームに残存（`/genres` 遷移）。ジャンルページに検索 UI なし。`filterFormat` 状態なし。
- **Phase 10 残差**: 軽微 — `handleSearchClearAll` はジャンルクリア済みだが Phase 11 向け **形式クリア未対応**（将来拡張）。プレイ状況フィルタは `applyPlayStatusFilter` で接続済み。
- **推奨（設計フェーズ）**: **Option C（ハイブリッド）** — 新規 `ExploreAccordion` / `GenreCarousel` / `FormatCarousel` + `HomeFeedFilters` / hook 拡張 + ジャンルページは共有 `ExploreSearchSection` を `lockedGenreId` 付きで再利用。
- **規模 / リスク**: Phase 11 **M（3–5日）/ Medium** — 新 UI コンポーネント、状態同期、`GenreNav` 削除に伴うテスト/E2E 更新。

## Document Status

- **入力**: `requirements.md` 要件 12–13、roadmap Phase 10–11、`page.tsx`, `genre-nav.tsx`, `genres/[genreName]/page.tsx`, `unified-search-field.tsx`, `home-feed-filters.ts`, `useHomeQuizFeed.ts`
- **手法**: gap-analysis.md フレームワーク、Grep/Read
- **分析日**: 2026-06-05
- **上流**: `quizetika-core` Phase 11（`SearchFilters.format`）が UI の形式カルーセルより先

## 1. Requirement-to-Asset Map

### Phase 10（要件 12）

| サブ領域              | 期待                                | 現状                                | ギャップ              |
| --------------------- | ----------------------------------- | ----------------------------------- | --------------------- |
| 12.1–6 タグチップ     | スペース/Enter 確定、× 削除、クリア | `unified-search-field.tsx`          | ✅                     |
| 12.7–10 サジェスト    | タグ・ジャンル部分一致              | `filter-search-suggestions.ts`      | ✅                     |
| 12.11 クイックサーチ  | チップ追加（テキスト流し込み禁止）  | `page.tsx` `handleQuickChip`        | ✅                     |
| 12.12–15 検索実行     | タグ AND + デバウンス               | `useHomeQuizFeed` + `searchQuizzes` | ✅                     |
| 12.16–20 クイズカード | ★N、ジャンル、形式                  | `quiz-card.tsx` + 探索ページ        | ✅                     |
| 12.21–22 a11y/testid  | キーボード、data-testid             | 実装・部分テスト                    | ✅（E2E 追加余地あり） |

### Phase 11（要件 13）

| サブ領域                    | 期待                           | 現状                              | ギャップ                     |
| --------------------------- | ------------------------------ | --------------------------------- | ---------------------------- |
| 13.1–3 アコーディオン       | 2 セクション独立開閉           | なし                              | ❌ **Missing**                |
| 13.4–8 ジャンルカルーセル   | 横スクロール、ホーム内フィルタ | `GenreNav` ピル → `/genres` 遷移  | ❌ **Missing** + **Conflict** |
| 13.9–12 形式カルーセル      | 7 形式、ホーム内フィルタ       | なし                              | ❌ **Missing**                |
| 13.13–14 GenreNav 置換      | ピル非表示、遷移禁止           | `page.tsx` L266 `GenreNav`        | ❌ **Missing**                |
| 13.15–18 状態共有           | 検索バー・カルーセル同期       | `filterGenreId` のみ、format なし | ❌ **Partial**                |
| 13.19–23 ジャンルページ検索 | scoped 検索 UI                 | `getQuizzesByGenre` のみ          | ❌ **Missing**                |
| 13.26–27 testid             | accordion/carousel/search      | なし                              | ❌ **Missing**                |

## 2. Current State Investigation

### 既存アセット（Phase 11 で再利用）

| ファイル                   | 再利用内容                                                     |
| -------------------------- | -------------------------------------------------------------- |
| `unified-search-field.tsx` | タグチップ・ジャンルサジェスト — ホーム／ジャンルページ共通    |
| `genre-search-field.tsx`   | フィルタパネル内ジャンル（ホームのみ。ジャンルページは非表示） |
| `genre-nav.tsx`            | カード UI の参考（アイコン+ラベル）— **置換対象**              |
| `explore-sort-tabs.tsx`    | ジャンルページのソート（検索未指定時）                         |
| `home-feed-filters.ts`     | `format` フィールド追加先                                      |
| `useHomeQuizFeed.ts`       | `searchQuizzes` 呼び出し — `format` 引数追加                   |
| `quiz-format-labels.ts`    | 形式カルーセルラベル定義                                       |
| `page.module.css`          | 検索セクションスタイル — アコーディオン追加                    |

### 競合・置換ポイント

```text
page.tsx 現行レイアウト:
  searchSection (UnifiedSearchField + filterPanel)
  quickSearch chips
  GenreNav  ← Phase 11 で削除
  tabBar + grid

Phase 11 目標:
  searchSection
  ExploreAccordions (genre | format carousels)  ← 新規
  quickSearch / tabBar / grid
```

- `tests/components/genre-nav.test.tsx` — ホームから `GenreNav` 削除後は **コンポーネント単体テストは残すか、カルーセルテストへ移行**。
- `genre-nav.tsx` の `/genres` 遷移は要件 13 と矛盾 — ファイル自体は削除せず、ホームからの参照のみ除去可。

## 3. Implementation Approach Options

### Option A: `page.tsx` インライン拡張

- アコーディオン・カルーセルを `page.tsx` に直接追加
- **Pros**: ファイル数最小
- **Cons**: `page.tsx` 肥大化（既に 340 行級）、ジャンルページ再利用困難
- **Effort**: M / **Risk**: Medium

### Option B: 探索コンポーネント一式新設

- `explore-accordion.tsx`, `genre-carousel.tsx`, `format-carousel.tsx`, `explore-search-section.tsx`
- **Pros**: テスト・ジャンルページ再利用が明確
- **Cons**: ファイル増
- **Effort**: M / **Risk**: Low-Medium

### Option C: ハイブリッド（推奨候補）

- **新規**: アコーディオン + 2 カルーセル + `EXPLORE_FORMATS` 定数（`quiz-format-labels` 隣接）
- **拡張**: `HomeFeedFilters.format`, `hasActiveHomeSearchFilters`, `useHomeQuizFeed`（または `useExploreQuizFeed`）
- **共有**: `ExploreSearchSection` — props: `lockedGenreId?: string`（ジャンルページ用）
- **削除**: ホームの `GenreNav` import/render
- **Pros**: roadmap Phase 11 の shared seam に一致、ジャンルページ scoped 検索を DRY
- **Cons**: hook 抽象化の初期コスト
- **Effort**: M / **Risk**: Medium

## 4. ジャンルページ scoped 検索 — 設計論点

| 論点             | 選択肢                                                                                                                                     |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| 検索 active 判定 | `hasActiveExploreFilters({ ...filters, lockedGenreId })` — locked genre は常に active 扱いしない（要件 13.22）                             |
| データ取得分岐   | フィルタなし → `getQuizzesByGenre(id, limit, sort)` / あり → `searchQuizzes(keyword, { genreId: locked, tags, format, ... })`              |
| ソート           | scoped 検索時は `searchQuizzes` 戻りを `sortQuizzesForList` でクライアント再ソート（Research Needed: core 側 sort 引数追加 vs UI 側 sort） |
| プレイ状況       | ジャンルページ要件に明記なし — 初版はホーム同等フィルタを写すか Out か design で確定                                                       |

## 5. Research Needed

| 項目                  | 内容                                                                                            |
| --------------------- | ----------------------------------------------------------------------------------------------- |
| scoped 検索時のソート | `searchQuizzes` は `latest` 固定取得が多い — ジャンルページで「人気」タブ + 検索同時指定時の UX |
| カルーセル UX         | scroll-snap のみ vs 左右矢印ボタン（要件未指定 — design で任意）                                |
| E2E                   | 既存ホーム E2E が `GenreNav` / ジャンル遷移を前提にしていないか確認                             |
| core 依存             | Phase 11 UI は `quizetika-core` の `format` フィルタ merge 後に結合                             |

## 6. Effort & Risk Summary

| ワークストリーム               | Effort | Risk           |
| ------------------------------ | ------ | -------------- |
| Phase 10 残差（ほぼなし）      | —      | —              |
| アコーディオン + カルーセル UI | M      | Low            |
| ホーム状態拡張 + GenreNav 削除 | S      | Medium（回帰） |
| ジャンルページ scoped 検索     | M      | Medium         |
| テスト（RTL + E2E 更新）       | S      | Medium         |
| **Phase 11 合計**              | **M**  | **Medium**     |

## 7. Design Phase Recommendations

1. **Option C** — 共有 `ExploreSearchSection` + `lockedGenreId`。
2. 形式一覧定数: `src/lib/explore-formats.ts`（id + label、`getFormatLabel` 再利用）。
3. 実装順: **core format フィルタ → ホームカルーセル → GenreNav 削除 → ジャンルページ**。
4. `GenreNav` コンポーネントファイルは残し、ホーム参照のみ削除（他画面で未使用なら deprecation コメント）。
5. testid 契約は要件 13.26–27 に従い E2E を先にスケルトン定義。

## Document Status（Phase 11）

- 設計: `design.md` Phase 11 節追記済み
- Discovery 種別: **Light（Extension）**
- 外部調査: 不要

### Design Synthesis（Phase 11 — 2026-06-05）

**Generalization**
- 探索フィルタ状態は `HomeFeedFilters` + `hasActiveExploreFilters` / `hasActiveScopedExploreFilters` に集約。ホームとジャンルページは `ExploreSearchSection` + `useExploreQuizFeed` を共有。
- ジャンル／形式の「カード選択」は同一トグルパターン（選択 → 再選択で解除）。

**Build vs. Adopt**
- **採用**: 既存 `UnifiedSearchField`、`QuizCard`、`ExploreSortTabs`、コア `searchQuizzes.format`（実装済み）、クライアント `sortQuizzesForList`。
- **新規**: アコーディオン・2 カルーセル、`explore-formats.ts`。外部 carousel ライブラリは不採用。

**Simplification**
- `useHomeQuizFeed` を `useExploreQuizFeed` に統合（home/scoped モード）。`GenreNav` はホームから除去のみ（ファイル削除しない）。

### validate-design 反映（予定）
- scoped 検索 + ソート同時指定時は UI 側 `sortQuizzesForList` で再ソート（core に sort 引数追加は Phase 11 Non-Goal）。

---

# Gap Analysis & Research Log: スマートサジェスト機能（Phase 10 追記 — 2026-06-06）

## 1. 調査と分析のサマリー
- **機能**: `GenreSearchField` および `UnifiedSearchField` のフォーカス時（空クエリ時）に、localStorage 履歴および週間人気トレンドTop5をドロップダウンサジェストする機能。
- **実装アプローチ**: 
  - クライアント側履歴 (`localStorage`) は安全かつ軽量に保つため、Firestore等には保存せずクライアントローカルで完結（重複排除、先頭挿入、件数制限）。
  - 週間の人気ジャンル・タグ・キーワードは、attempts コレクションおよび search_logs コレクションから直近7日間のデータを集計する Route Handler を新設し、30分間のデータキャッシュ (`revalidate = 1800`) を適用。
  - セキュリティ保護のため、未認証ユーザーからの検索については `search_logs` への非同期書き込みを行わない。

## 2. 設計上の決定とトレードオフ

### 決定: クライアント履歴の localStorage 完結
- **Context**: ユーザーが検索した履歴をドロップダウンに表示する。
- **Selected Approach**: `localStorage` を使用し、キー `quizetika_recent_search_genres` および `quizetika_recent_search_words` で管理。
- **Rationale**: ユーザー個別の直近履歴をサーバーに送信・永続化するコストとプライバシーへの懸念を排除し、ミリ秒以下の即時応答を可能にするため。

### 決定: API への30分キャッシュ適用
- **Context**: `/api/genres/weekly-top` と `/api/search/weekly-top` は集計コスト（過去7日間の attempts や search_logs のスキャン）が高い。
- **Selected Approach**: `export const revalidate = 1800` を設定。
- **Rationale**: Firestoreの読み取りコスト (Read operations) を節約し、大量アクセス時も高速に応答するため。

### 決定: 型定義のジェネリクス化 (`filterGenreSuggestions`)
- **Context**: ジャンルカルーセルに `filterGenreSuggestions` の戻り値を渡す際、`Pick<GenreMetadata, 'id' | 'displayName'>[]` への縮退により TypeScript の型エラー（`GenreMetadata[]` への代入不可）が発生。
- **Selected Approach**: `filterGenreSuggestions` の定義にジェネリクス `T extends Pick<GenreMetadata, 'id' | 'displayName'>` を導入。
- **Rationale**: クエリフィルタ実行時にもオブジェクトの元の型情報を保持し、呼び出し側でのキャストや別オブジェクトの再ロードを防ぐため。

## 3. リスクと緩和策
- **キャッシュによるトレンド反映の遅延**: 新しくプレイされたクイズや検索履歴が最大30分間トレンドに載らないが、週間の集計であるため即時性は不要であり許容範囲内。
- **エミュレータ未起動時の API エラー (ECONNREFUSED)**: ローカル開発および動作テスト時にエミュレータが起動していない場合、API がエラーを返す。これを防ぐため、`.env.local` にエミュレータ用環境変数を明記し、Next.js 起動時に `npm run emulators` が裏で動いていることを徹底。

---

# Gap Analysis: quizetika-play-flow-ui (結果画面および難易度UI改善差分 — 2026-06-06)

## Analysis Summary
- **スコープ**: クイズプレイ画面から結果画面への自動遷移、難易度（★）の等幅ゲージのグラデーションカラー表示、結果画面でのヒント・質問回数表示、作者情報とお気に入り、指摘/通報機能の制限と追加。
- **上流依存**:
  - `quizetika-core`: 既存の `getQuizzesByAuthor`（作者別クイズ取得）や `flagContent`（コンテンツ通報）を活用可能。
  - `Attempt` スキーマ拡張なしで連想クイズのヒント数をやり取りするため、解答中の一時状態を `localStorage` 等で結果画面へ引き渡す設計。
- **最大ギャップ**:
  - 結果画面（`result/page.tsx`）の難易度投票・難易度表示に★のグラデーションUIが未配置。
  - クイズ全体の指摘時の「別解の追加要望」カテゴリの除外フィルタ、および「通報（コンテンツフラグ）」モーダルの新設。
  - 最後の解答時の自動遷移（「全問終了しました！」待ち画面のバイパス）。
- **推奨（設計フェーズ）**: **Option C（ハイブリッドアプローチ）**。既存の `play/page.tsx`, `result/page.tsx` を直接拡張しつつ、難易度のグラデーション星ゲージ表示用に共通ユーティリティやUI関数を定義。

## 1. Current State vs Requirements (差分マップ)
- **自動遷移 (要件 3.6)**:
  - 現状: `play/page.tsx` の 598-607 行目で「全問終了しました！ 結果を確認する」ボタンをレンダリング。
  - ギャップ: これを削除し、最後の回答送信完了（または `isFinished` 確定）時に自動で `handlePlayComplete()` に進むようにフックやライフサイクルを配線。
- **難易度の★グラデーションカラー (要件 2.1b-1 / 5.2a)**:
  - 現状: `page.tsx`（詳細）では単色表示、結果画面では数値のボタングリッドのみで★表示なし。
  - ギャップ: 難易度の値に応じて `hsl` で動的に変化する緑→黄→赤のグラデーションカラー表示をするためのスタイル/コンポーネントを追加。
- **連想クイズ・ウミガメのスープの結果表示 (要件 5.6)**:
  - 現状: 質問回数は `attempt.aiTurnCount` から取得可能だが表示なし。連想クイズのヒント表示回数は attempt に保存されていない。
  - ギャップ: 連想クイズプレイ完了時に表示したヒント情報を `localStorage` 等を介して結果画面へ引き渡し、結果画面上で表示する。
- **もう一度プレイするボタン・作者リンク・おすすめ (要件 5.7 / 5.7a / 5.8 / 5.9)**:
  - 現状: 「もう一度プレイする」ボタンや作者クイズ推薦 UI は未実装。
  - ギャップ: 結果画面の末尾に、`getQuizzesByAuthor` を使って取得した作者の他の公開クイズをカード一覧としてレンダリングするセクションを追加。
- **クイズ全体の指摘と通報 (要件 5.3a / 5.10 / 5.11 / 5.11a)**:
  - 現状: 指摘カテゴリは常に typo/fact/alternative を表示。クイズ全体用の通報ボタンやブックマークトグルは結果画面の上部に未配置。
  - ギャップ: 全体指摘時は「別解の追加」を選択肢から非表示にする条件分岐。通報ボタンを押した際に理由（`reason`）を入力する通報モーダルを新設し、`src/services/moderation.ts` の `flagContent` と連携。

## 2. Core API / Assets Confirmation
- **利用可能API**:
  - `getQuizzesByAuthor(authorId)` in `src/services/quiz.ts` (作者の他のクイズの取得に使用)
  - `flagContent(quizId, reporterId, reason)` in `src/services/moderation.ts` (通報機能に使用)
  - `toggleBookmark` in `src/services/bookmark.ts` (クイズ全体のブックマークトグルに使用)

## 3. Implementation Complexity & Risk
- **Effort**: **S-M (1〜3日)**
  - UI 変更、ボタン追加、モーダル追加、遷移自動化が中心であり、コア API の新設は不要なため低コスト。
- **Risk**: **Low**
  - 既存のクイズ詳細画面と結果画面の拡張のみであり、破壊的変更はない。

## 4. Recommendations for Design Phase
1. **難易度カラー計算ヘルパーの共通化**:
   難易度（1〜10）を引数にとり、滑らかなグラデーションカラーを生成する関数を `src/lib/` などの共通領域に定義し、詳細画面・結果画面・クイズカードで共有可能にする。
   （例：`hsl(${Math.max(0, 120 - (difficulty - 1) * 13)}, 100%, 45%)`）
2. **通報モーダルと指摘モーダルの共通化/分離**:
   通報ボタン用の簡易モーダルを新規作成するか、または指摘モーダルを拡張して「通報理由」の入力および送信（`flagContent` 呼び出し）を行えるように設計する。保守性を高めるため、極力シンプルなコンポーネント構造にする。
3. **お気に入り状態の双方向反映**:
   結果画面の「お疲れ様でした」カード領域でのブックマーク追加/解除アクションが、その後の他のUIや詳細画面へ戻った際にも正しく状態が維持されていることを確認する。

---

# Phase 14: 作家お礼機能の廃止および結果画面でのフォロー機能の追加（2026-06-07 ディスカバリー）

## 1. 調査と分析のサマリー
- **機能**: クイズ結果画面（`/quiz/[id]/result`）において、既存の「作家にお礼リアクションを送る」機能（感謝リアクション）を廃止し、代わりに「作成者をフォローする / フォロー解除する」ボタンを表示する。
- **調査スコープ**: Extension（`src/services/user.ts` の既存フォローAPIを利用し、UIおよび要件定義書・設計書を整合）
- **キー発見**:
  - `src/services/user.ts` には `followUser`, `unfollowUser`, `isFollowing` がすでに実装されており、これらを結果画面から直接インポートして利用可能。
  - `src/services/reaction.ts` の `sendReaction` はお礼リアクションの廃止に伴い結果画面からは呼び出されなくなる。
  - 自分自身のクイズ結果画面ではフォローボタンを非表示にする制御が必要。
  - オフライン時は、フォロー状態のトグル操作を無効化（非活性化）し、良問評価等と同様の制限を適用する。

## 2. 設計上の決定とトレードオフ

### 決定: `UserService` を直接インポートしてフォロー状態を制御
- **Context**: 結果画面における作家のフォロー状態判定およびトグル。
- **選択アプローチ**: `src/services/user.ts` の `isFollowing` で初期状態を取得し、ボタンクリックで `followUser` または `unfollowUser` を実行。
- **理由**: すでに `quizetika-auth-profile-ui` 等で実績のある API であり、追加の API 設計が不要で安全に統合できるため。

### 決定: 自分自身のクイズにおけるフォローボタンの非表示
- **Context**: ユーザーが自分自身をフォローできない制約。
- **選択アプローチ**: ログイン中の `user.id` とクイズの `authorId` が一致する場合はボタンをレンダリングしない（非表示にする）。
- **理由**: Firebase 側のトランザクションエラーを回避し、UX を向上させるため。

## 3. リスクと緩和策
- **オフライン時の操作**: オフライン中にフォローボタンが押されると Firebase エラーが発生する。
  - **緩和策**: `online` ステートを監視し、`!online` 時にはボタンを `disabled` にし、視覚的にも無効化する。

---

# Gap Analysis: 非同期データフェッチとスケルトンロード表示（Streaming & Suspense）（Phase 12 追記 — 2026-06-07）

## 1. 調査と分析のサマリー
- **機能**: 主要画面（ホーム、クイズ詳細、結果、ブックマーク、通知、プロフィール、総合リーダーボード、弱点克服、ジャンル・タグ一覧）における、Next.jsのStreaming機能とSuspenseを活用した静的フレームの先行配信と、非同期に読み込まれるコンテンツ領域のスケルトン（Skeleton）プレースホルダー表示。
- **実装アプローチ**:
  - `page.tsx` をサーバーコンポーネント（Server Component）として残し、背景コンテナ、戻るボタン、ヘッダー、サイドバー、検索バーの枠組みなど静的レイアウトフレームをサーバー側で即時描画してクライアントへStreaming送信する。
  - Firebase 認証状態の読み込み（`useAuth`）や Firestore からの非同期データ取得など、非同期データフェッチに依存する表示エリアを `<Suspense fallback={<Skeleton />}>` で囲む。
  - 動的データをフェッチするコンポーネントをクライアントコンポーネント、または非同期サーバーコンポーネントとして実装し、Suspense 内に配置する。
  - 認証必須の画面（`/bookmarks`, `/notifications`, `/creator/dashboard` 等）では、Next.jsの Middleware (`src/middleware.ts`) を用いて Cookie ベースでのサーバーサイドリダイレクトを行い、クライアント側でのマウント後リダイレクトによる白紙表示を防ぐ。

## 2. 設計上の決定とトレードオフ

### 決定: `page.tsx` の Server Component 化と非同期データ取得の境界
- **Context**: 画面全体の白紙ローディングを避けるための App Router 設計。
- **選択アプローチ**: 各ページのメイン `page.tsx` は Server Component とし、ヘッダーや枠組みを即時レンダリング。データ読み込みは `<Suspense>` を挟んだ子コンポーネント（あるいは Server Component 内での Promise 渡し）で行う。
- **理由**: これにより静的フレームの即時描画（Streaming）が可能になり、データ取得が完了したものから順次画面に反映される。

### 決定: Cookie セッションを利用した Middleware でのサーバーサイド認証保護
- **Context**: `/bookmarks` などのログイン必須画面におけるリダイレクト制御。
- **選択アプローチ**: クライアントサイドでのマウント後リダイレクトは白紙ローディングや画面のチラつき（Flicker）が発生するため、Next.js Middleware (`src/middleware.ts`) にて Firebase セッション Cookie もしくは認証Cookieを利用してサーバーサイドで即時保護・リダイレクトを行う。
- **理由**: 白紙表示を完全になくし、静的フレームすら未認証ユーザーに見せないセキュリティ保護とUXを両立するため。

## 3. リスクと緩和策
- **N+1 フェッチおよびローディングのチラつき**:
  - 小さすぎる Suspense 境界は、個々の小さなパーツがバラバラにローディングされ、UI がガタつく（Layout Shift）。
  - **緩和策**: 意味のあるコンテンツグループ（例：クイズ詳細メタ全体、リーダーボード全体、おすすめクイズ全体）ごとに Suspense 境界をまとめ、専用の Skeleton プレースホルダーを配置する。
- **テスト自動化への影響**:
  - 非同期ローディングにより、E2Eテストや単体テストがローディング状態のままアサーションに到達し失敗するリスク。
  - **緩和策**: スケルトン領域に明確な `data-testid` を付与し、テストコードでスケルトンの消失または実コンテンツの描画を待機（`waitFor` 等）するように設計する。

---

# Gap Analysis: プレイ画面 Suspense 最適化（Phase 12 追補 — 2026-06-07）

## 1. 調査サマリー

- **対象要件**: 要件 15 受け入れ基準 22–32（本番 `/quiz/[id]/play`、test-play `/quiz/test-play/play`、共有 `PlaySkeleton`）
- **実装状況**: Phase 12 追補の新規資産は**未実装**。両プレイ画面は全面 `'use client'` のまま、ロード UI は中央テキスト（「プレイ環境を準備中...」「テストプレイを準備中...」）
- **参照実装**: クイズ詳細・結果画面は Server Component + async Loader + Skeleton パターンが**完了済み**（`src/app/quiz/[id]/page.tsx`、`result/page.tsx`）
- **レイアウト除外**: 要件 15.32 は**既に充足** — `layout-wrapper.tsx` / `sidebar.tsx` / `header.tsx` / `bottom-nav.tsx` が `pathname.includes('/play')` で非表示
- **推奨方向**: design.md の Hybrid（RSC シェル + Client 本体分割）が既存コードベースと最も整合。Effort **M**、Risk **Medium**

## 2. 現状調査（Current State）

### 2.1 関連ファイル

| ファイル                                      | 行数規模 | 現状                                                                                                    |
| --------------------------------------------- | -------- | ------------------------------------------------------------------------------------------------------- |
| `src/app/quiz/[id]/play/page.tsx`             | ~1130    | 全面 Client。`useEffect` + `getQuiz`、quick-press 難読化 inline、`React.Suspense` は `use(params)` のみ |
| `src/app/quiz/test-play/play/page.tsx`        | ~703     | 全面 Client。`loadTestPlayPayload`（sessionStorage）、テキスト fallback Suspense                        |
| `src/components/quiz/play-skeleton.tsx`       | —        | **不存在**                                                                                              |
| `src/lib/quick-press-obfuscate.ts`            | —        | **不存在**                                                                                              |
| `src/app/quiz/[id]/play/quiz-play-client.tsx` | —        | **不存在**                                                                                              |

### 2.2 再利用可能な既存資産

| 資産                                            | 用途                                                                                           |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `getQuiz()` (`src/services/quiz.ts`)            | 本番 Loader。結果・詳細 RSC で Server 側利用実績あり（Client Firebase SDK）                    |
| `QuizResultClient` パターン                     | Server で fetch → `JSON.parse(JSON.stringify(quiz))` → Client props 渡し                       |
| `DetailSkeleton` / `ResultSkeleton`             | pulsing CSS・glassmorphism パターンの参照（`*.module.css` の `.pulse`）                        |
| `usePlayState` / `useAiPlayState`               | プレイ進行・localStorage セッション（変更不要、Client に残す）                                 |
| `lib/test-play.ts`                              | `loadTestPlayPayload`, `prepareQuizForTestPlay`, TTL エラー処理（test-play Client で継続利用） |
| `play.module.css`                               | プレイ UI スタイル（Client 移管後も共有）                                                      |
| `tests/components/skeleton-components.test.tsx` | Skeleton testid テストの追加先                                                                 |

### 2.3 命名・パターン

- Phase 12 完了画面: `page.tsx`（Server）→ async `*Loader` → `*Client`（Client）
- Skeleton: `src/components/quiz/*-skeleton.tsx` + `data-testid` 必須
- プレイ画面のみ Phase 12 当初 Out → 現行 monolith Client が残存

## 3. 要件–資産マップ

| 要件 ID | 必要能力                    | 既存資産                         | ギャップ                                            |
| ------- | --------------------------- | -------------------------------- | --------------------------------------------------- |
| 15.22   | 本番プレイ静的フレーム SSR  | 結果画面 RSC パターン            | **Missing** — play `page.tsx` が Client             |
| 15.23   | 本番プレイ Skeleton         | DetailSkeleton パターン          | **Missing** — `PlaySkeleton` 未作成                 |
| 15.24   | クイズロード後 UI 差し替え  | `QuizPlayPageContent` ロジック   | **Partial** — ロジックは存在、Loader 分割未実施     |
| 15.25   | セッション復元・進行維持    | `usePlayState`, `useAiPlayState` | **Exists** — Client 移管時の mount タイミングに注意 |
| 15.26   | test-play 静的フレーム      | なし                             | **Missing**                                         |
| 15.27   | test-play Skeleton          | なし                             | **Missing**                                         |
| 15.28   | test-play UI 差し替え       | `TestPlayPageContent`            | **Partial**                                         |
| 15.29   | draft 欠落エラー UI         | test-play 既存 `loadError`       | **Exists** — Skeleton 非表示への組み込み要          |
| 15.30   | `quiz-play-skeleton` testid | 他 Skeleton testid 実績          | **Missing**                                         |
| 15.31   | テキストのみロード禁止      | 現行 2 画面が違反                | **Constraint** — 要置換                             |
| 15.32   | `/play` レイアウト非表示    | layout コンポーネント群          | **Exists** — 変更不要                               |

## 4. 技術的ギャップ詳細

### 4.1 本番プレイ — Server Loader 化

- `getQuiz` は Firestore Client SDK 経由だが、詳細・結果 RSC と同じく Server Component から呼び出し可能（追加 API 不要）
- 現行 Client `useEffect` 内の quick-press 難読化（`questionText: ''` + Base64 正解）を lib へ抽出する必要あり
- **注意**: `review/review-client.tsx` では quick-press の `questionText` も Base64 化しており、play 画面とは**難読化規則が異なる**。本フェーズは play / test-play の既存 play 規則を lib 化するに留める（review 統合は Out）

### 4.2 1130 行モノリス分割

- `QuizPlayPageContent` を `quiz-play-client.tsx` へ移管が主作業
- 複数プレイモード分岐（normal / exam / flashcard / lateral / question-list / list）が同一ファイルに集約 — 一括移管が安全（部分抽出は退行リスク大）
- `useSearchParams` 依存: Server `page.tsx` で `searchParams` を await して props 渡し可能（Next.js 15 App Router）。Client 内 `useSearchParams` も Suspense 境界として残す選択肢あり

### 4.3 `usePlayState` セッション復元タイミング

- 現行: `questions: quiz?.questions \|\| []` で loading 中は空配列 → ロード後に questions 確定 → セッション復元 effect 実行
- リファクタ後: Client mount 時点で `initialQuiz.questions` が揃っている → **復元タイミングが改善**される見込み
- **リスク**: `isFinished` 自動完了 effect が旧 `loading` フラグに依存（`!loading` 条件）。Loader 分割後は quiz loading 状態を削除し、effect 条件の見直しが必要

### 4.4 test-play — sessionStorage 制約

- draft はブラウザ sessionStorage のみ — Server Loader **不可**（brief / design と一致）
- 認証 (`useAuth`) + payload 読み込みは Client 必須
- 現行は `authLoading \|\| loading` でテキスト表示 — Skeleton 化 + auth 待ちも Skeleton に統一する設計判断が必要

### 4.5 静的フレームと Client ヘッダーの重複

- ロード完了後の Client UI は既に「中断する」戻るリンク + プログレスバーを内包（`styles.header`, `styles.progressSection`）
- Server 静的フレームを同構造で先行描画すると、**ロード完了時に二重表示**の可能性
- **Research Needed（design フェーズ）**: (a) 静的フレームは Skeleton 内のみに含め Server shell は最小 container のみ、(b) Client マウント後に静的フレームをアンマウント、(c) 静的フレームを Client に統合し Server は container + Suspense のみ — のいずれかを確定

### 4.6 ウミガメ（lateral）レイアウト

- 2 カラム (`styles.lateralContainer`) は quiz ロード後に Client が分岐
- 共有 `PlaySkeleton` は通常モード想定で可（design 方針）。lateral 専用 Skeleton は初版不要

### 4.7 テスト

- E2E: プレイ画面スケルトンシーケンスのテスト**未存在**（タスク 20.6 任意）
- Unit: `skeleton-components.test.tsx` に `PlaySkeleton` 追加可能（タスク 20.2 と整合）

## 5. 実装アプローチ Options

### Option A: Client のみ Skeleton 差し替え（最小 diff）

- 既存 `page.tsx` を Client のまま、`loading` 時の return を `PlaySkeleton` に変更
- test-play も同様

| Pros                  | Cons                                                              |
| --------------------- | ----------------------------------------------------------------- |
| diff 小、退行リスク低 | 要件 15.22 / 15.26（SSR 静的フレーム・Streaming）を**満たせない** |
| 即日実装可能          | Phase 12 他画面との UX 一貫性不足                                 |

**判定**: 要件未達のため非推奨

### Option B: design.md 通り Full Hybrid 分割（推奨）

- 本番: Server `page.tsx` + `QuizPlayLoader` + `QuizPlayClient`
- test-play: Server shell + `TestPlayClient`（sessionStorage）
- 共有: `PlaySkeleton`, `quick-press-obfuscate`

| Pros                              | Cons                             |
| --------------------------------- | -------------------------------- |
| 結果画面と同型、要件 22–32 を網羅 | 1130 行移管で Effort M           |
| Streaming による体感速度向上      | 静的フレーム重複の設計判断が必要 |
| quick-press 難読化の DRY 化       | E2E 更新コスト                   |

**判定**: design.md / tasks 20.x と一致。**推奨**

### Option C: 段階的 Hybrid（2 フェーズ）

- Phase 1: `PlaySkeleton` + lib 抽出 + Client 内 Skeleton 化（15.23, 15.27, 15.30, 15.31）
- Phase 2: RSC 分割（15.22, 15.26）

| Pros                        | Cons                                     |
| --------------------------- | ---------------------------------------- |
| 中間リリース可能            | 2 回の touch で play/page.tsx を二度編集 |
| Phase 1 だけでも 15.31 改善 | Phase 1 単独では Streaming 未達          |

**判定**: 急ぎで Skeleton だけ先に出す場合の代替。spec tasks は Option B 一括想定

## 6. Effort & Risk

| 項目       | 評価            | 根拠                                                                                                                   |
| ---------- | --------------- | ---------------------------------------------------------------------------------------------------------------------- |
| **Effort** | **M**（3–7 日） | 2 画面 + 新規 3–4 ファイル + 1130 行移管 + 結合検証。新規 API / Core 変更なし                                          |
| **Risk**   | **Medium**      | セッション復元・自動結果遷移・lateral AI・question-list クエリ等、退行ポイントが多い。参照パターンは codebase 内に存在 |

## 7. Design フェーズへ引き継ぐ Research Items

1. **静的フレーム vs Client ヘッダー**: 二重 UI 回避策の確定（§4.5）
2. **authLoading 中の UI**: Skeleton 継続表示 vs 認証完了まで Suspense 維持
3. **`searchParams` 渡し**: Server props vs Client `useSearchParams` の境界（question-list / lateral モード）
4. **「解答データを送信中...」**: 完了処理中テキスト（648 行付近）は 15.31 対象外か明示（プレイ中状態 vs 初回ロード）
5. **quick-press lib の Server/Client 両対応**: `btoa(unescape(encodeURIComponent))` を Node RSC でそのまま使用可能（結果画面の `getQuiz` 実績と同様）

## 8. 推奨（Design / Impl 向け）

- **Preferred**: Option B（design.md / tasks 20.1–20.5 に従う）
- **実装順序**: 20.1（lib）→ 20.2（Skeleton）→ 20.3 / 20.4 並行 → 20.5 統合検証
- **Core 変更**: 不要（`getQuiz` 既存利用）
- **Middleware 変更**: 不要（test-play は Client auth リダイレクト維持で可）
- **既存 spec 更新**: design.md / tasks.md は生成済み — gap 分析結果と矛盾なし

---

# Gap Analysis: quizetika-play-flow-ui (結果画面アコーディオン & ★投票 — Phase 14 / 2026-06-08)

## Summary

- **スコープ**: 要件 16 — 結果画面の回答・解説アコーディオン（初期 closed）、体感難易度投票の ★ クリック UI
- **分類**: Extension / Simple UI（Presentation-only）
- **Discovery 種別**: Light（既存コードベースパターン分析）

## Research Log

### R14.1 現状実装

| 領域             | 現状                                                                                               | ギャップ                                   |
| ---------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| 問題詳細         | `quiz-result-client.tsx` L967–1016: `answerSummary`・`explanationBox`・`hintHistoryBox` が常時表示 | アコーディオン化・初期 closed              |
| 難易度投票       | L775–792: `difficultyBar` + 数値 `diffCell` 1〜5                                                   | ★ クリック UI（要件 5.2a / 16.7 は未充足） |
| テストプレイ結果 | `test-play/result/page.tsx` L182–187: 解説常時表示                                                 | 本番と同型アコーディオン                   |
| 色計算           | `getDifficultyColor`（1〜5、30°ステップ）                                                          | 再利用可、変更不要                         |

### R14.2 既存アコーディオンパターン

- `ExploreAccordion`（`src/components/explore/explore-accordion.tsx`）: `button` + `aria-expanded` + chevron — **パターン参照可**
- スタイルは `explore-carousel.module.css` に結合 → 結果画面用に**別 CSS Module** で同型実装（build、explore への依存は避ける）

### R14.3 Build vs. Adopt

| 選択肢                                                                                | 判定                                                |
| ------------------------------------------------------------------------------------- | --------------------------------------------------- |
| `ExploreAccordion` 直接 import                                                        | 却下（探索専用スタイル・testId 契約が異なる）       |
| 汎用 `CollapsiblePanel` を shared に新設                                              | 却下（現時点で利用箇所は結果画面のみ — 過剰抽象化） |
| `ResultQuestionDetailsAccordion` + `DifficultyVoteStars` を `components/quiz/` に新設 | **採用**                                            |

### R14.4 統合リスク

| リスク                          | 緩和                                                         |
| ------------------------------- | ------------------------------------------------------------ |
| 既存 E2E が `diffCell` を参照   | `difficulty-vote-star-{N}` へ更新                            |
| オフライン非活性                | 既存 `online` state を `DifficultyVoteStars.disabled` に渡す |
| `handleDifficultyVote` 変更不要 | `onVote(level)` のシグネチャ維持                             |

## Design Decisions

1. **アコーディオン範囲**: 問題文・ヘッダーは常時表示。回答・解説・ヒントのみ折りたたみ（discovery 合意どおり）
2. **状態管理**: 問題ごと独立 `boolean`（親 `Record<string, boolean>` または Accordion 内 state）
3. **難易度投票**: 数値グリッド削除、`DifficultyVoteStars` に一本化。永続化は既存 `updateDoc({ difficultyVote })`

## Effort & Risk

| 項目   | 評価                                          |
| ------ | --------------------------------------------- |
| Effort | **S**（1〜2 日）                              |
| Risk   | **Low** — Core 変更なし、既存コールバック維持 |

---

# Light Discovery: Phase 16 早押し区間累計経過時間（2026-06-09）

## Summary

- **Feature**: quizetika-play-flow-ui Phase 16（要件 18）
- **Discovery Scope**: Extension（既存プレイフック・早押しストリームの挙動変更）
- **Key Findings**:
  - `usePlayState` は `setInterval` で毎秒 `elapsedSeconds` を無条件加算し、問題切替時に即 `timeLeft` をセットしている（早押しと非互換）。
  - `useQuickPressStream` は `onBodyTimingStart` のみ提供。問読み修了の親通知は未実装。
  - `QuizPlayClient` は不正解時に `formatCorrectAnswer` を `PostAnswerFeedback` へ渡している。早押し例外は未適用。
  - `.container { max-width: 900px }` 固定。問読み前は問題文空のためカードが視覚的に狭く見える。

## Research Log

### 既存タイマー実装
- **Sources**: `src/hooks/usePlayState.ts`, `src/hooks/useElapsedSeconds.ts`, `src/app/quiz/[id]/play/quiz-play-client.tsx`
- **Findings**:
  - 壁時計型 `elapsedSeconds` が `LocalAttemptSession` / `buildAttemptData` / 結果画面へそのまま流れる。
  - ウミガメモードのみ `useElapsedSeconds` を別途使用（Phase 16 対象外）。
- **Implications**: 区間累計は `usePlayState` 内で `finalizedSeconds + activeSegment` モデルへ置換。セッション復元は累計値を `finalizedSeconds` 初期値として扱う。

### 早押しストリーム完了検知
- **Sources**: `src/hooks/useQuickPressStream.ts`, `docs/detailed_design.md` §④
- **Findings**: `setIsStreaming(false)` が正常完了の唯一のフックポイント。`cancelStream`（早押しボタン）は Abort で完了扱いにしない。
- **Implications**: `onReadingComplete` を `finally` の正常パスのみで発火。問読み修了後に `beginLimitCountdown()` を Client から呼ぶ。

### フィードバックとレイアウト
- **Sources**: `src/components/quiz/post-answer-feedback.tsx`, `play.module.css`
- **Findings**: `correctAnswerDisplay` は optional。渡さなければ非表示（変更不要）。`lateralContainer` は `max-width: 1400px`  precedent。
- **Implications**: 早押しは `containerQuickPress`（1200px 前後）を新設。`PostAnswerFeedback` は呼び出し側修正のみ。

## Architecture Pattern Evaluation

| Option                              | Description                           | Strengths                         | Risks                                         | Decision |
| ----------------------------------- | ------------------------------------- | --------------------------------- | --------------------------------------------- | -------- |
| A. Client 内インライン state        | `quiz-play-client` のみで経過時間管理 | 差分小                            | `usePlayState` と二重管理、セッション保存ずれ | 不採用   |
| B. `usePlayState` + policy prop     | 親が `elapsedPolicy` を供給           | セッション一貫、Phase 15 構造維持 | hook API 拡張                                 | **採用** |
| C. 新規 `useCumulativeElapsed` hook | 完全分離                              | 責務明確                          | `usePlayState` との同期コスト                 | 不採用   |

## Design Decisions

1. **区間数学は lib 純関数** — `play-elapsed.ts` でテスト容易性を確保。hook は tick ループのみ担当。
2. **`PostAnswerFeedback` 無変更** — 要件 18.17 は呼び出し側で `correctAnswerDisplay` 省略（YAGNI）。
3. **混合クイズ** — 非早押しは `standard` policy（問題表示〜回答確定で tick）。累計表示は共通（要件 18.6）。
4. **セッション復元** — リロード時は保存済み `elapsedSeconds` を finalized として復元。進行中区間は再開時に新規 start（許容誤差）。

## Risks & Mitigations

| リスク                                   | 緩和                                                                                                         |
| ---------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| 混合クイズで累計と旧壁時計の差           | ユニットテストで standard / quick-press 各区間を検証                                                         |
| ストリーム中断後の limitTime             | `onReadingComplete` 未発火のまま。早押しボタンで `post_reading` へ手動遷移するフォールバックを Client に追加 |
| リーダーボード `elapsedSeconds` 意味変化 | 要件どおり区間累計が正しい値。Core 変更なし。リグレッションは E2E 早押しプレイで確認                         |

## Effort & Risk

| 項目   | 評価                                  |
| ------ | ------------------------------------- |
| Effort | **S**（1〜2 日）                      |
| Risk   | **Low** — 新規依存なし、Core API 不変 |

---

## Phase 19: 模擬試験・フラッシュカード LB 警告（2026-06-09）

### Summary
`QuizDetailClient` のプレイパネルに静的警告を追加。Core Phase 18 の LB ルールをユーザーへ事前告知するのみ。ロジック変更なし。

### Design Decisions
1. 共通注意ブロック1つ（モード説明への分散挿入なし）。
2. 早押し固定・ウミガメ専用 UI では警告非表示（該当モード選択 UI が無いため）。

**Document Status（Phase 19 設計）**: `design.md` Phase 19 節に反映済。

---

## Phase 20: 〇× 1タップ回答 UI（2026-06-09）

### Summary
現状 `true-false` は `ChoiceAnswerPanel`（ラジオ＋確定）で表示。専用 `TrueFalseAnswerPanel` に分離し、タップ即 `onConfirm(choiceId)`。要件 17 フィードバックは呼び出し側既存フローで統合。`explore-formats.ts` に `true-false` 追加。

### Design Decisions
1. **分離** — `ChoiceAnswerPanel` に mode 追加は却下（UI・analytics が混在）。
2. **契約維持** — `onConfirm` は既存 choiceId 文字列のまま（`saveAttempt` / `usePlayState` 変更不要）。

**Document Status（Phase 20 設計）**: `design.md` Phase 20 節に反映済。

---

## Phase 21: ホーム無限スクロール・フィルタ UI 再編（2026-06-09）

### Summary
`ExploreAccordionsPanel` をホームから除去し、カルーセルを `ExploreSearchSection` に統合（常時表示）。`useExploreQuizFeed` に cursor 状態と `loadMore` を追加。`IntersectionObserver` は新規 hook に分離。sticky は `searchBar` 行のみ（`z-index: 80`、sidebar 90 未満）。

### Design Decisions
1. **カルーセル再利用** — `GenreCarousel` / `FormatCarousel` 変更最小。
2. **scoped ページ Out** — ジャンル一覧は一括取得維持。
3. **プレイ状況** — 後段フィルタ + 表示件数不足時の自動 `loadMore`。

**Document Status（Phase 21 設計）**: `design.md` Phase 21 節に反映済。

---

## Phase 22: ホーム／検索 IA 分離（2026-06-09）

### Summary
`home-client.tsx` を `/search/search-client.tsx` へ移設。`/` は新 `HomeDiscoveryClient`（3カルーセル）。`ActiveFilterChips` を検索バー下に常時配置。`GenreCarousel` に navigate モード追加。

### Design Decisions
1. **Rename not duplicate** — `HomeClient` → `SearchClient` 移設で Phase 21 実装を最大再利用。
2. **URL sync** — `useSearchUrlState` が core lib をラップ。
3. **Sticky testid** — 検索画面では `search-search-bar-sticky` に変更（E2E 更新）。

**Document Status（Phase 22 設計）**: `design.md` Phase 22 節に反映済。

---

## Phase 26: リスト機能 UI 廃止（2026-06-10）

### Summary
- **Discovery Type**: Extension（削除）。`app/lists`・`app/list`・`components/lists`・`components/quiz-list` を削除。
- **Key Findings**:
  - ブックマークは `bookmarks-tabs.tsx` の `BookmarkTab` から `'list'` を除去するだけで2タブ化可能。
  - `quiz-play-client` / `quiz-result-client` に `list` / `question-list` 分岐が集中 — 一括削除対象。
  - リスト専用 E2E 2本 + `phase8.spec.ts` のリスト部分を更新。

### Design Decisions
1. **404** — リダイレクトではなくルート削除による既定 404。
2. **プロフィールリスト** — `profile-client.tsx` のタブ除去は play-flow が軽微実施（auth-profile スペックは別途）。

---

## Phase 37: クイズ詳細画面のプレイモード選択廃止・既プレイ限定の代替導線（2026-07-07）

### Summary
- **Discovery Type**: Extension（既存 `QuizDetailClient` の簡素化 + 条件分岐追加）。
- **Key Findings**:
  - 現状 `quiz-detail-client.tsx` はローカル state `selectedMode`（`normal`/`exam`/`flashcard`）を持つ3択UIを常時表示している。水平思考・早押し形式は既存の分岐（`isLateralThinkingQuiz` / `isQuickPressQuiz`）で単一モード表示済みのため変更不要。
  - 既プレイ判定は `usePlayedQuizIds(user?.id)` が既に提供しており（ホーム画面のプレイ状況フィルタ、詳細画面の「プレイ済み」バッジで利用中）、新規の判定ロジック・APIは不要。
  - 結果画面の「もう一度プレイする」ボタン（`quiz-result-client.tsx`）は既に `/quiz/${quiz.id}`（詳細画面）へ戻る実装のため、初回プレイ完了後に代替導線へ自然に到達できる。追加の画面遷移設計は不要。
  - E2E 3本（`e2e/learning-support.spec.ts`, `e2e/quiz-play.spec.ts`, `e2e/advanced-quiz-features.spec.ts`）が、未プレイの新規クイズに対して模擬試験・フラッシュカードの選択UIや警告を即座にクリック/検証しており、本フェーズのゲーティングで直接壊れる。事前に1周プレイを完了させてから詳細画面に戻る手順への更新が必須。
  - スタイリングは Phase 24（shadcn/ui + Tailwind 移行）により `page.module.css` ではなく `detail-classes.ts`（Tailwindユーティリティのオブジェクトマップ）で管理されている。design.md Phase 19 節の記述（`page.module.css`）は移行前の記述であり、本フェーズの実装は `detail-classes.ts` を対象とする。
  - **重要な既存実装との矛盾を発見**: 現行の `showLeaderboardWarning` 条件は `!isLateralThinkingQuiz && !isQuickPressQuiz && !hasPlayedThisQuiz`（**未プレイ時のみ**警告表示）であり、`tests/components/quiz-detail-client.test.tsx` の既存テストもこれに整合している。design.md の Phase 19 記述（`!isLateralThinkingQuiz && !isQuickPressQuiz` のみ）はこの `!hasPlayedThisQuiz` 条件が後から追加された事実を反映しておらず、ドキュメントが実装より古い状態だった。Phase 37 では警告条件を `hasPlayedThisQuiz` 反転（既プレイ時のみ表示、代替導線と同時表示）に変更するため、この既存テストの反転修正が必須タスクとなる。

### Design Decisions
1. **モード選択 state の削除** — `selectedMode` state と3択UIブロックを完全に削除し、常に `mode=normal` へ遷移する単一ボタンに統一。水平思考・早押し形式の既存分岐は変更しない。
2. **代替導線は既存コンポーネント内にインライン実装** — 新規の再利用可能コンポーネントとしては切り出さない（利用箇所がクイズ詳細画面のみのため、Simplification原則によりコンポーネント分割を見送り）。
3. **既プレイ判定の再利用** — 新規 API・フックを作らず、既存 `usePlayedQuizIds` / `hasPlayedThisQuiz` をそのまま再利用する。
4. **警告表示条件の変更** — `modeLeaderboardWarning` は既存クラスを流用し、表示条件のみ「3択UI表示時」→「代替導線表示時（既プレイ時）」に変更する。

### Risks & Mitigations
- リスク: 既存 E2E 3本が新規クイズに対して即座に模擬試験・フラッシュカードへ遷移する手順を含むため、変更後に失敗する。
  - 緩和: 各テストを「まず通常モードで1周完了 → 詳細画面へ戻る → 代替導線から模擬試験/フラッシュカードを開始」という手順に更新する。
- リスク: `usePlayedQuizIds` は未認証時に `null` を返す設計のため、ゲスト（未認証）ユーザーに代替導線を誤って表示する実装漏れの可能性。
  - 緩和: 表示条件に `user` の存在チェックを明示的に含める（要件 27.2、`hasPlayedThisQuiz` の既存定義が `Boolean(user && ...)` のため自然に担保される）。

**Document Status（Phase 37 設計）**: `design.md` Phase 37 節に反映済。

**Document Status（Phase 26 設計）**: `design.md` Phase 26 節に反映済。
