# Implementation Plan: quizetika-auth-profile-ui

## Tasks

### 1. 共通デザインシステムとレイアウトの構築
- [x] 1.1 グローバルCSS変数と共通スタイル（Vanilla CSS/CSS Modules）の実装 (P)
  - `src/app/globals.css` に、硬すぎないカジュアルモダンなデザインシステムトークン（丸みのある角丸、温かみのあるカラーパレット、標準フォント等）を設定する。
  - ボタン（主要/補助）、カード、フォーム入力などの汎用共通CSSモジュールを用意し、動作を確認する。
  - _Requirements: 2.1, 3.1_
  - _Boundary: CSS-Tokens_
- [x] 1.2 共通Headerレイアウトコンポーネントの実装
  - `src/components/layout/header.tsx` を作成し、アプリケーション全体のヘッダーをレスポンシブかつ美しいデザインで実装する。
  - 認証状態（`useAuth`）を監視し、未ログイン時は「ログイン」ボタン、ログイン時はアバター画像とドロップダウンメニュー（プロフィール、通知、ログアウト等）を動的に表示する。
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

> **前提**: `quizetika-core` Phase 8 完了（`getQuizListsByAuthor` + `listType` フィルタ、`resolveListType`）。`quizetika-creator-dash-ui` / `quizetika-play-flow-ui` Phase 8 でリスト作成・詳細表示は実装済み。

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
  - 未使用となる `Heart`（`@mui/icons-material`）import を削除する。
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

### 11. Phase 26: プロフィールリストタブの除去（2026-06-10）

> **前提**: `quizetika-core` Phase 26 完了後。`profile-client.tsx` は play-flow-ui 28.5 によりリストタブ除去済みの可能性あり — 本スペックは auth-profile 境界として残存参照・テスト掃除と検証を行う。

- [x] 11.1 `ProfileClient` からリストタブ・取得ロジックの除去
  - `src/app/profile/[uid]/profile-client.tsx` から「作成したリスト」タブ・`TabsContent`・`getQuizListsByAuthor` 呼び出し・`quizLists` state を除去する（未除去の場合）。
  - `ProfileContentTab` を `quizzes` | `history` のみとし、本人のみ「プレイ履歴」第2タブを維持する。
  - **完了状態**: プロフィール DOM に「作成したリスト」タブが存在せず、作成クイズ・プレイ履歴（本人）タブが回帰なく動作すること。
  - _Requirements: 2.2, 11.1, 11.2, 11.3, 11.6, 11.7_
  - _Depends: quizetika-core 23.6_
  - _Boundary: ProfileClient_

- [x] 11.2 リスト専用コンポーネント・テストの除去
  - `profile-lists-panel.tsx`、`profile-list-card.tsx`、`profile-list-display.ts` および関連 Jest（`profile-list-display.test.ts`、`profile-list-card.test.tsx`、`profile-lists-panel.test.tsx`）を削除する（存在する場合）。
  - プロフィールリストタブ前提の E2E シナリオを削除または更新する。
  - **完了状態**: リスト専用 profile コンポーネント・テストがリポジトリから除去され、関連 Jest がグリーンであること。
  - _Requirements: 11.4, 11.5, 11.10_
  - _Depends: 11.1_
  - _Boundary: Testing_

- [x] 11.3 Phase 26 統合検証
  - 本人・他ユーザープロフィールでタブ構成が要件 11 どおりであることを確認する。
  - プレイ履歴（要件 7）、フォロー操作、弱点克服導線、Phase 23 リアクション履歴導線削除が回帰なく動作することを確認する。
  - **完了状態**: auth-profile 関連ビルド・テストがグリーンで、プロフィールにリスト導線が残存しないこと。
  - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7, 11.8, 11.9, 11.10_
  - _Depends: 11.1, 11.2_
  - _Boundary: Integration_

## Implementation Notes (Phase 26)

- リストルート・ブックマークリストタブ削除の正本は `quizetika-play-flow-ui` 28.x。本スペックはプロフィール「作成したリスト」タブと profile 専用コンポーネント。
- 要件 8（Phase 8）は **廃止**。履歴参照のみ。
- 実装順: `quizetika-core` 23.6 → play-flow 28.5（部分実装可）→ 本スペック 11.1/11.2 → 11.3。

