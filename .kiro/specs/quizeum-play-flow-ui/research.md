# Research & Design Decisions: quizeum-play-flow-ui

## Summary
- **Feature**: quizeum-play-flow-ui（Phase 5 差分: クイズ単位リーダーボードUI）
- **Discovery Scope**: Extension（`quizeum-core` 実装済み、UI仕上げ）
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

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| 縦並び2表（現状） | 初回・リプレイを連続表示 | 実装済み | モバイルで縦長、タブ要件の弱い充足 | 採用しない |
| タブ切替 | 1系統ずつ表示 | コンパクト、/leaderboard と一貫 | タブ操作がE2Eで1ステップ増 | **採用** |
| ページ内インライン | page.tsx に表ロジック | 差分小 | 保守性・9.8境界が悪化 | 採用しない |

## Design Decisions

### Decision: 読み取りは `getLeaderboard*` + slice のみ
- **Context**: 要件9.8（更新・並び替えロジック禁止）。
- **Alternatives Considered**:
  1. ページ内 `compareLeaderboardRecords` で防御的ソート
  2. サーバー保存順を信頼し slice(0,5) のみ
- **Selected Approach**: 2 — `quizeum-core` が書き込み時に順位付け済み。
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
- `.kiro/specs/quizeum-core/design.md` — LB永続化・`LeaderboardRecord`
- `docs/detailed_design.md` — 画面F-801/F-802（表示側）
- `src/types/index.ts` — `LeaderboardRecord`

---

# Gap Analysis: quizeum-play-flow-ui（Phase 6 差分 — 2026-06-03）

## Analysis Summary

- **スコープ**: 要件 1–9 はおおむね実装済み。Phase 6（要件 10）が未着手で、ホーム・ジャンル／タグ一覧・復習のジャンル周りが `docs/` / コア API と乖離している。
- **上流依存**: `quizeum-core` の `listActiveGenres` / C2 `getQuizzesByGenre` / `getQuizzesByTag` / `searchQuizzes` は **実装済み** — UI 接続のみで足りる。
- **最大ギャップ**: ハードコード `GENRES` / `REVIEW_GENRES`、ホームのクライアント側のみ絞り込み、`searchQuizzes` 未使用、探索ページのソートタブ欠如。
- **副次ギャップ**: 要件 1.3 の「プレイ状況」フィルタ UI はあるが `filteredQuizzes` に未接続（スタブ状態）。
- **推奨**: **Option C（ハイブリッド）** — `useActiveGenres` + `GenreNav` 新設、既存 `page.tsx` / 探索ページを段階的に差し替え。共有 `ExploreSortTabs` の抽出は任意。

## 1. Current State Investigation

### 既存アセット（再利用可能）

| 領域 | 現状 | パターン |
|------|------|----------|
| コア API | `src/services/quiz.ts` に `listActiveGenres`, `getQuizzesByGenre(_,_,sort)`, `getQuizzesByTag(_,_,sort)`, `searchQuizzes` | クライアントから直接 import（既存と同型） |
| ホーム | `src/app/page.tsx` — タブ・複合フィルタ UI・`GENRES` 定数 | CSS Modules、`useMemo` クライアントフィルタ |
| ジャンル一覧 | `src/app/genres/[genreName]/page.tsx` — `getQuizzesByGenre(id, 20)` のみ | 新着固定、ヘッダーは URL 生文字列 |
| タグ一覧 | `src/app/tags/[tagName]/page.tsx` — `getQuizzesByTag` のみ | ソート UI なし |
| 復習 | `src/app/quiz/review/page.tsx` — `REVIEW_GENRES` 定数 | `getFailedQuestions` はコア側でマージ展開済み |
| Phase 5 LB | `QuizDualLeaderboard` + 単体テスト | 読み取り専用コンポーネント分離済み |
| プレイ系 | `usePlayState`, `useAiPlayState`, play/result 各ページ | 要件 3–5 は充足 |

### 命名・レイヤー

