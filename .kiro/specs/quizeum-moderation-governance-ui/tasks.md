# Implementation Plan: quizetika-moderation-governance-ui

## Tasks

### 1. ロール・権限ルートガードの実装
- [x] 1.1 ミドルウェアによるモデレーションルート保護の実装 (P)
  - `src/middleware.ts` を作成または更新し、`/admin/*` および `/community/*` へのアクセスを、ログインユーザーの `moderationTier` や管理者ロールに基づいて厳格に保護・リダイレクトする処理を実装する。
  - _Requirements: 1.1, 2.1_
  - _Boundary: RouteGuard_

### 2. 管理者モデレーション画面のUI実装
- [x] 2.1 審査待ちモデレーションキューおよび通報詳細表示の実装 (P)
  - `src/app/admin/moderation/page.tsx` および `moderation.module.css` を作成し、通報数が5に達して `suspended` となったクイズの審査待ちキューリストを実装する。
  - 各コンテンツカード内に、通報理由（ハラスメント、スパム等）およびプレイヤーのコメント詳細を表示する。
  - _Requirements: 1.2, 1.3_
  - _Boundary: AdminModeration-Queue_
- [x] 2.2 公開復帰・削除アクションおよび特別検証プレビューの実装
  - 「公開に復帰（通報却下）」または「永久非公開化 / 削除」アクションを実行するボタンを設置する。
  - 対象コンテンツ（特にクイズ）をクリックした際に、特別な審査用ヘッダーオーバーレイ付きの「特別検証閲覧ビュー」へ遷移・確認する動線を構築する。
  - _Requirements: 1.4, 1.5_
  - _Boundary: AdminModeration-Action_

### 3. タグ/ジャンルマージリクエスト画面のUI実装
- [x] 3.1 マージ提案起案フォームおよび保留中マージ一覧表示の実装 (P)
  - `src/app/community/merge/page.tsx` および `merge.module.css` に、モデレータが起案する「提案起案」フォームを実装する。
  - 「投票一覧」タブを作成し、現在保留中のマージ提案を一覧カード表示する。
  - ソースタグ/ジャンルをクリックした際、別ウィンドウまたは分割ビューで該当一覧画面を開く確認遷移を実装する。
  - _Requirements: 2.2, 2.3, 2.4_
  - _Boundary: CommunityMerge_
- [x] 3.2 モデレータ加重投票およびリアルタイムプログレスバーの実装
  - 保留提案カードに対し「賛成 👍」「反対 👎」を投票するUIを実装し、シニアモデレータの場合には「重み: x2」として計算・アトミック送信する処理を構築する。
  - `weightedVotesFor` と `weightedVotesAgainst` の数値を基に、賛成率（％）を算出して視覚的に伸び縮みするプログレスバーを表示する。
  - _Requirements: 2.5, 2.6, 2.7_
  - _Boundary: CommunityMerge-Vote_

### 4. ジャンル新設申請・投票画面のUI実装
- [x] 4.1 (P) 新ジャンル申請画面における画像ローカルアップロードの実装
  - 申請フォームから手動選択されたアセットファイルを、Firebase Storage への直接アップロードではなく、ローカル一時保存API経由で一時領域へアップロード保存する処理を構築する。
  - *完了状態*: 申請フォームで画像選択時に一時保存APIが呼び出され、返却された一時アセットURLをプレビューし、申請データにバインドできること。
  - _Requirements: 3.1_
  - _Boundary: CommunityGenres_
  - _Depends: 13.2_
- [x] 4.2 コミュニティ新ジャンル新設の投票可決時アセット移行の実装
  - モデレータ投票により申請が可決承認された際、一時アセット移行API `/api/genres/migrate-icon` を呼び出し、ローカル一時ファイルから正式なジャンルアイコン用ローカルアセットパスへの移行処理を組み込む。
  - *完了状態*: 承認可決時に一時ファイルが正式な場所へ移動し、Firestore 上の `metadata_genres` に正式なローカルアセット配信URLが登録されること。
  - _Requirements: 3.4, 4.4_
  - _Boundary: CommunityGenres_
  - _Depends: 13.3_

### 5. ジャンルアイコン仕様整合と検証
- [x] 5.1 スペック・画面コメントの SVG 表記除去
  - コメント等から「PNG/SVG」表記を除去し、PNG/JPEG/GIF・SVG禁止に統一する。
  - _Requirements: 4.1_
  - _Boundary: SpecSync_
