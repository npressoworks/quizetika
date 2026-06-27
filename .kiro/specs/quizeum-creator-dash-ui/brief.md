# Brief: quizetika-creator-dash-ui

## Problem
クリエイターがクイズやクイズリストを作成・編集し、投稿したクイズのアナリティクス分析やプレイヤーからの間違い指摘フィードバックを確認・処理する、高品質なクリエイターUIが必要です。

## Current State
クイズエディタ・作家ダッシュボード・リスト編集 UI は実装済み。Phase 6 では `QuizEditor` のジャンル `<select>` がハードコード 6 件のまま（`listActiveGenres` 未接続）。`quizetika-core` Phase 6 完了後、play-flow と同様にマスタ駆動セレクトへ差し替える。

## Phase 6 UX（2026-06）
- ジャンル選択肢は `listActiveGenres` の `displayName` / `id` のみ（ハードコード option 廃止）。
- 「新しいジャンルを申請する」リンク（`/community/genres`）は維持。
- 申請・投票画面から戻ったとき、フォーカス復帰時にジャンル一覧を再取得（承認反映）。
- 取得失敗時はエラー／再試行表示（サイレントに旧固定一覧へフォールバックしない）。

## Desired Outcome
直感的で使いやすいクイズ・問題エディタ（動的な追加削除、自動名寄せサジェスト警告、公開時Zodバリデーション警告など）を提供し、作家ダッシュボードで円グラフ等のアナリティクスや指摘管理を快適に行え、クイズリストのドラッグ＆ドロップ編集やJSONパッケージエクスポートを行えること。

## Approach
Next.js App Routerでのクリエイター専用のディレクトリ構造を用意し、ドラッグ＆ドロップライブラリ等を用いた直感的な並び替えUIを実装。Zodスキーマを用いたフロントエンド公開時バリデーションとエラーインライン表示を統合します。

## Scope
- **In**:
  - クイズ作成・編集画面 (`/quiz/create`, `/quiz/[id]/edit`): 動的問題追加削除、問題タイプトグル（選択式 / 短答式）、難易度スライダー、ジャンルセレクトボックス、タグ自動名寄せ類似サジェストインライン警告UI（最大5個）、公開時Zod厳格バリデーションエラーリスト表示、下書き保存機能。
  - 作家ダッシュボード (`/creator/dashboard`): 累計プレイ数、評価平均、ブックマーク数のグラフ表示。各クイズの問題別正解率・解答割合のビジュアルグラフ表示。クローズド指摘（誤植・事実誤認等）リストと修正動線。クイズ一括JSONエクスポート。
  - クイズリスト詳細画面 (`/list/[id]`): リスト情報、収録クイズ一覧カード、リストプレイ開始動線（統計用の listId トラッキング）。
  - リスト作成・編集画面 (`/list/create`, `/list/[id]/edit`): リスト情報入力、クイズ検索・アタッチ、ドラッグ＆ドロップによる並び替え、リストパッケージJSONエクスポート。
- **Out**:
  - クイズのインポート機能（廃止されたため対象外）。

## Boundary Candidates
- `src/app/quiz/create/page.tsx`
- `src/app/quiz/[id]/edit/page.tsx`
- `src/app/creator/dashboard/page.tsx`
- `src/app/list/[id]/page.tsx`
- `src/app/list/create/page.tsx`
- `src/app/list/[id]/edit/page.tsx`

## Out of Boundary
- モデレータや管理者専用のモデレーション画面（別スペック）。

## Upstream / Downstream
- **Upstream**: `quizetika-play-flow-ui`, `quizetika-core`
- **Downstream**: `quizetika-moderation-governance-ui`

## Existing Spec Touchpoints
- **Extends**: `quizetika-core` の `QuizService`, `QuizListService` および関連データモデル。
- **Adjacent**: `quizetika-play-flow-ui` (クイズ詳細からの作家ダッシュボード遷移など)

## Constraints
- **Validation**: 「公開」申請時はZodを用いてフロントエンド側で厳格に検証し、問題や正解設定の不整合を視覚的にフィードバックする。
- **Import UI**: インポート機能は廃止されたため、インポートに関連するUIは一切作成しない。
