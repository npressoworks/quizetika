# Implementation Tasks - supabase-gameplay

- [x] 1. 基礎: ゲームプレイ系スキーマとRPCのマイグレーション
- [x] 1.1 既存テーブルのALTERと新規テーブル作成、RLSポリシー定義
  - `attempts.completed_at` を NULL 許容へ ALTER し、`gave_up_lateral BOOLEAN` 列を新設する
  - `quiz_reviews` を `id TEXT` 主キー + `rating`/`comment` 列から、複合主キー `(reviewer_id, quiz_id)` + `type`/`reason`/`updated_at` 列へ ALTER する
  - `feedback_reports` に `(quiz_id, question_id, reporter_id) WHERE status='open'` の部分ユニークインデックスを新設する
  - `quizzes` に `likes_count`／`difficulty_votes_sum`／`difficulty_votes_count` 列を追加する
  - `reactions`、`difficulty_votes`、`ai_turn_counts_per_quiz`、`ai_turn_counts_global` の各テーブルを主キー・外部キー・インデックス付きで新規作成し、RLSを有効化してポリシーを定義する（`difficulty_votes` は INSERT/UPDATE/DELETE を分離したポリシーとする）
  - マイグレーションをローカル Supabase に適用し、全テーブル・ALTERがエラーなく反映されることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 2.3, 3.1, 3.2, 4.1, 4.2_

- [x] 1.2 リーダーボード・アテンプト・AI対話関連RPCの定義
  - 内部共有関数 `record_leaderboard_entry` を定義し、`PUBLIC`/`anon`/`authenticated` からの直接実行を `REVOKE` する
  - `handle_save_attempt`（`quiz_questions` を用いた対不正検証、表示名のサーバー側導出、`playCount` 更新、適格時のリーダーボード反映）を定義する
  - `handle_start_lateral_attempt`、`handle_complete_lateral_attempt`（合格時のみ完了・リーダーボード反映）、`handle_give_up_lateral_attempt`（既に完了済みの場合は例外）を定義する
  - `handle_record_ai_turn` を定義し、JST日付境界でのカウンタ加算と、加算直後の上限判定によるアトミックな制限強制（`p_per_quiz_limit`/`p_global_limit` が NULL なら無制限）を実装する
  - 成果物確認: 各RPCがマイグレーション適用後にエラーなくデータベースへロードされること
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 4.1, 4.2_
  - _Depends: 1.1_

- [x] 1.3 レビュー・評価・リアクション関連RPCの定義
  - `handle_submit_review`（同一票の再送信は無視、差分に基づく `positive_count`/`negative_count`/`review_score` 再計算）、`handle_retract_review` を定義する
  - `handle_submit_difficulty_vote`（ログイン済みユーザーは上書き+差分反映、匿名は常に新規加算、1〜5範囲チェック）を定義する
  - `handle_toggle_reaction`（受信者をクイズ作成者からサーバー側導出、自己反応防止、追加/解除の双方で `quizzes.likes_count` と `users.total_reactions_count` を更新）を定義する
  - 成果物確認: 各RPCがマイグレーション適用後にエラーなくデータベースへロードされること
  - _Requirements: 2.1, 2.2, 2.3, 3.1, 3.2_
  - _Depends: 1.1_

- [x] 2. コア: ゲームプレイサービス層の正規化対応
- [x] 2.1 (P) 解答履歴・リーダーボードサービスの正規化対応
  - `attempt.ts` の `saveAttempt`／`createLateralAttemptSession`／`listUserPlayHistory`／`listUserPlayedQuizIds` を Supabase RPC/クエリ呼び出しに書き換える（`getLeaderboard` を新設し `leaderboard_entries` から上位5件を取得する）
  - `attempt-server.ts` の `getAttemptByIdForUser` を Firebase Admin から Supabase サーバークライアントに書き換える
  - `play-history-client.ts`／`played-quiz-ids-client.ts` の現在ユーザー取得を Supabase セッションベースへ更新する
  - 単体テストを実行し、初回/リプレイのリーダーボード分岐・対不正検証・水平思考セッションのライフサイクルが既存テストの期待値どおりに動作することを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: AttemptService_
  - _Depends: 1.2_

