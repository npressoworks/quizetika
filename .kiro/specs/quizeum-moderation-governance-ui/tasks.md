# Implementation Plan: quizeum-moderation-governance-ui

## Tasks

### 1. ロール・権限ルートガードの実装
- [x] 1.1 ミドルウェアによるモデレーションルート保護の実装 (P)
  - `src/middleware.ts` を作成または更新し、`/admin/*` および `/community/*` へのアクセスを、ログインユーザーの `moderationTier` や管理者ロールに基づいて厳格に保護・リダイレクトする処理を実装する。
  - _Requirements: 1.1, 2.1_
  - _Boundary: RouteGuard_

### 2. 管理者モデレーション画面のUI実装
- [x] 2.1 審査待ちモデレーションキューおよび通報詳細表示の実装 (P)
  - `src/app/admin/moderation/page.tsx` および `moderation.module.css` を作成し、通報数が5に達して `suspended` となったクイズの審査待ちキューリストを実装する（リスト・プロフィールは core 側スキーマ待ち）。
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
- [x] 4.1 新ジャンル申請フォームと画像アップロードの実装 (P)
  - `src/app/community/genres/page.tsx` および `genres.module.css` を作成し、認証ユーザーが新規ジャンル（英語ID、日本語名）を申請するフォームを実装する。
  - アイコン画像（**PNG/JPEG/GIF**、SVG 不可）を Firebase Storage にアップロードして登録する処理を構築する。
  - _Requirements: 3.1_
  - _Boundary: CommunityGenres-Request_
- [x] 4.2 モデレータ投票および履歴閲覧タブの実装
  - 保留中ジャンル申請へのモデレータ投票UIを構築し、可決された際のシステム自動反映を通知するアラートメッセージを表示する。
  - 承認/否決が決定した過去の申請を表示する「履歴タブ」を構築する。
  - _Requirements: 3.2, 3.3, 3.4, 3.5_
  - _Boundary: CommunityGenres-Vote_

---

### 5. Phase 6 拡張 — ジャンルアイコン SEC-08 仕様整合（2026-06）

> **前提**: 実装は概ね SEC-08 準拠済み。本フェーズは **仕様ドキュメントとコードの明示的整合** が主目的。

- [x] 5.1 スペック・画面コメントの SVG 表記除去
  - `requirements.md` / `design.md` / `brief.md` / `tasks.md` および `community/genres/page.tsx` 先頭コメントから「PNG/SVG」表記を除去し、PNG/JPEG/GIF・SVG禁止に統一する。
  - **完了状態**: スペック内にジャンルアイコンで SVG を許可する記述が残っていないこと。
  - _Requirements: 4.1_
  - _Boundary: SpecSync_

- [x] 5.2 `validateGenreIconFile` 共通化と申請フォーム接続
  - `src/lib/genre-icon-upload.ts` に MIME・サイズ検証（2MB、png/jpeg/gif）を抽出する。
  - `/community/genres` の `handleIconChange` から呼び出し、`accept` 属性と一致させる。
  - **完了状態**: SVG 選択時にインラインエラーが出て submit がブロックされること。
  - _Requirements: 4.2, 4.3_
  - _Depends: 5.1_

- [x] 5.3 Phase 6 統合検証
  - `genre-icon-upload` の単体テスト（許可形式・SVG拒否・2MB超過）。
  - `npm test` / `npm run build` がグリーンであること。
  - **完了状態**: 関連 Jest が PASS。
  - _Requirements: 4.2, 4.3_
  - _Depends: 5.2_

- [ ]* 5.4 E2E: アイコン形式ガード（任意）
  - 申請画面で `accept` に svg が含まれないこと、または SVG 相当ファイルでエラーになることを記録。
  - _Depends: 5.3_
  - _Requirements: 4.5_

---

### 6. 初期ジャンル一括投入機能の実装

- [x] 6.1 初期ジャンル一括投入サービス関数の実装 (P)
  - `src/services/tagMerge.ts` に `seedInitialGenres` 関数を追加し、`src/data/initial_genres.json` をロードして Firestore `metadata_genres` へ冪等に書き込む処理を実装する（既存ジャンルIDがある場合は上書きまたはスキップ）。
  - **完了状態**: 単体テストまたは手動実行にて、指定された初期ジャンルが重複なく正しく投入されること。
  - _Requirements: 5.4, 5.5_
  - _Boundary: Service_

