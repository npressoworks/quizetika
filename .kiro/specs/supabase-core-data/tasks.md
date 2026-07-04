# Implementation Tasks - supabase-core-data

- [x] 1. 基礎: 正規化スキーマとRPCのマイグレーション基盤
- [x] 1.1 中間テーブル・バッジカタログの追加マイグレーション作成
  - `badges`（カタログ、`BADGE_DEFINITIONS` 11件をシード）、`user_badges`、`user_genre_follows`、`quiz_tags`、`quiz_questions` の各テーブルを主キー・外部キー・インデイックス付きで新規作成するマイグレーションファイルを追加する
  - `questions` テーブルに `quiz_id` を保持したまま、所有クイズ参照の意味を持つ新設カラムとしての扱いを明確にするコメントを付与する（リネームは後続タスクで実施）
  - マイグレーションをローカル Supabase に適用し、全テーブルがエラーなく作成されることを確認する
  - _Requirements: 1.4, 2.1, 2.3, 2.4_

- [x] 1.2 RPC関数の複合キー対応再定義と問題並び替えRPCの新設
  - `handle_follow_user` / `handle_unfollow_user` を `follows` の複合主キー `(follower_id, following_id)` に対応させ、文字列連結ID生成ロジックを削除する
  - `handle_check_and_award_badges` を `user_badges` への `INSERT ... ON CONFLICT DO NOTHING` 方式に書き換え、実際に新規付与されたバッジIDのみを返すようにする
  - `handle_bookmark_toggle` を `bookmarks` の複合キー `(user_id, target_id, target_type)` に対応させる
  - 新規 RPC `handle_reorder_questions(quiz_id, question_ids)` を作成し、`quiz_questions.display_order` を指定順序でアトミックに更新し、対象外の問題IDが含まれる場合は例外を送出することを確認する
  - _Requirements: 1.2, 1.3, 1.4, 2.3, 3.1, 3.2_
  - _Depends: 1.1_

- [x] 1.3 旧データの正規化テーブルへのバックフィルとカラムリネーム
  - `users.badges` (JSONB) の各要素を `user_badges` へ、`users.followed_genres` (配列) の各要素を `user_genre_follows` へ展開して移行するバックフィルSQLを作成・実行する
  - `quizzes.canonical_tag_ids` / `tags` / `original_tags` の内容を `quiz_tags`（`original_label` 含む）へ展開して移行するバックフィルSQLを作成・実行する
  - `quizzes.question_ids` の配列順序を `quiz_questions.display_order` として展開して移行するバックフィルSQLを作成・実行し、`questions.quiz_id` を `owner_quiz_id` にリネームする
  - バックフィル後、新テーブルの行数が旧JSONB/配列列の要素総数と一致することをクエリで検証する
  - _Requirements: 1.4, 2.1, 2.3, 2.4, 2.5, 3.1_
  - _Depends: 1.1_

- [x] 2. コア: サービス層の正規化対応
- [x] 2.1 (P) ユーザープロフィールサービス (user.ts) の正規化対応
  - `getUserProfile` が `user_badges JOIN badges` と `user_genre_follows` の集計結果から `User.badges` / `User.followedGenres` を従来と同じ配列形状で返すようにマッピングを書き換える
  - `checkAndAwardBadges` が新しい `handle_check_and_award_badges` の戻り値（新規付与されたバッジIDのみ）を使って通知作成対象を決定するように更新する
  - `followGenre` / `unfollowGenre` を `user_genre_follows` への単一行 `INSERT ON CONFLICT DO NOTHING` / `DELETE` に書き換え、既存の配列全体を読み込んで書き戻す処理を廃止する
  - `Follow` 型から Firestore ドキュメントID形式の合成 `id` フィールドを削除する
  - 単体テストを実行し、バッジの重複付与が発生しないこと、ジャンルフォロー操作が単一行操作になっていることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: UserService_
  - _Depends: 1.2, 1.3_