- [x] 5.2 validateGenreIconFile 共通化と一時アップロードAPI・申請フォームへの接続
  - `src/lib/genre-icon-upload.ts` による MIME・サイズ検証（2MB、PNG/JPEG/GIF、SVG禁止）を一時アップロードAPIおよび一般申請画面フォームに接続し、不正入力をクライアント/サーバー両面でブロックする。
  - *完了状態*: 非許可アセット選択時に送信がブロックされ、インラインでエラーが表示されること。
  - _Requirements: 4.2, 4.3_
  - _Boundary: UI, API_
- [x] 5.3 アイコン検証ロジックの単体テスト実行
  - `genre-icon-upload` の MIME検証、サイズ制限、およびSVG拒否の単体テストをローカル環境で実行し、パスさせる。
  - *完了状態*: テストスイートを実行し、関連するすべての単体テストがパスすること。
  - _Requirements: 4.2, 4.3_

### 6. 初期ジャンル一括投入機能の実装
- [x] 6.1 初期ジャンル一括投入サービス関数の実装 (P)
  - `src/services/tagMerge.ts` に `seedInitialGenres` 関数を追加し、`src/data/initial_genres.json` をロードして Firestore `metadata_genres` へ冪等に書き込む処理を実装する。
  - _Requirements: 5.4, 5.5_
  - _Boundary: Service_
- [x] 6.2 初期ジャンル一括投入APIルートの実装 (P)
  - `src/app/api/admin/seed-genres/route.ts` を新規作成し、管理者（`admin` ロールまたは `moderationTier: 'admin'`）のセッション認証・認可を行い、`seedInitialGenres` を実行する POST エンドポイントを実装する。
  - _Requirements: 5.1, 5.3_
  - _Boundary: API_
- [x] 6.3 管理者モデレーション画面への投入UI実装とAPI接続
  - `src/app/admin/moderation/page.tsx` に管理者専用の投入ボタンUIを追加し、ボタン押下時に `/api/admin/seed-genres` を呼び出し、ローディング中のボタン無効化とスピナー表示、完了後の成功・失敗アラート表示を実装する。
  - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_
  - _Boundary: UI_
  - _Depends: 6.2_
- [x] 6.4 一括投入機能のテスト検証
  - `seedInitialGenres` に対する Jest テスト、およびAPIの認可制限とUIのローディング・実行時統合テストを実行し、パスさせる。
  - _Requirements: 5.4, 5.5, 5.7_
  - _Boundary: Testing_
  - _Depends: 6.3_

### 7. 管理者専用ジャンル直接追加・管理機能の実装
- [x] 7.1 (P) 管理者専用ジャンル直接登録APIにおけるローカル画像移行の実装
  - `/api/admin/genres` を更新し、GET ではローカルアセット配信URLを含む全ジャンルのリストを返し、POST では管理者認可後に `iconImageUrl` が一時URLであった場合にローカル一時フォルダから正式アセットフォルダ `assets/genre/{genreId}/` へとファイルをコピー移行し、正式なローカルアセットURLで Firestore に登録する処理を実装する。
  - *完了状態*: 有効な管理者トークンで POST リクエストを送信した際、一時画像ファイルが正式なディレクトリに移動され、新しいジャンルアセット情報が `metadata_genres` に登録されること。
  - _Requirements: 7.1, 7.4, 7.5_
  - _Boundary: admin-genres API_
  - _Depends: 13.1_
- [x] 7.2 (P) 管理者専用ジャンル管理画面のUI実装
  - `src/app/admin/genres/page.tsx` を新規作成し、Tailwind CSS + shadcn/ui を使用して登録済みジャンルの一覧テーブルと新規ジャンル追加フォームを構築する。
  - _Requirements: 7.1, 7.2, 7.3_
  - _Boundary: UI_
- [x] 7.3 直接追加画面での手動選択アイコンの一時アップロード接続
  - `AdminGenresClient` を更新し、ジャンル追加時のアイコン選択時に、Firebase Storage ではなく一時アセットアップロードAPI `/api/genres/upload-icon` を呼び出し、プレビューおよび一時URLをフォーム値に設定する処理に接続する。
  - *完了状態*: 画像選択時に一時アセットURL `/api/assets/genre/temp/...` が取得されてプレビューされ、送信時にその一時URLが登録APIに渡されること。
  - _Requirements: 7.6, 7.4_
  - _Boundary: AdminGenres_
  - _Depends: 13.2_