- 探索ページは `src/app/page.module.css` をジャンル／タグで共有。
- 新規は `src/hooks/useActiveGenres.ts`、`src/components/explore/genre-nav.tsx` が設計案（未作成）。
- E2E は `e2e/additional-features.spec.ts` がホームの **「コンピュータ・IT」** ボタン名に依存 → Phase 6 で更新必須。

## 2. Requirement-to-Asset Map

| 要件 | 状態 | ギャップ / 備考 |
|------|------|----------------|
| **1.1** ホームタブ | ✅ 充足 | `getLatestQuizzes` 等 |
| **1.2** ジャンルナビ | ⚠️ 部分 | `GENRES` ハードコード。`iconImageUrl` 未使用 |
| **1.3** 複合検索 | ⚠️ 部分 | UI あり。`searchQuizzes` 未使用。`playStatus` 未配線。ジャンルは `quiz.genre` のみ（canonical 未考慮） |
| **1.4** ゲスト BM | ✅ 充足 | `/login` リダイレクト |
| **2–8** | ✅ おおむね充足 | プレイ・結果・編集ガード・探索他画面は実装済み（別タスク検証済み） |
| **9** 二系統 LB | ✅ 充足 | `QuizDualLeaderboard` |
| **10.1** `listActiveGenres` ナビ | ❌ 欠落 | 未呼び出し |
| **10.2** ハードコード禁止 | ❌ 欠落 | `GENRES` / `REVIEW_GENRES` が正本 |
| **10.3** `/genres/[id]` 遷移 | ❌ 欠落 | 現状はホーム内 `selectedGenre` フィルタのみ（`docs/screen_transition.md` は遷移を期待） |
| **10.4** `searchQuizzes` | ❌ 欠落 | クライアント `useMemo` フィルタのみ |
| **10.5** ジャンル一覧メタ | ❌ 欠落 | `displayName` / `iconImageUrl` 未表示 |
| **10.6** ジャンル一覧ソート | ❌ 欠落 | `sort` 引数未使用、タブなし（コアは対応済み） |
| **10.7** タグ一覧ソート | ❌ 欠落 | 同上 |
| **10.8** 復習ジャンルマスタ | ❌ 欠落 | `REVIEW_GENRES` 固定（API フィルタはコアでマージ対応済み） |
| **10.9** 空ジャンル | ❌ 欠落 | 0 件時の UI なし |
| **10.10** エラー時フォールバック禁止 | ⚠️ 暗黙違反リスク | マスタ未取得時も `GENRES` が常に表示される |

## 3. Implementation Approach Options

### Option A: 既存ページへの直接拡張

- `page.tsx` 内で `listActiveGenres` を `useEffect` 取得し、`GENRES` を state 置換。
- ジャンル／タグ `page.tsx` にソート state を追加。

| 長所 | 短所 |
|------|------|
| ファイル数が少ない | ホームが肥大化し続ける |
| 短期で動く | `GenreNav` / エラー状態の再利用が難しい |

**Effort**: S–M | **Risk**: Low

### Option B: 新コンポーネント中心（設計どおり）

- `useActiveGenres` + `GenreNav` + 共有 `ExploreSortTabs`（任意）。
- ホーム・ジャンル・タグ・復習は薄いページラッパーに留める。

| 長所 | 短所 |
|------|------|
| 境界明確、テストしやすい | 新規ファイル 3–4 |
| E2E の `data-testid` を固定しやすい | 初回の配線コスト |

**Effort**: M | **Risk**: Low–Medium（E2E 更新）

### Option C: ハイブリッド（推奨）

- **新規**: `useActiveGenres`, `GenreNav`（10.1）。
- **拡張**: `page.tsx`（10.2–10.4）、`genres/[genreName]`（10.5–10.6）、`tags/[tagName]`（10.7）、`review`（10.8）。
- **共有**: ホームのタブバーと同型のソート UI を探索ページにコピーまたは小コンポーネント化。

