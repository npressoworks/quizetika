# Brief: quizetika-billing-subscription-ui

## Problem
ウミガメのスープ（AI対話プレイ）では無料ユーザーに1日20回の質問制限があり、上限到達時にプレミアムプランへの誘導メッセージは表示されるが、実際に購入・契約管理できる画面や導線が存在しない。Stripe パッケージは導入済みだが未配線のため、有料化の価値提供が完結していない。

## Current State
- `stripe` / `@stripe/stripe-js` が `package.json` にあるが、API・Webhook・画面実装はゼロ
- `ask-ai` API は Firestore `users/{uid}` の `isPremium` をサーバー側で参照して制限を判定（モデレーターは別途免除）
- `User` 型にサブスク関連フィールドなし。プレイ画面は `isPremium: false` 固定
- `firestore.rules` で `isPremium` のクライアント書き込みが未ブロック（特権昇格リスク）
- ナビゲーションに課金導線なし。`screen_transition.md` に課金画面未定義

## Desired Outcome
- ログインユーザーが `/pricing` で **Pro プラン**（Free はデフォルトのため非表示）の内容・価格・特典を確認し、Stripe Checkout で購読開始できる
- Webhook 経由で Firestore の契約状態が更新され、ウミガメ AI 質問の日次制限が即時解除される
- 契約中ユーザーは Customer Portal からプラン変更・解約・請求履歴を管理できる
- 将来 **Premium** ティアを追加しても、プラン定義・Stripe Price マッピング・UI カードを拡張するだけで対応できる設計にする

## Approach
**フル垂直スライス（Stripe Checkout + Webhook + Customer Portal）**

- Core が Stripe Customer / Subscription ライフサイクルとエンタイトルメント書き込みを所有（サーバー専用・冪等）
- 本 UI スペックが `/pricing` 画面と購入・管理 CTA、契約状態表示を所有
- プラン階層は `subscriptionTier: 'free' | 'pro' | 'premium'`（初版は `pro` のみ販売、`free` はデフォルト暗黙、`premium` は将来追加）で表現し、機能ゲートは tier ベースのヘルパー（例: `hasProEntitlements(tier)`）に集約
- 既存 `isPremium` は後方互換の導出値（`tier !== 'free'`）として維持し、`ask-ai` 等の既存ゲートを壊さない

## Scope
- **In**:
  - `/pricing` 画面（Pro プランカード、月額/年額 Price 表示、特典一覧、購入 CTA）
  - 未ログイン時はログインへ誘導、ログイン済み・契約中は「管理中」状態と Portal 導線
  - Checkout 成功/キャンセル後のリダイレクト先（`/pricing?checkout=success` 等）とフィードバック UI
  - サイドバー／プロフィールポップアップ等からの `/pricing` 導線（最小1か所 + AI 制限ダイアログからの導線は play-flow 側）
  - プレイ画面の残り質問数表示・制限到達ダイアログから `/pricing` へのリンク（play-flow と連携）
  - Vanilla CSS / CSS Modules、既存ネオンデザインシステムとの統一
  - E2E: 未契約→Checkout 開始（Stripe テストモード）、契約済み表示
- **Out**:
  - Free プランの比較表行（デフォルトのため表示しない）
  - §2.5 将来構想の他特典（模擬試験詳細分析、弱点克服無制限、広告非表示、プライベートクイズ等）の実装 — 初版は **AI 質問無制限** のみ Pro 特典として明示
  - Premium ティアの販売 UI（スキーマ・Price マッピングの拡張ポイントのみ設計）
  - クリエイター支援（ギフティング）、BtoB 法人ライセンス
  - Stripe Elements によるアプリ内カード入力（初版はリダイレクト Checkout）

## Boundary Candidates
- **Billing UI**: `/pricing` ページ、プランカード、Checkout/Portal 起動ボタン、契約状態バッジ
- **Billing API（Core）**: `POST /api/billing/checkout-session`、`POST /api/billing/portal-session`、`POST /api/webhooks/stripe`
- **Entitlement（Core）**: `subscriptionTier` / `stripeCustomerId` / `stripeSubscriptionId` / `subscriptionStatus` / `currentPeriodEnd` の Firestore 更新、`resolveUserEntitlements(uid)`
- **Feature gate（Core + Play-flow）**: `ask-ai` の tier 検証、プレイ画面の `isPremium` 導出表示

## Out of Boundary
- Stripe Dashboard での Product/Price 作成・税設定（運用手順として docs に記載するが本スペックの実装対象外）
- 請求書 PDF のカスタムデザイン
- 管理者による手動 tier 付与（既存モデレーター免除ロジックは維持、別途 admin ツールは本フェーズ外）
- 返金・チャージバックの個別オペレーション UI

## Upstream / Downstream
- **Upstream**: `quizetika-core`（Stripe 連携 API、Webhook、エンタイトルメント型・Rules）、`quizetika-auth-profile-ui`（ログイン状態・`refreshUser`）、Firebase Auth ID Token 検証パターン
- **Downstream**: 将来 Premium 追加、他機能の tier ゲート（弱点克服無制限等）、PostHog 等でのコンバージョン計測

## Existing Spec Touchpoints
- **Extends**: `quizetika-core`（サブスク型、Stripe サービス、Webhook、Firestore Rules で billing フィールドのクライアント書き込み禁止）、`quizetika-play-flow-ui`（AI 制限 UI・`isPremium` 連携・誘導 CTA）
- **Adjacent**: `quizetika-auth-profile-ui`（プロフィールからの Portal 導線・契約バッジは任意）、`quizetika-sidebar-layout`（ナビ項目追加）

## Constraints
- **Stripe**: Checkout（リダイレクト）+ Customer Portal + Webhook 署名検証（raw body、Node runtime）
- **Security**: billing フィールドは Admin SDK / Webhook のみ書き込み可。クライアントからの `isPremium` / `subscriptionTier` 改ざんを Rules で遮断
- **冪等性**: Webhook は `event.id` による重複処理防止
- **環境変数**: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_CREATOR_MONTHLY`, `STRIPE_PRICE_CREATOR_YEARLY`（Premium 用は将来追加）、`NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`
- **Styling**: Vanilla CSS / CSS Modules（Tailwind 不使用）
- **初版 Pro 特典**: ウミガメ AI 質問の日次20回制限解除（`ask-ai` 既存ゲートと整合）
- **拡張性**: プラン定義を `src/lib/subscription-plans.ts`（仮）等の単一マスタに集約し、UI は `paidTiers` 配列を map するだけで Premium 追加可能にする
