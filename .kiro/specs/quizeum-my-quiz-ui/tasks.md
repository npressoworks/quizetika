# Implementation Plan: quizeum-my-quiz-ui

> **前提**: `quizeum-core` が `buildMyQuizQuestionPool`、`my-quiz-session.ts`、`saveAttempt` の `mode: 'my-quiz'` を提供済みであること。未完了の場合は core タスクを先に実装する。

## Tasks

### 1. マイクイズページのルーティングと認証ガード

- [x] 1.1 `/my-quiz` RSC シェルとクライアントページ骨格の実装 (P)
  - `src/app/my-quiz/page.tsx` にメタデータ（title: マイクイズ）と Suspense 境界を配置する。
  - `my-quiz-client.tsx` にページ見出し・説明文・`data-testid="my-quiz-page"` を実装する。
  - 完了時、認証済みユーザーが `/my-quiz` を開くと静的フレームが即時表示されること。
  - _Requirements: 1.1, 1.4, 1.5, 7.2_
  - _Boundary: MyQuizPage_

- [x] 1.2 未ログインリダイレクトとローディング状態の実装
  - `useAuth` により未認証時 `/login?redirect=%2Fmy-quiz` へ `router.replace` する。
  - 認証判定中は `data-testid="my-quiz-skeleton"` 付きスケルトンを表示する。
  - 完了時、未ログイン直接アクセスがログイン画面へ誘導されること。
  - _Requirements: 1.2, 1.3, 7.1_
  - _Boundary: MyQuizPage_

### 2. 4ソース問題プール取得

- [x] 2.1 4ソーストグル UI の実装 (P)
  - `my-quiz-source-panel.tsx` に自作／ブックマーククイズ／ブックマークリスト／ブックマーク問題の4チェックボックスを配置する（初期値: すべてオン）。
  - 各トグルに design 指定の `data-testid` を付与する。
  - 完了時、4ソースすべてが個別にオン／オフ可能であること。
  - _Requirements: 2.1, 2.7_
  - _Boundary: MyQuizSourcePanel_

- [x] 2.2 `useMyQuizPool` フックと core プール取得の接続
  - `useMyQuizPool.ts` を新設し、ソースフラグ変更時に `buildMyQuizQuestionPool(userId, flags)` を呼び出す。
  - loading / error / refetch を公開する。dedupe は core 返却を信頼する。
  - 有効ソース0件時は空プール + 案内文案を返す。
  - 完了時、ソーストグル変更でプール件数が更新されること。
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Depends: quizeum-core（buildMyQuizQuestionPool）_
  - _Boundary: useMyQuizPool_

### 3. フィルタ UI とクライアント側絞り込み

- [x] 3.1 `my-quiz-filter.ts` 純関数の実装 (P)
  - キーワード（`filterQuestionCandidatesByKeyword` 再利用）、ジャンル、タグ AND、出題形式、難易度レンジの AND 合成を実装する。
  - `tests/lib/my-quiz-filter.test.ts` で主要組み合わせを検証する。
  - 完了時、フィルタ条件変更がユニットテストで期待どおり件数を返すこと。
  - _Requirements: 3.1, 3.7, 3.8_
  - _Boundary: my-quiz-filter_

- [x] 3.2 フィルタパネル UI の実装
  - `my-quiz-filters.tsx` にキーワード入力（300ms デバウンス）、ジャンル選択、`UnifiedSearchField` によるタグチップ、形式選択、難易度レンジを配置する。
  - `data-testid="my-quiz-filters"` を付与する。
  - 完了時、フィルタ変更で `useMyQuizPool` の `filteredCount` が更新されること。
  - _Requirements: 3.2, 3.3, 3.4, 3.5, 3.6, 3.9, 3.12_
  - _Depends: 3.1_
  - _Boundary: MyQuizFilters_

- [x] 3.3 アクティブフィルタチップと一括クリアの実装 (P)
  - `ActiveFilterChips` パターンを `MyQuizFilterState` 向けアダプタで再利用し、`data-testid="my-quiz-active-filters"` を付与する。
  - 一括クリアでキーワード・ジャンル・タグ・形式・難易度のみリセットする。
  - 完了時、チップ個別解除と一括クリアがプレビュー件数に反映されること。
  - _Requirements: 3.10, 3.11_
  - _Depends: 3.2_
  - _Boundary: MyQuizFilters_

### 4. 出題数・シャッフル設定

