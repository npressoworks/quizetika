# Requirements Document - supabase-storage-migration

## Introduction
本仕様書は、Quizetika のファイルストレージ機能（クイズカバー画像、ジャンルアイコン、SNSロゴ等の画像アップロード・削除・配信）における Firebase Storage 依存から Supabase Storage への移行に伴うクライアントサイド・サーバーサイドの振る舞い要件を定義します。

## Boundary Context
- **In scope**:
  - クライアントサイドストレージ操作（`src/services/storage.ts`）の Supabase Storage SDK への全面書き換え（`uploadImage`, `deleteImage`, `uploadQuizCover`, `getSnsLogoUrl` 等）
  - サーバーサイドストレージ操作（`src/services/storage-admin.ts`）の Supabase サーバークライアント（Service Role Key）への全面書き換え（`uploadQuizCoverBuffer`, `uploadTemporaryGenreIconBuffer`）
  - Supabase Storage バケット（`quizzes`, `users`, `genres`, `sns-logos`）の作成と RLS ポリシーによるアクセス制御（MIMEタイプ・サイズ制限含む）
  - Firebase Storage URL パターン（`firebasestorage.googleapis.com` / `storage.googleapis.com`）から Supabase Storage の パブリック URL / Signed URL パターンへの判定ロジック更新
  - 関連 API Routes（`ai-generate-thumbnail`, `generate-icon`, `migrate-icon`）のストレージ呼び出し更新
  - 画像バリデーション（`src/lib/genre-icon-upload.ts`、SVG禁止・PNG/JPEG/GIFのみ許可）の維持
- **Out of scope**:
  - 既存 Firebase Storage 内ファイルの物理移行（新規アップロードのみ Supabase 経由とする）
  - データベース（Firestore/Supabase）内の画像URL参照の一括更新
  - データベースクエリ・認証フロー・UIコンポーネントの変更
- **Adjacent expectations**:
  - ストレージバケットおよび RLS ポリシーの基盤は `supabase-foundation` で定義済みであることを前提とします。
  - パスヘルパー（`getQuizCoverPath` 等）が生成するパス構造自体は変更しません。

## Requirements

### 1. クライアントサイドアップロード要件
**Objective:** クイズ作成者として、クイズカバー画像やユーザーアイコン等をアップロードした際、Supabase Storage に確実に保存されるようにしたい

#### Acceptance Criteria
1. When ユーザーが画像アップロード操作（`uploadImage` 等）を実行した時, the ストレージサービス shall `supabase.storage.from(bucket).upload(path, file)` を用いてファイルを対象バケットに保存する。
2. When アップロードが完了した時, the ストレージサービス shall Supabase Storage のパブリック URL（`/storage/v1/object/public/bucket/path`）または Signed URL を呼び出し元に返却する。
3. If アップロード対象ファイルが許可された MIME タイプ（PNG/JPEG/GIF）以外である場合, then ストレージサービス shall アップロードを拒否しエラーを返す。
4. While パスヘルパー（`getQuizCoverPath` 等）が既存のパス構造を返す間, the ストレージサービス shall そのパス構造をそのまま Supabase Storage のオブジェクトパスとして使用する。

### 2. 画像削除要件
**Objective:** クイズ作成者として、不要になった画像を削除した際、Supabase Storage 上のファイルも確実に削除されるようにしたい

#### Acceptance Criteria
1. When ユーザーが `deleteImage` を実行し、対象URLが Supabase Storage のパブリック URL パターンである時, the ストレージサービス shall URL からバケットとパスを解決し、該当オブジェクトを削除する。
2. If 対象URLが旧 Firebase Storage の URL パターン（`firebasestorage.googleapis.com` / `storage.googleapis.com`）である場合, then ストレージサービス shall 削除処理をスキップしエラーとせずに正常終了する。

### 3. サーバーサイド特権アップロード要件
**Objective:** システムとして、API Routes からの画像処理結果（AIサムネイル生成、アイコン生成等）を Service Role Key を用いて安全にアップロードしたい

#### Acceptance Criteria
1. When サーバーサイド処理（`uploadQuizCoverBuffer`, `uploadTemporaryGenreIconBuffer` 等）がバッファ画像をアップロードする時, the ストレージ管理サービス shall Supabase サーバークライアント（Service Role Key）を使用して対象バケットに保存する。
2. The ストレージ管理サービス shall Service Role Key をクライアントサイドのコードやレスポンスに一切含めない。

### 4. ストレージバケットとアクセス制御要件
**Objective:** システム管理者として、各用途のストレージバケットに対して適切な公開範囲とアクセス制御を設定したい

#### Acceptance Criteria
1. The Supabase プロジェクト shall `quizzes`, `users`, `genres`, `sns-logos` の各バケットを保持する。
2. Where バケットが公開用途（例: `sns-logos`）である場合, the ストレージバケット shall パブリック読み取りを許可する。
3. Where バケットがユーザー保護対象（例: `users`）である場合, the ストレージバケット shall RLS ポリシーにより認証済みかつ本人のみが書き込み可能な制御を適用する。
4. If アップロードされるファイルのサイズが許容上限を超える場合, then ストレージバケット shall アップロードを拒否する。

### 5. 関連API Routes更新要件
**Objective:** システムとして、AIサムネイル生成・アイコン生成・アイコン移行を行う API Routes が Supabase Storage を正しく利用できるようにしたい

#### Acceptance Criteria
1. When `ai-generate-thumbnail`, `generate-icon`, `migrate-icon` の各 API Route が画像を保存する時, the API Route shall Supabase ストレージ管理サービス経由でアップロードを実行する。
2. The `src/lib/genre-icon-upload.ts` のバリデーションロジック shall SVGファイルのアップロードを引き続き禁止する。
