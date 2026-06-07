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