- [x] 7.4 管理画面間の相互ナビゲーション導線の追加
  - `src/app/admin/moderation/page.tsx` および `src/app/admin/users/page.tsx` に、新規ジャンル管理画面（`/admin/genres`）へのナビゲーションリンクを追加し、ジャンル管理画面からは他の管理者画面への相互リンクを追加する。
  - _Requirements: 7.8_
  - _Boundary: UI_
  - _Depends: 7.2_
- [x] 7.5 ジャンル追加送信時のローカル保存自動反映の統合
  - ジャンル追加送信成功時に、状態を更新して追加されたジャンルがページ再読み込みなしで即座に一覧テーブルに反映され、正しいローカルアセット画像（`/api/assets/genre/{genreId}/icon_xxx.png`）で描画されることを確認する。
  - *完了状態*: 追加完了時にテーブルの行が自動更新され、登録されたジャンルのローカルアセット画像が正しく表示されること。
  - _Requirements: 7.7, 7.4_
  - _Boundary: AdminGenres_

### 8. ジャンル管理画面の非同期ローディングとスケルトン実装
- [x] 8.1 (P) ジャンル管理画面における静的フレームの先行描画とスケルトン表示の実装
  - `src/app/admin/genres/page.tsx` を React Server Component と Suspense に対応させ、データロード中に `data-testid="genres-management-skeleton"` を付与したスケルトンプレースホルダーを表示する。
  - _Requirements: 6.10, 6.11, 6.12, 6.16_
  - _Boundary: UI_
  - _Depends: 7.2_

### 9. ジャンル直接追加機能の検証テスト
- [x] 9.1 (P) ジャンル管理APIのローカル移行・重複検証テストの構築
  - APIルート `/api/admin/genres` に対する Jest テストを更新し、一時画像のローカル移行（ファイルコピー・削除）の正常性、重複IDに対する `409` 応答、および非管理者アクセスの `403` ブロックを検証する。
  - *完了状態*: 追加・更新した API テストを実行し、すべてパスすること。
  - _Requirements: 7.1, 7.5_
  - _Boundary: Testing_
- [x] 9.2 管理者直接追加のローカルアセット保存をカバーするE2Eテストの更新
  - Playwright 等の E2E テスト（`admin-genres.spec.ts`）を更新し、管理者によるジャンル直接追加、ローカルアップロードAPI接続、画像移行、および一覧への自動更新を検証する。
  - *完了状態*: E2E テストを実行し、モックおよびローカルアセット保存を介した登録フローがグリーンでパスすること。
  - _Requirements: 7.1, 7.4, 7.5, 7.7_
  - _Boundary: Testing_

### 10. 管理者メニューポータル画面の実装と検証
- [x] 10.1 (P) 管理者メニューポータル画面のUI実装
  - `src/app/admin/page.tsx` を作成し、管理者以外のアクセスを遮断し、3つの管理者用サブ画面（モデレーション審査、ユーザー評判管理、ジャンル直接管理）へ遷移する Material Icons (MUI Icons) およびホバーエフェクト付きのポータルカードUIを提供する。
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: UI_
- [x] 10.2 ポータル画面の検証テストの構築
  - Jest 単体・結合テスト（`tests/app/admin/portal.test.tsx`）および Playwright E2E テスト（`e2e/admin-portal.spec.ts`）にて、非管理者アクセス制限、カードUIの表示、および遷移を検証・パスさせる。
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: Testing_
  - _Depends: 10.1_

### 11. AIジャンルアイコン生成機能の追加
- [x] 11.1 (P) AIジャンルアイコン生成APIのローカル一時保存対応
  - `src/app/api/genres/generate-icon/route.ts` を更新し、Gemini で生成した画像 Buffer を Firebase Storage ではなく、ローカル一時領域 `assets/genre/temp/{uid}_{timestamp}.png` に保存し、一時アセット配信URLを返却するよう変更する。
  - *完了状態*: API 呼び出しに成功した際、ローカルの一時フォルダにファイルが正しく作成され、プレビュー用のURL `/api/assets/genre/temp/...` がレスポンスされること。
  - _Requirements: 9.3, 9.4, 9.5, 9.6_
  - _Boundary: generate-icon API_
  - _Depends: 13.1_