- [x] 6.2 初期ジャンル一括投入APIルートの実装 (P)
  - `src/app/api/admin/seed-genres/route.ts` を新規作成し、管理者（`admin` ロールまたは `moderationTier: 'admin'`）のセッション認証・認可を行い、`seedInitialGenres` を実行する POST エンドポイントを実装する。
  - **完了状態**: 管理者ユーザーの有効な ID トークンでリクエストした際に `200 OK` が返り、それ以外では `401` または `403` が返ること。
  - _Requirements: 5.1, 5.3_
  - _Boundary: API_

- [x] 6.3 管理者モデレーション画面への投入UI実装とAPI接続
  - `src/app/admin/moderation/page.tsx` に管理者専用の投入ボタンUIを追加し、ボタン押下時に `/api/admin/seed-genres` を呼び出し、ローディング中のボタン無効化とスピナー表示、完了後の成功・失敗アラート表示を実装する。
  - **完了状態**: 管理者としてログイン時にボタンが表示され、クリックすると一括投入処理が走り、完了後に成功件数を含んだアラートメッセージが表示されること。
  - _Requirements: 5.1, 5.2, 5.3, 5.6, 5.7_
  - _Boundary: UI_
  - _Depends: 6.2_

- [x] 6.4 一括投入機能のテスト検証
  - `seedInitialGenres` に対する Jest テスト（モック Firestore を用いた重複制御の検証）、およびAPIの認可制限とUIのローディング・実行時統合テストを実装・実行する。
  - **完了状態**: 追加した Jest テストおよびビルドチェックがグリーンでパスすること。
  - _Requirements: 5.4, 5.5, 5.7_
  - _Boundary: Testing_
  - _Depends: 6.3_

---

### 7. 管理者専用ジャンル直接追加・管理機能の実装

- [x] 7.1 (P) 管理者専用ジャンルAPIルートの実装
  - `/api/admin/genres` を新規作成し、有効な管理者認証トークン（Bearer Token）の検証、全ジャンルの取得処理 (GET) および新規ジャンルの直接登録処理 (POST、ID重複チェックとDB書き込み) を実装する。
  - **完了状態**: 管理者トークンを用いた GET/POST が成功し、一般トークンや未認証リクエストが `401` または `403` のエラーを返却すること。
  - _Requirements: 7.1, 7.4, 7.5_
  - _Boundary: API_

- [x] 7.2 (P) 管理者専用ジャンル管理画面のUI実装
  - `src/app/admin/genres/page.tsx` を新規作成し、Tailwind CSS + shadcn/ui を使用して登録済みジャンルの一覧テーブルと新規ジャンル追加フォーム（ID、日本語表示名、説明、アイコンファイル選択）を構築する。
  - **完了状態**: 管理者としてアクセスした際に一覧と入力フォームが表示され、非管理者のアクセス時は `404` または `403`（`/not-found` へのリダイレクトなど）になること。
  - _Requirements: 7.1, 7.2, 7.3_
  - _Boundary: UI_

- [x] 7.3 アイコン画像のクライアント検証と Storage アップロードの実装
  - 新規ジャンル追加時のアイコン選択時に、`validateGenreIconFile` による容量制限（2MB）および MIME 形式（PNG/JPEG/GIF、SVG不可）の検証と、Storage へのアップロード処理（パス: `genres/{genreId}/icon_{timestamp}.png`）を実装する。
  - **完了状態**: SVG や大容量ファイル選択時に即座にインラインエラーが表示され送信がブロックされ、正しいファイルはアップロードされその画像 URL がフォーム値にセットされること。
  - _Requirements: 7.6, 7.4_
  - _Boundary: UI_
  - _Depends: 7.2_

- [x] 7.4 管理画面間の相互ナビゲーション導線の追加
  - `src/app/admin/moderation/page.tsx` および `src/app/admin/users/page.tsx` に、新規ジャンル管理画面（`/admin/genres`）へのナビゲーションリンクを追加し、ジャンル管理画面からは他の管理者画面への相互リンクを追加する。
  - **完了状態**: 管理者メニュー間で各ページへ相互遷移可能なリンクが表示され、正しくリンク遷移できること。
  - _Requirements: 7.8_
  - _Boundary: UI_
  - _Depends: 7.2_

