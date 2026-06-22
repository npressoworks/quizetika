# 技術スタックと標準 (Technology Stack)

## アーキテクチャ (Architecture)

Next.js（App Router）によるフルスタックフロントエンドと、Firebase（Auth, Firestore, Storage）のBaaS構成を密に統合したサーバーレスアーキテクチャを採用しています。
一部の重い処理や機密処理は、Next.jsのAPI RoutesやServer Actionsを利用して安全に実行します。

## コア技術 (Core Technologies)

- **Language**: TypeScript (Strict Mode)
- **Framework**: Next.js 16.2.6 (App Router)
- **UI Library**: React 19.2.4
- **Runtime**: Node.js 20+
- **Database / Auth**: Firebase 12.13.0 (Firestore, Authentication, Cloud Storage)
- **AI**: Gemini API (`@google/generative-ai` 0.24.1)
- **Payments**: Stripe (`stripe` ^22 / `@stripe/stripe-js` ^9) — サーバー側 Webhook + クライアント側 Checkout
- **Analytics**: PostHog (`posthog-js` ^1) — プロダクト分析・イベントトラッキング

## 主要ライブラリ (Key Libraries)

- **UI / Styling**: Tailwind CSS v4 + shadcn/ui（`base-nova` / neutral）。新規 UI は shadcn プリミティブ + Tailwind ユーティリティを正とする。未移行ドメインは CSS Modules + `variables.css` と共存（Phase 24 strangler 移行中）。
- **Class Utils**: `clsx`, `tailwind-merge`, `class-variance-authority` — `cn()`（`src/lib/utils.ts`）
- **Animations**: Framer Motion 12.40.0
- **Drag & Drop**: @dnd-kit (Core / Sortable)
- **Sanitizer**: Isomorphic DOMPurify (XSS防止のためのHTMLサニタイズ)
- **Icons**: Material Icons

## 開発標準 (Development Standards)

### 型安全性 (Type Safety)
- TypeScriptの `strict` モードを常時有効化します。
- `any` 型の使用は原則禁止とし、未知の入力には `unknown` と手動バリデーション（長さ・形式チェック等）またはサービス層の検証関数を使用します。

### コード品質 (Code Quality)
- ESLint（`eslint-config-next` + `eslint-plugin-security`）による静的解析をパスする必要があります。
- テストコードにおけるモックやテストプレイ用コードが本番ビルド（Production）に混入しないよう、静的フラグを用いたTree Shakingが機能するように実装します。

### テスト (Testing)
- **サービス・ロジック**: Jest（`tests/**/*.test.ts(x)`）を用いた単体テスト・結合テスト。
- **UI・インタラクション**: Playwright（`e2e/*.spec.ts`）によるE2Eテスト。
- **ローカル BaaS**: Firebase Emulator（`npm run emulators`）で Auth / Firestore / Storage を起動可能。

## 開発環境 (Development Environment)

### 共通コマンド (Common Commands)
```bash
# ローカル開発サーバー起動
npm run dev

# 本番ビルド
npm run build

# テスト実行
npm run test

# E2Eテスト実行
npm run test:e2e

# Firebase エミュレーター（Auth, Firestore, Storage）
npm run emulators

# Firestore セキュリティルールのみデプロイ
npm run deploy:rules
```

## 主要な技術決定 (Key Technical Decisions)

- **リスト種別の後方互換**: `QuizList.listType`（`quiz` | `question`）は未設定ドキュメントを `quiz` と解釈する `resolveListType()` を型層に集約し、UI・サービスは `list.listType` の直参照を避ける。
- **ハイブリッド共通レイアウト**: PC/タブレットは左 Sidebar（275px / 70px）、モバイルは BottomNav + ミニ Header。`/play` パスでは全ナビを非表示にし没入型プレイを維持する（`LayoutWrapper` がパス判定）。
- **Tailwind + shadcn 基盤（Phase 24）**: UI 刷新の基盤として Tailwind CSS v4 + shadcn/ui を採用。テーマは shadcn 標準（`dark` クラス + CSS 変数）。移行期は `data-theme` dual bridge で旧 CSS Modules と共存。共通プリミティブは `src/components/ui/`（shadcn CLI 生成）に集約。
- **二重検証（Defense-in-Depth）**: フロントエンド（Cookie等）での権限チェックはUX向上のためだけに使用し、実際のデータ更新や操作はFirestoreセキュリティルール（`firestore.rules`）およびサーバーサイドでのトークン検証で厳格に認可します。
- **画像のSVGアップロード禁止**: XSS（スクリプト埋め込み）攻撃を防ぐため、Firebase Storageへの画像アップロード（アイコン含む）は `PNG`, `JPEG`, `GIF` に限定し、セキュリティルールで容量・MIMEタイプを厳格にチェックします。
- **Stripe課金フロー**: Stripe Checkout Session（サーバー生成）+ Webhook（`/api/webhooks/stripe`）でサブスクリプション状態を Firestore に同期。`src/lib/stripe/server.ts` にサーバー側クライアントを集約し、クライアントバンドルへの秘密鍵漏洩を防止する。

---
_updated_at: 2026-06-09 — Phase 24: Tailwind CSS + shadcn/ui 基盤を反映_

_Document standards and patterns, not every dependency_