### 12. Phase 27 拡張 — 作成したクイズのページングと検索機能（2026-06-23）

- [x] 12.1 (P) 作成したクイズの検索・フィルタリングロジックの実装
  - `src/app/profile/[uid]/profile-client.tsx` に検索キーワード用の状態変数 `searchQuery` と、リアルタイムでクイズを絞り込む `filteredQuizzes` ロジックを実装する。
  - タイトル、説明、ジャンル、タグのいずれかにマッチすること。キーワード変更時にページ番号 `currentPage` を1にリセットすること。
  - _Requirements: 12.2, 12.3_
  - _Boundary: ProfileClient_
- [x] 12.2 (P) クイズ一覧のページングロジックとUIの実装
  - `src/app/profile/[uid]/profile-client.tsx` に現在のページ番号用状態変数 `currentPage` を追加し、1ページあたり9件で分割表示するスライスロジックとページングUI（ページ番号、前へ・次へボタン）を実装する。
  - 1ページ目で「前へ」ボタン無効、最終ページで「次へ」ボタン無効に制御する。全体の件数が9件以下の場合はページングUIを非表示にする。
  - _Requirements: 12.4, 12.6, 12.7_
  - _Boundary: ProfileClient_
- [x] 12.3 ページ切替時のスムーズスクロール統合
  - `ProfileClient` のページ変更ハンドラにおいて、ページ変更と同時にクイズタブコンテンツの開始位置（`#profile-quizzes-container` など）へスムーズスクロールさせるロジックを統合する。
  - _Requirements: 12.5_
  - _Depends: 12.2_
  - _Boundary: ProfileClient_
- [x] 12.4 data-testid 契約の適用とマークアップ更新
  - `profile-client.tsx` の検索入力欄に `data-testid="profile-quiz-search-input"`、ページングUIコンテナに `data-testid="profile-quiz-pagination"`、およびクイズカードに `data-testid="profile-quiz-card"` を付与する。
  - _Requirements: 12.1, 12.8_
  - _Depends: 12.1, 12.2_
  - _Boundary: ProfileClient_
- [x] 12.5 Phase 27 統合検証とE2Eテストの作成/更新
  - `npm test` および `npm run build` がグリーンであることを確認し、 Playwright E2Eテストにおいて検索ワード入力による絞り込みや、ページ遷移によるクイズ表示の変化、および testid が正しく機能することを検証するテストを追加・実行する。
  - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5, 12.6, 12.7, 12.8, 13.5_
  - _Depends: 12.7_
  - _Boundary: Testing_
- [x] 12.6 (P) 共通QuizCardコンポーネントの適用と状態管理の実装
  - `profile-client.tsx` において独自のクイズ表示を `@/components/quiz/quiz-card` の `QuizCard` に置き換える。
  - `bookmarkedIds` ステート、および初期取得のための `getBookmarkedQuizIds` 呼び出し、トグルのための `toggleBookmark` を実装する。未ログイン時のログインリダイレクトを実装する。
  - _Requirements: 13.1, 13.2, 13.3, 13.4_
  - _Boundary: ProfileClient_
- [x] 12.7 (P) テストコードの更新（QuizCardの適用に追従）
  - `tests/components/profile-client.test.tsx` の要素探索において、`profile-quiz-card` の代わりに `quiz-card` を探すようにアサーションを修正する。
  - ブックマークトグルおよび詳細遷移のモック呼び出しが正しく行われることをテストに追加・検証する。
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5_
  - _Depends: 12.6_
  - _Boundary: Testing_




### 13. Phase 28: 好きなジャンルの設定と表示EEhase 28EE

> **前提**: `quizetika-core` におけめE`UserService.updateProfile` および `@/hooks/useActiveGenres` などのマスタチEEタ取得機Eが有効であること、E