- [x] 7.5 APIとUIの統合・自動更新の実装
  - ジャンル追加完了時に、APIへの POST リクエストを行い、成功した際には React state を更新して追加されたジャンルが即座に一覧テーブルに反映・表示されるようにする。
  - **完了状態**: ジャンルが追加された際、ページ再読み込みを伴うことなく追加されたジャンルがテーブルに自動的かつ即座に描画されること。
  - _Requirements: 7.7, 7.4_
  - _Boundary: UI_
  - _Depends: 7.1, 7.3_

---

### 8. ジャンル管理画面の非同期ローディングとスケルトン実装

- [x] 8.1 (P) ジャンル管理画面における静的フレームの先行描画とスケルトン表示の実装
  - `src/app/admin/genres/page.tsx` を React Server Component と Suspense/Streaming に対応させ、データロード中（登録済みジャンル一覧取得中）に `data-testid="genres-management-skeleton"` を付与したスケルトンプレースホルダーを表示する。
  - **完了状態**: ジャンル管理画面へのアクセス時にヘッダーやサイドバー等の静的フレームが即時描画され、コンテンツ部分にスケルトンが表示された後、データ解決に伴い実際のテーブルに切り替わること。
  - _Requirements: 6.10, 6.11, 6.12, 6.16_
  - _Boundary: UI_
  - _Depends: 7.2_

---

### 9. ジャンル直接追加機能の検証テスト

- [x] 9.1 (P) ジャンルAPIおよび画像バリデーションの単体・統合テストの構築
  - APIルート `/api/admin/genres` の認可処理・重複チェック（409応答）に対するテスト、および `validateGenreIconFile` に関する SVG 拒否テストを構築する。
  - **完了状態**: 追加された Jest 単体・統合テストが全てパスすること。
  - _Requirements: 7.1, 7.5, 7.6_
  - _Boundary: Testing_

- [x] 9.2 ジャンル直接追加・一覧更新のE2Eテストの実装
  - Playwright 等の E2E テストを追加または更新し、管理者によるジャンル直接追加、Storage への画像保存、一覧の即時更新、および非管理者のアクセス拒否の動作を自動検証する。
  - **完了状態**: `npm run build` および E2E テストがグリーンでパスすること。
  - _Requirements: 7.1, 7.4, 7.5, 7.7_
  - _Boundary: Testing_
  - _Depends: 7.5, 9.1_

## Implementation Notes
- Next.js middleware は Firebase Auth SDK を直接利用できないため、Cookie ベース（quizeum_uid, quizeum_tier）の一次ガードとクライアントサイドの useAuth 二重保護の組み合わせを採用。
- ジャンル新設の可決条件チェック（totalApproveWeight >= 5 && 80%以上）は moderation-utils.ts の isGenreRequestApproved を再利用。
- マージリクエストの保留一覧は onSnapshot によるリアルタイム購読でプログレスバーが即時反映される。
- 可決時の `metadata_genres` 登録は `tagMerge.voteGenreRequest`（core）が担当。Phase 6 UI は Storage 直叩き前のクライアント検証のみ。
- Phase 6 実装（2026-06-03）: `genre-icon-upload.ts` + `storage.ts` 統合。Jest 304 件・build PASS。
- Phase 6 タスク 6（2026-06-04）: `seedInitialGenres` + `/api/admin/seed-genres` + 管理者モデレーション画面の投入UI。`isAdminUser` を middleware-auth-cookies から export。Jest 328 件・build PASS。
- 管理者ジャンル直接追加実装（2026-06-18 追加分）: `/api/admin/genres` (GET / POST) 新設 + `/admin/genres` (Table/Form) 構築 + 相互リンク追加。

### 10. 管理者メニューポータル画面の実装と検証

- [x] 10.1 (P) 管理者メニューポータル画面のUI実装
  - `src/app/admin/page.tsx` を新規作成し、管理者（`admin` ロールまたは `moderationTier: 'admin'`）以外のアクセスを遮断し `/not-found` へリダイレクトするアクセスガードを実装する。
  - 3つの管理者用サブ画面（モデレーション審査、ユーザー評判管理、ジャンル直接管理）へ遷移する、Lucide アイコンおよびホバーエフェクト付きのポータルカードUIを提供する。
  - **完了状態**: 管理者としてログイン時にポータルカードメニューが表示され、非管理者ユーザーアクセス時は `/not-found` へリダイレクトされること。
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: UI_

