# Brief: quizetika-play-flow-ui — Phase 15 通常モードプレイフィードバックフロー（2026-06-08）

## Problem
通常モードのプレイ中、回答後すぐ次問へ自動遷移するため正誤・解説を確認できない。わからない問題をスキップする手段がない。全問完了後は「解答データを送信中...」の白紙待機が発生し、結果画面の Suspense シェルが活かされない。

## Current State
- `usePlayState.handleAnswerSubmit` は回答記録と `currentIdx` 進行を一体で実行（通常モードは自動次問）
- 早押しのみ `showFeedback=true` 時に即時正誤 +「次の問題へ」UI あり
- 全問完了で `saveAttempt` 完了まで「解答データを送信中...」を表示してから結果へ遷移
- 結果 `page.tsx` は RSC + `ResultSkeleton` 済みだがプレイ側が遷移をブロック

## Desired Outcome
- **通常モードのみ**: 回答 or スキップ → 即時正誤表示 →「次へ」／最終問は「結果を見る」
- スキップは空回答と同様に不正解（`failedQuestionIds`）
- 「解答データを送信中...」廃止。結果画面へ即遷移し `ResultSkeleton` で枠表示、`saveAttempt` はバックグラウンド
- 模擬試験・フラッシュカード・ウミガメ・問題リストは現状維持

## Approach
**統一フィードバックフロー + 楽観的結果遷移（アプローチ A）**
- `usePlayState` を「回答記録」と「次問進行」に分離（通常モードのみフィードバック待ち）
- 共有 `PostAnswerFeedback` UI で全問題形式に正誤・解説・次へ／結果を見る
- 完了時: sessionStorage に楽観的 attempt を保存 → 即 `router.push`（`localId`）→ バックグラウンド `saveAttempt` → 成功時 `attemptId` に URL 置換

## Scope
- **In**: `mode=normal` の全問題形式、スキップボタン、楽観的結果遷移、結果 Client の pending attempt 読み取り
- **Out**: exam / flashcard / lateral / question-list のフロー変更、`saveAttempt` API 変更（Core）、test-play

## Boundary Candidates
- `usePlayState` — record vs advance
- `PostAnswerFeedback` — 正誤・解説・CTA
- `handlePlayComplete` — 楽観的遷移 + バックグラウンド保存
- `QuizResultClient` — optimistic / Firestore フォールバック

## Out of Boundary
- `quizetika-core` の `saveAttempt` スキーマ・API 変更
- クイズ詳細の「即時正誤表示」トグル（通常モードでは新フローを常時適用しトグルは無効化または非表示）

## Upstream / Downstream
- **Upstream**: 既存 `saveAttempt`, `addPendingSyncAttempt`, `ResultSkeleton`, 正誤判定ユーティリティ
- **Downstream**: E2E 通常プレイフロー更新、Phase 12 要件 15.25 の挙動改定

## Existing Spec Touchpoints
- **Extends**: 要件 3, 要件 5, 要件 15（結果 Suspense 活用）
- **Adjacent**: Phase 14 結果アコーディオン、Phase 12 追補プレイ Suspense

## Constraints
- スキップ = 空文字 `''` 提出と同等（不正解）
- Vanilla CSS / 既存 `play.module.css` 踏襲
- オフライン完了時は既存 `localId` + pending sync パターンを維持

---

# Brief: quizetika-play-flow-ui — Phase 16 早押し経過時間・レイアウト（2026-06-09）

## Problem
早押しプレイで経過時間が問読み前から加算され、制限時間も問読み前に開始する。不正解時に正解が表示され、問読み前はカードが狭く見える。

## Desired Outcome
- 経過時間は各問題の計測区間の累計（問読み開始前・制限時間終了後・不正解確定後は加算しない）
- 制限時間カウントダウンは問読み修了後に開始
- 不正解フィードバックで正解を表示しない
- 問題カードは問読み前から十分な横幅

## Scope
- **In**: 通常モード・`quick-press` 問題、本番プレイ画面
- **Out**: 早押しタイム計測変更、テストプレイ、非通常モード、復習プレイ、`saveAttempt` スキーマ変更
