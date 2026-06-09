# Brief: quizeum-my-quiz-ui

## Problem
学習者は、自分が関心を持つ問題（自作・ブックマーク・リスト経由）を**横断的に**絞り込み、条件に合う問題だけをまとめてプレイしたい。現状はリストエディタの問題添付検索やブックマーク画面がソースごとに分断されており、「マイクイズ」として一括検索→フィルタ→出題数指定→プレイ開始する体験がない。

## Current State
- `useQuestionAttachSearch` / `question-attach-search.ts`: リストエディタ向けに own-published / bookmarked / public-explore の3ソース
- ブックマーク: `getBookmarkedQuizzes`, `getBookmarkedLists`, `getBookmarkedQuestions`
- プレイ: `question-list-session.ts` + `mode=question-list` は**保存済み問題リスト**向け。アドホックな問題集合のセッション生成は未整備
- ナビにマイクイズ項目なし

## Desired Outcome
- ログインユーザーが Sidebar から「マイクイズ」(`/my-quiz`) を開ける
- 次の4ソースから問題プールを統合できる:
  1. 自分が作成したクイズに含まれる問題
  2. ブックマークしたクイズに含まれる問題
  3. ブックマークしたリスト内のクイズに含まれる問題
  4. ブックマークした問題
- キーワード・ジャンル・タグ・出題形式・難易度等でフィルタできる
- 出題数（例: 10 / 20 / 全件 / カスタム）とシャッフル有無を指定できる
- 「クイズを始める」で既存プレイエンジンに遷移し、連続出題できる

## Approach
Core に問題プール合成 lib（`buildMyQuizQuestionPool` 仮）を新設し、既存 `question-attach-search` とブックマーク/リスト取得を組み合わせる。フィルタ UI は検索画面 (`ExploreSearchSection`) のフィルタチップパターンを簡略化して再利用。プレイ開始時は `my-quiz-session`（`question-list-session` と同型の `entries[]`）を `sessionStorage` に書き、先頭問題の `quiz/[parentQuizId]/play?mode=question-list&...` または専用 `mode=my-quiz` で起動。既存 `quiz-play-client` の question-list 分岐を拡張してアドホックセッションを読む。

## Scope
- **In**: `/my-quiz` ページ、4ソースチェックボックス/タブ、統合検索、フィルタパネル、出題数・シャッフル、プレビュー件数表示、プレイ開始、セッション lib、E2E
- **Out**: フィルタプリセットの保存、URL 共有、復習モードとの統合、AI 生成問題

## Boundary Candidates
- 問題プール合成（Core lib）
- フィルタ UI とプレイ設定 UI（本スペック）
- プレイエンジン連携（`quizeum-play-flow-ui` の `quiz-play-client` 最小拡張は design で境界明記）

## Out of Boundary
- リスト探索（`quizeum-lists-discovery-ui`）
- クイズ新規作成・編集
- 弱点克服復習 (`/quiz/review`)

## Upstream / Downstream
- **Upstream**: `quizeum-core`（プール合成・セッション）、`bookmark.ts`, `quiz-list.ts`, `author-quiz-search.ts`, `useAuth`
- **Downstream**: プレイ結果・attempt 記録（既存 attempt フロー）

## Existing Spec Touchpoints
- **Extends**: なし（新規スペック）。`quiz-play-client` の question-list モードは**最小限の読み取り拡張**のみ（tasks で play-flow タスクに分離するか design で決定）
- **Adjacent**: `quizeum-play-flow-ui`, `quizeum-creator-dash-ui`（attach search 重複回避）

## Constraints
- ログイン必須。未ログインは `/login` へ
- ブックマーク経由の問題は親クイズが `published` のもののみ
- 出題数はフィルタ後プール上限を超えない
- ウミガメのスープ等、マイクイズ対象外の出題形式はフィルタで除外可能にする（design で確定）
- Vanilla CSS、日本語 UI
