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

## Implementation Notes
- Next.js middleware は Firebase Auth SDK を直接利用できないため、Cookie ベース（quizeum_uid, quizeum_tier）の一次ガードとクライアントサイドの useAuth 二重保護の組み合わせを採用。
- ジャンル新設の可決条件チェック（totalApproveWeight >= 5 && 80%以上）は moderation-utils.ts の isGenreRequestApproved を再利用。
- マージリクエストの保留一覧は onSnapshot によるリアルタイム購読でプログレスバーが即時反映される。
- 可決時の `metadata_genres` 登録は `tagMerge.voteGenreRequest`（core）が担当。Phase 6 UI は Storage 直叩き前のクライアント検証のみ。
- Phase 6 実装（2026-06-03）: `genre-icon-upload.ts` + `storage.ts` 統合。Jest 304 件・build PASS。
- Phase 6 タスク 6（2026-06-04）: `seedInitialGenres` + `/api/admin/seed-genres` + 管理者モデレーション画面の投入UI。`isAdminUser` を middleware-auth-cookies から export。Jest 328 件・build PASS。

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

