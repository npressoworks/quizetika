# Requirements Document

## Introduction
クイズ投稿SNS「quizetika」の信頼性向上およびユーザーサポート対応のため、トップページに右サイドバー（カラム）を設置して利用規約、プライバシーポリシー、お問い合わせへの導線を提供し、それぞれの法的情報・規約等の専用ページを新規追加します。

## Boundary Context
- **In scope**:
  - トップページ（PC表示）における右サイドバーカラムの配置。
  - モバイル端末表示時における右サイドバーコンテンツのメインコンテンツ直下への配置。
  - 利用規約ページ（`/terms`）の新規作成と規約表示。
  - プライバシーポリシーページ（`/privacy`）の新規作成とポリシー表示。
  - お問い合わせリンクの機能（設定値または環境変数をベースにした外部フォームへの遷移）。
- **Out of scope**:
  - ホーム画面以外の画面（クイズプレイ画面、クイズ作成・編集画面、クリエイターダッシュボード画面など）における右サイドバーの追加。
  - 規約ドキュメントの動的編集機能や管理者向け管理パネル。
- **Adjacent expectations**:
  - 左サイドバー（`Sidebar`）およびボトムナビ（`BottomNav`）等の既存の共通ナビゲーションレイアウトは、トップページにおける右サイドバーの追加によって表示崩れを起こさないよう、適切なパディングや余白を維持すること。

## Requirements

### Requirement 1: トップページ右サイドバーのレスポンシブ配置
**Objective:** As a quizetikaの一般ユーザー, I want トップページで利用規約やお問い合わせのリンクが自然に見えること, so that サービスの情報や法的規約にいつでもアクセスできること

#### Acceptance Criteria
1. When ユーザーがPC端末（ビューポート幅が一定以上）でトップページを表示したとき, the Home UI shall メインコンテンツの右側に幅300pxのサイドバーカラムを並列に表示する
2. When ユーザーがモバイル端末（ビューポート幅が一定未満）でトップページを表示したとき, the Home UI shall サイドバーコンテンツをメインコンテンツ（おすすめクイズやジャンルカルーセル等）の直下に縦並びで配置する
3. The Sidebar Card shall 既存のデザインシステム（ネオンカラー、Glassmorphism調など）と調和したプレミアムなカードデザインで描画される

### Requirement 2: 法的ページ（利用規約・プライバシーポリシー）の表示
**Objective:** As a サービスを利用するユーザー, I want リンクから利用規約やプライバシーポリシーの全文を読めること, so that サービスの安全性を確認できること

#### Acceptance Criteria
1. When ユーザーが「利用規約」リンクをクリックしたとき, the Browser shall `/terms` に遷移する
2. When ユーザーが「プライバシーポリシー」リンクをクリックしたとき, the Browser shall `/privacy` に遷移する
3. The /terms and /privacy pages shall 共通の `LayoutWrapper`（左サイドバー、ヘッダー、ボトムナビ等）を適用した状態で、法的文書の本文を読みやすいマークダウン風UIで描画する
4. The /terms and /privacy pages shall 各自のページに最適化されたSEO用メタデータ（独自のTitleおよびDescription）を持つ

### Requirement 3: お問い合わせフォームの動作
**Objective:** As a 問い合わせをしたいユーザー, I want 「お問い合わせ」リンクからGoogleフォームに移動できること, so that 運営に意見や不具合報告を送信できること

#### Acceptance Criteria
1. When ユーザーが「お問い合わせ」リンクをクリックしたとき, the Browser shall 新しいタブでお問い合わせフォームのURLを開く
2. If 環境変数 `NEXT_PUBLIC_CONTACT_FORM_URL` が設定されている場合, the System shall その値をお問い合わせ先のURLとして利用する
3. If 環境変数 `NEXT_PUBLIC_CONTACT_FORM_URL` が設定されていない場合, then the System shall 予め定義されたデフォルトのGoogleフォームのURLをお問い合わせ先のURLとして利用する
