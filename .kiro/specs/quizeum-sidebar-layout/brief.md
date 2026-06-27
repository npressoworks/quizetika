# Brief: quizetika-sidebar-layout

## Problem
現在のQuizetikaはデスクトップでもモバイルでもヘッダー（Header）を中心としたナビゲーションになっており、メニュー項目（ホーム、通知、ブックマーク、作問、ダッシュボード、プロフィールなど）が増えるにつれて、ヘッダーに要素が集中するかドロップダウンに隠れてしまい、アクセス性が低下しています。また、一般的なモダンSNS（XやInstagram）と比較して、UIのWOW感やプレミアムな操作性が不足しています。

## Current State
- `src/components/layout/header.tsx` がロゴ、デスクトップナビ、ユーザーメニュー、モバイルメニューのすべてを所有。
- デスクトップでは上部にヘッダーが固定。
- モバイルではハンバーガーメニューを開かないと通知やブックマークにアクセスできない。
- クイズプレイ中（`/play`）はヘッダーを非表示にしている。

## Desired Outcome
- **PC/タブレット**: 画面左側に常時固定される左サイドバー（Sidebar）を導入し、メニュー項目を一元化。
- **モバイル**: 画面下部に固定されるボトムナビ（BottomNav）を新設し、上部にはロゴとユーザーメニューのみを持つシンプルなミニヘッダーを表示。
- XやInstagramに匹敵する、スムーズでプレミアムなレスポンシブ・ナビゲーションUIを実現する。

## Approach
**フルハイブリッドアプローチ（X/Instagram風モバイルボトムナビ ＋ PC/タブレット左サイドバー）**
- `Sidebar` コンポーネントを新規追加（PC時はメニューテキスト付き、タブレット時はアイコンのみにレスポンシブ切り替え）。
- `BottomNav` コンポーネントを新規追加（モバイルサイズで画面下部に固定）。
- 既存の `Header` をモバイルサイズ専用のミニヘッダーとして軽量化。
- `src/app/layout.tsx` を修正し、これら3つのコンポーネントを適切なグリッド/フレックスレイアウトで配置。

## Scope
- **In**:
  - `src/components/layout/sidebar.tsx` および `sidebar.module.css` の新規実装。
  - `src/components/layout/bottom-nav.tsx` および `bottom-nav.module.css` の新規実装。
  - `src/components/layout/header.tsx` および `header.module.css` のモバイル軽量化リファクタリング。
  - `src/app/layout.tsx` へのコンポーネント統合とレスポンシブCSSレイアウトの構築。
  - プロフィール、作問、通知などの各既存ルートと新サイドバー/ボトムナビとの連携テスト。
- **Out**:
  - クイズプレイ画面（`/play`）でのレイアウト変更（引き続き非表示とする）。
  - サイドバー内の通知バッジなどのリアルタイム更新機能（UI上の表示枠のみとし、今後の別フェーズでの実装とする）。

## Boundary Candidates
- **Sidebar-Component**: PC/タブレット用の縦型ナビゲーションメニュー。
- **BottomNav-Component**: モバイル用の下部固定型ナビゲーションメニュー。
- **Layout-Grid**: 画面幅に合わせたメインコンテンツエリアのマージン調整。

## Out of Boundary
- 各画面内部（ホーム、プロフィール等）のメインコンテンツのデザインや表示データのロジック変更。

## Upstream / Downstream
- **Upstream**: `quizetika-auth-profile-ui` (ログイン状態やアバター表示、通知・ブックマークのルート定義に依存)
- **Downstream**: 今後追加されるすべての画面UI（左サイドバーレイアウト下でレンダリングされる）

## Existing Spec Touchpoints
- **Extends**: `quizetika-auth-profile-ui` の `Header` 実装を置き換える。
- **Adjacent**: `quizetika-play-flow-ui` のホームやクイズ詳細のレイアウト余白に干渉するため、余白設定の整合をとる。

## Constraints
- **TailwindCSS禁止**: スタイリングには CSS Modules (Vanilla CSS) を使用すること。
- **プレイ画面の保護**: `/play` パスではサイドバー、ボトムナビ、ヘッダーをレンダリングしないこと。
- **レスポンシブ切替点**:
  - 1024px以上: サイドバー表示（テキストあり、幅275px）
  - 768px〜1023px: サイドバー表示（アイコンのみ、幅70px）
  - 767px以下: モバイルヘッダー + ボトムナビ表示
