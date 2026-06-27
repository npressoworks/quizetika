# Brief: quizetika-ads

## Problem
クイズSNS「quizetika」において、無料プラン（一般ユーザー）向けの収益化手段として広告表示を実装する必要があります。ただし、ゲームプレイの快適性や没入感を過度に損なわず、また有料プラン（Pro/Premium）のユーザーには広告を一切表示しない制御が求められます。

## Current State
Stripe課金および有料プラン判定ロジック（`pro` / `premium` で active）はすでに実装されていますが、Google AdSense のスクリプト読み込み、インライン広告枠のレンダリング、クイズ完了から結果への遷移時の割り込み等の広告表示制御は全く存在しません。

## Desired Outcome
* 有料プランのユーザーに対しては、一切の広告スクリプトをロードせず、UI上でも広告を完全に非表示にする。
* 一般ユーザー（無料会員）には以下の2か所で広告を表示する：
  1. クイズ一覧（ホーム、検索結果、ジャンル別一覧、タグ別一覧）において、クイズカード10件ごとに1件のインライン広告（PRチップ付きの広告カード）を表示する。
  2. クイズプレイ完了から結果画面遷移時、1/3の確率で自前の全画面動画広告モーダルを表示する。モーダルは5秒後にスキップ可能になり、スキップ後に結果画面へと遷移させる。
* ローカル開発環境やE2Eテストにおいて、モック経由で広告非表示や強制表示などのテストが容易に実行できる状態にする。

## Approach
* **クライアントサイド完全注入方式**:
  * 広告のロード・表示判定・テスト用のモック制御をカプセル化した `useAds` フックを作成します。
  * Google AdSense のスクリプトは `next/script` を利用し、有料会員以外の場合のみ動的に読み込みます。
  * クイズ一覧での広告挿入は、描画時にインデックスに基づいて `AdsenseInlineAd` コンポーネントを差し込みます。
  * 動画広告は、トリガーが自前制御しやすい「自前モーダル（`VideoAdModal`）」として実装し、5秒経過後に結果遷移を続行するコールバックを仕込みます。

## Scope
- **In**:
  - `useAds` フック（有料プラン判定、モック制御、動画広告トリガー制御）
  - `AdsenseInlineAd` コンポーネント（PRチップ付きのリストカード風コンポーネント）
  - `VideoAdModal` コンポーネント（ダミー動画プレイヤー、5秒カウントダウン、スキップアクション）
  - `src/app/layout.tsx` での Google AdSense ススクリプト動的ロード
  - クイズ一覧（ホーム、検索、ジャンル、タグ）へのインライン広告差し込み
  - クイズプレイ（通常、テストプレイ）から結果画面遷移時の動画広告割り込み実装
- **Out**:
  - Google AdSense 以外のサードパーティ広告SDKの導入
  - クイズプレイ中（解答中）のバナー広告表示（没入感低下防止のため）
  - 5秒未満でのスキップ不可能な長尺強制動画広告

## Boundary Candidates
- 広告用コンポーネントおよびロジックの配置： `src/components/ads/` または `src/hooks/useAds.ts`

## Out of Boundary
- Stripe サブスクリプション決済処理自体（既存の `quizetika-billing-subscription-ui` が担当）
- ユーザーのサブスクリプション状態の同期（既存の Webhook が担当）

## Upstream / Downstream
- **Upstream**: `quizetika-core` (プラン判定ロジック、環境変数)
- **Downstream**: `quizetika-play-flow-ui` (クイズ一覧描画、プレイ・結果遷移)

## Existing Spec Touchpoints
- **Extends**: `quizetika-play-flow-ui`, `quizetika-core`
- **Adjacent**: `quizetika-billing-subscription-ui`

## Constraints
- Tailwind CSS v4 / shadcn/ui もしくは Vanilla CSS を用いたクリーンでモダンなデザイン
- AdSense ID などの識別子は環境変数 (`NEXT_PUBLIC_ADSENSE_CLIENT_ID`) を経由
- 有料会員に対して余分なネットワークリクエストを発生させないこと
