# Requirements Document - supabase-cleanup

## Introduction

本仕様書は、Firebase → Supabase 段階移行（`.kiro/steering/roadmap.md` Phase 35）の最終工程として、全ドメイン移行完了後に Firebase 関連のパッケージ・初期化コード・設定ファイル・テストインフラを完全に削除し、Steering ドキュメント（`tech.md` / `structure.md` / `security.md`）を Supabase 単独構成へ全面更新するための要件を定義します。本スペックはコードベースの新規機能追加やサービス層のビジネスロジック変更を行わず、既存移行済みコードが正しく動作する前提のもとで Firebase 依存の痕跡を除去することにのみ責任を持ちます。

## Boundary Context

- **In scope**:
  - `package.json` からの `firebase` / `firebase-admin` パッケージ削除と `package-lock.json` の再生成
  - `src/lib/firebase/` ディレクトリおよび Firebase 設定ファイル（`.firebaserc`, `firebase.json`, `firestore.indexes.json`, `firestore.rules`, `storage.rules`）の削除
  - Firebase 関連環境変数（`NEXT_PUBLIC_FIREBASE_*`, `FIREBASE_*`）の `.env.local.example` からの除去
  - テストモック（`tests/__mocks__/firebase/`）および E2E 設定（Firebase Emulator 接続設定）の Supabase 用への置き換え
  - `.kiro/steering/tech.md` / `structure.md` / `security.md` の Supabase 単独構成への全面更新
  - プロジェクト全体に対する残存 Firebase 参照の網羅的検出と是正
  - `npm run build` / `npm run test` / `npm run test:e2e` による最終検証
- **Out of scope**:
  - サービス層（`src/services/*`）のビジネスロジックそのものの書き換え（`supabase-auth-migration` / `supabase-core-data` / `supabase-gameplay` / `supabase-storage-migration` / `supabase-governance` が既に完了させている前提）
  - 既存 Firestore / Firebase Storage 上のデータの物理マイグレーション（`supabase-storage-legacy-migration` の責務）
  - 新規機能の追加や UI の変更
  - `src/components/quiz/quiz-editor.tsx` の `CANONICAL_TAGS` に含まれる技術タグ文字列 `'Firebase'`（ユーザーがクイズに付与する正当なタグ値であり、命名是正の対象外）
- **Adjacent expectations**:
  - 本スペックの実行は `supabase-auth-migration`, `supabase-core-data`, `supabase-gameplay`, `supabase-storage-migration`, `supabase-governance` の全てが実装完了していることを前提とする。いずれかが未完了の場合、本スペックの削除作業は開始できない。
  - Steering ドキュメントの更新は、Phase 1-34 で記録された既存の意思決定・変更履歴を破壊しないことを前提とする。
  - Firebase Storage 上に残存する実データ（画像ファイル）の Supabase Storage への物理移行は、隣接スペック `supabase-storage-legacy-migration` が別途所有する。本スペックは命名（識別子・フィールド名）の是正のみを担当する。

## Requirements

### 1. 前提条件検証

**Objective:** 移行担当チームとして、Firebase 削除作業を開始する前に全ての依存 Supabase 移行スペックが完了していることを検証したい。それにより、まだ Firebase に依存している機能を誤って壊すことを防ぎたい。

#### Acceptance Criteria

1. When Cleanup Process が開始される時, the Cleanup Process shall `supabase-auth-migration`, `supabase-core-data`, `supabase-gameplay`, `supabase-storage-migration`, `supabase-governance` の各 `spec.json` の `phase` が実装完了状態であることを確認する。
2. If いずれかの依存スペックが実装完了状態でない場合, then Cleanup Process shall Firebase 関連ファイルの削除処理を実行せず、未完了のスペック名を明示したエラーを報告する。
3. The Cleanup Process shall 前提条件検証の結果（各依存スペックの完了状況）を記録として残す。

### 2. Firebase パッケージ依存関係の削除