- [x] 13.1 (P) プロフィール編雁E面での好きなジャンル選択UIおよび初期表示の実裁E
  - `src/app/profile/edit/profile-edit-client.tsx` において、`useActiveGenres` を用ぁE有効ジャンルマスタを取得し、褁Eトグル選択できるボタン/チップ型UIを表示する、E
  - ユーザーチEEタの `followedGenres` が既に存在する場合E、それを初期選択状態に反映させる、E
  - ジャンル選択UIコンチEに `data-testid="profile-genre-select"` を付与する、E
  - **完亁E慁E*: 編雁E面で利用可能なジャンル一覧が描画され、クリチE操作で選抁E解除のトグルが機Eすること、E
  - _Requirements: 14.1, 14.2, 14.7_
  - _Boundary: ProfileEditClient_

- [x] 13.2 (P) 好きなジャンルの保存E琁EE実裁E
  - プロフィール編雁E面の保存E琁Eに、E択されたジャンルIDリストを `followedGenres` フィールドにアタチEし、`UserService.updateProfile` を呼び出して保存する、E
  - 保存E功後、E動的にユーザー自身のプロフィール詳細画面EE/profile/[uid]`Eへ遷移させる、E
  - **完亁E慁E*: 保存EタンをクリチEした際、変更された好きなジャンル惁Eが正常に保存され、詳細画面へリダイレクトされること、E
  - _Requirements: 14.3_
  - _Depends: 13.1_
  - _Boundary: ProfileEditClient_

- [x] 13.3 (P) プロフィール表示画面での好きなジャンルチップ表示の実裁E
  - `src/app/profile/[uid]/profile-client.tsx` にて `useActiveGenres` からジャンルマスタをロードし、対象ユーザーの `followedGenres`EジャンルID配EEを解決する、E
  - 解決された各ジャンルにつぁE、表示名テキストとアイコン画像！EiconImageUrl`Eを含むチップを「好きなジャンル」として基本惁E領域に表示する、E
  - ジャンルが未設定で本人の場合、「好きなジャンルを登録しましょぁEテキストと `/profile/edit` への遷移リンクを表示する、E
  - ジャンルが未設定で他人の場合、好きなジャンル表示領域自体を非表示とする、E
  - 表示領域のコンチEに `data-testid="profile-favorite-genres"` を付与する、E
  - **完亁E慁E*: プロフィール詳細画面にて設定されたジャンルチップが正しくレンダリングされ、未登録時E条件刁E（本人/他人Eが動作すること、E
  - _Requirements: 14.4, 14.5, 14.6, 14.7_
  - _Boundary: ProfileClient_

- [x] 13.4 単体テストERTLチEトE作E/更新
  - `ProfileEditClient` および `ProfileClient` のチEトファイルを更新EまたE新規作EEし、ジャンルの褁E選択、E期表示、保存時の `updateProfile` 呼び出し、チチEEのマスタ解決表示、未登録時E表示刁EロジチEが正常に動作することめEJest 等で検証する、E
  - **完亁E慁E*: 追加・更新した単体テストスイートがすべてグリーンEEASSEであること、E
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6_
  - _Depends: 13.2, 13.3_
  - _Boundary: Testing_

- [x] 13.5 (P) E2EチEトE作E/更新
  - `e2e/auth-profile.spec.ts` などの Playwright E2EチEトを更新し、テストユーザーでログイン後、Eロフィール編雁E面から好きなジャンルを褁E選択して保存し、詳細画面でチップが正しく表示される統合シナリオを検証する。また未登録時E本人・他人の表示条件を検証する、E
  - **完亁E慁E*: E2EチEトスイートがパスすること、E
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_
  - _Depends: 13.4_
  - _Boundary: Testing_

- [x] 13.6 Phase 28 統合検証
  - 好きなジャンル設定E表示機Eを含め、`npm run build` および `npm test` がエラーなく通ることを確認する、E
  - **完亁E慁E*: ビルドと全チEト！Eest、E2EEが成功すること、E
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7_
  - _Depends: 13.5_
  - _Boundary: Integration_

### 14. Phase 29: プロフィール表記変更、ダッシュボードリンク追加、およびプレイ履歴表示ガード（2026-06-28）