| 長所 | 短所 |
|------|------|
| 設計・tasks.md と一致 | ホームの「フィルタ vs 遷移」UX要決定 |
| コア API をそのまま利用 | `playStatus` は別途 Attempt 連携が必要（1.3） |

**Effort**: **M（3–7 日）** | **Risk**: **Low**（コア完了前提）

## 4. Research Needed（設計フェーズへ引き継ぎ）

| 項目 | 状態 |
|------|------|
| ジャンルナビのクリック挙動 | **確定**: アイコンは常に `/genres/[id]` 遷移。ホーム絞り込みは `GenreSearchField` のみ |
| ホーム検索トリガー | **確定**: フィルタ変更 + デバウンス（例 300ms）→ `searchQuizzes` |
| `playStatus` | **確定**: 要件 1.3 完遂。`listUserPlayedQuizIds` + API、結果の後段フィルタ。未認証は無効化 |
| アイコン表示 | 実装時決定（`next/image` またはフォールバック） |
| Firestore シード | 実装時決定 |
| E2E | `data-testid` 化・遷移アサーションへ更新 |

## 5. Upstream / Downstream

| 依存 | 状態 |
|------|------|
| `quizeum-core` Phase 6 | ✅ API 利用可能（要: Rules/Indexes 本番デプロイは運用） |
| `quizeum-creator-dash-ui` | 未確認 — エディタの動的セレクトは別スペック（ジャンル表示の一貫性は E2E で横断確認推奨） |
| `quizeum-auth-profile-ui` | プロフィールのフォロージャンル UI は別（`followedGenres` は表示名文字列のままの可能性） |

## 6. Effort & Risk Summary

| フェーズ | Effort | Risk | 根拠 |
|---------|--------|------|------|
| Phase 6 UI（10.1–10.6） | M | Low | 既存サービス・ページパターンの延長 |
| E2E 更新（10.6–10.7） | S | Medium | ハードコードラベル依存の除去 |
| 要件 1.3 playStatus | S–M | Medium | コア未対応なら UI のみでは不可 |

## 7. Design Phase Recommendations

1. **採用**: Option C（`tasks.md` セクション 10 と整合）。
2. **優先順**: 10.1 → 10.3（ジャンルページ）→ 10.2（searchQuizzes）→ 10.5（復習）→ 10.4（タグ）→ 10.6（検証）。
3. **設計で固定すること**: ジャンルクリック = `/genres/[id]` 遷移（フィルタ専用ボタン「すべて」はホーム残留）。
4. **テスト**: `useActiveGenres` モック単体 + `GenreNav` RTL + E2E の `data-testid="genre-nav-item-{id}"` 追加。
5. **設計更新**: 既存 `design.md` Phase 6 は概ね妥当。`ExploreSortTabs` の要否だけ実装時に決定。

## Document Status

- 分析手法: コードベース Grep/Read + 要件 10 トレース + `quizeum-core` API 存在確認
- 出力先: 本ファイル（`research.md`）に追記
- 外部 Web 調査: 不要（社内スタック確定済み）

---

# Phase 8 Gap Analysis（要件 11・2026-06-05）

## Summary

`quizeum-core` Phase 8 は実装済み（`getBookmarkFeed`, `getQuestionsInList`, `toggleBookmark` 設問対応, `saveAttempt` の `question-list` モード）。`quizeum-play-flow-ui` は `/bookmarks` がクイズのみ、`list/[id]` がクイズリスト専用、プレイ／結果に設問 BM なし、設問リスト連続プレイ未配線。本フェーズは **Extension（軽量 discovery）** で既存ページ拡張 + 小コンポーネント抽出が最適。

## 1. Current State vs Requirements 11

