# Requirements Document

## Introduction
Firebase → Supabase 完全移行プロジェクトの基盤スペック。プロジェクト全体のバックエンド基盤を Firebase（Firestore, Auth, Storage）から Supabase（PostgreSQL, Auth, Storage）に完全移行するにあたり、最初に構築すべき共通基盤を定義する。具体的には、Supabase クライアント初期化層、PostgreSQL テーブルスキーマ（DDL）、Row Level Security（RLS）ポリシー、ストレージバケット定義、ローカル開発環境セットアップを包含する。後続の全移行スペック（supabase-auth-migration, supabase-core-data, supabase-gameplay, supabase-storage-migration, supabase-governance, supabase-cleanup）はこの基盤に依存する。

## Boundary Context
- **In scope**: Supabase プロジェクト初期化、クライアントユーティリティ、全テーブル DDL、RLS ポリシー、ストレージバケット定義、インデックス設計、型生成基盤、環境変数テンプレート、ローカル開発環境
- **Out of scope**: サービス層のコード書き換え（`supabase-core-data` 以降が担当）、認証フローの書き換え（`supabase-auth-migration` が担当）、既存 Firestore/Storage データの物理マイグレーション、テストコードの更新（`supabase-cleanup` が担当）
- **Adjacent expectations**: 後続スペックは本スペックで定義されたテーブル構造・RLS ポリシー・クライアント初期化パターンをそのまま利用する。DDL の変更が必要になった場合は追加マイグレーションファイルで対応する。

## Requirements

### Requirement 1: Supabase クライアント初期化

**Objective:** As a 開発者, I want Supabase クライアントを Next.js App Router の各コンテキスト（ブラウザ、サーバー、ミドルウェア）で安全に初期化できるようにしたい, so that 後続の全スペックが統一されたクライアント取得パターンでデータベース・認証・ストレージにアクセスできる

#### Acceptance Criteria
1. The Supabase Foundation shall ブラウザ用クライアントユーティリティ（`src/lib/supabase/client.ts`）を提供し、`'use client'` コンポーネントから呼び出し可能にする
2. The Supabase Foundation shall サーバー用クライアントユーティリティ（`src/lib/supabase/server.ts`）を提供し、Server Components・Server Actions・Route Handlers から Cookie ベースのセッション管理付きで呼び出し可能にする
3. The Supabase Foundation shall ミドルウェア用クライアントユーティリティ（`src/lib/supabase/middleware.ts`）を提供し、Next.js ミドルウェアからセッション更新処理を実行可能にする
4. The Supabase Foundation shall 環境変数 `NEXT_PUBLIC_SUPABASE_URL` と `NEXT_PUBLIC_SUPABASE_ANON_KEY` をクライアント初期化に使用する
5. When サーバー側でRLSをバイパスした特権操作が必要な場合, the Supabase Foundation shall サービスロールキー（`SUPABASE_SERVICE_ROLE_KEY`）を使用した特権クライアントの取得手段を提供する

### Requirement 2: PostgreSQL テーブルスキーマ（DDL）

**Objective:** As a 開発者, I want 全 Firestore コレクションに対応する PostgreSQL テーブルが定義されている, so that 後続スペックでサービス層を書き換える際にテーブルがすぐに利用可能である

#### Acceptance Criteria
1. The Supabase Foundation shall 以下のテーブルをマイグレーションファイルとして定義する: `users`, `follows`, `quizzes`, `questions`, `bookmarks`, `attempts`, `search_logs`, `flags`, `feedback_reports`, `quiz_reviews`, `review_reset_requests`, `reactions`, `notifications`, `announcements`, `admin_logs`, `stripe_processed_events`, `metadata_tags`, `metadata_genres`, `merge_requests`, `genre_requests`, `quiz_lists`, `daily_ai_authoring_counts`
2. The Supabase Foundation shall 各テーブルの主キーに UUID 型（`gen_random_uuid()` デフォルト）を使用する
3. The Supabase Foundation shall 日時フィールドに `timestamptz` 型を使用し、デフォルト値として `now()` を設定する
4. The Supabase Foundation shall 既存の Firestore 配列フィールド（例: `tags`, `questionIds`, `failedQuestionIds`）を用途に応じて PostgreSQL 配列型（`text[]`）または JSONB 型に変換する
5. The Supabase Foundation shall ネストされた構造体フィールド（例: `badges`, `leaderboardFirstPlay`, `snsLinks`）を JSONB カラムまたは正規化された関連テーブルに変換する
6. The Supabase Foundation shall 外部キー制約を適切に設定し、参照整合性を保証する（例: `quizzes.author_id` → `users.id`）
7. The Supabase Foundation shall 列挙型フィールド（例: `status`, `moderationTier`, `category`）を PostgreSQL の `CHECK` 制約または `text` 型 + チェック制約で定義する

