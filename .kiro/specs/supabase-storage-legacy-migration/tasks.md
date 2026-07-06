# Implementation Plan

- [ ] 1. Foundation: 移行ツールの実行基盤と対象データ定義

- [x] 1.1 tsx を devDependency として追加し、npm スクリプトを登録する
  - `package.json` の `devDependencies` に `tsx` を追加する
  - `package.json` の `scripts` に `migrate:legacy-storage`（`tsx scripts/migrate-legacy-storage.ts`）と `verify:legacy-storage-migration`（`tsx scripts/verify-legacy-storage-migration.ts`）を追加する
  - 観測可能な完了条件: `npx tsx --version` がエラーなく実行できる
  - _Requirements: 3.1_

- [x] 1.2 対象データ定義（LEGACY_STORAGE_TARGETS）を実装する
  - `src/lib/legacy-storage-targets.ts` に、対象5テーブル×7カラム×バケットの静的定義（`users.avatar_url`, `quizzes.thumbnail_url`, `quizzes.author_avatar`, `questions.image_url`, `questions.author_avatar`, `metadata_genres.icon_image_url`, `genre_requests.icon_image_url`）を実装する
  - 観測可能な完了条件: 定義された配列が7件のカラム定義を含み、テーブル名・IDカラム名・URLカラム名・対応バケット名の組み合わせが正しいことを単体テストで確認できる
  - _Requirements: 2.1_
  - _Boundary: LegacyAssetInventory_

- [ ] 2. 棚卸しと冪等フィルタの実装

- [x] 2.1 対象カラムの棚卸しクエリと既移行レコード除外ロジックを実装する
  - `src/services/legacy-storage-migration.ts` に `scanLegacyAssets()` を実装し、`LEGACY_STORAGE_TARGETS` の各カラムから `firebasestorage.googleapis.com` を含む値を持つレコードを検出する
  - 検出結果のうち、既存の `parseSupabasePublicUrl()`（`@/lib/storage-path`）でSupabase URL形式と判定できるレコードを除外する（冪等フィルタ）
  - 対象領域（テーブル/カラム）別のレコード件数を集計する機能を実装する
  - 観測可能な完了条件: モックしたSupabase Admin Clientに対し、Firebase URL・Supabase URL・null混在のフィクスチャを与えたテストで、Firebase URLのレコードのみが返却され、テーブル別件数集計が正しいことを確認できる
  - _Requirements: 2.1, 2.2, 7.1_
  - _Boundary: LegacyAssetInventory_
  - _Depends: 1.2_

- [ ] 3. 検証関数（前提条件サンプル検証・最終残存検証）の実装

- [x] 3.1 サンプル読み取り検証関数を実装する
  - `scanLegacyAssets()` の結果から最大5件（総数がそれ未満の場合は全件）を抽出し、各URLへ匿名HTTP GETを行い読み取り可能かを判定する関数を実装する
  - 読み取り可能なレコードが1件もない場合は失敗結果を、1件以上ある場合は成功結果を返す
  - 観測可能な完了条件: `fetch` をモックし、「全件200」「一部200」「全件失敗」の3パターンで、それぞれ期待通りの合否判定が返ることをテストで確認できる
  - _Requirements: 1.1, 1.2, 1.3_
  - _Boundary: LegacyMigrationVerificationGate_
  - _Depends: 2.1_

- [x] 3.2 残存件数検証関数を実装する
  - `scanLegacyAssets()` を再実行し、検出件数が0件かどうかを判定する関数を実装する
  - 残存がある場合は該当レコード（テーブル・カラム・ID）の一覧を結果に含める
  - 観測可能な完了条件: 「残存0件」「残存あり（レコード一覧付き）」の2パターンでテストが通ることを確認できる
  - _Requirements: 9.1, 9.2_
  - _Boundary: LegacyMigrationVerificationGate_
  - _Depends: 2.1_

- [ ] 4. フォールバックコード撤去関数の実装