- [ ] 14.1 (P) プロフィール関連メニューの「プロフィール」表記への変更
  - `src/components/layout/sidebar.tsx` 内 of `menuItems` 配列 of オブジェクト定義で、ラベル `label: 'プロフィール'` を `label: 'プロフィール'` に変更する。
  - `tests/components/sidebar.test.tsx` of 中 of 「プロフィール」期待値を含むテスト（2箇所）を「プロフィール」に書き換え、テストがパスすることを確認する。
  - **完了状態**: サイドバー上で「プロフィール」 of 代わりに「プロフィール」と描画され、テストスイートがパスすること。
  - _Requirements: 15.1_
  - _Boundary: Sidebar-Rename_

- [ ] 14.2 (P) アバタードロップダウンメニューへのダッシュボードリンク追加
  - `src/components/layout/sidebar.tsx` および `src/components/layout/header.tsx` of アバタークリック時 of `DropdownMenuContent` に、クリエイターダッシュボード（`/creator/dashboard`）へのリンクを挿入し、適切な `data-testid` （`sidebar-dashboard-link` と `header-dashboard-link`）を付与する。
  - `tests/components/sidebar.test.tsx` および `tests/components/header-profile-popup.test.tsx` of ドロップダウン開閉テストにダッシュボードリンク存在検証 of アサーションを追加し、テストがパスすることを確認する。
  - **完了状態**: アバタークリック時 of ドロップダウンメニュー内にダッシュボードリンクが描画され、関連テストがすべてグリーンであること。
  - _Requirements: 15.2, 15.5_
  - _Boundary: Layout-Dropdowns_

- [ ] 14.3 (P) 他人プロフィールでのプレイ履歴タブコンテンツのレンダリングガード
  - `src/app/profile/[uid]/profile-client.tsx` で、他人 of プロフィール（`isMyProfile` が `false`） of ときに `<TabsContent value="history">` がマウントされないように `isMyProfile && (...)` による条件付きレンダリングに変更する。
  - **完了状態**: 他人プロフィール（`isMyProfile == false`）を開いた際、HTML/DOM上にプレイ履歴セクションが一切描画されず、自分自身 of プロフィールではタブ選択時に正しくプレイ履歴が表示されること。
  - _Requirements: 15.3, 15.4_
  - _Boundary: ProfilePage-PlayHistoryGuard_

- [ ] 14.4 Phase 29 統合検証
  - `npm test` と `npm run build` を実行し、既存テストおよび追加・修正したテストがすべてエラーなくビルド・パスすることを確認する。
  - **完了状態**: 全テストおよび本番ビルドがグリーン（PASS）であること。
  - _Requirements: 15.1, 15.2, 15.3, 15.4, 15.5_
  - _Depends: 14.1, 14.2, 14.3_
  - _Boundary: Integration_

### 15. Phase 30: アバター画像変更とプロフィールタブ視認性向上（2026-07-14）

- [x] 15.1 アバター画像検証ライブラリの実装
  - `src/lib/avatar-upload.ts` に、許可される画像形式（PNG/JPEG/GIF）と上限サイズ（5MB）を検証する純関数（`validateAvatarFile`, `assertAvatarFileValid`）を実装する。
  - **完了状態**: 許可形式内・許可形式外・サイズ超過の各ケースで、検証関数が期待どおりの ok/error 結果を返すこと。
  - _Requirements: 16.3, 16.4_
  - _Boundary: avatar-upload_

- [x] 15.2 (P) アバター画像アップロード関数の実装
  - `src/services/storage.ts` に `uploadUserAvatar(file, uid)` を追加し、`assertAvatarFileValid` による検証を通した上で `getUserAvatarPath` のパスへ Supabase Storage にアップロードし、公開URLを返す。
  - **完了状態**: 有効な画像ファイルを渡すと公開URLが返り、不正な画像を渡すと検証エラーが送出されること。
  - _Depends: 15.1_
  - _Requirements: 16.5_
  - _Boundary: storage-service_

