# Implementation Plan - supabase-cleanup

- [x] 1. 前提条件検証ツール（MigrationCompletionGate）の実装と初回実行

- [x] 1.1 依存スペック完了状態の検証ロジック（Stage A）を実装する
  - `supabase-auth-migration`, `supabase-core-data`, `supabase-gameplay`, `supabase-storage-migration`, `supabase-governance` の各 `.kiro/specs/*/spec.json` を読み取り、`phase` フィールドを取得する処理を実装する
  - いずれかが `implementation-complete` でない場合に、該当スペック名の一覧を伴う失敗結果を返すロジックを実装する
  - 観測可能な完了条件: 5スペック全ての `phase` を読み取り、完了/未完了スペック名のリストを返す関数がユニットテストで検証できる状態になっている
  - _Requirements: 1.1_

- [x] 1.2 残存 Firebase 参照の検出ロジック（Stage B）を実装する
  - `src/`, `tests/`, `e2e/` を再帰的に走査し、`firebase`, `firebase-admin`, `firebase-admin/*`, `firebase/*` および `src/lib/firebase/` を指すエイリアス（`@/lib/firebase*`、相対パス）への静的 import/require 文を検出する処理を実装する
  - 文字列変数化された動的 import（`import('firebase/firestore')` 形式）も検出対象に含める
  - `firebaseUser`・`firebaseUid` のような識別子名のみの一致（パッケージ import を伴わないもの）を誤検知として除外する
  - 観測可能な完了条件: 既知の生存依存ファイル（`src/services/attempt.ts` 等）を検出しつつ、`firebaseUser` のみを含むファイル（`src/context/auth-context.tsx` 等）を誤検知しないことがユニットテストで確認できる
  - _Requirements: 7.1_

- [x] 1.3 Stage A と Stage B を統合した CLI エントリポイントを実装し初回実行する
  - Stage A と Stage B の結果を統合し、両方 Pass の場合のみ終了コード `0`、いずれか Fail の場合は非ゼロで終了する CLI を実装する
  - Fail 時に未完了スペック名または残存ファイルパスの一覧を標準出力に人間可読な形式で出力する
  - `package.json` に `verify:firebase-removed` npm スクリプトとして登録する
  - 実装したツールを現在のリポジトリに対して実行し、Stage A / Stage B それぞれの合否結果を記録として残す
  - 観測可能な完了条件: `npm run verify:firebase-removed` が実行可能で、現状のリポジトリ状態に対する合否と根拠一覧が出力される
  - _Requirements: 1.2, 1.3, 7.2_

- [x] 2. Firebase パッケージ・初期化コード・設定ファイルの削除

- [x] 2.1 (P) package.json の依存関係を整理する
  - `dependencies` から `firebase`, `firebase-admin` を削除する
  - `devDependencies` から `firebase-tools` を削除する
  - `scripts` から `emulators`, `deploy:rules` を削除する
  - `package-lock.json` を再生成する
  - 観測可能な完了条件: `package.json` および `package-lock.json` に `firebase`／`firebase-admin`／`firebase-tools` のエントリが存在しない
  - _Requirements: 2.1, 2.2, 2.3_
  - _Boundary: DependencyAndConfigPurge (package.json dependencies)_

- [x] 2.2 (P) Firestore 専用の開発スクリプトを廃止する
  - `scripts/seed-test-data.mjs`, `scripts/reset-firestore.mjs`, `scripts/migrate-delete-quizlists.mjs`, `scripts/migrate-quiz-visibility-public.mjs` を削除する
  - `package.json` の `scripts` から `seed:test-data`, `seed:test-data:emulator`, `db:reset`, `db:reset:emulator`, `db:reset-and-seed`, `db:reset-and-seed:emulator` を削除する
  - 観測可能な完了条件: `scripts/` ディレクトリに Firestore 専用スクリプトが存在せず、`package.json` に対応する npm スクリプトエントリが残っていない
  - _Requirements: 2.1, 7.1_
  - _Boundary: DependencyAndConfigPurge (scripts directory and package.json scripts)_

- [x] 2.3 (P) Firebase 初期化コードと設定ファイルを削除する
  - `src/lib/firebase/`（`admin.ts`, `config.ts`, `firestore.ts`）を削除する
  - `.firebaserc`, `firebase.json`, `firestore.indexes.json`, `firestore.rules`, `storage.rules` を削除する
  - 存在する場合は `firebase-debug.log`, `firestore-debug.log` を削除する
  - 削除後に TypeScript の型チェック（`src/lib/firebase/` への参照エラーがないこと）を確認する
  - 観測可能な完了条件: `src/lib/firebase/` と Firebase 設定ファイル一式がリポジトリから存在しなくなり、型チェックが `src/lib/firebase/` 起因のエラーなしで完了する
  - _Requirements: 3.1, 3.2, 3.3, 3.4_
  - _Boundary: DependencyAndConfigPurge (src/lib/firebase and Firebase config files)_