**Objective:** 開発者として、Firebase の npm パッケージがプロジェクトから完全に削除された状態にしたい。それにより、使用されていない SDK 依存によるビルドサイズ増加や脆弱性面を排除したい。

#### Acceptance Criteria

1. When 前提条件検証（Requirement 1）が完了した時, the Cleanup Process shall `firebase` パッケージおよび `firebase-admin` パッケージを `package.json` の dependencies から削除する。
2. When パッケージ削除が実行された時, the Cleanup Process shall `package-lock.json` を再生成し Firebase 関連のエントリを含まない状態にする。
3. The プロジェクト shall 依存関係ツリー（`node_modules` 解決結果）に `firebase` および `firebase-admin` を含まない。

### 3. Firebase 初期化コードおよび設定ファイルの削除

**Objective:** 開発者として、Firebase クライアント/サーバー初期化コードと設定ファイルが完全に削除された状態にしたい。それにより、Supabase のみで完結するコードベースを維持したい。

#### Acceptance Criteria

1. When Firebase パッケージ削除（Requirement 2）が完了した時, the Cleanup Process shall `src/lib/firebase/` ディレクトリ配下の全ファイルを削除する。
2. The Cleanup Process shall `.firebaserc`, `firebase.json`, `firestore.indexes.json`, `firestore.rules`, `storage.rules` をリポジトリから削除する。
3. If `firebase-debug.log` または `firestore-debug.log` がリポジトリ内に存在する場合, then Cleanup Process shall これらのログファイルを削除する。
4. When Firebase 初期化コードと設定ファイルの削除が完了した時, the プロジェクト shall `src/lib/firebase/` への参照エラーなしに TypeScript の型チェックを通過する。

### 4. 環境変数テンプレートのクリーンアップ

**Objective:** 開発者として、環境変数サンプルファイルが Supabase の設定のみを示すようにしたい。それにより、新規参加者が不要な Firebase 変数を設定せずに開発を開始できるようにしたい。

#### Acceptance Criteria

1. When 環境変数クリーンアップが実行される時, the Cleanup Process shall `.env.local.example` から `NEXT_PUBLIC_FIREBASE_*` および `FIREBASE_*` 系の全エントリを削除する。
2. The `.env.local.example` shall 更新後、Supabase に必要な環境変数（`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` 等）のみを含む。

### 5. テストインフラの Supabase 統一

**Objective:** 開発者として、単体テストおよび E2E テストの実行環境が Firebase Emulator やモックに依存しない状態にしたい。それにより、テストが実際の本番スタック（Supabase）を正しく反映するようにしたい。

#### Acceptance Criteria

1. When テストインフラ更新が実行される時, the Cleanup Process shall `tests/__mocks__/firebase/` ディレクトリを削除する。
2. If いずれかのテストファイルが `firebase` または `firebase-admin` モジュール、もしくは `tests/__mocks__/firebase/` を import している場合, then Cleanup Process shall 当該箇所を Supabase 用のテストヘルパー・モックに置き換える。
3. The E2E テスト設定（`playwright.config.ts` 等）shall Firebase Emulator への接続設定を含まず、Supabase ローカル環境（`supabase start`）への接続設定のみを保持する。
4. When `npm run test` および `npm run test:e2e` が実行された時, the テストスイート shall Firebase 依存に起因する失敗なく完了する。

### 6. Steering ドキュメントの Supabase 全面更新

**Objective:** プロジェクトメンバーとして、Steering ドキュメント（`tech.md` / `structure.md` / `security.md`）が Firebase との併存を前提としない、Supabase 単独構成の記述になっていることを確認したい。それにより、以後の開発判断の基準となるドキュメントが実態と一致するようにしたい。

#### Acceptance Criteria

