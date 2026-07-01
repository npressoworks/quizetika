# Implementation Plan - supabase-foundation

## Major Tasks

- [ ] 1. Foundation: 環境セットアップとパッケージ設定
- [x] 1.1 パッケージのインストールと npm スクリプト追加
  - `package.json` に `@supabase/supabase-js` および `@supabase/ssr` を開発依存関係/通常依存関係として追加する。
  - `package.json` の `scripts` に、ローカル環境用の TypeScript 型自動生成コマンド `gen:types` を追加する。
  - 成果物確認: `npm install` がエラーなく完了し、パッケージがインストールされること。
  - _Requirements: 7.3_
  - _Boundary: package.json_

- [x] 1.2 環境変数テンプレートの設定
  - `.env.local.example` に `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` を追記する。
  - `SUPABASE_SERVICE_ROLE_KEY` には `NEXT_PUBLIC_` プレフィックスを付与せず、サーバー専用の機密情報である旨のコメントを付記する。
  - 成果物確認: `.env.local.example` に必要な環境変数が過不足なく追加されていること。
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: .env.local.example_

- [x] 1.3 Supabase CLI プロジェクト初期化
  - ローカル開発ディレクトリのルートで `supabase init` を実行し、`supabase/` ディレクトリと `config.toml` を作成する。
  - `supabase/config.toml` 内で、データベースポート、ストレージ、および認証の設定を確認・最適化する。
  - 成果物確認: `supabase/config.toml` が作成され、Supabase の構成初期設定が完了していること。
  - _Requirements: 6.1_
  - _Boundary: supabase/config.toml_

- [x] 2. Core: PostgreSQL DDL とインデックス設計
- [x] 2.1 テーブルスキーマおよびインデックス DDL 定義
  - `supabase/migrations/20260702000000_init.sql` を新規作成する。
  - 22のテーブル（`users`, `quizzes`, `questions` 等）の DDL を定義する。主キーは UUID（`gen_random_uuid()` 優先）、日付は `timestamptz DEFAULT now()` とする。
  - 外部キー制約、チェック制約、および必要なインデックス（`quizzes` の検索/ソート複合インデックス、タグ検索用 GIN インデックス等）を定義する。
  - 成果物確認: SQL マイグレーションファイルに全テーブルとインデックス、外部キー制約が定義されていること。
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 4.1, 4.2, 4.3, 4.4, 4.5_
  - _Boundary: supabase/migrations/_

- [x] 2.2 (P) 共通ヘルパー関数および RPC 定義
  - `supabase/migrations/20260702000000_init.sql` または追加のマイグレーションファイルに、RLS で利用する共通ヘルパー関数（`is_not_banned` 等）を定義する。
  - 関数定義には `SECURITY DEFINER` または `SECURITY INVOKER` を適切に設定し、データベース内アクセスを最適化する。
  - 成果物確認: PostgreSQL 関数が SQL 定義内に含まれており、正常にコンパイル可能な状態であること。
  - _Requirements: 9.1, 9.2, 9.3_
  - _Boundary: supabase/migrations/_
  - _Depends: 2.1_

- [x] 3. Core: RLS（Row Level Security）とストレージバケット定義
- [x] 3.1 データベース RLS ポリシーの定義
  - 各テーブル（`users`, `quizzes`, `bookmarks`, `attempts` 等）に対し、RLS ポリシー（`ENABLE ROW LEVEL SECURITY`）を有効化し、Firestore Rules 準拠のポリシーを定義する。
  - BAN ユーザー（`is_banned = true`）による書き込みを共通で拒否するポリシーを設定する。
  - 成果物確認: SQL マイグレーションファイルに全テーブルに対する RLS 有効化コマンドとポリシーが正しく記述されていること。
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7, 3.8, 3.9, 3.10_
  - _Boundary: supabase/migrations/_
  - _Depends: 2.1, 2.2_

- [x] 3.2 (P) ストレージバケットの作成とアクセスポリシー
  - マイグレーションファイルまたは初期設定として、4つのバケット（`quizzes`, `users`, `genres`, `sns-logos`）の作成と設定を定義する。
  - `sns-logos` は public バケット、他は RLS 制限バケットとし、容量制限（10MB）や MIME タイプ制限（PNG/JPEG/GIF のみ）を適用する。
  - 成果物確認: ストレージバケットおよびストレージ用の RLS ポリシーが SQL または構成内に記述されていること。
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  - _Boundary: supabase/migrations/_

- [ ] 4. Core: Next.js 用 Supabase クライアント初期化
- [ ] 4.1 (P) ブラウザおよびサーバー用クライアント
  - `src/lib/supabase/client.ts` を作成し、ブラウザ環境（Client Components）で動作するクライアントを実装する。
  - `src/lib/supabase/server.ts` を作成し、サーバー環境（Server Components, Actions, API）で動作する Cookie 連携クライアントを実装する。
  - 成果物確認: 各初期化ファイルが正しくエクスポートされ、静的コンパイルをパスすること。
  - _Requirements: 1.1, 1.2_
  - _Boundary: src/lib/supabase/_

- [ ] 4.2 (P) ミドルウェア用セッション更新および特権クライアント
  - `src/lib/supabase/middleware.ts` を作成し、Next.js ミドルウェア環境で動作するセッション更新クライアントを実装する。
  - `src/lib/supabase/server.ts`（または独立したファイル）に、特権操作用のサービスロールクライアント初期化関数を実装する。
  - 成果物確認: 各ファイルがエラーなく作成され、型エラーなく定義されていること。
  - _Requirements: 1.3, 1.5_
  - _Boundary: src/lib/supabase/_
  - _Depends: 4.1_

- [ ] 5. Validation: ローカル検証と型自動生成
- [ ] 5.1 ローカル Supabase 起動と DDL マイグレーション適用テスト
  - ローカル環境で Docker を起動し、`supabase start` を実行して PostgreSQL, Auth, Storage を起動する。
  - 定義したマイグレーション SQL とシードデータ（`supabase/seed.sql`）が正常に適用され、エラーが発生しないことを確認する。
  - `supabase db reset` が正常に機能することを確認する。
  - 成果物確認: ローカル Supabase エミュレーターがエラーなく正常に起動し、全マイグレーションとシードが自動適用されること。
  - _Requirements: 6.2, 6.3, 6.4_
  - _Boundary: supabase/_
  - _Depends: 1.3, 2.1, 3.1, 3.2_

- [ ] 5.2 TypeScript 型定義の自動生成テスト
  - `supabase start` で起動したローカルデータベースから、`npm run gen:types` コマンドを実行して `src/lib/supabase/database.types.ts` を自動生成する。
  - 生成されたファイルに、`users` や `quizzes` 等のテーブル型が正しく出力されていること、および `types.ts` ファイルへのインポートに型エラーが発生しないことを検証する。
  - 成果物確認: `database.types.ts` が正常に生成され、クライアント初期化コード（`client.ts`, `server.ts`）に読み込んでも型エラーがないこと。
  - _Requirements: 7.1, 7.2_
  - _Boundary: src/lib/supabase/database.types.ts_
  - _Depends: 4.1, 5.1_