- [x] 15.3 (P) プロフィール更新データへのアバターURL項目追加
  - `src/services/user.ts` の `UpdateProfileData` に `avatarUrl?: string` を追加し、`updateProfile()` が `avatarUrl` が指定された場合のみ更新対象に含めるようにする。
  - **完了状態**: `avatarUrl` を指定して `updateProfile` を呼ぶとユーザーレコードのアバターURLが更新され、指定しない場合は既存値が変更されないこと。
  - _Requirements: 16.8_
  - _Boundary: user-service_

- [x] 15.4 (P) プロフィール編集画面へのアバター選択・プレビューUIの統合
  - `src/app/profile/edit/profile-edit-client.tsx` に `avatarFile` / `avatarPreviewUrl` / `avatarError` の状態管理と、ファイル選択ハンドラ（`validateAvatarFile` による検証呼び出し）を実装する。
  - ファイル入力に `data-testid="profile-avatar-upload-input"`、プレビュー領域に `data-testid="profile-avatar-preview"` を付与する。
  - 新しいファイル選択時およびコンポーネントのアンマウント時に、直前の `URL.createObjectURL` プレビューURLを `URL.revokeObjectURL` で解放する。
  - **完了状態**: 有効な画像を選択すると保存前のプレビューが表示され、既存の保存済みアバターは変更されないこと。不正な画像を選択すると保存前にエラーメッセージが表示されプレビューは更新されないこと。
  - _Depends: 15.1_
  - _Requirements: 3.4, 16.1, 16.2, 16.3, 16.4, 16.10_
  - _Boundary: ProfileEditClient_

- [x] 15.5 保存フローへのアバターアップロード統合と表示反映
  - `handleSubmit` にて、`avatarFile` が存在する場合のみ `uploadUserAvatar` を呼び出してURLを取得し、`updateProfile` へ `avatarUrl` として渡す。アップロード中は保存ボタンを無効化する。
  - 保存成功後、`useAuth().refreshUser()` を呼び出してからプロフィール画面へ遷移する。失敗時は変更前のアバター表示を維持したままエラーメッセージを表示する。
  - **完了状態**: アバターを変更して保存すると、プロフィール画面・ヘッダー・サイドバーのアバター表示が更新後の画像に切り替わること。アバター未変更で他項目のみ保存した場合はアバターが変化しないこと。アップロード失敗時は変更前のアバターが維持されエラーが表示されること。
  - _Depends: 15.2, 15.3, 15.4_
  - _Requirements: 16.5, 16.6, 16.7, 16.8, 16.9_
  - _Boundary: ProfileEditClient_

- [x] 15.6 (P) プロフィールタブの視認性向上スタイル適用
  - `src/app/profile/[uid]/profile-client.tsx` の `TabsList` / `TabsTrigger` に `className` を追加し、選択中タブと非選択タブのコントラストを強化し、モバイル幅でのタップ領域を拡大する。共有 `src/components/ui/tabs.tsx` 自体は変更しない。
  - **完了状態**: 選択中のタブが背景色・下線等で非選択タブと明確に区別でき、タブの件数表示・タブ数（2タブ構成）は変更されていないこと。
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
  - _Boundary: ProfileClient-Tabs_

- [x] 15.7 (P) アバター検証ライブラリの単体テスト
  - `avatar-upload.test.ts` を作成し、許可形式内・許可形式外・サイズ超過の各ケースを検証する。
  - **完了状態**: 追加した単体テストスイートがすべてグリーン（PASS）であること。
  - _Depends: 15.1_
  - _Requirements: 16.3, 16.4_
  - _Boundary: Testing_

