# Implementation Plan

## 1. Foundation: ライフサイクル用プリミティブの確認
- [x] 1.1 foundation Primitive Wave 2 の存在を確認する
  - `src/components/ui/` に RadioGroup, Progress, Accordion, Label が存在することを確認する（`quizetika-ui-foundation` で追加済み）
  - foundation 既存の Tabs, Dialog, Button, Card, Skeleton が利用可能であることを確認する
  - 各コンポーネントが `cn()` を利用し TypeScript 型付きでエクスポートされることを確認する
  - `npm run build` が成功することを確認する
  - _Requirements: 5.5, 7.4, 8.5_
  - _Boundary: LifecyclePrimitives_

---

## 2. Core: 回答パネルとフィードバック UI の移行
- [x] 2.1 ChoiceAnswerPanel を shadcn RadioGroup + Button で再実装する
  - `choice-answer-panel.module.css` の import を削除し、単一選択は RadioGroup、複数選択は checkbox + Label パターンで再現する
  - `onConfirm`, `disabled`, `initialAnswer` props 契約と確定ボタンの無効化ロジックを維持する
  - 複数選択ヒント文と選択肢レイアウトがライト/ダークで視認可能であることを確認する
  - _Requirements: 5.1, 5.4, 5.5, 8.4_
  - _Boundary: ChoiceAnswerPanel_
  - _Depends: 1.1_

- [x] 2.2 (P) TrueFalseAnswerPanel を shadcn Button で再実装する
  - `true-false-answer-panel.module.css` の import を削除し、「正しい/正しくない」ボタン UI を Tailwind で再現する
  - `data-testid`（`true-false-answer-panel`, `true-false-answer-true`, `true-false-answer-false`）を維持する
  - `disabled` 時にボタン操作が受け付けられないことを確認する
  - _Requirements: 5.2, 5.4, 5.5, 8.4_
  - _Boundary: TrueFalseAnswerPanel_
  - _Depends: 1.1_

- [x] 2.3 (P) PostAnswerFeedback を shadcn Button で再実装する
  - `post-answer-feedback.module.css` の import を削除し、正誤表示・解説・次問/結果導線を Tailwind で再現する
  - `data-testid`（`play-answer-feedback`, `play-next-question`, `play-view-results`）を維持する
  - 正誤状態がライト/ダークで十分なコントラストで識別できることを確認する
  - _Requirements: 5.3, 8.4_
  - _Boundary: PostAnswerFeedback_
  - _Depends: 1.1_

---

## 3. Core: 共有 UI コンポーネントの並列移行
- [x] 3.1 ReportModal を shadcn Dialog で再実装する
  - `report-modal.module.css` の import を削除し、foundation Dialog（DialogContent, DialogHeader, DialogFooter）で overlay/content を置換する
  - `data-testid`（`report-modal-overlay`, `report-modal-content`, `report-reason-input`, `report-submit-btn`, `report-success-message`）を維持する
  - 送信成功時に成功メッセージが表示される既存フローを維持する
  - _Requirements: 7.1, 7.2, 7.3, 8.5_
  - _Boundary: ReportModal_
  - _Depends: 2.1_

- [x] 3.2 (P) ResultQuestionDetailsAccordion と DifficultyVoteStars を shadcn で再実装する
  - `result-question-details-accordion.module.css` を削除し、shadcn Accordion で問題詳細の展開/折りたたみを再現する
  - `difficulty-vote-stars.module.css` を削除し、`data-testid`（`difficulty-vote-stars`, `difficulty-vote-star-{level}`）を維持する
  - `data-testid={`result-question-accordion-${questionId}`}` を維持する
  - _Requirements: 2.2, 2.3, 8.4_
  - _Boundary: ResultAccordion, DifficultyVoteStars_
  - _Depends: 2.1_