- [x] 2.2 (P) クイズ・問題管理サービス (quiz.ts, question.ts) の正規化対応
  - `mapRowToQuiz` が `quiz_tags JOIN metadata_tags` から `Quiz.tags` / `Quiz.originalTags` / `Quiz.canonicalTagIds` を、`quiz_questions ORDER BY display_order JOIN questions` から `Quiz.questionIds` / `Quiz.questions` を再構成するように書き換える
  - `createQuiz` / `updateQuiz` がタグの追加・削除を `quiz_tags` への差分 `INSERT` / `DELETE` として反映するように `src/lib/metadata-resolution.ts` に同期用関数を追加して呼び出す
  - `createQuiz` / `updateQuiz` が問題の追加・削除・入れ替えを `quiz_questions` への `INSERT` / `DELETE` として反映するように書き換える
  - `question.ts` に `updateQuestionOrder(quizId, orderedQuestionIds)` を新設し、`handle_reorder_questions` RPCを呼び出して問題の表示順序を更新できるようにする
  - `canDeleteQuestionDoc` の判定に使う `findQuizIdsContainingQuestion` を `quizzes.question_ids` の配列スキャンから `quiz_questions` への件数クエリに置き換える
  - 単体テストを実行し、クイズ取得時のタグ・問題一覧がJOIN結果から正しく再構成されること、および問題並び替えが指定順序どおりに反映され対象外IDでは例外になることを検証する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Boundary: QuizService, QuestionService_
  - _Depends: 1.2, 1.3_

- [x] 2.3 (P) ブックマークサービス (bookmark.ts) の複合キー対応
  - `getBookmarkDocId` による疑似ドキュメントID生成を廃止し、`isBookmarked` / `toggleBookmark` が `(user_id, target_id, target_type)` の複合条件で直接クエリするように書き換える
  - `Bookmark` 型から Firestore ドキュメントID形式の合成 `id` フィールドを削除する
  - 単体テストを実行し、`target_type` を跨いだID衝突が発生しないこと、およびブックマークの追加・削除・一覧取得が複合キーで正しく動作することを検証する
  - _Requirements: 3.1, 3.2, 3.3_
  - _Boundary: BookmarkService_
  - _Depends: 1.2, 1.3_

- [x] 3. 統合と検証
- [x] 3.1 サービス層移行の全体結合と型チェックのパス
  - すべてのサービス層が正規化テーブルへ切り替わった状態で `npm run build` を実行する
  - TypeScript コンパイラが一切の型エラーを報告せず、Next.js プロジェクトのビルドが100%成功することを確認する
  - _Requirements: 1.1, 2.1, 3.1, 4.1_
  - _Depends: 2.1, 2.2, 2.3_

- [x] 3.2 通知・お知らせ機能のリグレッション確認とバッジカタログ整合性検証
  - 既存の `notification.ts` / `announcement.ts` が正規化後のスキーマ変更の影響を受けず、未読通知一覧・既読化・お知らせ公開判定が引き続き正しく動作することを単体テストで確認する
  - `badges` テーブルのシードデータが `BADGE_DEFINITIONS` のID集合と完全に一致することを検証するテストを追加する
  - Jest テストスイート全体を実行し、全テストがパスすることを確認する
  - _Requirements: 4.1, 4.2, 4.3_
  - _Depends: 2.1, 2.2, 2.3_

- [x] 4. クリーンアップ: 旧カラム削除マイグレーション
- [x] 4.1 Firestore由来の非正規化カラムの削除
  - `users.badges` / `users.followed_genres`、`quizzes.tags` / `original_tags` / `canonical_tag_ids` / `question_ids` / `questions` を削除する最終マイグレーション（`20260703000100_core_data_cleanup.sql`）を作成する（`follows.id` / `bookmarks.id` の削除および `questions.owner_quiz_id` へのリネームはタスク1.3のカットオーバー用マイグレーションで先行実施済み）
  - マイグレーション適用後、`npm run build` と Jest テストスイートを再実行し、削除済みカラムへの参照が残っていないことを確認する
  - _Requirements: 1.4, 2.1, 2.3, 2.4, 2.5, 3.1, 3.2_
  - _Depends: 3.1, 3.2_