- [x] 15.8 Phase 30 統合検証とE2Eテスト
  - アバター選択→プレビュー→保存→プロフィール/ヘッダー反映のフローと、不正ファイル時のエラー表示、未変更時のアバター保持、タブの選択状態の視覚的区別を手動またはPlaywrightで検証する。
  - `npm test` および `npm run build` がグリーンであることを確認する。
  - **完了状態**: Phase 30 関連のテスト・ビルドがすべてグリーンであり、手動/E2E確認項目がすべて満たされていること。
  - **実施結果（2026-07-14）**: `npx jest`（全261スイート・1693テスト）PASS。`npm run build` PASS（`/profile/edit`, `/profile/[uid]` を含む全ルートのビルド成功）。アバター選択→プレビュー→保存→反映、失敗時のロールバック表示、未変更時のavatarUrl非送信、タブの視覚強調・アクセシビリティ状態は RTL 統合テスト（`profile-edit-client.test.tsx` 9件、`profile-client.test.tsx` 14件）で検証済み。
  - _Depends: 15.5, 15.6, 15.7_
  - _Requirements: 3.4, 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 17.1, 17.2, 17.3, 17.4, 17.5, 17.6_
  - _Boundary: Integration_

### 16. Phase 31: アバター画像の円形トリミング機能（2026-07-16）

- [x] 16.1 `ImageCropper`のアスペクト比・クロップ形状・出力解像度のProps化
  - モジュールレベル定数 `CROP_ASPECT` を `aspect` Prop（デフォルト `1.91`）に置換し、クロップ枠サイズ・最小ズーム算出（`onMediaLoaded`）・`react-easy-crop` への指定をすべて Props 経由の値に変更する。
  - `calculateTargetDimensions` と `getCroppedImg` にアスペクト比引数を追加し、`maxWidth`/`maxHeight` もコンポーネント側から Props として受け取れるようにする（デフォルト値は現行の `1920`/`1005` を維持し、既存の2引数呼び出しの挙動を変えない）。
  - `cropShape` Prop（デフォルト `'rect'`）を追加し、`react-easy-crop` の `Cropper` へそのまま伝播する。
  - **観測可能な完了状態**: `aspect={1}` `cropShape="round"` を指定してレンダリングすると正方形の円形マスクのクロップ枠が表示され、Props省略時は従来どおり1.91:1の矩形クロップ枠が表示される。
  - _Requirements: 18.1, 18.2, 18.3, 18.4_
  - _Boundary: ImageCropper_

- [x] 16.2 `ImageCropper`のエラー通知・テスト識別子のProps化
  - `quality` Prop（デフォルト `0.85`）を追加し、`canvas.toBlob` の第3引数に反映する。
  - `confirmTestId`/`cancelTestId` Prop（デフォルト `'image-cropper-confirm'`/`'image-cropper-cancel'`）を追加し、確定・キャンセルボタンの `data-testid` に反映する。
  - `onError` Prop（任意のコールバック）を追加し、切り抜き処理失敗時に指定があれば呼び出し、未指定時は既存の `alert()` 表示にフォールバックする。
  - **観測可能な完了状態**: `onError` 未指定時に切り抜き失敗を発生させると `alert()` が呼ばれ、`onError` 指定時は `alert()` が呼ばれずコールバックにエラーメッセージが渡る。
  - _Depends: 16.1_
  - _Requirements: 18.6, 18.8_
  - _Boundary: ImageCropper_

- [x] 16.3 (P) `image-cropper.test.tsx`へのProps配線検証テスト追加
  - `calculateTargetDimensions` に `aspect=1` を渡した場合、正方形512px上限縮小が正しく計算されることを検証する単体テストを追加する。
  - `ImageCropper` に `aspect={1}` `cropShape="round"` `confirmTestId`/`cancelTestId` を指定してレンダリングし、`react-easy-crop` の `Cropper` へ実際に `aspect=1` `cropShape="round"` が渡ること、確定・キャンセルボタンに指定した `data-testid` が反映されることをRTLで検証する。
  - `onError` 未指定時は `window.alert` が呼ばれ、指定時は `onError` コールバックが呼ばれ `alert` が呼ばれないことをモックで検証する。
  - **観測可能な完了状態**: 追加したテストケースがすべてグリーン（PASS）であり、既存の1.91:1前提テストも引数省略時のデフォルト値でグリーンのまま維持される。
  - _Depends: 16.1, 16.2_
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.6, 18.8_
  - _Boundary: ImageCropper-Testing_