| 要件 | 現状 | ギャップ |
|------|------|----------|
| **11.1** 3タブ | 単一クイズ一覧 | `getBookmarkFeed` + タブ UI 未実装 |
| **11.2** 未認証リダイレクト | 実装済 | 維持 |
| **11.3** クイズタブ | `getBookmarkedQuizzes` で実装済 | `BookmarkFeed.quizzes` へ移行 |
| **11.4** リストタブ | なし | 新規グリッド |
| **11.5** 設問タブ | なし | `BookmarkedQuestionEntry` + 日時降順 |
| **11.6** 設問カード→プレイ | なし | `startAtQuestionId` 導線 |
| **11.7–11.9** プレイ/結果 BM・未認証 | なし | `QuestionBookmarkToggle` 新規 |
| **11.10–11.12** 設問リストプレイ | `mode=list`（クイズ連続）のみ | `question-list` セッション + 次設問遷移 |
| **11.13** クイズリスト維持 | 実装済 | 設問分岐と混在させない |
| **11.14** コア永続化なし | 準拠 | UI はサービス呼び出しのみ |

## 2. Core API 確認（利用可能）

| API | 所在 | UI からの参照 |
|-----|------|---------------|
| `getBookmarkFeed` | `bookmark.ts` | ❌ |
| `toggleBookmark(..., 'question')` | `bookmark.ts` | ❌ |
| `getQuestionsInList` | `quiz-list.ts` | ❌ |
| `resolveListType` | `types/index.ts` | ❌ |
| `saveAttempt` + `mode: 'question-list'` | `attempt.ts` | ❌（play は `list` のみ） |

## 3. Design Synthesis（Phase 8）

### Generalization
- **ブックマーク解除**は3タブ共通で `toggleBookmark` + 楽観的配列除去。`useBookmarkFeed.removeBookmark` に集約。
- **リスト連続プレイ**はクイズリスト（`quizIds` + `mode=list`）と設問リスト（`question-list-session` + `mode=question-list`）でセッション形状が異なるが、結果画面の「次へ」パターンは共通化可能（先に `listType` / セッション種別を判定）。

### Build vs. Adopt
- **採用**: コア `getBookmarkFeed` 一括取得（3タブで再フェッチ不要）。`sessionStorage` で設問リスト進行（既存 `usePlayState` の `localStorage` キーと衝突しない別キー）。
- **新規**: `question-list-session.ts` のみ。外部ライブラリ不要。

### Simplification
- `BookmarksPage` を肥大化させず `components/bookmark/*` に分割。E2E 用 `data-testid` はタブバーに集中。
- 設問単体プレイ（11.12）は専用ルートを作らず `startAtQuestionId` クエリで既存プレイ画面を拡張。

## 4. Architecture Pattern Evaluation

| Option | 説明 | 判定 |
|--------|------|------|
| A | 各ページに直書き | 却下（bookmarks/play/result が肥大化） |
| B | フック + 小コンポーネント（推奨） | **採用** — 設計・tasks 境界が明確 |
| C | 専用 `/question-list/play` ルート | 却下 — コア契約は親 `quizId` ベースの attempt |

## 5. Risks & Mitigations

| リスク | 緩和 |
|--------|------|
| クイズリストと設問リストの結果画面分岐競合 | `question-list-session` 存在を先に評価 |
| 親クイズ跨ぎで `usePlayState` が全問ロード | `questionId` で1問にフィルタ |
| 設問 BM 初期状態の N+1 | プレイ画面は quiz ロード時に user's bookmarked questionIds を1回取得（または feed キャッシュ） |

## 6. Upstream / Downstream

| 依存 | 状態 |
|------|------|
| `quizeum-core` Phase 8 | ✅ 実装・テスト済 |
| `quizeum-creator-dash-ui` | 設問リスト作成 UI は別スペック（プレイ導線のみ本スペック） |
| `quizeum-auth-profile-ui` | プロフィール BM 表示は別（任意連携） |

## Document Status（Phase 8）

- 分析: Grep/Read（`bookmarks/page.tsx`, `list/[id]/page.tsx`, `play/page.tsx`, `result/page.tsx`, `bookmark.ts`）
- Discovery 種別: **Light（Extension）**
- 外部調査: 不要