### Requirement 3: Row Level Security（RLS）ポリシー

**Objective:** As a システム運用者, I want 全テーブルに対して既存の Firestore Security Rules と同等のアクセス制御が RLS ポリシーとして適用されている, so that 不正なデータアクセスや改ざんがデータベースレベルで防止される

#### Acceptance Criteria
1. The Supabase Foundation shall 全テーブルに対して RLS を有効化する（`ALTER TABLE ... ENABLE ROW LEVEL SECURITY`）
2. The Supabase Foundation shall `users` テーブルに対し、プロフィール読み取りは全ユーザーに許可し、更新は本人のみに制限し、特権フィールド（`moderation_tier`, `reputation_score`, `subscription_tier` 等）のクライアント側からの変更を禁止する RLS ポリシーを定義する
3. The Supabase Foundation shall `quizzes` テーブルに対し、公開範囲（`visibility`）に基づく読み取り制御（public は全員、private は作者のみ、followers は作者＋フォロワー）を RLS ポリシーで実装する
4. The Supabase Foundation shall BAN されたユーザー（`is_banned = true`）による書き込み操作を全テーブルで禁止する RLS ポリシーを定義する
5. The Supabase Foundation shall `admin_logs` テーブルに対し、クライアントからの直接書き込みを禁止し、サーバーサイド（Service Role Key）からのみ書き込み可能にする RLS ポリシーを定義する
6. The Supabase Foundation shall `bookmarks` テーブルに対し、自分のブックマークのみ読み取り・作成・削除可能とする RLS ポリシーを定義する
7. The Supabase Foundation shall `attempts` テーブルに対し、自分の挑戦記録のみ読み取り・作成・更新・削除可能とする RLS ポリシーを定義する
8. The Supabase Foundation shall `notifications` テーブルに対し、自分宛ての通知のみ読み取り・更新（既読マーク）・削除可能とする RLS ポリシーを定義する
9. The Supabase Foundation shall モデレータ以上のロール（`moderator`, `senior_moderator`, `admin`）に対し、`flags` テーブルの読み取り権限を付与する RLS ポリシーを定義する
10. The Supabase Foundation shall `announcements` テーブルに対し、公開済みのお知らせは全ユーザーに読み取り可能とし、書き込みは管理者のみとする RLS ポリシーを定義する

### Requirement 4: PostgreSQL インデックス設計

**Objective:** As a 開発者, I want 既存の Firestore 複合インデックスに対応する PostgreSQL インデックスが定義されている, so that クエリパフォーマンスが維持される

#### Acceptance Criteria
1. The Supabase Foundation shall `quizzes` テーブルに対し、ジャンル別・ステータス別の検索・ソートに対応する複合インデックスを定義する（例: `status` + `canonical_genre_id` + `created_at`）
2. The Supabase Foundation shall `quizzes` テーブルに対し、タグ検索に対応する GIN インデックスを `canonical_tag_ids` カラムに定義する
3. The Supabase Foundation shall `attempts` テーブルに対し、ユーザー別のプレイ履歴取得に対応するインデックスを定義する（例: `user_id` + `completed_at DESC`）
4. The Supabase Foundation shall `quizzes` テーブルに対し、作者別クイズ一覧取得に対応するインデックスを定義する（例: `author_id` + `status` + `visibility` + `created_at DESC`）
5. The Supabase Foundation shall 外部キーカラムに対して自動的にインデックスを作成する

### Requirement 5: ストレージバケット定義

**Objective:** As a 開発者, I want Supabase Storage のバケットとアクセスポリシーが定義されている, so that 後続のストレージ移行スペックでファイルのアップロード・ダウンロードがすぐに利用可能である

