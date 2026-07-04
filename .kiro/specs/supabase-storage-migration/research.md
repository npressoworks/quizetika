# Research & Design Decisions Template

## Summary
- **Feature**: `supabase-storage-migration`
- **Discovery Scope**: Extension（既存 Firebase Storage サービス層を Supabase Storage へ置換）
- **Key Findings**:
  - `supabase-foundation` の初期マイグレーション（`supabase/migrations/20260702000000_init.sql`）で `quizzes`, `users`, `genres`, `sns-logos` の4バケットと RLS ポリシー（読み取り・書き込み・削除）が**既に作成済み**。本スペックはバケット新規作成ではなく、サービス層の書き換えとバケット公開設定の是正のみを担当する。
  - `quizzes`/`users`/`genres` バケットは `public: false` で作成されているが、ホーム画面・クイズ詳細・ジャンル一覧は**未ログインでも閲覧可能**（`src/middleware.ts` の `authRequiredPaths` に含まれない）。Firebase Storage の `getDownloadURL()` は事実上無期限で誰でもアクセス可能なURLを返していたため、同等の挙動を得るには対象バケットを `public: true` に変更する必要がある。
  - パスヘルパー（`getQuizCoverPath` 等）が返す文字列は `quizzes/{quizId}/cover_{ts}.png` のように**バケット名を先頭セグメントとして含む**。Supabase Storage は `.from(bucket)` でバケットを明示指定するAPIのため、先頭セグメントをバケットIDとして解決し、残りをオブジェクトパスとして使う変換ロジックが必要（パス構造自体は brief.md の要求通り変更しない）。
  - `generate-icon` / `ai-generate-thumbnail` の API Routes は `storage-admin.ts` の関数をそのまま呼び出しているだけで、Storage 固有のロジックを含まないため、関数シグネチャ（引数・戻り値の型）を変えなければ**ルートファイル自体の変更は不要**。
  - `migrate-icon` route のみ `getAdminStorage()` を直接操作しており（Firebase Admin SDK のバケット参照・コピー・削除）、Supabase 版では `storage-admin.ts` に集約した新規関数（一時アイコンの本移動）を呼び出す形に書き換える。

## Research Log

### Storage バケットの公開範囲と匿名アクセス要件
- **Context**: `deleteImage` の URL 判定ロジック書き換えおよび画像表示URLの決定方式を設計する上で、未ログインユーザーへの画像表示可否を確認する必要があった。
- **Sources Consulted**: `src/middleware.ts`（認証必須パス一覧）、`supabase/migrations/20260702000000_init.sql`（バケット定義・RLSポリシー）、`.kiro/steering/product.md`（対象ユースケース：気軽な閲覧）
- **Findings**:
  - `/`, `/quiz/[id]`, `/genres/[genreName]`, `/tags/[tagName]` は認証ガード対象外 → 匿名ユーザーもクイズカバー・ジャンルアイコン・ユーザーアバターを閲覧する。
  - 既存 RLS の `SELECT` ポリシー（`Authenticated Read Access for buckets`）自体は `auth.role()` 制限を持たず事実上匿名にも読み取りを許可しているが、Supabase Storage の `getPublicUrl()` は対象バケットが `public: true` でない場合に機能しない（公開エンドポイントを利用するため）。
- **Implications**: `quizzes`/`users`/`genres` バケットを `public: true` に変更する追加マイグレーションが必要。書き込み・削除は既存の認証必須 RLS ポリシーで引き続き保護されるため、公開範囲の変更は読み取り専用の挙動に限定され、セキュリティ低下はない（Firebase Storage の旧来の公開ダウンロードURL方式と同等）。

### パス構造とバケット解決の対応関係
- **Context**: 既存パスヘルパーの戻り値（`quizzes/{quizId}/...` 等）を維持しつつ、Supabase Storage の `bucket + path` 分離モデルに適合させる方法を検討した。
- **Sources Consulted**: `src/services/storage.ts`（`getQuizCoverPath`, `getUserAvatarPath`, `getGenreIconPath`, `getQuestionImagePath`）、`supabase/migrations/20260702000000_init.sql`（バケットID一覧）
- **Findings**: 各パスヘルパーの先頭セグメント（`quizzes`, `users`, `genres`）は既存バケットIDと1対1で一致する。`sns-logos` も同様（`getSnsLogoUrl` の `/sns-logos/{name}.png` パターン）。
- **Implications**: 共通ユーティリティで「先頭セグメント = バケットID、残り = オブジェクトパス」という変換を行えば、既存のパスヘルパー・呼び出し元コードを変更せずに Supabase Storage へ適合できる。

