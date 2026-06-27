# Brief: quizetika-ui-quiz-lifecycle

## Problem
クイズ詳細・プレイ・結果・復習・リーダーボードは UI 最重要かつ CSS 量が最大級（`play.module.css` ~773 行）。没入型プレイ UX と回答パネル（選択肢/正誤）の視覚的フィードバックが UX の核（shadcn 標準の Button/RadioGroup/Progress で再現）。

## Current State
- `/quiz/[id]` 詳細, `/quiz/[id]/play` プレイ（シェル非表示）, `/quiz/[id]/result`, `/quiz/review`, `/leaderboard`
- 回答 UI: ChoiceAnswerPanel, TrueFalseAnswerPanel, PostAnswerFeedback
- 大規模 CSS Modules: play, result, page, review, leaderboard

## Desired Outcome
- クイズライフサイクル全画面が shadcn + Tailwind で再構築
- プレイ中の没入感、回答フィードバック、タイマー/進捗表示が機能・体感ともに維持
- `/play` パスでのシェル非表示が維持
- 結果画面のリーダーボード・アコーディオン詳細が動作

## Approach
高リスク域のため、詳細→結果→復習→プレイの順（プレイを最後）で段階移行。shadcn Button, RadioGroup, Progress, Accordion, Dialog（ReportModal）を使用。プレイ画面は視覚回帰テストを重点実施。

## Scope
- **In**: quiz detail, play, result, success, review, leaderboard, 回答パネル, report-modal, skeletons
- **Out**: クイズエディタ（→ editor）、シェル、プレイエンジン lib

## Boundary Candidates
- `src/app/quiz/[id]/*`（play/result/success 除く editor）
- `src/app/quiz/review/*`, `src/app/leaderboard/*`
- `src/components/quiz/*`（editor 関連除く）

## Out of Boundary
- quiz-editor.tsx, quiz-list-editor（→ editor）
- スコア計算・attempt 永続化 lib

## Upstream / Downstream
- **Upstream**: quizetika-ui-layout-shell, quizetika-ui-foundation
- **Downstream**: E2E play/result spec 更新

## Existing Spec Touchpoints
- **Extends**: quizetika-play-flow-ui（プレイ/結果部分）
- **Adjacent**: quizetika-core（attempt 契約）

## Constraints
- プレイ UX 退行は許容しない — E2E + 手動 QA 必須
- テストプレイ（`/quiz/test-play/*`）も同スコープ
