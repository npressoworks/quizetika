# Implementation Tasks - supabase-core-data

## 1. 基礎・データベースマイグレーション
- [ ] 1.1 フォロー・バッジ管理用のデータベース RPC 関数の定義
  - データベースにフォロー/アンフォロー用のアトミック関数 `handle_follow_user` と `handle_unfollow_user` を作成するマイグレーション SQL ファイルを追加する
  - データベースに未獲得バッジを一括追加するためのアトミックマージ関数 `handle_check_and_award_badges` を定義する
  - マイグレーションを実行した際、エラーなく関数がデータベースにロードされることを検証する
  - _Requirements: 1.2, 1.3, 1.4_
  - _Boundary: Database Migration_

- [ ] 1.2 不要な Firebase Firestore 定義ファイルの削除と整理
  - 既存の `src/lib/firebase/firestore.ts` ファイルを削除する
  - プロジェクト全体のインポートエラーを特定するため、一度ビルドチェックを実行する
  - 依存ファイルの削除が完了し、不要なコンバーターコードが物理的に除去された状態を確認する
  - _Requirements: 1.1_
  - _Boundary: Codebase Cleanup_

## 2. コアサービス層の Supabase 移行
- [ ] 2.1 (P) ユーザープロフィールサービス (user.ts) の移行
  - ユーザー情報の取得、作成、更新 (`getUser`, `createUser`, `updateUserProfile`, `updateProfile`) を Supabase クライアント API に置き換える
  - フォロー・アンフォローおよびバッジ自動付与の処理を、1.1 で作成した RPC 関数を呼び出す形に変更する
  - バッジ獲得・フォロー時のシステム通知作成ロジックを Supabase に統合する
  - 単体テストを実行し、プロフィールCRUD、フォロー・アンフォロー、バッジ付与のロジックが正常にモック/実行されることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4_
  - _Boundary: UserService_
  - _Depends: 1.1_

- [ ] 2.2 (P) クイズ・問題管理サービス (quiz.ts, question.ts) の移行
  - クイズの CRUD (`getQuiz`, `createQuiz`, `updateQuiz`, `deleteQuiz`) および問題の順序更新 (`updateQuestionOrder`) を Supabase JS Client に移行する
  - キーワードおよびジャンルに基づくクイズ一覧取得を、PostgreSQL クエリによるキーセットページネーションを実装して置き換える
  - `src/lib/metadata-resolution.ts` および `src/lib/search-log.ts` 内の Firestore 依存を Supabase クエリ・インサートに書き換える
  - バリデーションファイル (`src/services/quiz-validation.ts`) から Firestore の型や参照を完全に除去する
  - 単体テストにて、クイズ取得や検索、ページネーション、問題順序の更新が意図通りに動作することを検証する
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Boundary: QuizService, QuestionService_
  - _Depends: 1.2_

- [ ] 2.3 (P) ブックマークサービス (bookmark.ts) の移行
  - ブックマークの追加 (`addBookmark`)、削除 (`removeBookmark`) を Supabase JS Client で実装する
  - ユーザーがブックマークしたクイズ一覧 (`getBookmarkedQuizzes`) を、キーセットページネーションで取得できるように移行する
  - テスト環境でブックマークの追加・削除の動作および一覧取得がパスすることを検証する
  - _Requirements: 3.1, 3.2, 3.3_
  - _Boundary: BookmarkService_
  - _Depends: 1.2_

- [ ] 2.4 (P) 通知とお知らせサービス (notification.ts, announcement.ts) の移行
  - 未読通知一覧の取得、既読化、および新規通知の作成を Supabase API で実装する
  - お知らせ一覧取得 (`getPublishedAnnouncements`) を Supabase 向けに書き換え、公開日時順にソートする
  - テスト環境で通知の既読化とお知らせの一覧取得が正常に行えることを検証する
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: NotificationService, AnnouncementService_
  - _Depends: 1.2_

## 3. 結合と最終検証
- [ ] 3.1 サービス層移行の全体結合と型チェックのパス
  - すべてのサービス層が Supabase へ切り替わった状態で、`npm run build` コマンドを実行する
  - TypeScript コンパイラ (`tsc`) が一切の型エラーを報告せず、Next.js プロジェクトのビルドが 100% 成功することを確認する
  - _Requirements: 1.1, 2.1, 3.1, 4.1_
  - _Boundary: Project Build & Integration_
  - _Depends: 2.1, 2.2, 2.3, 2.4_
