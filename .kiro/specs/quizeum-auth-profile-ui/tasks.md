# Implementation Plan: quizeum-auth-profile-ui

## Tasks

### 1. 共通デザインシステムとレイアウトの構築
- [x] 1.1 グローバルCSS変数と共通スタイル（Vanilla CSS/CSS Modules）の実装 (P)
  - `src/app/globals.css` に、硬すぎないカジュアルモダンなデザインシステムトークン（丸みのある角丸、温かみのあるカラーパレット、標準フォント等）を設定する。
  - ボタン（主要/補助）、カード、フォーム入力などの汎用共通CSSモジュールを用意し、動作を確認する。
  - _Requirements: 2.1, 3.1_
  - _Boundary: CSS-Tokens_
- [x] 1.2 共通Headerレイアウトコンポーネントの実装
  - `src/components/layout/header.tsx` を作成し、アプリケーション全体のヘッダーをレスポンシブかつ美しいデザインで実装する。
  - 認証状態（`useAuth`）を監視し、未ログイン時は「ログイン」ボタン、ログイン時はアバター画像とドロップダウンメニュー（マイページ、通知、ログアウト等）を動的に表示する。
  - _Requirements: 1.3, 2.1_
  - _Boundary: Header-Component_

### 2. 認証画面 (/login) のUI実装
- [x] 2.1 ログインUI画面およびGoogle認証連携の実装
  - `src/app/login/page.tsx` および `login.module.css` に、気軽に利用できるフレンドリーなGoogle認証ログイン画面を実装する。
  - ユーザーがGoogleでログインし、成功した際に `/`（またはリダイレクト元）へ自動的に遷移する。
  - _Requirements: 1.1, 1.2_
  - _Boundary: LoginPage_
- [x] 2.2 ログイン状態によるアクセス制限（リダイレクト）の実装
  - ログイン済みユーザーが直接 `/login` にアクセスした際、自動的に `/` にリダイレクトすることを確認する。
  - _Requirements: 1.3_
  - _Boundary: LoginPage-Guard_

### 3. プロフィール画面 (/profile/[uid]) のUI実装
- [x] 3.1 プロフィール画面基本情報表示の実装
  - `src/app/profile/[uid]/page.tsx` および `profile.module.css` に、アバター、表示名、自己紹介、フォロー/フォロワー数、称号バッジ一覧、信頼スコア（pt）および権限ティアーバッジを親しみやすいカード形式で表示する。
  - _Requirements: 2.1_
  - _Boundary: ProfilePage_
- [x] 3.2 投稿クイズ・リストのタブ切り替え表示の実装
  - 「作成したクイズ」と「作成したリスト」のタブパネルを用意し、クリック時に表示がスムーズに切り替わるように実装する。
  - _Requirements: 2.2_
  - _Boundary: ProfilePage-Tabs_
- [x] 3.3 フォロー/アンフォロートグルの実装
  - 他人のプロフィール表示時、フォロー/フォロー解除のアトミックなトグルボタンを表示し、クリック時に `UserService.followUser` を呼び出して表示カウンターをリアルタイム更新する。
  - _Requirements: 2.3, 2.4_
  - _Boundary: ProfilePage-Follow_
- [x] 3.4 退会処理中（delete_pending）のアクセスブロック実装
  - 対象プロフィールデータの `deleteStatus == 'delete_pending'` である場合、アクセスをブロックし、自動的に Next.js の 404 画面を表示する。
  - _Requirements: 2.5_
  - _Boundary: ProfilePage-Guard_

### 4. プロフィール編集画面 (/profile/edit) のUI実装
- [x] 4.1 プロフィール編集フォームの実装
  - `src/app/profile/edit/page.tsx` および `edit.module.css` に、表示名（最大30文字）および自己紹介（最大200文字）を編集する入力フォームを実装する。
  - Zodバリデーション警告をインライン表示し、入力値が範囲外の時は保存ボタンを非活性化する。
  - _Requirements: 3.1, 3.2_
  - _Boundary: ProfileEditPage_
- [x] 4.2 編集データの保存と更新処理の実装
  - 「保存する」クリック時に `UserService.updateProfile` を呼び出し、完了後元のマイプロフィール画面へ自動リダイレクトする。
  - _Requirements: 3.3_
  - _Boundary: ProfileEditPage-Save_

### 5. ソーシャルおよび通知関連画面のUI実装
- [x] 5.1 フォロー/フォロワー一覧画面 (/profile/[uid]/connections) の実装
  - `src/app/profile/[uid]/connections/page.tsx` に、「フォロー中」と「フォロワー」のタブ表示リストを構築し、ダイレクトにフォロートグルが行えるように実装する。
  - _Requirements: 4.1, 4.2_
  - _Boundary: ConnectionsPage_