### `migrate-icon` の一時ファイル移動方式
- **Context**: Firebase 版は `bucket.file().copy()` + `.delete()` で一時アイコンを本番パスへ移動していた。Supabase Storage での等価な操作を確認した。
- **Sources Consulted**: 既存コード `src/app/api/genres/migrate-icon/route.ts`、`@supabase/supabase-js` Storage API（プロジェクト内 `server.ts` の `createAdminClient()` 経由で利用可能な標準メソッド、既存プロジェクト依存の範囲内）
- **Findings**: `@supabase/supabase-js` の Storage クライアントは同一バケット内のオブジェクト移動を1回のAPI呼び出しで行うメソッドを提供しており、コピー＋削除の2段階操作より単純かつアトミックに近い。
- **Implications**: `storage-admin.ts` に一時アイコン移動専用の関数を追加し、`migrate-icon` route からの直接的な Storage バケット操作を撤廃してサービス層に集約する（既存の構成原則「サービス層がストレージ操作を所有する」に整合）。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| バケット `public: true` 化 + `getPublicUrl()` | 対象バケットの公開フラグを是正し、Firebase 同様の永続公開URLを発行 | 実装最小・追加APIコール不要・既存 URL 判定パターンと親和性が高い | 書き込み保護は RLS に依存（既存ポリシーで担保済み） | 採用 |
| Signed URL 方式 | `createSignedUrl()` で期限付きURLを発行 | 読み取りアクセスをより厳格に制御可能 | 期限切れ・再発行の管理コストが増え、DB保存済みの恒久URL方針と不整合 | 却下 |
| サーバープロキシ配信 | Next.js API Route 経由で Service Role Key によりストリーミング配信 | アクセス制御を完全にアプリ側で制御可能 | レイテンシ増・サーバー負荷増・既存の「URLをそのままDBに保存」設計と乖離 | 却下 |

## Design Decisions

### Decision: 対象バケットの公開設定是正
- **Context**: `quizzes`/`users`/`genres` バケットが `public: false` のままでは匿名ユーザーへの画像表示ができず、既存の未ログイン閲覧要件（ホーム・クイズ詳細・ジャンル一覧）を満たせない。
- **Alternatives Considered**:
  1. Signed URL 方式 — 期限管理コストが高い
  2. サーバープロキシ配信 — レイテンシ・サーバー負荷増
- **Selected Approach**: 新規マイグレーションで `quizzes`/`users`/`genres` の `public` を `true` に変更し、`getPublicUrl()` で恒久URLを発行する。
- **Rationale**: Firebase Storage の `getDownloadURL()` と同等の恒久公開URL方式を維持でき、既存の「URLをそのままDBフィールドへ保存する」設計を変更せずに済む。書き込み・削除は既存 RLS ポリシーで認証済み・非BANユーザーに限定されたまま。
- **Trade-offs**: 読み取りアクセス制御をアプリケーション層（RLS）からバケット公開設定に一部委譲する。オブジェクトパスを知っていれば誰でも読み取れるが、パスにはタイムスタンプが含まれ推測は困難であり、Firebase 版と同等のセキュリティレベルを維持する。
- **Follow-up**: マイグレーション適用後、匿名セッションでの画像表示をローカル Supabase 環境で確認する。

### Decision: パス→バケット解決ユーティリティの新設
- **Context**: 既存パスヘルパーはバケット名を先頭セグメントに含む文字列を返すが、Supabase Storage API は `bucket` と `path` を分離して要求する。
- **Alternatives Considered**:
  1. 各パスヘルパーの戻り値からバケット名セグメントを削除する — 呼び出し元・保存済みパス文字列との後方互換性が崩れる
  2. 各アップロード関数内で個別にバケット名を分岐処理する — 重複コードが増える
- **Selected Approach**: `src/lib/storage-path.ts`（新規）に `resolveBucketAndPath(path: string)` と `parseSupabasePublicUrl(url: string)` を定義し、`storage.ts` / `storage-admin.ts` の双方から共有する。
- **Rationale**: パスヘルパーの戻り値・既存パス構造を変更せずに、Supabase の bucket/path 分離モデルに適合できる。純関数ライブラリとして `src/lib/` に配置する既存の構成原則（`structure.md`）に一致する。
- **Trade-offs**: 新規ファイルが1つ増えるが、クライアント/サーバー双方の重複ロジックを避けられる。

### Decision: `migrate-icon` の Storage 操作をサービス層へ集約
- **Context**: 現行実装は API Route が直接 Firebase Admin Storage バケットを操作しており、ストレージ操作の一貫した所有権（`storage-admin.ts`）から外れている。
- **Alternatives Considered**:
  1. Route 内で Supabase Admin クライアントを直接操作するコードに置換 — 既存の境界逸脱を温存してしまう
- **Selected Approach**: `storage-admin.ts` に一時アイコンの本移動を担う関数を追加し、route はバリデーションと当該関数呼び出しのみを行う。
- **Rationale**: `structure.md` の「サービス層がストレージ操作を所有する」原則に整合させ、今後のストレージ実装変更の影響範囲をサービス層に閉じ込める。
- **Trade-offs**: なし（既存の逸脱を是正する変更のため）

## Risks & Mitigations
- バケット公開設定変更により意図せず全オブジェクトが公開範囲になるリスク — 対象を `quizzes`/`users`/`genres` の3バケットに限定し、書き込み・削除は既存 RLS ポリシーのまま維持することで軽減。
- 既存の保存済み Firebase Storage URL（DB内）が `deleteImage` の新URL判定で誤ってスキップされない設計とすることで、削除処理の互換性を担保。
- `migrate-icon` の移動操作失敗時に一時ファイルが残存するリスク — 移動失敗はエラーとして呼び出し元へ伝播し、一時ファイルはTTLベースの手動クリーンアップ対象として許容する（本スペックのOut of scope）。

## References
- 既存コード: `src/services/storage.ts`, `src/services/storage-admin.ts`, `src/lib/supabase/server.ts`, `supabase/migrations/20260702000000_init.sql` — プロジェクト内の確立済みパターンを一次情報として採用（外部Web調査は `@supabase/supabase-js` が既存の統合済み依存関係であるため省略）
