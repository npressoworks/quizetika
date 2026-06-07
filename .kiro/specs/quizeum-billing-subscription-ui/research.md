# Research & Design Decisions: quizeum-billing-subscription-ui

---
**Purpose**: Phase 1 料金 UI のディスカバリー調査と設計判断の記録。
---

## Summary
- **Feature**: `quizeum-billing-subscription-ui`
- **Discovery Scope**: Extension（`quizeum-core` Phase 14 完了後の UI 層追加）
- **Key Findings**:
  - 購読開始 API・契約管理 API は `quizeum-core` で実装済み。本スペックはクライアントから Bearer トークン付き `fetch` で呼び出し、返却 `sessionUrl` へ `window.location.assign` する薄い UI 層で足りる。
  - `src/services/entitlement.ts` は `firebase-admin` を import するためクライアントコンポーネントから直接利用不可。UI 用の client-safe な tier 解釈ヘルパーを別モジュールに置く。
  - `subscription-plans.ts` は Stripe Price ID のみ保持し表示用の円価格は含まない。UI 表示価格は `pricing-display.ts` でマーケティング正本とし、Stripe Dashboard の金額と手動同期する。
  - 既存 API 呼び出しパターンは `auth.currentUser.getIdToken()` + `Authorization: Bearer`（`admin/users/page.tsx`、`useAiPlayState.ts` と同型）。

## Research Log

### コア API 契約の確認
- **Context**: UI が依存する upstream 契約を固定する必要がある。
- **Sources Consulted**: `src/app/api/billing/checkout-session/route.ts`, `src/app/api/billing/portal-session/route.ts`, `quizeum-core` requirements 要件 19
- **Findings**:
  - Checkout: `POST /api/billing/checkout-session` body `{ priceInterval: 'monthly' | 'yearly' }` → `{ sessionUrl }`。401/403/409/500。
  - Portal: `POST /api/billing/portal-session` body なし → `{ sessionUrl }`。401/404/500。
  - Checkout 成功/キャンセル URL はコア側で `/pricing?checkout=success|canceled` に設定済み。
- **Implications**: UI は query パラメータ処理と `refreshUser` のみ実装すれば E2E の大半をカバーできる。

### クライアント側エンタイトルメント解釈
- **Context**: 要件 3・6 は `subscriptionTier` と有効契約に基づく CTA 切替を要求。
- **Sources Consulted**: `src/services/entitlement.ts`, `src/services/user.ts` (`normalizeUserRecord`)
- **Findings**:
  - `computeUserEntitlements` は純粋関数だが同一ファイルに Admin SDK 依存がある。
  - `User` 型に `subscriptionTier`, `subscriptionStatus` が追加済み。auth-context 経由で `subscriptionTier` 未設定は `free` に正規化される。
- **Implications**: `src/lib/pricing-entitlement.ts` に core と同一規則の client-safe ミラーを置く（実装時に core の `PAID_ACTIVE_STATUSES` と同期維持）。

### 既存 UI パターン
- **Context**: ネオンデザイン・ナビ・ページ構成の整合。
- **Sources Consulted**: `src/components/layout/sidebar.tsx`, `src/app/leaderboard/page.tsx`, `quizeum-auth-profile-ui/design.md`
- **Findings**:
  - サイドバーは `menuItems` 配列 + `pathname` アクティブ判定。`/play` では非表示（既存ルール）。
  - 料金ページは認証状態依存のため Client Component 主体が適切（`useAuth`）。
  - CSS Modules + `glass-card` 等の既存ユーティリティクラスを再利用可能。
- **Implications**: `/pricing` は `page.tsx`（Client）+ 子コンポーネント分割。サイドバーに 1 項目追加。

### 表示価格の所在
- **Context**: Stripe Price ID とユーザー向け円表示の分離。
- **Sources Consulted**: `src/lib/subscription-plans.ts`, `.env.local` 例
- **Findings**:
  - コアは `STRIPE_PRICE_PRO_*`（Price ID）のみ。UI に金額文字列の正本はない。
  - Stripe から動的取得は初版スコープ過大。
