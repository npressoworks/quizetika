# 技術スタックと標準 (Technology Stack)

## アーキテクチャ (Architecture)

Next.js（App Router）によるフルスタックフロントエンドで、Firebase（Auth, Firestore, Storage）から Supabase（PostgreSQL, Auth, Storage）への移行を **ドメイン単位で段階的に** 進行中です（`.kiro/steering/roadmap.md` Phase 35、実体は `.kiro/specs/supabase-*`）。認証（`supabase-auth-migration`）とコアデータ（`supabase-core-data`）は Supabase へ移行済み、ゲームプレイ・ガバナンス・ストレージは Firebase のまま未移行です。移行完了の最終判定と本ドキュメントの Supabase 全面更新は `supabase-cleanup` スペックが担当するため、それまでは両 SDK が併存する過渡状態を正として扱ってください。
一部の重い処理や機密処理は、Next.jsのAPI RoutesやServer Actionsを利用して安全に実行します。

## コア技術 (Core Technologies)

- **Language**: TypeScript (Strict Mode)
- **Framework**: Next.js 16.2.6 (App Router)
- **UI Library**: React 19.2.4
- **Runtime**: Node.js 20+
- **Database / Auth**: 移行中 — Supabase（PostgreSQL + `@supabase/supabase-js` 2.x / `@supabase/ssr`）が認証とコアデータ（ユーザー/クイズ/問題/フォロー/ブックマーク/通知/お知らせ）を担当。Firebase 12.13.0（Firestore, Cloud Storage）がゲームプレイ・ガバナンス・ストレージ操作に残存。ドメイン別の正確な移行状況は `.kiro/specs/supabase-*/spec.json` の `phase` を参照
- **AI**: Gemini API (`@google/generative-ai` 0.24.1)
- **Payments**: Stripe (`stripe` ^22 / `@stripe/stripe-js` ^9) — サーバー側 Webhook + クライアント側 Checkout
- **Analytics**: PostHog (`posthog-js` ^1) — プロダクト分析・イベントトラッキング
- **Ads**: Google AdSense (`NEXT_PUBLIC_ADSENSE_CLIENT_ID`) + 自前動画広告モーダル

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
- **サービス・ロジック**: Jest（`tests/**/*.test.ts(x)`）を用いた単体テスト・結合テスト。Supabase 移行済みサービスは `@/lib/supabase/client` を `jest.mock()` したチェーンモック（`from().select().eq()...` 形式）で検証し、未移行サービスは `tests/__mocks__/firebase/` を利用する。
- **UI・インタラクション**: Playwright（`e2e/*.spec.ts`）によるE2Eテスト。
- **ローカル BaaS**: 未移行ドメイン用に Firebase Emulator（`npm run emulators`）、移行済みドメイン用に Supabase CLI（`supabase start` / `npm run gen:types` で型再生成）を併用。

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

# Supabase 型定義の再生成（ローカル Supabase 起動中に実行）
npm run gen:types
```

## 主要な技術決定 (Key Technical Decisions)

- **リスト種別の後方互換**: `QuizList.listType`（`quiz` | `question`）は未設定ドキュメントを `quiz` と解釈する `resolveListType()` を型層に集約し、UI・サービスは `list.listType` の直参照を避ける。
- **ハイブリッド共通レイアウト**: PC/タブレットは左 Sidebar（275px / 70px）、モバイルは BottomNav + ミニ Header。`/play` パスでは全ナビを非表示にし没入型プレイを維持する（`LayoutWrapper` がパス判定）。
- **Tailwind + shadcn 基盤（Phase 24）**: UI 刷新の基盤として Tailwind CSS v4 + shadcn/ui を採用。テーマは shadcn 標準（`dark` クラス + CSS 変数）。移行期は `data-theme` dual bridge で旧 CSS Modules と共存。共通プリミティブは `src/components/ui/`（shadcn CLI 生成）に集約。
- **二重検証（Defense-in-Depth）**: フロントエンド（Cookie等）での権限チェックはUX向上のためだけに使用し、実際のデータ更新や操作はFirestoreセキュリティルール（`firestore.rules`）およびサーバーサイドでのトークン検証で厳格に認可します。
- **画像のSVGアップロード禁止**: XSS（スクリプト埋め込み）攻撃を防ぐため、Firebase Storageへの画像アップロード（アイコン含む）は `PNG`, `JPEG`, `GIF` に限定し、セキュリティルールで容量・MIMEタイプを厳格にチェックします。
- **Stripe課金フロー**: Stripe Checkout Session（サーバー生成）+ Webhook（`/api/webhooks/stripe`）でサブスクリプション状態を Firestore に同期。`src/lib/stripe/server.ts` にサーバー側クライアントを集約し、クライアントバンドルへの秘密鍵漏洩を防止する。
- **広告の動的ロードと制御（Quizetika Ads）**: 有料プラン（Pro/Premium）のアクティブな状態で広告スクリプト（Google AdSense）のロードを動的にスキップし、パフォーマンスおよび不要なネットワークリクエストを排除する。一時的広告非表示フラグ環境変数 `NEXT_PUBLIC_DISABLE_ADS` が `'true'` の場合、すべての広告コンポーネントおよびフックで非表示処理にフォールバックする。
- **ハイブリッド無限スクロール設計**: クイズ一覧等におけるページング体験向上のため、初期状態は「もっと見る」ボタンで開始し、クリック後はスクロール交差監視による自動追加ロード（無限スクロール）に移行するハイブリッド方式を採用。データフェッチには Firestore のカーソルベース `startAfter` を用いたページング処理（`getQuizzesByAuthorPage` やクイズフィードのカーソル仕様拡張）を適用し、不要な全件フェッチによる読み取りコストを削減する。
- **Firebase → Supabase 段階移行（ドメイン単位カットオーバー）**: 一括移行ではなく `.kiro/specs/supabase-*`（foundation → auth-migration → core-data → gameplay/governance/storage-migration → cleanup の順）でドメインごとに移行する。`firebase`/`firebase-admin` と `@supabase/*` が `package.json` に共存し、同一サービスファイル内で両方の呼び出しが一時的に混在するのは意図した過渡状態である。各ドメインの正確な移行状況は steering ではなく `.kiro/specs/supabase-*/spec.json` の `phase` を正とする。
- **RDB 正規化の徹底（core-data）**: Firestore ドキュメント構造をそのまま PostgreSQL に転写しない。文字列連結の疑似ドキュメントID（例: `follower_id + '_' + following_id`）は複合主キーに、配列/JSONB による埋め込み（バッジ・フォロー中ジャンル・タグ・問題構成）は中間テーブル（`user_badges`, `user_genre_follows`, `quiz_tags`, `quiz_questions` 等）に正規化する。サービス層の TypeScript インターフェースは変更せず、内部クエリのみを差し替えるブラックボックス置換を徹底する。

---
_updated_at: 2026-07-03 — Firebase→Supabase移行状況（Phase 35 / supabase-core-data 実装完了）を反映_

_Document standards and patterns, not every dependency_
