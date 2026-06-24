# Implementation Plan

## 1. Foundation: 基盤整備
- [x] 1.1 法的ドキュメントのMarkdownソースファイル作成
  - `src/data/terms.md` および `src/data/privacy.md` を新規作成する
  - 各ファイルに、一般的な利用規約およびプライバシーポリシーの構造（定義、禁止事項、個人情報取扱い等）を持つ仮テキスト（日本語）を記述する
  - 完了基準：`src/data/terms.md` と `src/data/privacy.md` がローカルに存在し、マークダウン形式で記述されていること
  - _Requirements: 2.3_

- [x] 1.2 お問い合わせ用環境変数の定義
  - `.env` ファイルの末尾に、お問い合わせ先のダミーGoogleフォームURLを設定する環境変数 `NEXT_PUBLIC_CONTACT_FORM_URL` を追加する
  - 完了基準：`.env` ファイル内に設定が追記され、Node/Vite等のランタイムプロセスで読み込み可能であること
  - _Requirements: 3.2_

## 2. Core: 主要機能実装
- [x] 2.1 (P) 右カラム用サイドバーコンポーネント `HomeSidebar` の実装
  - `src/components/explore/home-sidebar.tsx` を新規作成する
  - shadcn/ui の `Card` と `Button` を使用して、ネオンカラーや透過背景（Glassmorphism調）を持つプレミアムなカードUIを構築する
  - 「利用規約」「プライバシーポリシー」への内部リンク（Link）、および「お問い合わせ」への外部リンクを配置する
  - お問い合わせリンクの遷移先は `NEXT_PUBLIC_CONTACT_FORM_URL` をベースに動的に解決し、未定義時はデフォルトのGoogleフォームURLにフォールバックするヘルパー関数を含める
  - 完了基準：ブラウザ表示で `HomeSidebar` がエラーなくインポートでき、期待通りの静的スタイルとリンクが構築されていること
  - _Requirements: 1.3, 2.1, 2.2, 3.1, 3.2, 3.3_
  - _Boundary: HomeSidebar_

- [ ] 2.2 (P) 利用規約およびプライバシーポリシー表示ページの作成
  - `src/app/terms/page.tsx` および `src/app/privacy/page.tsx` を Server Component として新規作成する
  - サーバーサイドで対応するMarkdownソースファイルを `fs.promises.readFile` で非同期ロードし、`marked` でHTMLに変換、`isomorphic-dompurify` でサニタイズした上でレンダリングする
  - 文書表示領域に Tailwind Typography風の適切な文字修飾用CSSスタイルをあてる
  - 各ページ独自の Metadata（Title, Description）を定義する
  - ドキュメント読み込みエラー時は、警告のカードUIをフォールバック表示してクラッシュを防ぐ例外ハンドリングを含める
  - 完了基準：`/terms` および `/privacy` にアクセスした際、読み込まれた法的ドキュメントの本文が美しいレイアウトで表示されること
  - _Requirements: 2.3, 2.4_
  - _Boundary: TermsPage, PrivacyPage_

## 3. Integration: 結合
- [ ] 3.1 トップページへの右カラム組み込みとレスポンシブ調整
  - `src/app/home-discovery-client.tsx` に `HomeSidebar` をインポートして配置する
  - 外枠に CSS Grid または Flexbox レイアウト（`flex flex-col lg:grid lg:grid-cols-[1fr_300px] lg:gap-8` 等）を適用する
  - PCサイズ（`lg`以上）では右側に `HomeSidebar` が300px固定でメインのクイズカルーセルと並列に表示されるようにする
  - モバイルサイズ（`lg`未満）では、`HomeSidebar` がおすすめクイズなどのメインコンテンツの直下に回り込んで縦並びで表示されるようにする
  - 左サイドバー（`Sidebar`）やボトムナビとの余白が崩れないか画面端の動作を確認する
  - 完了基準：PC・スマホ双方で崩れなく規約カラムが表示されること
  - _Requirements: 1.1, 1.2_
  - _Depends: 2.1_

## 4. Validation: 検証
- [ ] 4.1 UI・リンク遷移・レスポンシブ挙動のE2Eテスト
  - `tests/e2e/home-sidebar.spec.ts` を新規作成する（Playwright）
  - PC解像度（1280px以上）でトップページを開いた際、右カラムが存在し並列に表示されていること、およびモバイル解像度（480px以下）で下部に流れるレスポンシブ配置をアサーションする
  - 利用規約・プライバシーポリシーリンクをクリックして `/terms`・`/privacy` に遷移し、本文が正しくレンダリングされているかをテストする
  - お問い合わせリンクをクリックして、新規タブでフォームのURL（環境変数で設定された値またはデフォルト値）がオープンすることをテストする
  - 完了基準：`npx playwright test tests/e2e/home-sidebar.spec.ts` を実行し、すべてのE2Eテストがパスすること
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 3.1_
  - _Depends: 3.1, 2.2_

- [ ] 4.2 お問い合わせURL解決ロジックのユニットテスト
  - `tests/components/home-sidebar.test.tsx` (または `home-sidebar.test.ts`) を作成する
  - `process.env.NEXT_PUBLIC_CONTACT_FORM_URL` がセットされている場合にそのURLを返すこと、および未定義時にデフォルトURLへフォールバックすることをJestでテストする
  - 完了基準：`npm run test` もしくは該当テストが単体でパスすること
  - _Requirements: 3.2, 3.3_
  - _Depends: 2.1_
