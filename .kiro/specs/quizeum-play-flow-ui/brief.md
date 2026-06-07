# Brief: quizeum-play-flow-ui — Phase 12 追補（プレイ画面 Suspense）

## Problem
プレイヤーが `/quiz/[id]/play` や `/quiz/test-play/play` に遷移した際、画面全体が「プレイ環境を準備中...」テキストのみの白紙状態になり、詳細・結果画面で実現済みの即時レイアウト表示と体験が乖離している。

## Current State
- 本番プレイ: 全面 `'use client'`、`getQuiz` を useEffect で取得、ロード中は中央テキストのみ
- test-play: 同様に Client のみ、`loadTestPlayPayload`（sessionStorage）を useEffect で読み込み
- Phase 12 では意図的に Out とされ、タスク 19.x は詳細・結果・探索等のみ完了

## Desired Outcome
- 両プレイ URL で静的フレーム（戻る、プログレス枠、問題エリア外枠）が即時表示される
- データロード中は `PlaySkeleton`（`data-testid="quiz-play-skeleton"`）が表示され、完了後にインタラクティブなプレイ UI に差し替わる
- localStorage セッション復元・ゲーム進行ロジックは既存どおり Client 側で動作する

## Approach
**本番プレイ**: 結果画面と同型 — `page.tsx`（Server）→ `QuizPlayLoader`（async, `getQuiz` + quick-press 難読化）→ `QuizPlayClient`（既存ロジック抽出）

**test-play**: Server シェルで静的フレームのみ即時描画。クイズ draft は sessionStorage のため Server Loader 不可。`TestPlayClient` 内で payload 解決し、Suspense fallback に共有 `PlaySkeleton` を使用。

## Scope
- **In**: `/quiz/[id]/play`（全モード）、`/quiz/test-play/play`、`PlaySkeleton`、quick-press 難読化の共通化
- **Out**: レイアウト（サイドバー/ボトムナビ）変更、プレイロジック変更、Phase 13 billing 連携

## Boundary Candidates
- Server `page.tsx` + static frame
- `QuizPlayLoader` / `TestPlayClient` data boundary
- `QuizPlayClient` interactive play (hooks, timers, AI)
- `PlaySkeleton` shared component

## Out of Boundary
- `quizeum-core` の `getQuiz` API 変更
- test-play 結果画面
- Middleware 追加（test-play は既存 Client auth リダイレクト維持可）

## Upstream / Downstream
- **Upstream**: `getQuiz`（本番）、`lib/test-play`（test-play）、既存 hooks
- **Downstream**: E2E スケルトンシーケンス更新、Phase 13 プレイ画面 tier UI（並行可）

## Existing Spec Touchpoints
- **Extends**: `quizeum-play-flow-ui` 要件 15
- **Adjacent**: Phase 9 レイアウト除外、Phase 13 billing プレイ UI

## Constraints
- Vanilla CSS / CSS Modules、既存 `play.module.css` 踏襲
- test-play は sessionStorage 依存 — サーバーで draft 取得不可
- quick-press 正解難読化は本番 Loader と test-play Client の両方で適用
