# Brief: genre-icons

## Problem
ジャンルのアイコン画像のアップロード（手動アップロードおよびAI生成）や移行（承認・永続化）の処理において、現在はローカルサーバーのファイルシステム（`assets/genre`）が直接使用されている。
このため、Vercelなどのサーバーレス環境やマルチインスタンス環境では、一時的に保存した画像が消失したり、インスタンス間で共有・永続化できない問題が発生する。

## Current State
- `POST /api/genres/upload-icon` は手動選択されたファイルをローカルの `assets/genre/temp` に保存する。
- `POST /api/genres/generate-icon` は AI が生成した画像バッファをローカルの `assets/genre/temp` に保存する。
- `POST /api/genres/migrate-icon` は一時URLを解析し、ローカル上で `assets/genre/temp` から `assets/genre/${genreId}` にコピーし、元のファイルを削除する。
- `POST /api/admin/genres`（直接登録）も同様にローカル上でのコピー・削除を行っている。
- `GET /api/assets/genre/[...path]` はローカルファイルシステムから画像アセットを読み取って配信している。

## Desired Outcome
ジャンルのアイコン画像に関するすべてのアップロード・一時保存・正式移行処理が **Firebase Storage** 上で完結し、クライアントからは Firebase Storage の直接公開 URL（`https://storage.googleapis.com/...`）で画像が参照できるようになること。これにより、サーバーレス環境でもアセットの永続化が保証される。

## Approach
アプローチ1（Firebase Storage 直接移行）を採用。
- **一時保存**: `upload-icon` および `generate-icon` は画像を Firebase Storage 内の `genres/temp/${filename}` に保存し、Storage の公開 URL を返却する。
- **正式移行**: `migrate-icon` および `/api/admin/genres` での移行処理は、Firebase Admin Storage SDK（`@google-cloud/storage`）を使用して `genres/temp/${filename}` から `genres/${genreId}/${destFilename}` にファイルをコピーし、コピー成功後に一時ファイルを削除する。
- **配信**: 画像の参照は Storage の直接公開 URL とする。ローカルアセット配信用のAPI (`/api/assets/genre/[...path]`) は原則不要とする。

## Scope
- **In**:
  - `src/services/storage-admin.ts` の `uploadTemporaryGenreIconBuffer` を Firebase Storage（`genres/temp/`）へのアップロードに修正。
  - `src/app/api/genres/upload-icon/route.ts` を Firebase Storage への一時保存に修正。
  - `src/app/api/genres/migrate-icon/route.ts` を Firebase Storage 上でのコピー・削除に修正。
  - `src/app/api/admin/genres/route.ts` の一時画像移行ロジックを Firebase Storage 上でのコピー・削除に修正。
  - ローカルアセット配信API (`src/app/api/assets/genre/[...path]/route.ts`) の不要化（削除または非推奨化）。
  - Firestore 内のジャンル申請（`genreRequests` コレクション）やジャンルマスタ（`metadata_genres` コレクション）に登録される `iconImageUrl` が、Firebase Storage の公開 URL となることの確認。
  - Firebase Storage エミュレータを用いたローカル検証。
- **Out**:
  - ジャンル以外の画像（プロフィール画像など）のアップロード仕様の変更。
  - Firebase Storage 以外の外部ストレージ（S3など）の導入。
  - 本番環境にすでに存在する（もしあれば）ローカルURLを指す古いデータのバッチ移行スクリプト（テストデータなどの対応のみで十分とする）。

## Boundary Candidates
- **Core (Backend API & Services)**: Firebase Storage と直接対話するサービスおよび API ルートが移行ロジックの全責任を持つ。
- **UI Components**: UI 側は返却された `iconImageUrl`（Storage 公開 URL）をそのまま Image src に使用するのみで、アップロード/移行のやり取りは不変とする。

## Out of Boundary
- フロントエンドにおける UI レイアウトやスタイル（Tailwind + shadcn）の変更。

## Upstream / Downstream
- **Upstream**: `quizeum-core` (Firebase / Storage 管理用ヘルパー)
- **Downstream**: `quizeum-moderation-governance-ui` (ジャンル申請・投票UI), `quizeum-play-flow-ui` (ジャンル表示UI)

## Existing Spec Touchpoints
- **Extends**: `quizeum-core` (Storage 連携部分)
- **Adjacent**: `quizeum-moderation-governance-ui`, `quizeum-play-flow-ui`

## Constraints
- 画像のアップロード制限（PNG, JPEG, GIFのみ。SVG禁止。最大2MB以下）のルールを遵守すること。
- Firebase Admin SDK を用いた安全な Storage 操作（コピー、公開設定、削除）を行うこと。