- [x] 5.2 通知一覧画面 (/notifications) の実装
  - `src/app/notifications/page.tsx` に、アクティビティ通知を時系列で並べ、指摘修正完了通知クリック時に該当のクイズ詳細画面へ正しく遷移するように実装する。
  - _Requirements: 5.1, 5.2_
  - _Boundary: NotificationsPage_
- [x] 5.3 リアクション履歴画面 (/profile/[uid]/likes) の実装
  - `src/app/profile/[uid]/likes/page.tsx` に、「送ったリアクション」と「受け取ったリアクション」のタブ切替リストを構築し、各履歴カードからクイズ詳細へ遷移するように実装する。
  - _Requirements: 6.1, 6.2_
  - _Boundary: LikesPage_

### 7. 本人プレイ履歴専用タブ（Phase 5）
- [x] 7.1 プレイ履歴APIクライアントの実装 (P)
  - `src/lib/play-history-client.ts` に、Bearer IDトークン付きで `GET /api/user/play-history` を呼び出す関数と、プレイモードの日本語表示ラベル関数を実装する。
  - 完了時、`cursor` 指定で追記ページを取得でき、401/403/500 は呼び出し元が扱えるエラーとして返ること。
  - _Requirements: 7.2, 7.3, 7.8_
  - _Boundary: play-history-client_
- [x] 7.2 プレイ履歴パネルコンポーネントの実装 (P)
  - `ProfilePlayHistoryPanel` を実装し、履歴行（クイズタイトルリンク・正解数/総数・モード・完了日時・経過秒）、空状態、ローディング、エラー表示、「もっと見る」追記読み込みを提供する。
  - タブ初回表示時にのみ初回フェッチし、`data-testid`（`play-history-section`, `play-history-entry`, `play-history-load-more`）を付与する。
  - _Requirements: 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 7.8_
  - _Depends: 7.1_
  - _Boundary: ProfilePlayHistoryPanel_
- [x] 7.3 プロフィール画面への「プレイ履歴」第3タブ統合
  - 本人プロフィール（`isMyProfile`）のときのみ「プレイ履歴」タブボタン（`data-testid="profile-tab-history"`）を表示し、選択時に `ProfilePlayHistoryPanel` を描画する。
  - 他人のプロフィールでは第3タブが存在しないこと。完了時、既存のクイズ/リストタブと切替が問題なく動作すること。
  - _Requirements: 2.2, 2.6, 7.1_
  - _Depends: 7.2_
  - _Boundary: ProfilePage-Tabs_
- [x] 7.4 プレイ履歴タブのE2Eテスト追加
  - 本人プロフィールでプレイ履歴タブ表示・履歴行・クイズ詳細遷移を検証する。他人プロフィールではタブ非表示を検証する。
  - _Requirements: 7.1, 7.7_
  - _Depends: 7.3_
  - _Boundary: E2E-profile-play-history_
- [x] 7.5 プレイ履歴クライアントの単体テスト（任意）
  - `getAttemptModeLabel` と API レスポンスの `completedAt` 変換をモック fetch で検証する。
  - _Requirements: 7.3_
  - _Depends: 7.1_
  - _Boundary: play-history-client_

---

### 8. Phase 8 拡張 — 作成リストの listType 別表示（2026-06）

> **前提**: `quizeum-core` Phase 8 完了（`getQuizListsByAuthor` + `listType` フィルタ、`resolveListType`）。`quizeum-creator-dash-ui` / `quizeum-play-flow-ui` Phase 8 でリスト作成・詳細表示は実装済み。

- [x] 8.1 (P) `profile-list-display` 純関数ライブラリ
  - `getProfileListTypeLabel` と `getProfileListItemCount` を実装する。内部は必ず `resolveListType(list)` を使用し、`list.listType` 直参照は行わない。
  - Jest で `listType: undefined`（クイズリスト扱い・`quizIds` 件数）、`listType: 'question'`（`questionIds` 件数）を検証する。
  - **完了状態**: 単体テストがグリーンであり、コンポーネントから import 可能であること。
  - _Requirements: 8.2, 8.3, 8.4_
  - _Boundary: profile-list-display_

