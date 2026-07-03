# Brief: supabase-storage-migration

## Problem
ファイルストレージが Firebase Storage（Google Cloud Storage）に依存しており、クライアントサイド（`storage.ts`）とサーバーサイド（`storage-admin.ts`）の両方で Firebase SDK を使用している。Supabase Storage（S3互換）への移行が必要。

## Current State
- `src/services/storage.ts`: クライアントサイドストレージ操作（`uploadImage`, `deleteImage`, `uploadQuizCover`, `getSnsLogoUrl` + 各種パスヘルパー）
- `src/services/storage-admin.ts`: サーバーサイドストレージ操作（`uploadQuizCoverBuffer`, `uploadTemporaryGenreIconBuffer` — Firebase Admin SDK 使用）
- `storage.rules`: Firebase Storage セキュリティルール（MIME タイプ・サイズ制限、認証チェック）
- Firebase Storage URL パターン: `firebasestorage.googleapis.com` / `storage.googleapis.com`
- 画像バリデーション: `src/lib/genre-icon-upload.ts`（SVG禁止、PNG/JPEG/GIF のみ）

## Desired Outcome
- 全ストレージ操作が Supabase Storage SDK を使用
- ストレージバケット（quizzes, users, genres, sns-logos）が Supabase に作成
- RLS ポリシーでアクセス制御（MIME タイプ・サイズ制限含む）
- クライアントサイドアップロードが `supabase.storage.from().upload()` を使用
- サーバーサイドアップロードが Supabase サーバークライアント（Service Role Key）を使用
- ダウンロード URL が Supabase Storage のパブリック URL / Signed URL に変更

## Approach
Firebase Storage のバケット構造をそのまま Supabase Storage バケットにマッピング。クライアントサイドは `supabase.storage.from('bucket').upload(path, file)` に書き換え。サーバーサイドは Service Role Key を使用した特権アップロード。URL パターンは Supabase のパブリック URL（`/storage/v1/object/public/bucket/path`）に統一。

## Scope
- **In**:
  - `src/services/storage.ts` の全面書き換え（Supabase Storage SDK）
  - `src/services/storage-admin.ts` の全面書き換え（Supabase サーバークライアント）
  - Supabase Storage バケット作成（quizzes, users, genres, sns-logos）
  - Storage RLS ポリシー設定（認証チェック、ファイルパスベースのアクセス制御）
  - `deleteImage` の URL パターン判定更新（`firebasestorage.googleapis.com` → Supabase URL）
  - パスヘルパー（`getQuizCoverPath` 等）の維持（パス構造は変更不要）
  - 関連 API Routes（`ai-generate-thumbnail`, `generate-icon`, `migrate-icon`）のストレージ呼び出し更新
  - `src/lib/genre-icon-upload.ts` のバリデーション維持（SVG禁止ルール）
- **Out**:
  - 既存 Firebase Storage 内のファイルの物理移行
  - DB 内の画像 URL 参照の一括更新

## Boundary Candidates
- クライアントサイドストレージ操作
- サーバーサイドストレージ操作
- ストレージセキュリティポリシー

## Out of Boundary
- データベースクエリの変更
- 認証フローの変更
- UI コンポーネントの変更

## Upstream / Downstream
- **Upstream**: `supabase-foundation`（ストレージバケット・RLS の基盤定義）
- **Downstream**: `supabase-cleanup`

## Existing Spec Touchpoints
- **Extends**: なし
- **Adjacent**: `quizetika-core`（ストレージサービスの利用元）

## Constraints
- Supabase Storage はファイルサイズ制限をバケットレベルで設定可能（Firebase の `storage.rules` と同等）
- MIME タイプ制限はクライアントサイドバリデーション + RLS ポリシーの二重チェック
- パブリックバケット vs プライベートバケット: SNS ロゴ等は public、ユーザーアップロードは RLS 保護
