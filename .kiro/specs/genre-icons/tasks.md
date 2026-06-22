# Implementation Plan

- [/] 1. Foundation: Storage Service 移行
- [x] 1.1 Firebase Storage 一時保存ヘルパーの修正
  - `src/services/storage-admin.ts` の `uploadTemporaryGenreIconBuffer` を修正し、ローカル保存から Firebase Storage の `genres/temp/` パスへの保存に変更する
  - 保存したアセットに `makePublic()` を設定し、Storage 直接公開 URL を返却する
  - テスト環境およびエミュレータ起動時に、メソッド呼び出しで Storage 上に一時アセットが正常にアップロードできることを確認する
  - _Requirements: 1.1, 1.3_
  - _Boundary: Storage Service_

- [ ] 2. Core API: アップロード・AI生成・移行 API の修正
- [x] 2.1 (P) 手動画像アップロード API の Storage 移行
  - `/api/genres/upload-icon` を修正し、送信された画像データを `genres/temp/` に直接保存するように変更する
  - 既存の `validateGenreIconFile` によるファイル種別（PNG/JPEG/GIFのみ、SVG禁止）および容量（2MB以下）の制限が正しく適用されることを維持する
  - Postman または Curl で有効な画像を送信した際、Firebase Storage の一時 URL が返却されることを確認する
  - _Requirements: 1.1, 1.2_
  - _Boundary: upload-icon API_

- [ ] 2.2 (P) アイコン移行 API の Storage 移行
  - `/api/genres/migrate-icon` を修正し、`genres/temp/` から `genres/${genreId}/` パスへの Storage 間コピー処理に変更する
  - コピー完了後、元の `genres/temp/` の一時アセットを Storage から完全に削除する
  - コピーされた正式ファイルの公開権限付与 (`makePublic`) を行い、正式な Storage 公開 URL を返却する
  - テストリクエストを送信した際、Storage 間でファイルがコピーされ、古いアセットが削除されて正式 URL が返却されることを確認する
  - _Requirements: 2.1, 2.2_
  - _Boundary: migrate-icon API_

- [ ] 2.3 (P) 管理者ジャンル登録 API の Storage 移行
  - `/api/admin/genres` の POST 処理内のアセット移行ロジックを、Storage 間でのコピー・削除に変更する
  - 管理者ユーザーからのリクエスト受信時に、`tempUrl` を検証した上で Storage の正式パスにコピーし、一時ファイルを削除する
  - ジャンル登録後に、`metadata_genres` コレクションの該当ジャンルドキュメントに Storage 公開 URL が正しく保存されることを確認する
  - _Requirements: 2.1, 2.2_
  - _Boundary: admin-genres API_

- [ ] 3. Integration & Cleanup: 不要コンポーネントの削除
- [ ] 3.1 ローカルアセット配信 API の削除
  - 不要となったローカル配信 API `/api/assets/genre/[...path]` (ファイル: `src/app/api/assets/genre/[...path]/route.ts`) を削除する
  - プロジェクト全体のビルドを実行し、該当 API の参照削除に伴う型エラーやリンク切れがないことを確認する
  - _Requirements: 3.1_
  - _Boundary: Asset API_

- [ ] 4. Validation: テストの作成と検証
- [x] 4.1 Unit Test の実装
  - `storage-admin.test.ts` を新規作成し、`uploadTemporaryGenreIconBuffer` が Storage SDK を正しく呼び出してバファをアップロードする処理をモック検証する
  - `npm run test` を実行して、新規追加した Unit Test が正常にパスすることを確認する
  - _Requirements: 1.1, 1.3_
  - _Boundary: Testing_

- [ ] 4.2 E2E Test の実装
  - `e2e/genre-icons.spec.ts` を新規作成し、Playwright による検証コードを記述する
  - ジャンル新設申請画面からの手動アップロード、AI生成、申請可決による Storage 移行、および管理者画面からのジャンル直接作成時に、Storage 公開 URL から正常にアイコン画像が表示されることを検証する
  - `npm run test:e2e` を実行して、新規追加した E2E シナリオがすべてグリーンになることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1_
  - _Boundary: Testing_