- [x] 4.1 出題設定 UI と effectivePlayCount の実装
  - `my-quiz-play-settings.tsx` に 10 / 20 / 全件 / カスタム入力とシャッフルトグル（default: on）を実装する。
  - `useMyQuizPool` に `resolveEffectivePlayCount`（clamp）と `buildFinalEntries`（shuffle / stable sort + slice）を追加する。
  - `data-testid="my-quiz-play-settings"`、`my-quiz-question-count-preview` を付与する。
  - 完了時、プール件数 < 指定出題数のとき自動調整メッセージが表示されること。
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.7, 4.8, 5.1_
  - _Depends: 2.2, 3.1_
  - _Boundary: MyQuizPlaySettings, useMyQuizPool_

### 5. プレビューとプレイ開始

- [x] 5.1 プレビューバーと空状態の実装 (P)
  - `my-quiz-preview-bar.tsx` に「対象 N 問 / 出題 M 問」表示と空状態案内を実装する。
  - フィルタ後0件またはソース未選択時は開始ボタンを disabled にする。
  - 完了時、件数プレビューがフィルタ・出題設定と同期すること。
  - _Requirements: 5.1, 5.2, 4.3_
  - _Depends: 4.1_
  - _Boundary: MyQuizPreviewBar_

- [x] 5.2 セッション初期化とプレイ画面遷移の実装
  - 「クイズを始める」押下で `sessionId = crypto.randomUUID()`、`initMyQuizSession(sessionId, entries)`、`buildMyQuizPlayUrl` により先頭問題へ遷移する。
  - `data-testid="my-quiz-start-play"` と `data-analytics="my-quiz-start-play"` を付与する。
  - 完了時、遷移 URL に `mode=my-quiz` と `sessionId` が含まれること。
  - _Requirements: 5.3, 5.4, 5.5, 5.6, 7.4_
  - _Depends: quizeum-core（my-quiz-session）, 4.1, 5.1_
  - _Boundary: MyQuizPreviewBar, useMyQuizPool_

### 6. プレイエンジン連携（quiz-play-client）

- [x] 6.1 `mode=my-quiz` プレイ分岐の実装
  - `quiz-play-client.tsx` に `myQuizMode` 分岐を追加し、`readMyQuizSession` + `sessionId` クエリ一致時に1問のみ `playQuestions` へ載せる。
  - `syncMyQuizSessionIndex` を `qIndex` 変更時に呼び出す（`question-list` と同型）。
  - `buildAttemptData` で `mode: 'my-quiz'`、`totalQuestions: 1`、`sessionId` を設定する。
  - セッション欠落時はエラー UI + `/my-quiz` リンクを表示する。
  - 完了時、マイクイズ URL で1問プレイが開始され、通常モード即時フィードバックが適用されないこと。
  - _Requirements: 6.1, 6.4, 6.5, 6.6, 6.7_
  - _Depends: quizeum-core（my-quiz-session, saveAttempt）, 5.2_
  - _Boundary: my-quiz-ui minimal extension; play-flow coordination（quiz-play-client）_

### 7. プレイエンジン連携（quiz-result-client）

- [x] 7.1 マイクイズ次問題遷移と完了導線の実装
  - `quiz-result-client.tsx` に `attemptMode === 'my-quiz'` 分岐を追加する。
  - 次問題あり: `peekNextMyQuizEntry` → `buildMyQuizPlayUrl`（`data-testid="my-quiz-next"`）。
  - 最終問: 「マイクイズを完了しました」+ `/my-quiz` 戻りリンク。`clearMyQuizSession` は完了時のみ。
  - 完了時、2問以上のセッションで1問目完了後に2問目プレイ URL へ遷移できること。
  - _Requirements: 6.2, 6.3_
  - _Depends: 6.1_
  - _Boundary: my-quiz-ui minimal extension; play-flow coordination（quiz-result-client）_

### 8. ページ統合とスタイル

- [x] 8.1 マイクイズ画面のコンポーネント統合と CSS Modules
  - `my-quiz-client.tsx` に SourcePanel / Filters / PlaySettings / PreviewBar を縦積みレイアウトで合成する。
  - `my-quiz.module.css` で Vanilla CSS トークン（`var(--*)`）を用い、モバイル幅でもフィルタが操作可能にする。
  - 完了時、認証済みユーザーが一画面でソース→フィルタ→出題→開始まで操作できること。
  - _Requirements: 1.1, 3.9, 7.2_
  - _Depends: 2.1, 3.2, 4.1, 5.1_
  - _Boundary: MyQuizPage_

### 9. E2E テスト