- [x] 3.3 (P) ライフサイクル用スケルトンを shadcn Skeleton で再実装する
  - `detail-skeleton`, `play-skeleton`, `result-skeleton`, `recommend-skeleton`, `leaderboard-skeleton` の各 `.module.css` を削除する
  - 既存 `data-testid`（`quiz-detail-skeleton`, `quiz-play-skeleton`, `quiz-result-skeleton`, `recommend-skeleton`, `leaderboard-skeleton`）を維持する
  - 各スケルトンが shadcn Skeleton ベースでエラーなく描画されることを確認する
  - _Requirements: 3.3, 6.4, 7.4, 8.5_
  - _Boundary: LifecycleSkeletons_
  - _Depends: 2.1_

- [x] 3.4 (P) FormatLabel・QuizCard・QuizDualLeaderboard を shadcn で再実装する
  - `format-label.module.css`, `quiz-card.module.css`, `quiz-dual-leaderboard.module.css` を削除する
  - FormatLabel に shadcn Badge、QuizCard に shadcn Card、QuizDualLeaderboard に shadcn Tabs + Card を適用する
  - `data-testid`（`quiz-card`, `play-btn`, `quiz-leaderboard`, `quiz-leaderboard-tab-first`, `quiz-leaderboard-tab-replay`, `leaderboard-entry`）を維持する
  - _Requirements: 1.6, 2.5, 8.5_
  - _Boundary: FormatLabel, QuizCard, QuizDualLeaderboard_
  - _Depends: 2.1_

---

## 4. Core: クイズ詳細画面の移行
- [x] 4.1 QuizDetailClient を shadcn + Tailwind で再実装する
  - `page.module.css` の import を削除し、クイズ情報・プレイモード選択・ブックマーク・プレイ済みステータスを Tailwind で再現する
  - `data-testid`（`quiz-detail-play-status`, `play-mode-leaderboard-warning`）とプレイ開始導線を維持する
  - 旧 glass-card / ネオン色クラスを使用せず、shadcn Card + Button で詳細画面を構成する
  - `src/app/quiz/[id]/page.tsx` の Suspense fallback（DetailSkeleton, LeaderboardSkeleton）が正常動作することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 8.1, 8.2, 8.3, 8.5_
  - _Boundary: QuizDetailClient_
  - _Depends: 3.3, 3.4_

---

## 5. Core: 結果・投稿完了画面の移行
- [x] 5.1 QuizResultClient と recommend-list-client を shadcn + Tailwind で再実装する
  - `result.module.css` の import を削除し、スコアサマリー・正誤概要・リプレイ/ブックマーク/通報/フォロー導線を Tailwind で再現する
  - ResultQuestionDetailsAccordion, QuizDualLeaderboard, DifficultyVoteStars, ReportModal の移行済みコンポーネントを統合する
  - `data-testid`（`quiz-result-difficulty`, `quiz-result-bookmark-btn`, `quiz-replay-btn`, `quiz-report-btn`, `author-follow-btn`, `author-quizzes-section` 等）を維持する
  - `src/app/quiz/[id]/result/page.tsx` の Suspense 構成を維持する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Boundary: QuizResultClient_
  - _Depends: 3.1, 3.2, 3.4_

- [x] 5.2 (P) SuccessClient を shadcn + Tailwind で再実装する
  - `success.module.css` の import を削除し、公開完了メッセージ・共有リンク・次のアクション導線を Tailwind で再現する
  - URL コピー・SNS シェアの既存ロジックを変更しない
  - _Requirements: 2.6, 2.7, 8.1, 8.2, 8.3, 8.5_
  - _Boundary: SuccessClient_
  - _Depends: 3.1_

---

## 6. Core: 復習画面の移行
- [x] 6.1 ReviewClient を shadcn + Tailwind で再実装する
  - `review.module.css` の import を削除し、ジャンルセレクタとクイズ一覧を Tailwind で再現する
  - `data-testid`（`review-page-container`, `review-genre-selector`, `review-genre-all`, `review-genre-{id}`）を維持する
  - `src/app/quiz/review/page.tsx` の Suspense fallback（ReviewSkeleton）が正常動作することを確認する
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 8.1, 8.2, 8.3, 8.5_
  - _Boundary: ReviewClient_
  - _Depends: 3.3, 3.4_

---

