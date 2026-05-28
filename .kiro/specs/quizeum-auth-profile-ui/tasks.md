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
