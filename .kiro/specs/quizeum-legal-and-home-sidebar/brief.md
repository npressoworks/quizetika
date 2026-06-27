# Brief: quizetika-legal-and-home-sidebar

## Problem
ユーザーが利用規約やプライバシーポリシー、お問い合わせ窓口に簡単にアクセスできるよう、トップページにそれらのリンクを配置する必要がある。また、モバイル端末でもこれらの法的ドキュメントや問い合わせへの動線を確保する必要がある。

## Current State
現在、トップページはおすすめクイズ、おすすめジャンル、新着クイズが全幅のカルーセル表示になっている。利用規約（Terms）やプライバシーポリシー（Privacy）のページはなく、問い合わせへの動線も整備されていない。

## Desired Outcome
- **レイアウトの拡張**: PC表示時（`lg`以上）にトップページの右側に幅300px程度のカラムが追加され、利用規約・プライバシーポリシー・お問い合わせへのリンク、および著作権表示がカード形式で表示されること。
- **モバイルレスポンシブ**: モバイル表示時には、右カラムのコンテンツが非表示にならず、メインコンテンツ（カルーセル群）の下部に自動的に流れて表示されること。
- **新規ページの追加**:
  - `/terms` (利用規約) ページの新規作成（静的マークダウンまたはJSXで記述）。
  - `/privacy` (プライバシーポリシー) ページの新規作成。
  - Google問い合わせフォームへのリンク（環境変数 `NEXT_PUBLIC_CONTACT_FORM_URL` などを利用した外部リンク）。

## Approach
- `src/app/page.tsx` および `src/app/home-discovery-client.tsx` のレイアウトを `flex flex-col lg:flex-row gap-8`（または `grid grid-cols-1 lg:grid-cols-[1fr_300px] gap-8`）に変更し、モバイルでは縦並び、PCでは横並びで右側にカラムが配置されるようにする。
- 新規コンポーネント `HomeSidebar`（`src/components/explore/home-sidebar.tsx`）を作成し、そこに各種リンクとコピーライト表示をまとめる。デザインは Tailwind CSS v4 / shadcn UI のデザインシステムに整合させ、ネオンカラーやガラスモルフィズム風のプレミアムなカードスタイルとする。
- `/terms/page.tsx` および `/privacy/page.tsx` に基本的な規約文書をマークダウン風UIで表示する。

## Scope
- **In**:
  - トップページへの右カラム `HomeSidebar` コンポーネントの追加。
  - PC・モバイルでのレスポンシブなカラム配置（PCは右、モバイルは下部）。
  - `/terms`（利用規約）および `/privacy`（プライバシーポリシー）の新規Next.jsページの作成とレスポンシブUI。
  - Googleお問い合わせフォームへの外部リンク（環境変数フォールバックあり）。
- **Out**:
  - ホーム画面以外のページでの右カラム表示。
  - 利用規約やプライバシーポリシーの管理画面や動的編集機能。

## Boundary Candidates
- **Legal UI Component**: `src/components/explore/home-sidebar.tsx`
- **Legal Pages**: `src/app/terms/page.tsx`, `src/app/privacy/page.tsx`
- **Layout Logic**: `src/app/page.tsx`, `src/app/home-discovery-client.tsx`

## Out of Boundary
- 左サイドバー（`Sidebar`）やボトムナビ（`BottomNav`）そのもののUI変更（ただし、必要に応じて遷移先としての動作保証は含む）。

## Upstream / Downstream
- **Upstream**: `quizetika-sidebar-layout` (共通レイアウトの適用)
- **Downstream**: なし

## Existing Spec Touchpoints
- **Adjacent**: `quizetika-sidebar-layout` にて左サイドバーおよびボトムナビが動作しているため、これらと競合しないようパディングや余白を維持する。

## Constraints
- **Styling**: Tailwind CSS v4 を使用してスタイリングし、既存のデザインシステムと調和させる。
- **SEO & OGP**: `/terms` や `/privacy` ページにも適切なメタデータ（Title, Description）を付与する。
