# Implementation Plan: quizeum-billing-subscription-ui

## Tasks

### 1. Phase 1 — 料金 UI 基盤ライブラリ（2026-06）

- [x] 1.1 (P) 料金プラン表示マスタの実装
  - Pro プランの表示用名称、月額・年額の円価格ラベル、初版特典（ウミガメ AI 質問の日次20回制限解除）を単一モジュールに集約する。
  - Free tier の比較行は含めず、将来 Premium 追加時に配列へ 1 エントリ追加できる構造とする。
  - **完了状態**: `getPricingPlansForUi()` が Pro 1 件を返し、特典 bullet が 1 件以上含まれること。
  - _Requirements: 1, 9_
  - _Boundary: pricing-display_

- [x] 1.2 (P) クライアント向け契約状態解釈の実装
  - 認証コンテキストの `User` から、ゲスト／無料 tier／Pro 契約中の CTA モードと `hasPaidEntitlements` を client-safe に解釈する純粋関数を実装する（core `computeUserEntitlements` と同一規則）。
  - Jest で guest / free / pro active / pro canceled / loading の期待ケースを検証する。
  - **完了状態**: `resolvePricingUiState` の単体テストがグリーンで、モデレーター免除は契約バッジ対象外であること。
  - _Requirements: 3, 6_
  - _Boundary: pricing-entitlement_

### 2. 購読・契約管理 API クライアント

- [x] 2.1 購読開始・契約管理 API クライアントの実装
  - Firebase ID トークン付きで購読開始 API・契約管理 API を呼び出し、`sessionUrl` を返すクライアントを実装する。
  - 401 / 403 / 409 / 404 / ネットワーク失敗をユーザー向け日本語メッセージ用のエラー型にマップし、技術詳細は画面に露出しない。
  - `https://` で始まる `sessionUrl` のみ外部リダイレクトに使用する検証を含める。
  - Jest で fetch モックによる成功・401・409 のマッピングを検証する。
  - **完了状態**: `startCheckoutSession` / `startPortalSession` の単体テストがグリーンであること。
  - _Requirements: 2, 3, 7_
  - _Boundary: billing-client_

### 3. 料金プラン UI コンポーネント

- [x] 3.1 (P) Checkout 完了・キャンセルフィードバックバナーの実装
  - `checkout=success` 時は祝福メッセージ、`checkout=canceled` 時は中立メッセージを表示するバナーコンポーネントを実装する。
  - ネオンデザインシステムと整合した CSS Modules でスタイルする。
  - **完了状態**: success / canceled それぞれで異なるメッセージがレンダリングされること。
  - _Requirements: 4_
  - _Boundary: CheckoutFeedbackBanner_

- [x] 3.2 (P) Pro 契約中バッジコンポーネントの実装
  - `hasPaidEntitlements` が true のときのみ「Pro 契約中」等の視覚インジケーターを表示する。
  - **完了状態**: 有料契約時のみバッジが DOM に出現し、無料 tier では非表示であること。
  - _Requirements: 3, 6_
  - _Boundary: SubscriptionStatusBadge_

- [x] 3.3 Pro プランカードと CTA の実装
  - 月額／年額の interval 選択、表示マスタに基づく価格・特典一覧、購読開始／ログイン誘導／契約管理 CTA を 1 カードに実装する。
  - API 呼び出し中はボタン無効化とローディング表示を行い、409 時は契約中メッセージと Portal 導線を表示する。
  - 未認証の購読クリックは API を呼ばず `/login?redirect=/pricing` へ遷移する。
  - 主要ボタンに `aria-label` と `data-testid`（`pricing-subscribe-btn`, `pricing-portal-btn` 等）を付与する。
  - **完了状態**: free ユーザーで購読 CTA、Pro 契約中ユーザーで Portal CTA が切り替わること。
  - _Requirements: 1, 2, 3, 7, 8_
  - _Depends: 1.1, 1.2, 2.1_
  - _Boundary: ProPlanCard_

### 4. 料金プラン画面 (`/pricing`)

- [x] 4.1 料金プラン画面の統合実装
  - `/pricing` ルートを Client Component で実装し、`useAuth` の loading / user 状態に応じたスケルトン表示を行う。
  - `useSearchParams` で Checkout リダイレクトクエリを検知し、成功時に `refreshUser()` を実行、Webhook 遅延時は反映待ち案内を表示する。
  - クエリ処理後に `router.replace('/pricing')` で URL をクリーンアップしてよい。
  - Pro プランカード・バッジ・フィードバックバナーを組み合わせ、未ログインでも閲覧可能とする。
  - **完了状態**: ブラウザで `/pricing` が表示され、未ログイン閲覧・ログイン後 CTA 切替・`?checkout=success` で成功バナーと `refreshUser` 呼び出しが動作すること。
  - _Requirements: 1, 4, 6, 7_
  - _Depends: 3.1, 3.2, 3.3_
  - _Boundary: PricingPage_

### 5. グローバルナビゲーション導線

- [x] 5.1 サイドバーへの料金プラン導線追加
  - サイドバーの `menuItems` に `/pricing` へのリンクを追加し、ログイン状態に関わらず表示する。
  - 現在パスが `/pricing` のときアクティブハイライトを適用する（`/play` 中の非表示ルールは既存のまま維持）。
  - **完了状態**: サイドバーから `/pricing` に遷移でき、料金画面で該当項目がアクティブ表示されること。
  - _Requirements: 5_
  - _Boundary: Sidebar_

### 6. Phase 1 統合検証

- [x] 6.1 Phase 1 統合テストと回帰確認
  - `pricing-entitlement`、`billing-client`、主要コンポーネントの Jest テストを追加し、全テストスイートがグリーンであることを確認する。
  - 要件 9 の境界（Webhook・プレイ画面誘導を本スペックに含めない）を満たしていることをテスト構成で確認する。
  - **完了状態**: Phase 1 関連テストがすべてパスし、既存コア billing API テストに回帰がないこと。
  - _Requirements: 1, 2, 3, 4, 5, 6, 7, 8, 9_
  - _Depends: 4.1, 5.1_

- [ ]* 6.2 Phase 1 E2E 購読開始フロー検証（任意）
  - Playwright で未ログイン→ログイン誘導、ログイン済み free ユーザー→購読クリック→購読開始 API 呼び出しまでを検証する（Stripe 画面遷移はスコープ外）。
  - **完了状態**: E2E が購読開始 API のリクエスト発火またはモック応答を検証できること。
  - _Depends: 6.1_
  - _Requirements: 2, 9_

---

## Implementation Notes

- **Upstream 前提**: `quizeum-core` Phase 14（購読開始 API、契約管理 API、`User.subscriptionTier`）が完了していること。
- **表示価格**: `pricing-display.ts` の円ラベルは Stripe Dashboard の実金額と手動同期する（運用チェックリスト）。
- **entitlement 同期**: core の `computeUserEntitlements` 規則変更時は `pricing-entitlement.ts` とテストを同時更新する。
- **隣接スペック**: プレイ画面の `isPremium` 連携・AI 制限誘導は `quizeum-play-flow-ui` が担当（本スペック外）。
- **Checkout フィードバック**: `router.replace` 後もバナー表示するため、クエリ検知結果をローカル state に保持する。