- [x] 11.2 (P) 管理者画面へのAI生成ローカルプレビューおよび登録連携の更新
  - 管理者専用ジャンル管理画面（`admin-genres-client.tsx`）の「AIで生成」処理を更新し、生成された一時アセットURL `/api/assets/genre/temp/...` のプレビュー表示と、追加時の正式パス移行連携をバインドする。
  - *完了状態*: 「AIで生成」を実行した際、プレビューに生成画像がローカルURLから正しく描画され、追加送信時に画像移行を経てジャンルが登録されること。
  - _Requirements: 9.1, 9.2, 9.3, 9.6_
  - _Boundary: AdminGenres_
- [x] 11.3 (P) 一般新設申請画面へのAI生成ローカルプレビューおよび移行送信の更新
  - 一般新設申請画面（`src/app/community/genres/page.tsx`）の「AIで生成」処理を更新し、プレビューの描画と、申請確定時の一時画像移行 API（`/api/genres/migrate-icon`）の呼び出しをバインドする。
  - *完了状態*: 一般申請画面で AI 生成された画像がプレビューされ、申請送信時に移行 API 経由で正式なローカルアセットパスへとコピーされた上で申請が登録されること。
  - _Requirements: 9.1, 9.2, 9.3, 9.5_
  - _Boundary: CommunityGenres_

### 12. AIジャンルアイコン生成機能の検証テスト
- [x] 12.1 (P) AI生成API of ローカル保存に対する単体・結合テストの更新
  - APIルート `/api/genres/generate-icon` および `/api/genres/migrate-icon` に対する Jest テストを更新し、ローカルファイルシステム操作のモック/スタブを用いて画像生成・一時保存、および移行コピー処理を検証する。
  - *完了状態*: テストを実行し、ローカル保存・移行を想定した API テストがすべてパスすること。
  - _Requirements: 9.4, 9.5, 9.6_
  - _Boundary: Testing_
- [x] 12.2 AI生成アイコン生成・ローカル保存・移行フロー全体のE2Eテストの更新
  - Playwright テストを更新し、管理者画面および一般申請画面での AI 画像生成ボタンクリック、ローカル一時URLプレビュー描画、登録/申請確定時のファイル移行、および一覧反映の全フローを検証する。
  - *完了状態*: E2E テストを実行し、AI生成とローカル保存・移行フローのテストがすべてパスすること。
  - _Requirements: 9.1-9.6_
  - _Boundary: Testing_

### 13. ローカル画像保存・配信インフラの実装
- [x] 13.1 (P) ローカル画像アセット配信APIの実装
  - 指定されたパス（一時保存または正式パス）のファイルを `assets/genre/` ディレクトリから読み込み、適切な画像 MIME タイプで配信するエンドポイント（GET `/api/assets/genre/[...path]`）を構築する。
  - セキュリティ対策として、ドットの連続 `..` や無効な文字を含むパスに対して `400 Bad Request` でディレクトリトラバーサルを防止するガードを実装する。
  - *完了状態*: アセット配信パスへアクセスした際、ファイルが存在すれば `200 OK` と画像バイナリが返り、不正なパスや不在ファイルには適切なエラー（`400` / `404`）が返ること。
  - _Requirements: 7.4, 9.3_
  - _Boundary: assets/genre API_
- [x] 13.2 (P) 手動選択画像の一時ローカル保存APIの実装
  - クライアントから送信された手動アイコン画像ファイルを受け取り、サイズや MIME バリデーション後に一時領域 `assets/genre/temp/{uid}_{timestamp}.png` へ保存し、プレビュー一時URLを返すエンドポイント（POST `/api/genres/upload-icon`）を構築する。
  - *完了状態*: PNG形式かつ2MB以下のファイルをPOSTした際に一時アクセスURL `/api/assets/genre/temp/...` が返却され、SVGなどの禁止形式に対しては `400 Bad Request` で拒否されること。
  - _Requirements: 3.1, 4.3, 7.6_
  - _Boundary: upload-icon API_
- [x] 13.3 (P) 一時ローカルアセット移行APIの実装
  - 一時保存URL `/api/assets/genre/temp/...` を解析し、対象の実ファイルを正式アセットディレクトリ `assets/genre/{genreId}/icon_{timestamp}.png` へとリネーム/コピー移動するエンドポイント（POST `/api/genres/migrate-icon`）を構築する。
  - *完了状態*: 移行要求に対して一時ファイルが正式な場所へ移動し、元のファイルが削除され、新しいアセットURLが正常に返ること。
  - _Requirements: 3.4, 4.4_
  - _Boundary: migrate-icon API_
  - _Depends: 13.1_
