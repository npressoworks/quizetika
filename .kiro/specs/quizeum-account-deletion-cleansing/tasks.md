# Implementation Plan

- [x] 1. Foundation: データベースチェック制約の拡張と型定義の更新
- [x] 1.1 `users.delete_status` チェック制約を変更する SQL マイグレーションの実装
  - 既存のチェック制約を解除し、`'active'`, `'delete_pending'`, `'deleted'` の3状態を許容するチェック制約を再定義するマイグレーションファイルを作成する
  - ローカル Supabase データベースに対してマイグレーションを実行し、エラーが発生しないこと
  - _Requirements: 1.2_
- [x] 1.2 TypeScript の `User` 型定義の更新
  - `src/types/index.ts` において `deleteStatus` の型定義に `'deleted'` を追加する
  - `src/lib/supabase/database.types.ts` 等の自動生成型定義ファイルに `'deleted'` 制約が正しく定義・同期されることを確認する
  - _Requirements: 1.2_

- [x] 2. Core: クレンジングサービスロジックの実装
- [x] 2.1 (P) `UserService.cleanUpDeletedUser` サービス関数の実装
  - `src/services/user.ts` に `cleanUpDeletedUser` 関数を実装し、Admin Client を利用して対象ユーザーの関連データを削除・匿名化する
  - リーダーボードエントリー (`leaderboard_entries`)、フォロー関係 (`follows`)、ブックマーク (`bookmarks`)、通知 (`notifications`) から対象ユーザーのデータを物理削除する
  - 対象ユーザーが作成したクイズ (`quizzes`) および問題 (`questions`) の `author_name` を「退会済ユーザー」に、`author_avatar` を `null` に更新する
  - `users` テーブル of 対象ユーザーレコードについて、`display_name` を「退会済ユーザー」に変更、`email` を `deleted_${uid}@example.com` に更新、その他の個人情報（avatar_url, bio, sns_links, badges）をクリアし、`delete_status` を `'deleted'` に更新する
  - すべてのデータベース操作において、例外発生時はログ（`console.error`）を出力しつつ例外を上位へ再スローする
  - _Requirements: 1.2, 2.1, 2.2, 3.1, 4.1, 4.2, 4.3, 4.4, 4.5, 5.1_
  - _Boundary: UserService_

- [x] 3. Integration: 退会APIエンドポイントの拡張とAuthアカウント削除の統合
- [x] 3.1 退会APIエンドポイントでの同期クレンジングとAuthユーザー物理削除の統合
  - `src/app/api/user/delete-account/route.ts` において、Stripeサブスク解約処理の完了後に `cleanUpDeletedUser(uid)` を同期的に呼び出すように拡張する
  - DBクレンジング完了後、`createAdminClient` から取得した Admin Client の `supabase.auth.admin.deleteUser(uid)` を実行して Supabase Auth からアカウントを物理削除する
  - DBクレンジング中にエラーが発生した場合は、Authからの削除を実行せず、処理を中断して 500 エラーを返す
  - Authからの削除でエラーが発生した場合は、`console.error` で警告ログを出力した上で、手動クリーンアップ用にログを残してレスポンスを制御する
  - _Depends: 2.1_
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2_
  - _Boundary: DeleteAccountAPI_

- [x] 4. Validation: 結合テストの実装と検証
- [x] 4.1 退会APIの結合テストコードの更新と実行
  - `tests/api/delete-account.test.ts` を拡張し、クレンジング呼び出しのモックテスト、および Auth 削除が呼ばれることのテストケースを追加する
  - クレンジングDB更新でエラーが発生した際に、Auth削除が呼び出されず 500 エラーになるテストケースを追加する
  - `npm run test` を実行し、退会APIを含むすべてのテストスイートが正常にパスすることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 5.1, 5.2_
  - _Boundary: DeleteAccountAPI_