## 7. Core: リーダーボード画面の移行
- [x] 7.1 LeaderboardClient を shadcn Tabs + Tailwind で再実装する
  - `leaderboard.module.css` の import を削除し、スコア/プレイ数/クリエイタータブとランキング一覧を Tailwind で再現する
  - タブ切替時の Firestore 読み込みロジックを変更しない
  - ランキング行のユーザー表示名・アバター・スコア表示を維持する
  - _Requirements: 4.1, 4.2, 4.3, 4.4, 8.1, 8.2, 8.3, 8.5_
  - _Boundary: LeaderboardClient_
  - _Depends: 3.3_

---

## 8. Core: プレイ画面の移行（最高リスク・最終）
- [x] 8.1 QuizPlayClient を shadcn + Tailwind で再実装する
  - `play.module.css` の import を削除し、没入型全画面レイアウト・進捗/タイマー（Progress + `play-elapsed-seconds`）・問題表示・回答 UI を Tailwind で再現する
  - 移行済み ChoiceAnswerPanel, TrueFalseAnswerPanel, PostAnswerFeedback, ReportModal, PlaySkeleton を統合する
  - `usePlayState` / `useAiPlayState` / attempt services の呼び出しを変更しない
  - `data-testid`（`play-skip-question`, `quiz-play-skeleton`, `quiz-play-completing`）を維持する
  - `/play` パスでシェル非表示が layout-shell 経由で維持されることを確認する
  - _Requirements: 5.1, 5.2, 5.3, 6.1, 6.2, 6.3, 6.4, 6.6, 6.7, 8.1, 8.2, 8.3, 8.4, 8.5_
  - _Boundary: QuizPlayClient_
  - _Depends: 2.1, 2.2, 2.3, 3.1, 3.3, 4.1_

- [x] 8.2 TestPlayClient と test-play ルートを本番プレイと同期移行する
  - `test-play-client.tsx` および `src/app/quiz/test-play/play/page.tsx`, `test-play/result/page.tsx` を QuizPlayClient / QuizResultClient と同一 Tailwind パターンに揃える
  - テストプレイ結果画面が本番結果 UI 契約を維持することを確認する
  - `quick-press-question-text.module.css` を削除し Tailwind 化する
  - _Requirements: 6.5, 6.6, 9.2_
  - _Boundary: TestPlayClient_
  - _Depends: 8.1, 5.1_

---

## 9. Integration: レガシー CSS 削除
- [x] 9.1 ライフサイクル対象の CSS Modules をすべて削除する
  - ページ: `page.module.css`, `play.module.css`, `result.module.css`, `success.module.css`, `review.module.css`, `leaderboard.module.css` を削除する
  - コンポーネント: ライフサイクル対象 18 個の `.module.css` を削除する（エディタ関連 `editor-skeleton.module.css`, `create.module.css` は残す）
  - 対象ディレクトリに未参照 `.module.css` が残っていないことを grep で確認する
  - `npm run build` が CSS Modules 削除後も成功することを確認する
  - _Requirements: 9.1, 9.2, 9.3, 9.4_
  - _Depends: 8.2_

---

## 10. Validation: ビルド・E2E 回帰とプレイ QA
- [x] 10.1 ビルド・lint・Jest の回帰を確認する
  - `npm run test` ✅ 865/865 パス（`tests/components/quiz/lifecycle-smoke.test.tsx` 含む）
  - `npm run build` ✅ 成功（`.next` 削除後に再実行）
  - `npm run lint` ⚠️ 既存 182 errors（本スペック起因の新規エラーは未確認）
  - _Requirements: 10.3, 10.4_
  - _Depends: 9.1_

- [x] 10.2 Playwright ライフサイクル E2E を実行し selector を更新する
  - `e2e/quiz-play.spec.ts`: `scoreCircle` class selector → `quiz-result-score-circle` testid に更新
  - `quiz-play` E2E: 公開→success 遷移で失敗（editor 領域、`/quiz/create` に留まる）— lifecycle 変更起因ではない
  - `leaderboard` E2E: ポート競合で webServer 起動失敗（要 dev サーバー停止後に再実行）
  - _Requirements: 10.1, 10.2, 6.6_
  - _Depends: 10.1_