- [x] 8.2 (P) `ProfileListCard` コンポーネント
  - 種別バッジ（`profile-list-type-badge`）、正しい収録件数ラベル、`/list/[id]` リンク、`data-testid="profile-list-card"` を実装する。
  - `getProfileListTypeLabel(resolveListType(list))` のみでバッジ文言を決定する（`bookmark-list-grid` の直比較パターンはコピーしない）。
  - RTL でクイズ／問題リストのバッジ・件数表示・レガシー未設定リストを検証する。
  - **完了状態**: 問題リストで `quizIds` 件数が表示されないこと。
  - _Requirements: 8.2, 8.3, 8.4, 8.5, 8.9_
  - _Depends: 8.1_
  - _Boundary: ProfileListCard_

- [x] 8.3 `ProfileListsPanel`（一覧・空状態・任意フィルタ）
  - `ProfileListCard` で一覧を描画する。本人0件時は既存空状態 + `/list/create` 導線（8.6）。
  - 任意フィルタ `all` | `quiz` | `question` をクライアント絞り込みで実装する（`profile-list-filter-*` testid）。
  - フィルタ結果0件（全体1件以上）時は `profile-list-filter-empty` とフィルタ解除操作を表示する（8.6 真の0件と区別）。
  - **完了状態**: 3種フィルタで一覧が切り替わり、フィルタ空状態から「すべて」に復帰できること。
  - _Requirements: 8.1, 8.6, 8.7_
  - _Depends: 8.2_
  - _Boundary: ProfileListsPanel_

- [x] 8.4 `ProfilePage` リストタブ統合
  - `src/app/profile/[uid]/page.tsx` のリストタブインライン JSX を `ProfileListsPanel` に委譲する。
  - タブ見出し `作成したリスト (N)` はフィルタ前の全件数のまま維持する。`getQuizListsByAuthor` 取得ロジックは変更しない。
  - **完了状態**: リストタブで種別バッジ付きカードが表示され、クリックで `/list/[id]` へ遷移すること。
  - _Requirements: 2.2, 8.1, 8.5_
  - _Depends: 8.3_
  - _Boundary: ProfilePage-Tabs_

- [x] 8.5 Phase 8 統合検証
  - `profile-list-display` / `ProfileListCard` / `ProfileListsPanel` のテストと、クイズ・プレイ履歴タブの回帰スモークを実施する。
  - `npm test` / `npm run build` がグリーンであること。
  - **完了状態**: Phase 8 関連テストがグリーンであり、手動スモークでクイズ／問題リストの種別・件数が正しいこと。
  - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_
  - _Depends: 8.4_

- [ ]* 8.6 Phase 8 E2E スモーク（任意）
  - `profile-list-card` / `profile-list-type-badge` の表示、問題リストの `questionIds` ベース件数、フィルタ空状態を Playwright またはチェックリストで記録する。
  - _Depends: 8.5_
  - _Requirements: 8.2, 8.9_

## Implementation Notes

- Phase 5 実装済み: 本人のみ「プレイ履歴」第3タブ + `ProfilePlayHistoryPanel`。
- **Phase 8**: 種別判定は `resolveListType` 必須。フィルタはクライアント絞り込み（API 再取得不要）。リスト CRUD は実装しない（8.8）。
- Phase 8 実装（2026-06-06）: `profile-list-display` + `ProfileListCard` + `ProfileListsPanel`。Jest 375 件・build PASS。
- Phase 9 実装（2026-06-07）: 認証・プロフィール画面を Server Component + Suspense + スケルトン化。`/profile/edit` を middleware 307 保護。
- **Phase 23**: 本人 `profileActions` からリアクション履歴 `Link` 削除のみ。`/profile/[uid]/likes` ルート・`LikesClient` はレガシー変更なし。E2E F-407 は直接実装候補 `remove-reaction-history-e2e` と連携。

### 9. Phase 12 拡張 — 認証・プロフィール画面の非同期表示最適化（Streaming & Suspense）のUI実装（2026-06-07）

- [x] 9.1 ブックマーク一覧画面の Server Component 化と Suspense 導入 (P)
  - `src/app/bookmarks/page.tsx` を Server Component に移行し、静的な戻るボタンやタブ等の外枠を即座にレンダリングする。
  - ブックマークデータ一覧のフェッチ領域を `<Suspense fallback={<BookmarksSkeleton data-testid="bookmarks-skeleton" />}>` でラッピングして非同期描画する。
  - _Requirements: 9.1, 9.2, 9.3, 9.7_
  - _Boundary: BookmarksPage_
- [x] 9.2 通知画面の Server Component 化と Suspense 導入 (P)
  - `src/app/notifications/page.tsx` を Server Component に移行し、静的なヘッダー等の外枠を即座にレンダリングする。
  - 通知一覧データのフェッチ領域を `<Suspense fallback={<NotificationsSkeleton data-testid="notifications-skeleton" />}>` でラッピングして非同期描画する。
  - _Requirements: 9.4, 9.5, 9.6, 9.8_
  - _Boundary: NotificationsPage_
