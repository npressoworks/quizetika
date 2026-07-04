# Implementation Tasks - supabase-storage-migration

- [ ] 1. 基礎: 共有パスユーティリティとバケット公開設定
- [x] 1.1 バケット/パス解決ユーティリティの実装
  - 先頭セグメントをバケットID、残りをオブジェクトパスとして解決する関数を実装する（例: `quizzes/{quizId}/cover_x.png` → バケット `quizzes` とオブジェクトパス `{quizId}/cover_x.png`）。先頭スラッシュ付きパス（`/sns-logos/{name}.png` 形式）にも対応する
  - Supabase Storage の公開URLパターン（`.../storage/v1/object/public/{bucket}/{path}`）を解析し、一致しない場合は `null` を返す関数を実装する
  - 正常系（各バケット向けパス、先頭スラッシュあり/なし）と非対象URL（旧 Firebase Storage URL・外部アバターURL等で `null` が返る）の単体テストを作成する
  - 成果物確認: `resolveBucketAndPath('quizzes/q1/cover_1.png')` が `{ bucket: 'quizzes', objectPath: 'q1/cover_1.png' }` を返し、`parseSupabasePublicUrl('https://.../firebasestorage.googleapis.com/...')` が `null` を返すことをテストで確認する
  - _Requirements: 1.1, 2.1_

- [x] 1.2 ストレージバケット公開設定マイグレーションの追加
  - `quizzes`／`users`／`genres` バケットの `public` フラグを `true` に変更する追加マイグレーションを作成する（`sns-logos` は既存のまま変更不要）
  - 既存の書き込み・削除RLSポリシー（認証済みかつ非BANユーザー限定）には一切変更を加えないことを確認する
  - マイグレーションをローカル Supabase 環境に適用し、対象3バケットが `public: true` になっていることを `storage.buckets` テーブルの参照で確認する
  - 成果物確認: ローカル環境で `select id, public from storage.buckets` を実行し、`quizzes`／`users`／`genres`／`sns-logos` すべてが `public = true` であることを確認する
  - _Requirements: 4.1, 4.2, 4.3, 4.4_

- [ ] 2. コア: ストレージサービス層の実装
- [ ] 2.1 (P) クライアントサイドストレージサービスの実装
  - `uploadImage`／`uploadQuizCover` を、既存の MIME タイプ・サイズ検証を維持したまま、パス解決ユーティリティでバケット/パスを求め Supabase Storage へアップロードし公開URLを返す実装に書き換える
  - `deleteImage` を、URL解析ユーティリティで Supabase 公開URLパターンに一致する場合のみ対象オブジェクトを削除し、一致しない場合（旧 Firebase URL・外部アバター等）は何もせず正常終了する実装に書き換える
  - `getSnsLogoUrl` を `sns-logos` バケットの公開URL取得に書き換える（既存のインメモリキャッシュ挙動は維持する）
  - パスヘルパー（`getQuizCoverPath`／`getQuestionImagePath`／`getUserAvatarPath`／`getGenreIconPath`）の戻り値構造は変更しない
  - 既存の単体テストを Supabase クライアントのモックベースに書き換え、MIME/サイズ異常系・SNSロゴキャッシュ・削除URL判定の期待値を維持する
  - 成果物確認: `uploadQuizCover` が `.../storage/v1/object/public/quizzes/...` 形式のURLを返し、旧 Firebase URL を渡した `deleteImage` が例外を出さず正常終了することをテストで確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 5.2_
  - _Boundary: storage.ts (Client Storage Service)_
  - _Depends: 1.1_

- [ ] 2.2 (P) サーバーサイド特権ストレージサービスの実装
  - `uploadQuizCoverBuffer`／`uploadTemporaryGenreIconBuffer` を、Service Role Key を用いた Supabase 管理クライアント経由のアップロードに書き換え、公開URLを返す実装にする
  - ジャンルアイコンの一時保存先（`genres/temp/...`）から本パス（`genres/{genreId}/...`）への移動を行う新規関数を追加し、移動元URLの検証（対象バケット・`temp/` 配下であること）を行う
  - 既存の単体テストを Supabase 管理クライアントのモックベースに書き換え、新規移動関数について正常系（移動後の公開URL返却）と異常系（不一致な移動元URL）のテストを追加する
  - 成果物確認: `uploadTemporaryGenreIconBuffer` が `genres/temp/...` 配下の公開URLを返し、新規移動関数が `genres/{genreId}/...` 配下の公開URLを返すことをテストで確認する
  - _Requirements: 3.1, 3.2, 5.1_
  - _Boundary: storage-admin.ts (Server Storage Service)_
  - _Depends: 1.1_

- [ ] 3. 統合: ジャンルアイコン移行APIルートの配線
- [ ] 3.1 migrate-icon ルートのストレージ操作集約
  - `migrate-icon` ルートが直接行っていたバケットのコピー・削除操作を、サーバーサイドストレージサービスの新規移動関数呼び出しに置き換える
  - 既存のリクエストバリデーション（必須パラメータ、ジャンルID形式、認証）はそのまま維持する
  - 移動元URLの妥当性判定を Supabase の一時アイコンURLパターンに合わせて更新する
  - 成果物確認: 有効な一時アイコンURLを指定した `POST /api/genres/migrate-icon` が `genres/{genreId}/...` 配下の恒久公開URLを返し、不正な移動元URLを指定した場合は400エラーを返すことを確認する
  - _Requirements: 5.1_
  - _Depends: 2.2_

- [ ] 4. 検証: 全体結合とテストスイート確認
- [ ] 4.1 型チェックとテストスイート全体の確認
  - すべてのストレージ関連サービス・APIルートが Supabase Storage ベースの実装へ切り替わった状態で `npm run build` を実行する
  - TypeScript コンパイラが一切の型エラーを報告せず、Next.js プロジェクトのビルドが100%成功することを確認する
  - Jest テストスイート全体を実行し、書き換えたストレージ関連テストを含む全テストがパスすることを確認する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 2.1, 2.2, 3.1, 3.2, 5.1, 5.2_
  - _Depends: 2.1, 2.2, 3.1_

- [ ] 4.2 匿名アクセスとバケット制御の統合検証
  - ローカル Supabase 環境で、未認証セッションから `quizzes`／`users`／`genres` バケットの公開URLへアクセスでき、画像が取得できることを確認する
  - 許容MIMEタイプ外または容量上限を超えるファイルのアップロードがバケットレベルで拒否されることを確認する
  - `migrate-icon` エンドポイント経由で一時アイコンが本パスへ移動し、移動後に一時ファイルが存在しなくなることを確認する
  - _Requirements: 4.1, 4.2, 4.3, 4.4_
  - _Depends: 4.1_