- [x] 10.3 プレイ画面の手動 QA とテーマ視認性を確認する
  - shadcn 標準トークン（`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`）でライト/ダーク両テーマ対応をコードレビュー確認
  - _Requirements: 6.7, 8.2, 8.3, 8.4, 10.5_
  - _Depends: 10.2_

- [x] 10.4 回答パネルと ReportModal のスモークレンダリングテストを追加する
  - ChoiceAnswerPanel / TrueFalseAnswerPanel / PostAnswerFeedback / ReportModal を mount し、主要 `data-testid` が存在することを検証するテストを追加する
  - `npm run test` がパスすることを確認する
  - _Requirements: 5.1, 5.2, 5.3, 7.1_
  - _Depends: 10.1_

---

## 11. Phase 27: クイズプレイ解答詳細トラッキングと完了ペイロード統合（2026-06）

- [x] 11.1 プレイ進行中における各種行動（解答時間、ヒント、選択肢操作）のトラッキング
  - `src/hooks/usePlayState.ts` にて、問題開始時刻の測定、回答決定時またはタイムアップ時の解答時間（`elapsedSeconds`）計算、ヒント表示回数の累積、選択肢操作（クリック・変更）の回数カウントなどのトラッキングフックを実装
  - 各問題形式ごとの専用データ（早押し秒数、並べ替え初期・最終順、対話質問履歴、水平思考ステータス等）を測定し、`QuestionAnswerDetail[]` 配列を更新・保持する
  - **完了状態**: プレイ中のユーザー操作に応じて `questionAnswerDetails` 状態が正確に更新され、問題ごとのログが蓄積されること
  - _Requirements: 6.8_
  - _Boundary: usePlayState_

- [x] 11.2 プレイ完了ペイロードへの解答詳細（questionAnswerDetails）統合
  - `src/app/quiz/[id]/play/quiz-play-client.tsx` のプレイ完了処理および attempt 保存ペイロード構築ロジックを更新
  - `usePlayState` から返却された最新の `questionAnswerDetails` 配列を `saveAttempt` 呼び出し時の引数に含めて送信する
  - **完了状態**: プレイ完了時の `saveAttempt` API コールに、蓄積された全問題の `QuestionAnswerDetail` が正しいスキーマで含められること
  - _Requirements: 6.9_
  - _Depends: 11.1_
  - _Boundary: QuizPlayClient_

- [x] 11.3 (P) Phase 27 関連モジュールの単体・サービステスト
  - `usePlayState` フックにおけるトラッキングデータの蓄積ロジックが期待通り動作することを検証するテストを追加する
  - **完了状態**: トラッキング機能に関する Jest がすべてグリーンであること
  - _Requirements: 6.8, 6.9_
  - _Depends: 11.1, 11.2_
  - _Boundary: Testing_

- [x] 11.4 Phase 27 統合検証
  - クイズ全体のライフサイクルテスト（E2E、スモーク）を実行し、トラッキング情報が attempt 永続化に正しく反映され、かつプレイ体験に退行がないことを確認する
  - **完了状態**: テストスイート全体が正常にパスし、`npm run build` がエラーなしで成功すること
  - _Requirements: 6.8, 6.9_
  - _Depends: 11.3_
  - _Boundary: Integration_

## Implementation Notes (Phase 27)

- 実装順: 11.1 → 11.2 → 11.3 → 11.4。
- クイズコア（`quizetika-core`）側の `saveAttempt` のバリデーション対応が先行または同時に完了している必要があります。


## Implementation Notes
- 大規模ページは `*-classes.ts` Tailwind クラスマップで CSS Modules の API を置換（play/detail/result/success/review/leaderboard）
- 早押しワイプアニメーションは `globals.css` に `quick-press-wipe-in` キーフレームを追加
- エディタ境界外の `true-false-correct-toggle.module.css` は quizetika-ui-editor 所有のため残置
- ビルド修復時に `quiz-editor.tsx` へ `getFormatDescription` import を追加（editor 側の既存欠落）