- [x] 9.1 マイクイズスモーク E2E の実装
  - `e2e/my-quiz.spec.ts` にログイン → `/my-quiz` 表示 → 開始ボタン → `mode=my-quiz` URL 確認 → 1問解答（または結果表示）までのテストを追加する。
  - シードデータでプール0件の場合は `test.skip` 条件を設ける。
  - 完了時、`npm run test:e2e -- my-quiz` が pass または skip されること。
  - _Requirements: 7.3, 7.4, 7.5_
  - _Depends: 8.1, 6.1, 7.1_
  - _Boundary: E2E-my-quiz_

- [ ] 9.2* フィルタ操作 E2E の追加（任意）
  - キーワード入力またはソース1件オフでプレビュー件数が変化することを検証する。
  - _Requirements: 3.9, 5.1_
  - _Depends: 9.1_
  - _Boundary: E2E-my-quiz_

---

## 要件カバレッジサマリ

| 要件 | タスク |
|------|--------|
| 1 | 1.1, 1.2, 8.1 |
| 2 | 2.1, 2.2 |
| 3 | 3.1, 3.2, 3.3 |
| 4 | 4.1 |
| 5 | 4.1, 5.1, 5.2 |
| 6 | 6.1, 7.1 |
| 7 | 1.1, 1.2, 8.1, 9.1, 9.2* |

## 並列実行可能タスク `(P)`

- 1.1 / 3.1 / 2.1 — core 完了後、ページ骨格・フィルタ lib・ソース UI を並列可能
- 5.1 / 3.3 — 4.1 完了後

## 外部ブロッカー

| 依存 | 内容 |
|------|------|
| `quizeum-core` | `buildMyQuizQuestionPool`, `my-quiz-session.ts`, `Attempt.mode: 'my-quiz'` |
| `quizeum-sidebar-layout` | Sidebar「マイクイズ」導線（本スペック外、E2E は直接 URL アクセス可） |

---

### 10. Phase 26: ブックマークリストソースの除去（2026-06-10）

- [x] 10.1 ソースパネルの3トグル化
  - 「ブックマークリスト」ラベル・トグル・`my-quiz-source-bookmarked-list` を除去する
  - 自作・ブックマーククイズ・ブックマーク問題の3トグルに `data-testid` を維持する
  - **完了状態**: ソースパネルに3 `data-testid` のみ存在し、リスト関連 UI が表示されないこと
  - _Requirements: 2.1, 2.7, 2.8, 8.1_
  - _Depends: quizeum-core 23.4_
  - _Boundary: my-quiz-source-panel_

- [x] 10.2 問題プール取得フックのフラグ縮小
  - プール再取得時にブックマークリスト由来フラグを送信しない
  - ソース型を core の3フラグ契約と1:1対応させる
  - **完了状態**: `useMyQuizPool` が `bookmarkedLists` を参照せず、3フラグのみで API を呼ぶこと
  - _Requirements: 2.2, 8.2, 8.3, 8.5_
  - _Depends: 10.1_
  - _Boundary: useMyQuizPool_

- [x] 10.3 フィルタ表・画面文言のリスト参照除去
  - フィルタ結果テーブルから `bookmarked-list` 取得元ラベルを除去する
  - ページ説明文の「4ソース」表記を「3ソース」に更新する
  - リスト取得 API の import をコードベースから除去する
  - **完了状態**: マイクイズ画面にリスト由来ラベル・文言・import が残らないこと
  - _Requirements: 8.4, 8.5_
  - _Depends: 10.2_
  - _Boundary: my-quiz-filtered-table, MyQuizPage_

- [x] 10.4 (P) Phase 26 コンポーネント・フック・E2E テストの更新
  - ソースパネル3トグル、`useMyQuizPool` フラグ、E2E から `bookmarked-list` シナリオを除去する
  - **完了状態**: `tests/components/my-quiz/*` および `e2e/my-quiz.spec.ts` が3ソース前提でグリーンであること
  - _Requirements: 2.7, 8.8_
  - _Depends: 10.3_
  - _Boundary: Testing_

- [x] 10.5 Phase 26 統合検証
  - 3ソースでプール取得→フィルタ→`mode=my-quiz` プレイ開始までの一連フローが維持されることを確認する
  - **完了状態**: マイクイズ関連ビルド・テストがグリーンであること
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8_
  - _Depends: 10.4_
  - _Boundary: Integration_

## Implementation Notes (Phase 26)

- **前提**: `quizeum-core` 23.4 完了後に着手。プレイ連携（`mode=my-quiz`）は変更なし。
- 実装順: 10.1 → 10.2 → 10.3 → 10.4 → 10.5。10.1 は core 23.4 完了後に play-flow と並行可能。