- [x] 16.4 (P) `ProfileEditClient`へのトリミングフロー統合
  - `avatarFile: File | null` ステートを `avatarCroppedBlob: Blob | null` に置き換え、`cropSourceUrl`/`isCropModalOpen` ステートを追加する。
  - `handleAvatarChange` を、検証成功後に選択画像のObject URLで `ImageCropper` モーダル（`aspect={1}` `cropShape="round"` `maxWidth={512}` `maxHeight={512}` `confirmTestId="profile-avatar-crop-confirm"` `cancelTestId="profile-avatar-crop-cancel"` `onError`）を開くように変更する。
  - `handleCropComplete`/`handleCropCancel` ハンドラを実装する。確定時は切り抜き結果のプレビュー反映と `avatarCroppedBlob` への保持、キャンセル時は変更前のアバター表示維持と選択直後のObject URLの解放を行う。
  - `handleSubmit` の保存フローを、`avatarFile` ではなく `avatarCroppedBlob` が存在する場合のみ `uploadUserAvatar` を呼び出すように更新する。
  - **観測可能な完了状態**: プロフィール編集画面でアバター画像を選択すると円形トリミングモーダルが開き、確定するとアバター領域に円形プレビューが反映され、保存するとトリミング後の画像のみがアップロードされる。
  - _Depends: 16.1, 16.2_
  - _Requirements: 3.4, 16.2, 18.1, 18.5, 18.7_
  - _Boundary: ProfileEditClient_

- [x] 16.5 `profile-edit-client.test.tsx`のクロップフロー対応更新
  - アバター関連アサーションを、選択直後の直接プレビューを前提とする既存記述から、クロップモーダル表示→確定/キャンセル操作を経たフローに更新する。
  - クロップ確定操作をシミュレートした後に切り抜き結果がアップロード対象になること、キャンセル操作後は変更前のアバターが維持されることを検証するテストケースを追加する。
  - **観測可能な完了状態**: 更新後のテストスイートが全件グリーン（PASS）である。
  - _Depends: 16.4_
  - _Requirements: 16.2, 18.5, 18.6, 18.7_
  - _Boundary: ProfileEditClient-Testing_

- [x] 16.6 アバタークロップE2Eシナリオ追加とクイズ側回帰確認
  - `e2e/auth-profile.spec.ts` に、アバター画像選択→円形トリミングモーダル表示→確定操作→プレビュー反映、および選択→キャンセル操作→アバター不変の2シナリオを追加する。
  - クイズ編集画面のカバー画像トリミング（1.91:1・矩形）の既存E2Eシナリオを実行し、本フェーズの変更後も従来どおり動作することを確認する（回帰確認）。
  - **観測可能な完了状態**: 追加したE2Eシナリオおよび既存のクイズカバー画像トリミングE2Eがすべてパスする。
  - _Depends: 16.3, 16.5_
  - _Requirements: 18.1, 18.4, 18.5, 18.8_
  - _Boundary: E2E-auth-profile_

- [ ] 16.7 Phase 31 統合検証
  - `npm test` および `npm run build` を実行し、Phase 31 関連の単体テスト・結合テストおよび全体スイートがグリーンであることを確認する。
  - 要件18の全受け入れ基準（18.1〜18.8）および要件3.4・16.2がタスクとテストで充足されていることを requirements.md と突合して確認する。
  - **確認事項（16.5レビューでの指摘）**: `ProfileEditClient`側の`onError`配線（要件18.6の一部。切り抜き失敗時に`setAvatarError`が呼ばれモーダルは開いたまま維持される）を検証する単体テストが現状不足している（`ImageCropper`単体側の`onError`検証はtask 16.3でカバー済みだが、`ProfileEditClient`統合側は未カバー）。本タスクで手動確認または追加テストにより18.6の充足を最終確認すること。
  - **観測可能な完了状態**: 全テスト・ビルドが成功し、Phase 31 の要件がすべて実装・検証済みであること。
  - _Depends: 16.6_
  - _Requirements: 3.4, 16.2, 18.1, 18.2, 18.3, 18.4, 18.5, 18.6, 18.7, 18.8_
  - _Boundary: Integration_