- **Implications**: `pricing-display.ts` に表示用円価格・特典文言を集約。環境変数 `NEXT_PUBLIC_PRO_PRICE_MONTHLY_LABEL` 等で上書き可能にしてもよい（任意）。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| Thin Client + Redirect | UI が core API を呼び URL へ遷移 | コア境界尊重、実装最小 | Webhook 反映遅延は UI で案内必要 | **採用** |
| Stripe.js Embedded Checkout | アプリ内決済 | シームレス | 要件 Out of scope | 不採用 |
| Server Action 経由 Checkout | Next.js Server Action で API プロキシ | トークン隠蔽 | 既存パターンは client fetch + Bearer | 不採用（既存に合わせる） |

## Design Decisions

### Decision: Client-safe pricing entitlement ミラー
- **Context**: CTA 切替に core と同じ tier 規則が必要だが `entitlement.ts` は server-only。
- **Alternatives Considered**:
  1. core から `entitlement-utils.ts` を抽出し双方で共有
  2. UI 専用ミラー `pricing-entitlement.ts`
- **Selected Approach**: 初版は UI スペック内 `pricing-entitlement.ts` にミラー。規則変更時は core と同時更新（Revalidation Trigger に明記）。
- **Rationale**: コアファイル変更を本スペックの必須依存にしない。
- **Trade-offs**: 二重定義の同期コスト vs 境界の明確さ。
- **Follow-up**: 将来 core が `entitlement-utils.ts` を公開したら import に切替可能。

### Decision: 表示価格は UI 正本
- **Context**: 要件 1.3 は月額・年額の「読みやすい表示」を要求。
- **Selected Approach**: `pricing-display.ts` に Pro カードの表示データ（名称、円価格ラベル、特典 bullets）を定義。`getPaidTierDefinitions()` は tier キー整合の参照のみ（価格 ID は UI 非露出）。
- **Rationale**: マーケティング文言は UI 層の責務。決済金額の正本は Stripe。
- **Follow-up**: Stripe Dashboard 価格変更時は `pricing-display.ts` を手動更新。

### Decision: Checkout フィードバックは URL クエリ + replace
- **Context**: 要件 4.5 はクエリクリーンアップを許容。
- **Selected Approach**: `useSearchParams` で `checkout=success|canceled` を検知 → バナー表示 → `router.replace('/pricing')`。
- **Rationale**: 既存 Next.js App Router パターンと整合。

## Risks & Mitigations
- **Webhook 反映遅延** — 成功バナー + `refreshUser` + 「反映待ち」案内（要件 4.4）
- **entitlement ミラーずれ** — 単体テストで core `computeUserEntitlements` と同一ケースを検証
- **表示価格と Stripe 実金額の不一致** — 運用チェックリスト（docs 同期タスク）で緩和