- [x] 4.1 next.config.ts のエントリ削除関数を実装する
  - `src/lib/legacy-fallback-cleanup.ts` に `removeFirebaseStorageRemotePattern(nextConfigSource: string)` を実装する（ファイルI/Oを行わない純粋関数）
  - `images.remotePatterns` から `hostname: 'firebasestorage.googleapis.com'` を含むエントリを1件削除した文字列を返す
  - 観測可能な完了条件: 対象パターンを含む文字列フィクスチャを与えると `changed: true` かつパターンが除去された文字列が返り、含まないフィクスチャでは `changed: false` かつ内容が変化しないことをテストで確認できる
  - _Requirements: 8.1_
  - _Boundary: LegacyFallbackCodeCleanup_

- [x] 4.2 storage.ts/storage-path.ts のコメント置換関数を実装する
  - `src/lib/legacy-fallback-cleanup.ts` に `updateLegacyUrlComment(sourceCode: string)` を実装する（ファイルI/Oを行わない純粋関数）
  - 対象2ファイルで実際の文言が異なる点に注意する: `src/services/storage.ts` のコメントは `旧 Firebase URL・外部アバター等`（「Storage」を含まない）、`src/lib/storage-path.ts` のdocstringは `旧 Firebase Storage URL・外部URL等`（「Storage」を含む）。両方の異表記を正しく検出・置換できるよう、正規表現（例: `旧 Firebase (Storage )?URL・外部(アバター|URL)等`）または2つの個別リテラル置換のいずれかで両方に対応する
  - いずれも「Supabase 以外の外部URL（Dicebearデフォルトアバター等）」という表現に統一して置換する。既存の非Supabase URLガードのロジック自体（`if` 文等）は変更しない
  - 観測可能な完了条件: `storage.ts` 用フィクスチャ（`旧 Firebase URL・外部アバター等` を含む文字列）と `storage-path.ts` 用フィクスチャ（`旧 Firebase Storage URL・外部URL等` を含む文字列）の両方で、それぞれ正しく置換され `changed: true` が返ることをテストで確認できる
  - _Requirements: 8.2_
  - _Boundary: LegacyFallbackCodeCleanup_

- [ ] 5. レコード単位の移行処理の実装

- [x] 5.1 単一レコードの取得・形式検証・複製・公開確認処理を実装する
  - `src/services/legacy-storage-migration.ts` に、(a) 旧URLへの匿名HTTP GET、(b) 取得結果のMIME形式検証（PNG/JPEG/GIFのみ許可）、(c) 決定的パス `{bucket}/legacy-migrated/{table}-{recordId}-{column}.{ext}` での Supabase Storage への `upsert: true` アップロード、(d) 新URLへのGETによる公開アクセス確認、を順に行う関数を実装する
  - 各段階の失敗は例外を投げず、型付きの失敗理由（取得失敗・形式不一致・アップロード失敗・公開確認失敗）を持つ結果型で返す
  - 観測可能な完了条件: 正常系（取得成功→検証成功→アップロード成功→公開確認成功）と、4種類の異常系（404取得失敗、MIME不一致、アップロード失敗、公開確認失敗）の計5パターンがテストで確認できる
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - _Boundary: LegacyAssetMigrator_
  - _Depends: 2.1_

- [x] 5.2 ドライラン/実行モード切替とDB更新・失敗分離・結果レポートを実装する
  - 5.1 の関数を `scanLegacyAssets()` の各レコードに対して呼び出すオーケストレーション関数を実装する
  - ドライランモード（既定）では Storage/DB への書き込みを一切行わず、対象レコード一覧と想定される新URLのみを結果として返す
  - 実行モード（明示的な指定時のみ）では、5.1 が成功したレコードについてのみ該当テーブルのURLカラムを新URLへ更新する。失敗したレコードはDB値を変更せず、失敗理由を記録して後続レコードの処理を継続する
  - 全件処理後、成功件数・失敗件数・テーブル別内訳・失敗理由一覧を含む結果レポートを生成する
  - 観測可能な完了条件: ドライランモードでDB更新関数・Storageアップロード関数が一度も呼ばれないこと、実行モードで成功レコードのみDB更新されること、失敗レコードのDB値が変更されないこと、レポートの件数集計が入力レコード数と一致することがテストで確認できる
  - _Requirements: 3.1, 3.2, 3.3, 5.1, 5.2, 5.3, 6.1, 6.2, 7.2_
  - _Boundary: LegacyAssetMigrator_
  - _Depends: 5.1_

