# Implementation Plan

- [x] 1. Foundation: ジャンル削除DB関数の追加
- [x] 1.1 `delete_genre_with_reassignment` PL/pgSQL関数を新規マイグレーションとして追加する
  - 紐づく既存クイズが0件の場合は再割当てをスキップして `metadata_genres` から削除のみ行う
  - 紐づく既存クイズが1件以上ある場合、指定された再割当て先へ `quizzes.genre`/`quizzes.canonical_genre_id` を一括更新してから削除する
  - 削除対象ジャンル不存在（`genre-not-found`）、再割当て先未指定（`reassign-required`）、再割当て先不存在（`invalid-reassign-target`）、削除対象と再割当て先が同一（`same-genre`）の各異常系で例外を送出し、途中まで実行された変更がロールバックされることを確認する
  - Observable: マイグレーション適用後、関数を直接呼び出すテストで正常系2パターン（0件時/N件時）と異常系4パターンすべてが期待通りの戻り値・例外・DB状態になることを確認できる
  - _Requirements: 3.1, 3.2, 3.3, 3.7, 3.8_
  - _Boundary: DeleteGenreFunction_

- [ ] 2. Core: ジャンル削除API
- [x] 2.1 (P) 削除対象ジャンルに紐づく既存クイズ件数を返すAPIを実装する
  - `GET /api/admin/genres/:id/usage` で `authorizeAdmin()` 相当の認可チェックを行う
  - 対象ジャンルが存在しない場合は404を返す
  - Observable: 認可済みリクエストで `{ quizCount: number }` が返り、非管理者リクエストは401/403、存在しないIDは404になることをテストで確認できる
  - _Requirements: 2.2_
  - _Boundary: GenreUsageApi_

- [x] 2.2 (P) ジャンル削除・既存クイズ再割当てを実行するAPIを実装する
  - `DELETE /api/admin/genres/:id` で `authorizeAdmin()` 相当の認可チェックを行う
  - リクエストボディの `reassignToGenreId` を `delete_genre_with_reassignment` へ橋渡しし、関数からの例外メッセージを400/404のHTTPステータスへマッピングする
  - Observable: 正常系で `{ success: true, reassignedCount: number }` が200で返り、`genre-not-found`→404、`same-genre`/`reassign-required`/`invalid-reassign-target`→400、非管理者→401/403になることをテストで確認できる
  - _Requirements: 3.1, 3.2, 3.3, 3.6, 3.7, 3.8_
  - _Boundary: GenreDeleteApi_
  - _Depends: 1.1_

- [ ] 3. Core: 削除UIコンポーネントと一括投入UIの移動
- [x] 3.1 (P) 削除確認・再割当て先選択ダイアログコンポーネントを新規作成する
  - 影響クイズ件数が取得中の間はローディング表示のみ行う
  - 影響クイズ件数が1件以上のとき、削除対象ジャンル自身を除いた選択肢で再割当て先を選択させ、未選択時は確定操作を無効化する
  - 影響クイズ件数が0件のとき、再割当て先選択を表示せず通常の削除確認のみ行う
  - キャンセル操作では選択状態を破棄し確定コールバックを呼ばない
  - Observable: 影響件数0件/1件以上それぞれのケースで、確定ボタンの活性状態と表示内容が仕様通りになることをコンポーネントテストで確認できる
  - _Requirements: 2.2, 2.3, 2.4, 2.5, 2.6_
  - _Boundary: DeleteGenreDialog_

- [x] 3.2 (P) 初期ジャンル一括投入UIをモデレーション画面からジャンル管理画面へ移動する
  - `admin/moderation/page.tsx` から一括投入のハンドラ・state・UIブロック（`seed-genres-btn` を含む）を削除する
  - `admin-genres/admin-genres-client.tsx` に同等のロジック・UI（ボタンID `seed-genres-btn` 維持、ローディング状態、成功/失敗メッセージ、一覧の即時更新）を追加する
  - 非管理者には一括投入UIセクションを表示しない
  - Observable: `/admin/genres` に一括投入ボタンとセクションが表示され、`/admin/moderation` には表示されなくなることを画面レンダリングテストで確認できる
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - _Boundary: AdminGenresClient, AdminModerationPage_