#### Acceptance Criteria
1. The Supabase Foundation shall 以下のストレージバケットを作成する: `quizzes`（クイズカバー画像・問題参考画像）、`users`（アバター画像）、`genres`（ジャンルアイコン）、`sns-logos`（SNS ロゴ画像）
2. The Supabase Foundation shall `sns-logos` バケットをパブリックバケットとして設定する（認証不要で読み取り可能）
3. The Supabase Foundation shall `quizzes`, `users`, `genres` バケットに対し、読み取りは全ユーザーに許可し、書き込みは認証済みユーザーのみに制限するストレージポリシーを定義する
4. The Supabase Foundation shall アップロード可能な MIME タイプを `image/png`, `image/jpeg`, `image/gif` に制限するバリデーションルールを定義する
5. The Supabase Foundation shall アップロードファイルサイズの上限を 10MB に設定する

### Requirement 6: ローカル開発環境

**Objective:** As a 開発者, I want ローカル環境で Supabase の全サービス（PostgreSQL, Auth, Storage）を起動・テストできるようにしたい, so that Firebase Emulator に依存せずに開発・デバッグが可能になる

#### Acceptance Criteria
1. The Supabase Foundation shall `supabase init` により Supabase プロジェクト構造（`supabase/` ディレクトリ）を生成する
2. When 開発者が `supabase start` を実行した場合, the Supabase Foundation shall ローカルの PostgreSQL, Auth, Storage, Studio がすべて起動し、マイグレーションが自動適用される状態にする
3. The Supabase Foundation shall ローカル開発環境のシードデータ（初期ジャンルデータ等）をマイグレーションまたはシードスクリプトとして提供する
4. When 開発者が `supabase db reset` を実行した場合, the Supabase Foundation shall データベースが初期状態にリセットされ、全マイグレーションとシードが再適用される

### Requirement 7: 型定義の自動生成基盤

**Objective:** As a 開発者, I want データベーススキーマから TypeScript 型定義を自動生成できるようにしたい, so that サービス層のコードが型安全に記述できる

#### Acceptance Criteria
1. The Supabase Foundation shall `supabase gen types typescript` コマンドにより型定義ファイル（`src/lib/supabase/database.types.ts`）を生成可能にする
2. The Supabase Foundation shall 生成された型定義が全テーブル・全カラムの型情報を含む
3. The Supabase Foundation shall 型生成コマンドを `package.json` の `scripts` に登録する（例: `"gen:types": "supabase gen types typescript --local > src/lib/supabase/database.types.ts"`）

### Requirement 8: 環境変数テンプレート

**Objective:** As a 開発者, I want 必要な Supabase 環境変数の一覧とテンプレートが提供されている, so that プロジェクトのセットアップ時に漏れなく設定できる

#### Acceptance Criteria
1. The Supabase Foundation shall `.env.local.example` に以下の Supabase 関連環境変数を追加する: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`
2. The Supabase Foundation shall `SUPABASE_SERVICE_ROLE_KEY` に `NEXT_PUBLIC_` プレフィックスを付与しない（サーバーサイド専用の機密情報として管理）
3. If 既存の Firebase 環境変数が `.env.local.example` に存在する場合, the Supabase Foundation shall それらをコメントアウトまたは残置し、移行完了後に `supabase-cleanup` スペックで削除されることを明記する

### Requirement 9: RPC（PostgreSQL 関数）の基盤定義

**Objective:** As a 開発者, I want 後続スペックで利用するトランザクション代替の PostgreSQL 関数（RPC）を定義できる基盤が整っている, so that Firestore の `runTransaction` に相当する原子的操作をサーバーサイドから呼び出せる

#### Acceptance Criteria
1. The Supabase Foundation shall 共通ヘルパー関数（BAN チェック、ロール判定等）を PostgreSQL 関数として定義する
2. The Supabase Foundation shall RPC 関数のセキュリティ設定として `SECURITY DEFINER` または `SECURITY INVOKER` を用途に応じて適切に指定する
3. When 後続スペックでドメイン固有の RPC 関数が必要になった場合, the Supabase Foundation shall 追加マイグレーションファイルで拡張可能な構造を維持する