1. When 依存スペックの完了と Firebase コードの削除（Requirement 1-3）が完了した時, the Cleanup Process shall `.kiro/steering/tech.md` の技術スタック記述から Firebase・Supabase 併存に関する記述を除去し、Supabase 単独構成の記述に更新する。
2. The Cleanup Process shall `.kiro/steering/structure.md` のディレクトリパターン記述から `src/lib/firebase/` および Firebase 併存を前提とした記述を除去する。
3. The Cleanup Process shall `.kiro/steering/security.md` の Firebase Security Rules に関する記述を Supabase RLS ベースの記述に統一し、移行期限定のセクション（Firestore Security Rules との並存に関する記述等）を削除または更新する。
4. While Steering ドキュメントを更新する間, the Cleanup Process shall Phase 1-34 で記録済みの既存の意思決定・変更履歴を削除せず保持する。

### 7. 残存 Firebase 参照の全数検出と除去

**Objective:** 開発者として、削除作業完了後にプロジェクト内のどこにも意図しない Firebase 参照が残っていないことを確認したい。それにより、見落としによる実行時エラーやドキュメント不整合を防ぎたい。

#### Acceptance Criteria

1. When Requirement 2-6 の削除・更新作業が完了した時, the Cleanup Process shall `src/`, `tests/`, `e2e/`, 設定ファイル群を対象に `firebase` 文字列参照の網羅的検索を実行する。
2. If 網羅的検索により意図しない Firebase 参照が検出された場合, then Cleanup Process shall 当該参照を修正または削除するまで本スペックを完了と判定しない。

### 8. 最終検証（ビルド・テスト成功ゲート）

**Objective:** 移行担当チームとして、Firebase 完全削除後もプロジェクトが正しくビルド・動作することを検証したい。それにより、クリーンアップが機能破壊を伴わないことを保証したい。

#### Acceptance Criteria

1. When Requirement 1-7 の全ての作業が完了した時, the Cleanup Process shall `npm run build` を実行しエラーなく成功することを確認する。
2. When ビルド検証が成功した時, the Cleanup Process shall `npm run test` および `npm run test:e2e` を実行し、全テストが成功することを確認する。
3. If ビルドまたはテストのいずれかが失敗する場合, then Cleanup Process shall `supabase-cleanup` を完了状態として報告せず、失敗内容を記録する。

### Requirement 9: 残存する Firebase 由来識別子命名の是正

**Objective:** 開発者として、実体は Supabase / Stripe のデータでありながら `firebase` を含む名前が付けられている識別子（変数名・プロパティ名・型フィールド名）が、実態を反映した名前にリネームされた状態にしたい。それにより、新規参加者がコードを読んだ際に「アプリがまだ Firebase に依存している」と誤解することを防ぎたい。

#### Acceptance Criteria

1. When 識別子リネーム作業が実行される時, the Cleanup Process shall 認証コンテキストが公開する `firebaseUser` プロパティおよびそれを参照する全てのコンポーネント・フックを、Firebase を含まない名前にリネームする。
2. When 識別子リネーム作業が実行される時, the Cleanup Process shall エンタイトルメント・サブスクリプション・Stripe Webhook 処理で使用される `firebaseUid` という変数名・型フィールド名を、Firebase を含まない名前にリネームする。
3. While 識別子リネーム作業を行う間, the Cleanup Process shall 認証状態判定・課金プラン判定・Stripe Webhook イベント処理の外部から観測可能な挙動を変更しない。
4. If 既存の Stripe Customer メタデータに過去のキー名でユーザーIDが保存されている場合, then the Cleanup Process shall リネーム後もそのメタデータから対象ユーザーを正しく解決できる状態を維持する。
5. The Cleanup Process shall `src/components/quiz/quiz-editor.tsx` の `CANONICAL_TAGS` に含まれる技術タグ文字列 `'Firebase'` をリネーム対象に含めない。
6. When 識別子リネーム作業が完了した時, the Cleanup Process shall `npm run build` および `npm run test` がリネームに起因するエラーなく成功することを確認する。