- [ ] 4. Integration: ジャンル削除フローの画面統合
- [x] 4.1 ジャンル一覧に削除操作を統合する
  - 各行に削除操作を開始する要素を追加し、開始時に影響クイズ件数取得APIを呼び出してから削除ダイアログを開く
  - ダイアログの確定コールバックで削除APIを呼び出し、成功時は一覧を再取得して成功メッセージを表示し、失敗時はエラーメッセージを表示して対象ジャンルを一覧に残す
  - Observable: 削除操作の開始からダイアログ確定までの一連の操作で、影響クイズ件数の表示、削除実行後の一覧更新、失敗時のエラー表示がそれぞれ画面上で確認できる
  - _Requirements: 2.1, 2.2, 2.3, 2.5, 2.6, 3.4, 3.5_
  - _Depends: 2.1, 2.2, 3.1_

- [ ] 5. Validation: テストの整備
- [x] 5.1 (P) ジャンル削除・影響確認APIの統合テストを追加する
  - 非管理者からの削除・影響確認リクエストが拒否されることを確認する
  - 削除成功時に対象クイズの `canonical_genre_id` が再割当て先へ更新され、対象ジャンルレコードが削除されていることをDB状態で確認する
  - 再割当て先未指定・不正な再割当て先IDのケースでエラーレスポンスになることを確認する
  - Observable: `tests/api/` 配下のテストスイートが全ケースでグリーンになる
  - _Requirements: 2.2, 3.1, 3.2, 3.3, 3.6, 3.7, 3.8_
  - _Depends: 2.1, 2.2_
  - _Boundary: GenreUsageApi, GenreDeleteApi_

- [ ] 5.2 (P) 一括投入UI移動に伴う既存テストを移設・更新する
  - `tests/app/admin/moderation-seed.test.tsx` のシナリオをジャンル管理画面向けのテストへ移設する
  - `e2e/admin-genres.spec.ts` を一括投入UIの新配置に合わせて更新する
  - Observable: 移設後のテストスイートがグリーンになり、モデレーション画面側に一括投入関連のテストが残っていないことを確認できる
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_
  - _Depends: 3.2_
  - _Boundary: AdminGenresClient, AdminModerationPage (テスト移設)_

- [ ] 5.3 ジャンル削除フローのE2Eテストを追加する
  - 影響クイズが存在するジャンルを再割当て先指定の上で削除し、対象クイズのジャンルが変更されたことを確認するシナリオを追加する
  - 影響クイズが存在しないジャンルを再割当て先選択なしで削除できるシナリオを追加する
  - `e2e/admin-genres.spec.ts` に5.2で移設済みの一括投入シナリオへ追記する形で削除シナリオを追加し、ファイル競合を避ける
  - Observable: `e2e/admin-genres.spec.ts` に削除フローの新規シナリオが実行され、削除後のクイズ一覧・ジャンル一覧が期待通りの状態になることを確認できる
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 3.1, 3.2, 3.3, 3.4, 3.5_
  - _Depends: 4.1, 5.2_

## Implementation Notes
- Task 1.1: `delete_genre_with_reassignment` のマイグレーションファイル名は design.md 記載の `20260715000000_...` ではなく、実際の最新マイグレーション `20260717000000_bigquery_export_outbox_claim_rpc.sql` より後になるよう `supabase/migrations/20260718000000_genre_deletion_reassignment.sql` を採用した。以降のタスクでこの関数を参照する際はこのファイル名・RPC名 `delete_genre_with_reassignment(p_genre_id, p_reassign_to_id)` を使うこと。
- Task 2.2: タスク1.1で追加したRPCがSupabase生成型（`src/lib/supabase/database.types.ts`）に未反映だったため、`Functions`型定義に `delete_genre_with_reassignment` のエントリを手動追記した（機械的な型整合パッチ、他エントリは変更なし）。今後DB関数を追加するタスクでも同様の追記が必要になる可能性がある。
- Task 3.2: 一括投入UIをmoderationページから削除した結果、`tests/app/admin/moderation-seed.test.tsx` の一括投入関連2テストが意図通り失敗する状態になっている（対象UIがmoderationページから消えたため）。これはタスク5.2で当該テストをジャンル管理画面向けに移設・修正することで解消する想定。タスク5.2実施時はこの2件の失敗が前提であることに注意。
- Task 4.1: design.mdの記述に軽微な内部矛盾あり（Implementation Notesの文章は失敗時に「ダイアログを閉じる」とあるが、State Managementの状態遷移表とDeleteGenreDialogのコントラクト(`errorMessage`props)は失敗時にダイアログを開いたままエラー表示する設計になっている）。より構造化された記述（状態遷移表・コンポーネントContract）を優先し、失敗時はダイアログを閉じずに `deleteErrorMessage` をダイアログ内表示する実装とした。要件3.5「エラーメッセージを表示し、削除対象ジャンルを一覧に残す」は満たしている。