- [x] 10.2 ポータル画面の検証テストの構築
  - Jest 単体・結合テスト（`tests/app/admin/portal.test.tsx`）および Playwright E2E テスト（`e2e/admin-portal.spec.ts`）を新規作成し、非管理者アクセス制限、カードUI의表示、および各管理者サブ画面への遷移を自動検証する。
  - **完了状態**: 追加された Jest および Playwright テストを実行し、すべてグリーンでパスすること。
  - _Requirements: 8.1, 8.2, 8.3_
  - _Boundary: Testing_
  - _Depends: 10.1_

### 11. AIジャンルアイコン生成機能の追加

- [x] 11.1 (P) AIジャンルアイコン生成APIルートの実装
  - `src/app/api/genres/generate-icon/route.ts` を新規作成し、Gemini (Imagen) モデルを呼び出してジャンル用のアイコン画像を生成する POST エンドポイントを構築する。
  - 一般ユーザーに対して1日5回のデイリー生成制限（Firestoreでのカウント管理）を適用し、管理者ユーザーに対しては制限チェックをバイパスする。
  - 生成された画像を Firebase Storage の一時パス `temp/genre-icons/{uid}_{timestamp}.png` に保存し、フロントエンドに URL を返却する。
  - **完了状態**: 認証済みのユーザー/管理者トークンを用いて POST リクエストした際に、画像 URL が正常に返り、一般ユーザーは 6 回目のリクエストで `429 Too Many Requests` エラーになること。
  - _Requirements: 9.4, 9.5, 9.6_
  - _Boundary: API_

- [ ] 11.2 (P) 管理者直接追加画面への AI 画像生成UIの実装
  - `src/app/admin/genres/admin-genres-client.tsx` に「AIで生成」ボタンを追加し、ボタン押下時に新設 API をコールしてローディング状態、生成された画像のプレビュー表示、およびフォームへの画像 URL セットを実装する。
  - 入力されているジャンル名および説明が空の場合は、「AIで生成」ボタン押下時に「ジャンル名と説明を入力してください」というエラーメッセージを表示して処理を中断する。
  - **完了状態**: 管理者画面でジャンル名と説明を入力してボタンをクリックすると、画像プレビューが表示され、そのまま「ジャンルを追加」をクリックして正常に登録できること。
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.6_
  - _Boundary: UI_
  - _Depends: 11.1_

- [ ] 11.3 (P) 一般ジャンル新設申請画面への AI 画像生成UIの実装
  - `src/app/community/genres/page.tsx` に「AIで生成」ボタンを追加し、管理者画面と同様に入力値バリデーション、ローディングインジケータ、プレビュー表示、フォーム値へのセットを実装する。
  - **完了状態**: 新設申請画面で情報を入力し「AIで生成」をクリックした際に、プレビューが表示され、正常に申請できること。
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  - _Boundary: UI_
  - _Depends: 11.1_

### 12. AIジャンルアイコン生成機能の検証テスト

- [ ] 12.1 (P) AI生成APIおよび画像保存の単体・結合テストの構築
  - APIルート `/api/genres/generate-icon` に対する Jest テスト（モック Gemini 呼び出し、管理者・一般の認可制御、一般ユーザーのデイリー制限カウントの検証）を構築する。
  - **完了状態**: 追加された Jest テストがすべて PASS すること。
  - _Requirements: 9.4, 9.5, 9.6_
  - _Boundary: Testing_

- [ ] 12.2 AIアイコン生成機能のE2Eテストの実装
  - Playwright テストを新規作成または `admin-genres.spec.ts` を更新し、管理者直接追加画面での AI 画像生成ボタンクリック、プレビュー表示、画像が保存される一連のフロー、および一般ユーザーでの上限制限の動作を検証する。
  - **完了状態**: すべての E2E テストがグリーンでパスすること。
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6_
  - _Boundary: Testing_
  - _Depends: 11.2, 11.3_