## References
- `quizeum-core` requirements 要件 19、`design.md` Phase 13
- `src/app/api/billing/checkout-session/route.ts`
- `src/app/api/billing/portal-session/route.ts`
- [Stripe Checkout redirect flow](https://docs.stripe.com/checkout/quickstart) — リダイレクト型の確認

---

# Implementation Gap Analysis（2026-06-07）

## Summary

- **スコープ**: `/pricing` UI、Checkout/Portal CTA、契約状態表示、サイドバー導線、Checkout フィードバック、テスト。
- **Upstream 状態**: `quizeum-core` Phase 14 は **実装済み・検証 GO**。購読 API・`User.subscriptionTier`・`refreshUser`・ログイン `redirect` は利用可能。
- **本スペックギャップ**: UI 層は **ほぼ全 Missing**（`/pricing` ページ、billing クライアント、pricing コンポーネント、サイドバー項目、E2E）。
- **推奨アプローチ**: **Option B**（`design.md` File Structure Plan どおり新規モジュール）— 既存ファイルへの最小改修はサイドバーのみ。
- **Effort**: **S（1–3日）** / **Risk**: **Low**

## 1. Current State Investigation

### 1.1 再利用可能な既存アセット

| アセット | パス | 本スペックでの用途 |
|----------|------|-------------------|
| 購読開始 API | `src/app/api/billing/checkout-session/route.ts` | `billing-client` から POST（**Ready**） |
| 契約管理 API | `src/app/api/billing/portal-session/route.ts` | `billing-client` から POST（**Ready**） |
| Checkout リダイレクト URL | `src/services/subscription.ts` L98–99 | `/pricing?checkout=success\|canceled` 既設定（**Ready**） |
| Portal return URL | `src/services/subscription.ts` L134 | `/pricing` 既設定（**Ready**） |
| `User` 課金フィールド | `src/types/index.ts` | `subscriptionTier`, `subscriptionStatus` 等（**Ready**） |
| tier 正規化（読み取り） | `src/services/user.ts` `normalizeUserRecord` | `subscriptionTier` 未設定→`free`（**Ready**） |
| 認証コンテキスト | `src/context/auth-context.tsx` | `useAuth`, `refreshUser`（**Ready**） |
| ログイン戻り先 | `src/app/login/page.tsx` + `safe-redirect-path.ts` | `/login?redirect=/pricing`（**Ready**） |
| Bearer fetch パターン | `useAiPlayState.ts`, `admin/users/page.tsx` | `getIdToken()` + `Authorization`（**Constraint** — 踏襲） |
| API クライアント先例 | `src/lib/play-history-client.ts` | エラークラス + auth チェック構造（**Constraint**） |
| サイドバー / ボトムナビ | `sidebar.tsx`, `bottom-nav.tsx` | 導線追加の拡張点（**Partial** — サイドバーのみ設計対象） |
| ネオン UI | `globals.css`, `glass-card` | スタイル基盤（**Ready**） |
| Billing API 単体テスト | `tests/api/billing-*.test.ts` | upstream 回帰済み（**Ready**、UI テストは未作成） |

### 1.2 存在しないファイル（design.md vs 実装）

| ファイル | 状態 |
|----------|------|
| `src/app/pricing/page.tsx` | **Missing** |
| `src/app/pricing/pricing.module.css` | **Missing** |
| `src/components/pricing/*` | **Missing**（4 コンポーネント + CSS） |
| `src/lib/billing-client.ts` | **Missing** |
| `src/lib/pricing-display.ts` | **Missing** |
| `src/lib/pricing-entitlement.ts` | **Missing** |
| `tests/lib/pricing-entitlement.test.ts` | **Missing** |
| `tests/lib/billing-client.test.ts` | **Missing** |
| `e2e/pricing-checkout.spec.ts` | **Missing** |

### 1.3 改修が必要な既存ファイル

| ファイル | 変更内容 | 影響 |
|----------|----------|------|
| `src/components/layout/sidebar.tsx` | `/pricing` ナビ項目追加、アクティブ判定 | 低 — 1 エントリ追加 |
| `src/components/layout/sidebar.module.css` | 必要時のみスタイル調整 | 低 |

**意図的に変更しないもの**（境界外）:
- `bottom-nav.tsx` — 要件 5 は「最小 1 か所」でサイドバーで充足可
- `auth-context.tsx` — `normalizeUserRecord` は `user.ts` で既に実施
- `entitlement.ts` — server-only。UI は `pricing-entitlement.ts` を新規作成

### 1.4 隣接スペックのギャップ（本スペック外だが E2E に影響）

| 領域 | 現状 | 担当 |
|------|------|------|
| プレイ画面 `isPremium` | `play/page.tsx` で `false` 固定 | `quizeum-play-flow-ui` |
| AI 制限ダイアログ → `/pricing` | 未実装 | `quizeum-play-flow-ui` |
| `docs/screen_transition.md` | `/pricing` 未記載 | `docs-sync-billing`（roadmap） |

## 2. Requirement-to-Asset Map

| 要件 | 必要アセット | 現状 | ギャップ |
|------|-------------|------|----------|
| **1** `/pricing` Pro 表示 | `PricingPage`, `ProPlanCard`, `pricing-display` | なし | **Missing** |
| **2** 購読開始 | `billing-client`, Checkout API | API のみ存在 | **Partial** — UI クライアント未実装 |
| **3** 契約管理 | `billing-client`, Portal API, `pricing-entitlement` | API のみ存在 | **Partial** |
| **4** Checkout フィードバック | `CheckoutFeedbackBanner`, query 処理, `refreshUser` | `refreshUser` のみ | **Partial** |
| **5** ナビ導線 | `sidebar.tsx` | 導線なし | **Missing**（`/play` 非表示は **Ready**） |
| **6** 契約状態表示 | `SubscriptionStatusBadge`, `pricing-entitlement` | `User` フィールドのみ | **Missing** |
| **7** ローディング・エラー | `billing-client` エラー型、UI 状態 | パターンは他画面に存在 | **Missing**（本画面用） |
| **8** デザイン・a11y | CSS Modules, `data-testid` | デザインシステム **Ready** | **Missing**（画面実装） |
| **9** 境界整合 | — | コアは実装済み、プレイは未連携 | **Constraint** — 9.1–9.2 は遵守可能 |

## 3. Implementation Approach Options

### Option A: 既存ページへの埋め込み

- ホームまたはプロフィールに Pro CTA を埋め込み、`/pricing` ルートは作らない
- **Trade-offs**: ファイル数最小 / 要件 1・5 不充足、Checkout リダイレクト先と不整合
- **評価**: **不採用** — コアが `/pricing` URL を既に Checkout 先に設定済み

### Option B: design.md どおり新規モジュール（推奨）

- `app/pricing` + `components/pricing` + `lib/billing-client` 等を新規作成
- `sidebar.tsx` のみ既存改修
- **Trade-offs**: 境界明確・テスト容易・design と 1:1 / 新規ファイル約 10
- **評価**: **推奨** — gap 分析・design と一致

### Option C: Hybrid（ページ先行 + ナビ後追い）

1. `/pricing` + Checkout CTA のみ（MVP）
2. Portal CTA + フィードバック + サイドバー + E2E

- **Trade-offs**: 早期デモ可能 / 2 段階 PR・テスト分割
- **評価**: 任意。単一 PR で S 規模なら Option B 一括で十分

## 4. Effort & Risk

| 項目 | 評価 | 根拠 |
|------|------|------|
| **Effort** | **S（1–3日）** | 新規 UI ~10 ファイル、upstream 完了、既存パターン踏襲 |
| **Risk** | **Low** | 新規外部依存なし。Stripe 操作は core 委譲。主リスクは Webhook 反映遅延 UX（設計済み） |
| **Blocker** | なし | コア API・env（Price ID）は実装済み。表示価格ラベルは `pricing-display.ts` で決定即可 |

## 5. Research Needed（実装前確認）

| 項目 | 状態 | 備考 |
|------|------|------|
| 表示用円価格の正本 | **要決定** | `pricing-display.ts` 固定値 vs `NEXT_PUBLIC_*` env。design は UI 正本を採用済み |
| Stripe Dashboard 金額との一致 | **運用** | 手動同期チェックリスト |
| `pricing-entitlement` と core の規則同期 | **テストで担保** | 単体テストで `computeUserEntitlements` 同一ケース比較推奨 |
| Customer Portal Dashboard 有効化 | **運用** | Portal API は実装済み、Dashboard 設定は運用タスク |
| E2E Stripe 遷移 | **スコープ限定** | 要件 9.5 — API 呼び出しまで。Stripe 画面は手動またはモック |

## 6. Spec / ドキュメント整合

| ドキュメント | 状態 |
|-------------|------|
| `requirements.md` | 生成済み・承認済み（`-y` design 時） |
| `design.md` | 生成済み。File Structure Plan と gap が一致 |
| `quizeum-core/research.md` §2 ギャップ表 | **陳腐化** — Stripe コアは実装完了。本分析が UI 側の正本 |
| `docs/screen_transition.md` | `/pricing` 未記載 — 実装後 `docs-sync-billing` で追記推奨 |

## 7. Recommendations for Task Generation

1. **`/kiro-spec-tasks quizeum-billing-subscription-ui -y`** でタスク生成（design 承認後）
2. **実装順序（推奨）**:
   - `pricing-display.ts` + `pricing-entitlement.ts`（純関数・テスト先行）
   - `billing-client.ts`（API ラッパー・テスト）
   - `components/pricing/*` + `app/pricing/page.tsx`
   - `sidebar.tsx` 導線
   - E2E `pricing-checkout.spec.ts`
3. **並行（別スペック）**: `quizeum-play-flow-ui` でプレイ内誘導・`isPremium` 連携
4. **依存**: `quizeum-core` Phase 14 完了を前提に着手可能（**満たされている**）

## Document Status（Gap Analysis）

- **方法**: gap-analysis.md フレームワーク + `src/` Grep/Read + upstream billing API 確認
- **入力**: `requirements.md`（要件 1–9）、`design.md`、`quizeum-core` 実装状態
- **出力先**: 本節（`research.md` 追記）

---

# Implementation Gap Analysis（Phase 2: Stripe 動的価格表示）（2026-06-08）

## Summary

- **スコープ**: Phase 2 要件（要件 1.3, 2.4, 3.7, 7.5–7.6, 10）— Pro 月額・年額を決済サービスから動的取得、失敗時「価格を読み込めません」、購読 CTA 無効化、契約管理 CTA 維持。
- **Phase 1 状態**: `/pricing` UI・Checkout/Portal クライアント・サイドバー導線・契約状態表示は **実装済み**。
- **Phase 2 ギャップ**: 価格取得 API・クライアント取得・ローディング/エラー UI・動的お得表示・関連テストは **Missing**。`pricing-display.ts` のハードコード価格は **要件と矛盾（要改修）**。
- **推奨アプローチ**: **Option C（Hybrid）** — `quizeum-core` に価格取得 API + 整形サービスを追加、UI は `ProPlanCard` / `billing-client` を拡張。
- **Effort**: **S（1–3日）** / **Risk**: **Low–Medium**（コア/UI 境界の設計判断と JPY 整形の確認が主リスク）

## 1. Current State Investigation

### 1.1 Phase 1 実装済みアセット（再利用可能）

| アセット | パス | 状態 | Phase 2 での用途 |
|----------|------|------|------------------|
| 料金画面 | `src/app/pricing/page.tsx` | **Ready** | 価格取得状態の親オーケストレーション候補 |
| Pro カード | `src/components/pricing/pro-plan-card.tsx` | **Partial** | 価格表示・CTA 無効化の改修対象 |
| Free カード | `src/components/pricing/free-plan-card.tsx` | **Ready** | ¥0 固定表示（変更不要） |
| Checkout クライアント | `src/lib/billing-client.ts` | **Partial** | 価格 GET ラッパー追加候補 |
| 表示マスタ | `src/lib/pricing-display.ts` | **Stale** | 特典・名称は維持、**価格ラベルは削除または非正本化** |
| Price ID マッピング | `src/lib/subscription-plans.ts` | **Ready** | サーバー側取得の Price ID 参照 |
| Stripe クライアント | `src/lib/stripe/server.ts` | **Ready** | `stripe.prices.retrieve` の基盤 |
| Checkout/Portal API | `src/app/api/billing/*` | **Ready** | 購読フローは変更不要 |
| キャッシュ付き GET API 先例 | `src/app/api/genres/weekly-top/route.ts` | **Constraint** | `export const revalidate` パターン踏襲可 |
| 単体テスト群 | `tests/lib/pricing-display.test.ts`, `tests/components/pricing/pro-plan-card.test.tsx` 等 | **Partial** | ハードコード価格前提のテストは更新必要 |

### 1.2 Phase 2 で存在しないもの

| 能力 | 状態 | 備考 |
|------|------|------|
| 価格取得 API（例: `GET /api/billing/prices`） | **Missing** | `src/app/api/billing/` に checkout/portal のみ |
| Stripe Price 取得サービス | **Missing** | `subscription.ts` は Checkout/Portal のみ |
| JPY 表示ラベル整形（`/月`・`/年`） | **Missing** | 現状 `pricing-display.ts` に固定文字列 |
| 年額お得ラベル自動計算 | **Missing** | 現状固定「年額で約2ヶ月分お得」 |
| 価格ローディング UI | **Missing** | `ProPlanCard` は同期 `getProPlanForUi()` |
| 価格失敗 UI（「価格を読み込めません」） | **Missing** | 失敗時の代替金額表示も未実装 |
| 価格未取得時の購読 CTA 無効化 | **Missing** | `isDisabled` は loading/ctaMode のみ |
| 価格未取得時の interval 無効化 | **Missing** | 要件 10.5 未対応 |
| 価格 API 単体テスト | **Missing** | — |
| `quizeum-core` 要件への価格 API 追記 | **Missing** | 隣接期待のみ、core spec 未更新 |

### 1.3 設計ドキュメントの陳腐化

| ドキュメント | 問題 |
|-------------|------|
| `design.md` | 「`pricing-display.ts` が円価格正本」「Free 非表示」と記載 — 実装・Phase 2 要件と不一致 |
| `research.md` §表示価格の所在 | 「Stripe 動的取得は初版スコープ過大」— Phase 2 で方針転換 |
| `tasks.md` | Phase 1 タスクのみ。Phase 2 タスク未生成 |

### 1.4 既存コードの要件矛盾点

```36:38:src/lib/pricing-display.ts
    monthlyPriceLabel: '¥980/月',
    yearlyPriceLabel: '¥9,800/年',
    yearlySavingsLabel: '年額で約2ヶ月分お得',
```

- 要件 1.3: ハードコード固定金額を正本として使用しない → **現状 Violation**
- 要件 7.6: 取得失敗時は代替固定金額を出さない → **未実装（常に固定表示）**
- 要件 2.4: 価格未取得時は購読無効化 → **未実装**

`ProPlanCard` はマウント時に `getProPlanForUi()` で同期取得しており、非同期価格フェッチの状態機械がない。

## 2. Requirements Feasibility Analysis

### 2.1 技術ニーズ（要件 → 能力）

| 要件 | 技術ニーズ | 現状 |
|------|-----------|------|
| 1.3, 10.1–10.2 | 決済サービス価格の取得と JPY 表示 | **Missing** |
| 2.4 | 価格未取得時の購読 CTA 無効化 | **Missing** |
| 3.7 | 価格失敗時も契約管理 CTA 有効 | **Ready**（`ctaMode=manage` は価格非依存だが明示テスト要） |
| 7.5 | 価格取得中のローディング表示 | **Missing** |
| 7.6 | 失敗時「価格を読み込めません」 | **Missing** |
| 10.3 | 両価格取得成功時のお得表示 | **Missing**（計算ロジック要） |
| 10.4 | Free ¥0 固定 | **Ready** |
| 10.5 | 失敗時 interval 無効化 | **Missing** |
| 10.6 | 特典文言は価格成否に非依存 | **Ready**（`featureBullets` は静的） |
| 9.2 | サーバー側取得は core 担当 | **Missing**（core に API 未存在） |

### 2.2 制約・依存

- **Stripe 秘密鍵**: クライアントから直接 Stripe API を呼べない → サーバー API 必須（要件 9.2 と一致）。
- **Price ID**: 既存 env `STRIPE_PRICE_PRO_MONTHLY` / `YEARLY` を正本として再利用可能。
- **認証**: 価格表示は未ログインでも閲覧可（要件 1.4）→ 価格 API は **認証不要の GET** が自然。
- **Checkout 整合**: 表示価格と Checkout の `line_items.price` は同一 Price ID 由来にすれば自動整合。

### 2.3 Research Needed（design フェーズへ委譲）

| 項目 | 内容 |
|------|------|
| Stripe Price フィールド | `unit_amount` / `currency` / `recurring.interval` の扱い（JPY はゼロ小数） |
| お得ラベル計算式 | 月額×12 と年額の差分を「約 N ヶ月分」に丸める規則 |
| キャッシュ TTL | `revalidate` 秒数（weekly-top は 1800s 先例あり） |
| 部分失敗 | 月額のみ成功・年額失敗時の表示/CTA 方針（要件は両方失敗を主に規定、片方成功の解釈要設計） |
| core spec 更新範囲 | 新 API を `quizeum-core` requirements/design に追記するか、billing-ui スペック design で core タスクとして明記するか |

## 3. Requirement-to-Asset Map

| 要件 | 必要アセット | 現状 | ギャップ |
|------|-------------|------|----------|
| **1.1–1.2** | `/pricing`, Pro/Free カード | 実装済 | **Ready** |
| **1.3** | 動的価格表示 | ハードコード | **Missing** |
| **2.1–2.3, 2.5–2.8** | Checkout フロー | 実装済 | **Ready** |
| **2.4** | 価格未取得時購読無効 | 未対応 | **Missing** |
| **3.1–3.6** | Portal フロー | 実装済 | **Ready** |
| **3.7** | 価格失敗時 Portal 維持 | 暗黙的に可能 | **Constraint**（テスト追加推奨） |
| **4–6, 8–9** | フィードバック・ナビ・契約表示・デザイン | 実装済 | **Ready** |
| **7.5–7.6** | 価格ローディング/エラー UI | 未対応 | **Missing** |
| **10.1–10.6** | 表示形式・お得・interval 制御 | 固定ラベル | **Missing** |

## 4. Implementation Approach Options

### Option A: 既存コンポーネント拡張のみ（UI スペック内完結）

- `pricing-display.ts` から価格フィールドを除去
- 新規 `src/app/api/billing/prices/route.ts` を **billing-ui スペック内**に直接追加
- `billing-client.ts` に `fetchProPrices()` 追加
- `ProPlanCard` に `useEffect` + 価格状態を追加

**Trade-offs**:
- ✅ 変更ファイル数最小、Phase 1 パターン踏襲
- ❌ 要件 9.2「サーバー側は core 担当」と境界が曖昧
- ❌ core spec / design との責務ずれ

### Option B: 新規モジュール分離（価格サブシステム）

- Core: `src/services/billing-prices.ts` + `GET /api/billing/prices`
- UI: `src/lib/pricing-prices-client.ts` + `useProPlanPrices` hook
- `ProPlanCard` は hook 消費のみ

**Trade-offs**:
- ✅ 責務分離が明確、テスト容易
- ✅ Premium 追加時に tier 配列へ拡張しやすい
- ❌ 新規ファイル増（4–6 ファイル）

### Option C: Hybrid（推奨）

- **Core 寄り（新規）**: 価格取得サービス + `GET /api/billing/prices`（`getStripeClient` + `getPaidTierDefinitions` 利用）
- **UI 拡張**: `billing-client.ts` に公開 GET ラッパー、`ProPlanCard` に価格状態、`pricing-display.ts` は名称・特典のみ
- **共有 lib（任意）**: `formatStripePriceLabel(amount, interval)` を core または `src/lib/pricing-format.ts` に配置

**Trade-offs**:
- ✅ 要件 9.2 の境界を尊重
- ✅ Phase 1 の `ProPlanCard` / `billing-client` 資産を活用
- ❌ `quizeum-core` spec/design の軽微更新が必要

## 5. Effort & Risk

| 項目 | 評価 | 根拠 |
|------|------|------|
| **Effort** | **S（1–3日）** | Stripe 基盤・Price ID・UI 骨格は既存。追加は API 1 本 + カード改修 + テスト |
| **Risk** | **Low–Medium** | 技術は既知。境界（core vs UI）と JPY 整形・部分失敗の設計判断が主因 |
| **Blocker** | なし | `STRIPE_SECRET_KEY` と Price ID env は Phase 1 で利用済み |

## 6. Recommendations for Design Phase

1. **価格正本の移管**: `pricing-display.ts` はマーケティング文言（名称・特典）のみ。金額は Stripe 取得結果。
2. **API 契約（案）**: `GET /api/billing/prices` → `{ pro: { monthly: { amount: number, label: string }, yearly: { ... }, savingsLabel?: string } }` または raw amount + UI 整形。design で確定。
3. **UI 状態機械**: `idle → loading → ready | error`。`error` 時は価格欄「価格を読み込めません」、購読無効、interval 無効、Portal は `ctaMode=manage` で有効維持。
4. **テスト更新**: `pricing-display.test.ts` から価格ラベル assertion を削除/変更。`pro-plan-card.test.tsx` に loading/error/disabled ケース追加。新規 `tests/api/billing-prices.test.ts`。
5. **隣接スペック**: `quizeum-core` に価格取得 API の要件・設計追記（または billing-ui design の `_Boundary:_` で core 実装タスクを明示）。
6. **design.md / tasks.md**: Phase 2 セクション追加。Phase 1 の「手動同期」「Free 非表示」記述を改訂。

## Document Status（Phase 2 Gap Analysis）

- **方法**: gap-analysis.md + `requirements.md` Phase 2 + `src/` Grep/Read
- **入力**: 更新済み `requirements.md`（要件 1–10）、既存 Phase 1 実装、`design.md` 陳腐化チェック
- **出力先**: 本節（`research.md` 追記）
- **要件承認状態**: `approvals.requirements.approved: false` — gap 分析は実施済み、要件レビュー後に design へ進行推奨

---

# Design Synthesis（Phase 2: Stripe 動的価格表示）（2026-06-08）

## Summary
- **Discovery Type**: Light（既存 billing 基盤の拡張）
- **採用パターン**: Option C Hybrid — core が `GET /api/billing/prices`、UI が `fetchProPrices` + `ProPlanCard` 状態機械
- **価格正本**: Stripe `unit_amount`（core 経由）。`pricing-display.ts` から金額フィールドを除去
- **失敗方針**: 月額・年額の片方失敗も全体 `PriceError`。「価格を読み込めません」、購読/interval 無効、Portal は維持

## Design Decisions

### Decision: Prices API は core 所有・UI は消費のみ
- **Context**: 要件 9.2 がサーバー側取得を core に委譲。
- **Selected**: `src/services/billing-prices.ts` + `GET /api/billing/prices`（core）、`billing-client.fetchProPrices()`（UI）。
- **Rationale**: Stripe 秘密鍵は既に core に集約。Checkout と同一 Price ID 参照で表示・課金整合。
- **Trade-offs**: 実装タスクが core/UI 両方に及ぶ vs 境界明確。

### Decision: 部分失敗は全体エラー
- **Context**: 月額のみ成功・年額失敗時の UX が未定義。
- **Selected**: いずれか失敗 → HTTP 500、UI は `PriceError`。
- **Rationale**: 要件 7.6「代替金額を出さない」と 2.4「購読無効」を単純に満たす。
- **Trade-offs**: 月額だけ見せられる機会を失う vs 誤誘導リスク低減。

### Decision: savingsLabel はサーバー計算
- **Context**: 要件 10.3 は両価格取得成功時のお得表示。
- **Selected**: `pricing-format.ts`（core）で `(monthly*12 - yearly) / monthly` の切り捨て月数。
- **Rationale**: UI と API テストで同一ロジックを共有。Dashboard 価格変更に自動追従。

### Decision: キャッシュ 3600s
- **Context**: `weekly-top` は 1800s 先例。
- **Selected**: Prices API `revalidate = 3600`。
- **Rationale**: 価格変動頻度が低く、Stripe rate limit への配慮。

## Risks & Mitigations
- **Stripe 一時障害** — 購読不可・Portal 可。ユーザーは再読み込みで再試行。
- **表示と Checkout 不整合** — 同一 `subscription-plans` Price ID で解消。
- **core spec 未追記** — design の Upstream Files を `quizeum-core` tasks 生成時に同期推奨。

## Document Status（Phase 2 Design）
- **入力**: Phase 2 gap 分析、`requirements.md`、Stripe JPY `unit_amount` 慣行
- **出力**: `design.md` Phase 2 更新、本節