- [x] 2.4 (P) 環境変数テンプレートから Firebase エントリを除去する
  - `.env.local.example` から `NEXT_PUBLIC_FIREBASE_*` および `FIREBASE_SERVICE_ACCOUNT_JSON` コメント行を削除する
  - Supabase に必要な環境変数（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`）のみが残ることを確認する
  - 観測可能な完了条件: `.env.local.example` に Firebase 関連の変数名が一件も含まれない
  - _Requirements: 4.1, 4.2_
  - _Boundary: DependencyAndConfigPurge (.env.local.example)_

- [ ] 3. テストインフラの Supabase 単独構成への再編

- [ ] 3.1 (P) Jest の Firebase 自動モックを除去する
  - `jest.config.js` の `moduleNameMapper` から `^firebase/(.*)$`, `firebase[\/]config$`, `firebase[\/]firestore$` の3エントリを削除する
  - `tests/__mocks__/firebase/`（5ファイル）, `tests/__mocks__/firebase-config.ts`, `tests/__mocks__/firebase-firestore.ts` を削除する
  - 個別のテストファイルが Firebase パッケージを直接 import している箇所があれば、既存の `jest.mock('@/lib/supabase/client')` チェーンモックパターンへ置き換える
  - 観測可能な完了条件: `tests/` 配下を検索して Firebase パッケージへの直接 import が一件も残っていない
  - _Requirements: 5.1, 5.2_
  - _Boundary: TestInfraRealignment (jest.config.js and tests/__mocks__)_

- [ ] 3.2 (P) E2E グローバルセットアップを Supabase ベースに書き換える
  - `e2e/global-setup.ts` の `firebase-admin` によるジャンルマスタ等のフィクスチャ投入処理を、Supabase サーバークライアント（`SUPABASE_SERVICE_ROLE_KEY`）による同等のデータ投入処理に置き換える
  - 既存の重複投入防止（存在チェック）ロジックを踏襲する
  - 観測可能な完了条件: `e2e/global-setup.ts` に `firebase-admin` への import が存在せず、Supabase ローカル環境に対してフィクスチャ投入が成功する
  - _Requirements: 5.2_
  - _Boundary: TestInfraRealignment (e2e/global-setup.ts)_

- [ ] 3.3 (P) Playwright 設定から Firebase Emulator 依存を除去する
  - `playwright.config.ts` の `webServer.env`（CI・ローカル両方）から `FIREBASE_AUTH_EMULATOR_HOST` 等6つの環境変数を削除する
  - コメント中の Firebase Emulator に関する記述を Supabase ローカル環境を前提とした文言に更新する
  - 観測可能な完了条件: `playwright.config.ts` に Firebase Emulator 関連の環境変数・コメントが残っていない
  - _Requirements: 5.3_
  - _Boundary: TestInfraRealignment (playwright.config.ts)_

- [ ] 4. Steering ドキュメントの Supabase 単独構成への更新

- [ ] 4.1 (P) tech.md を更新する
  - 技術スタック記述から Firebase・Supabase 併存に関する記述を除去し、Supabase 単独構成の記述に更新する
  - Phase 1-34 で記録済みの既存の意思決定・変更履歴は削除せず保持する
  - 観測可能な完了条件: `tech.md` の「移行中」を示す記述が Supabase 単独構成の記述に置き換わっている
  - _Requirements: 6.1, 6.4_
  - _Boundary: SteeringDocumentationSync (tech.md)_

- [ ] 4.2 (P) structure.md を更新する
  - ディレクトリパターン記述から `src/lib/firebase/` および Firebase 併存を前提とした記述を除去する
  - 観測可能な完了条件: `structure.md` に `src/lib/firebase/` への言及が残っていない
  - _Requirements: 6.2, 6.4_
  - _Boundary: SteeringDocumentationSync (structure.md)_

- [ ] 4.3 (P) security.md を更新する
  - Firebase Security Rules に関する記述（§7 Firebase Storage のアップロード制限、§9 Supabase RLS と Firestore Security Rules の並存）を Supabase RLS ベースの記述に統一・削除する
  - 観測可能な完了条件: `security.md` に Firestore/Firebase Security Rules 併存を前提とした記述が残っていない
  - _Requirements: 6.3, 6.4_
  - _Boundary: SteeringDocumentationSync (security.md)_

- [ ] 5. 最終検証: 残存参照の再確認とビルド・テストゲート

- [ ] 5.1 MigrationCompletionGate を再実行し残存参照ゼロを確認する
  - タスク1で実装したツールの Stage B を再実行し、削除・更新作業完了後のソースツリーに Firebase 参照が残っていないことを確認する
  - 検出された場合は該当タスクに差し戻し、ゼロになるまで完了と判定しない
  - 観測可能な完了条件: `npm run verify:firebase-removed` の再実行が Stage A・Stage B ともに終了コード `0` で完了する
  - _Requirements: 7.1, 7.2_
  - _Depends: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3_

- [ ] 5.2 ビルド検証を実行する
  - `npm run build` を実行し、エラーなく成功することを確認する
  - 失敗した場合は `spec.json` の `phase` を `implementation-complete` に更新しない
  - 観測可能な完了条件: `npm run build` が終了コード `0` で完了する
  - _Requirements: 3.4, 8.1, 8.3_

- [ ] 5.3 テストスイート検証を実行する
  - `npm run test` および `npm run test:e2e` を実行し、Firebase 依存に起因する失敗なく全テストが成功することを確認する
  - 失敗した場合は `spec.json` の `phase` を `implementation-complete` に更新しない
  - 観測可能な完了条件: `npm run test` と `npm run test:e2e` がいずれも終了コード `0` で完了する
  - _Requirements: 5.4, 8.2, 8.3_