- [ ] 6. CLIラッパーの実装

- [x] 6.1 (P) migrate-legacy-storage CLIを実装する
  - `scripts/migrate-legacy-storage.ts` を実装し、`--execute` フラグの有無で 5.2 のドライラン/実行モードを切り替えて呼び出す
  - 結果レポート（成功件数・失敗件数・失敗理由一覧、ドライラン時は対象一覧と想定新URL）を標準出力に人間可読な形式で出力する
  - 観測可能な完了条件: `npm run migrate:legacy-storage`（引数なし）がドライラン結果を出力して正常終了し、`npm run migrate:legacy-storage -- --execute` では実行モードの結果レポートを出力することを確認できる
  - _Requirements: 3.1, 3.2, 3.3, 6.2_
  - _Boundary: LegacyAssetMigrator_
  - _Depends: 5.2_

- [x] 6.2 (P) verify-legacy-storage-migration CLIを実装する
  - `scripts/verify-legacy-storage-migration.ts` を実装し、`sample`/`final` の2モードを引数で切り替える
  - `sample` モードは 3.1 のサンプル読み取り検証関数を呼び出し、結果に応じた終了コード（Pass: 0 / Fail: 非ゼロ）で終了する
  - `final` モードは 3.2 の残存件数検証関数を呼び出し、残存がある場合は残存レコード一覧を出力して非ゼロ終了する。残存ゼロの場合のみ `npm run build` と `npm run test` をサブプロセスとして実行し、両方成功した場合にのみ `legacy-fallback-cleanup.ts`（4.1, 4.2）の関数を使って `next.config.ts`・`src/services/storage.ts`・`src/lib/storage-path.ts` を読み込み・変換・書き戻す
  - 観測可能な完了条件: `sample` モードが3.1の判定結果に応じた終了コードを返すこと、`final` モードは残存ありの場合に実ファイルを一切変更せず非ゼロ終了すること、残存ゼロかつビルド・テスト成功の場合のみ実ファイルが変更されることを、一時ディレクトリにコピーしたフィクスチャファイルに対するテストで確認できる（リポジトリの実ファイルを直接書き換えるテストは行わない）
  - _Requirements: 1.1, 1.2, 1.3, 8.1, 8.2, 8.3, 9.1, 9.2, 9.3, 9.4_
  - _Boundary: LegacyMigrationVerificationGate_
  - _Depends: 3.1, 3.2, 4.1, 4.2_

- [ ] 7. 最終検証: 全体のビルド・テストゲート

- [ ] 7.1 リポジトリ全体のビルド・テストを実行する
  - 本スペックで新規追加した全ファイル（`legacy-storage-targets.ts`, `legacy-storage-migration.ts`, `legacy-fallback-cleanup.ts`, 2つのCLIスクリプト、対応するテストファイル）を含めて `npm run build` と `npm run test` を実行する
  - 観測可能な完了条件: `npm run build` と `npm run test` がいずれも終了コード `0` で完了する
  - _Requirements: 9.3_
  - _Depends: 6.1, 6.2_

## Implementation Notes

- Task 6.1（レビュー1回目REJECTED→修正）: `tsx` で直接実行するCLIスクリプト（`scripts/*.ts`）は、Next.js のリクエストライフサイクル外で動くため `.env.local` が自動読み込みされない。`createAdminClient()` 等が `NEXT_PUBLIC_SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` を要求するスクリプトでは、`playwright.config.ts` と同じパターン（`import { loadEnvConfig } from '@next/env'; loadEnvConfig(process.cwd());` をエントリポイント冒頭・`process.env` 参照より前に配置）が必要。Task 6.2（`verify-legacy-storage-migration.ts`）も同じくSupabase接続を行うため、実装時に同じ対応を最初から組み込むこと。