- [x] 2.2 (P) レビュー・指摘報告サービスの正規化対応
  - `review.ts` の `submitReview`／`retractReview`／`getUserReviewForQuiz` を `handle_submit_review`／`handle_retract_review` RPC呼び出しに書き換える
  - `submitFeedbackReport`／`getOpenReportsByQuizId`／`resolveReport`／`rejectReport` を Supabase クライアントAPIに書き換える
  - 単体テストを実行し、レビューの新規投票・変更・同一票再送信の無視、指摘報告の重複防止（部分ユニークインデックス起因）が正しく動作することを確認する
  - _Requirements: 3.1, 3.2_
  - _Boundary: ReviewService_
  - _Depends: 1.3_

- [x] 2.3 (P) 難易度評価サービスの正規化対応
  - `rating.ts` の `submitDifficultyVote` を `handle_submit_difficulty_vote` RPC呼び出しに書き換える
  - 単体テストを実行し、範囲外投票の拒否、ログイン済みユーザーの上書き差分反映、匿名投票の新規加算が正しく動作することを確認する
  - _Requirements: 2.1_
  - _Boundary: RatingService_
  - _Depends: 1.3_

- [x] 2.4 (P) リアクションサービスのトグル化対応
  - `reaction.ts` の `sendReaction` を `toggleReaction`（`handle_toggle_reaction` RPC呼び出し）に書き換え、追加/解除の両方に対応する
  - `getSentReactions`／`getReceivedReactions` を Supabase クライアントAPIに書き換える
  - 単体テストに解除（トグルオフ）ケースを新規追加し、追加・解除の両方で `quizzes.likes_count` と `users.total_reactions_count` が正しく増減することを検証する
  - _Requirements: 2.2, 2.3_
  - _Boundary: ReactionService_
  - _Depends: 1.3_

- [x] 2.5 (P) AI対話・合格判定APIルートの正規化対応
  - `/api/attempt/ask-ai` を Firebase Admin から Supabase サーバークライアントに書き換え、`handle_record_ai_turn` RPCを呼び出すようにする
  - `/api/attempt/verify-truth` を Supabase サーバークライアントに書き換え、`handle_complete_lateral_attempt` RPCを呼び出すようにする（判定失敗時は完了させない）
  - `/api/attempt/give-up-lateral` を Supabase サーバークライアントに書き換え、`handle_give_up_lateral_attempt` RPCを呼び出すようにする（既に完了済みの場合は409を返す）
  - `/api/quiz/quick-press-stream` のクイズ・問題参照を Firestore クライアントSDKから Supabase の `questions` テーブル参照に書き換える
  - 単体・APIテストを実行し、キャッシュ判定・日次上限超過時のエラー・合格/不合格それぞれの記録内容が既存テストの期待値どおりに動作することを確認する
  - _Requirements: 4.1, 4.2_
  - _Boundary: AI Dialogue Routes_
  - _Depends: 1.2_

- [x] 3. 統合と検証
- [x] 3.1 サービス層移行の全体結合と型チェックのパス
  - すべてのゲームプレイサービス・APIルートが正規化テーブルへ切り替わった状態で `npm run build` を実行する
  - TypeScript コンパイラが一切の型エラーを報告せず、Next.js プロジェクトのビルドが100%成功することを確認する
  - _Requirements: 1.1, 2.1, 3.1, 4.1_
  - _Depends: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 3.2 テストスイート全体の確認とマイグレーション整合性検証
  - Jest テストスイート全体を実行し、全テストがパスすることを確認する
  - ローカル Supabase 環境で、`attempts.completed_at` のNULL許容化と `quiz_reviews` の複合主キー化が既存の RLS ポリシー・インデックスと矛盾なく機能することを確認する
  - `handle_save_attempt` と `handle_complete_lateral_attempt` の双方から呼び出された `record_leaderboard_entry` が、`leaderboard_entries` の `UNIQUE(quiz_id, user_id, type)` 制約下で自己ベストのみを保持することを確認する
  - _Requirements: 1.2, 1.3, 1.4_
  - _Depends: 3.1_