- [x] 9.3 プロフィール関連画面の非同期最適化 (P)
  - プロフィール詳細（`/profile/[uid]`）および編集（`/profile/edit`）を Server Component に移行し、静的フレーム（戻るボタン、コンテナ等）を即時描画・配信する。
  - プロフィール情報フェッチ領域を `<Suspense fallback={<ProfileDetailSkeleton data-testid="profile-skeleton" />}>` でラッピングして非同期描画する。
  - _Requirements: 9.9, 9.10, 9.11, 9.14_
  - _Boundary: ProfilePage_
- [x] 9.4 その他関連画面の非同期最適化と a11y testid 付与 (P)
  - フォロー一覧（`/connections`）やリアクション履歴（`/likes`）を Server Component 化し、静的フレームの先行描画とスケルトン（`data-testid` 付与）を実装する。
  - _Requirements: 9.12, 9.13, 9.14_
  - _Boundary: PageRouterComponents_
- [x] 9.5 認証必須画面における Middleware サーバーサイド認証保護の実装
  - 未ログインアクセス時にクライアント側リダイレクトによる白紙表示を防ぐため、`src/middleware.ts` を作成（または更新）し、サーバーサイドで即時リダイレクト（`307`）制御する。
  - _Requirements: 1.2, 9.1, 9.4, 9.9_
  - _Boundary: NextMiddleware_
- [x] 9.6 非同期最適化の結合テスト・E2E テストの作成・更新
  - 各非同期スケルトンの `data-testid`（`bookmarks-skeleton`, `notifications-skeleton`, `profile-skeleton`, `connections-skeleton`）を検証し、ロード後に実データが表示されるシーケンスを検証する。
  - _Requirements: 9.7, 9.8, 9.14_
  - _Boundary: Testing_

### 10. Phase 23: リアクション履歴導線削除（2026-06-09）

> **前提**: リアクション機能は廃止方向。`/profile/[uid]/likes` ルート・`LikesClient`・`ReactionService` はレガシーとして変更しない（直接 URL アクセスのみ存続可）。

- [x] 10.1 本人プロフィール `profileActions` からリアクション履歴導線を削除
  - `src/app/profile/[uid]/profile-client.tsx` の本人（`isMyProfile`）向け `profileActions` から、`/profile/[uid]/likes` への `Link`（Heart アイコン付き「リアクション履歴」）を削除する。
  - 未使用となる `Heart`（`lucide-react`）import を削除する。
  - `data-testid="profile-reaction-history-link"` 等の導線用 testid は付与しない。
  - **完了状態**: 本人プロフィールの `profileActions` に「プロフィールの編集」のみ表示され、「リアクション履歴」リンクが DOM に存在しないこと。弱点克服セクション・他ユーザー側フォローボタンは従来どおり。
  - _Requirements: 2.7, 6.1, 10.1, 10.2, 10.3, 10.6_
  - _Boundary: ProfileClient_

- [ ]* 10.2 (P) ProfileClient RTL — 本人プロフィールに「リアクション履歴」テキストが無いこと（任意）
  - 本人プロフィール描画時、`profileActions` 領域に「リアクション履歴」テキストが存在しないことを RTL で検証する（専用テストファイル新規作成可）。
  - 「プロフィールの編集」リンクは表示されることを併せて確認する。
  - **完了状態**: 該当 RTL テストがグリーン、または本タスクをスキップして 10.1 の手動確認のみで充足すること。
  - _Depends: 10.1_
  - _Requirements: 2.7, 10.1_
  - _Boundary: ProfileClient-RTL_

- [x] 10.3 E2E F-407 と直接実装候補 `remove-reaction-history-e2e` の整合
  - `e2e/social-features.spec.ts` の `F-407: リアクション履歴が正常に表示されること` は、プロフィール上の「リアクション履歴」リンククリックを前提とするため、**削除** または **`test.skip` + Phase 23 理由コメント** とする。
  - 直接実装候補 `remove-reaction-history-e2e`（roadmap Wave 23）と方針を一致させ、同一 PR または直後の follow-up で整理する。
  - likes ルート直接 URL（`/profile/{uid}/likes`）の E2E は本フェーズ必須範囲外（レガシー存続）。
  - **完了状態**: F-407 が明示的に skip/削除され、導線削除後に E2E スイートが意図どおりパスまたはスキップ理由が記録されていること。
  - _Depends: 10.1_
  - _Requirements: 10.7_
  - _Boundary: E2E-social-features_

