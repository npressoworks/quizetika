# 技術スタックと標準 (Technology Stack)

## アーキテクチャ (Architecture)

Next.js（App Router）によるフルスタックフロントエンドで、バックエンドは Supabase（PostgreSQL, Auth, Storage）に一本化されています。Firebase（Auth, Firestore, Storage）からの段階移行（`.kiro/steering/roadmap.md` Phase 35、実体は `.kiro/specs/supabase-*`）は `supabase-cleanup` スペックの完了をもって完結し、Firebase 関連のパッケージ・初期化コード・設定ファイルはリポジトリから完全に除去されています。
一部の重い処理や機密処理は、Next.jsのAPI RoutesやServer Actionsを利用して安全に実行します。

## コア技術 (Core Technologies)

- **Language**: TypeScript (Strict Mode)
- **Framework**: Next.js 16.2.6 (App Router)
- **UI Library**: React 19.2.4
- **Runtime**: Node.js 20+
- **Database / Auth**: Supabase（PostgreSQL + `@supabase/supabase-js` 2.x / `@supabase/ssr`）が認証・データ・ストレージ全ドメインを担当
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
- **サービス・ロジック**: Jest（`tests/**/*.test.ts(x)`）を用いた単体テスト・結合テスト。`@/lib/supabase/client` を `jest.mock()` したチェーンモック（`from().select().eq()...` 形式）で検証する。
- **UI・インタラクション**: Playwright（`e2e/*.spec.ts`）によるE2Eテスト。
- **ローカル BaaS**: Supabase CLI（`supabase start` / `npm run gen:types` で型再生成）を使用。
- **E2Eスイート大量失敗の切り分け**: 多数のE2E失敗が発生した場合はまず Failure Ledger（原因調査用の記録）を作成し、各失敗を「プロダクトコードの不具合」「テストコード自体の不備」「テスト環境・設定の問題」に分類してからドメイン単位で独立修正する。修正完了後は `npm run e2e:diff`（`scripts/e2e-baseline-diff.mjs`）でベースラインとの差分を機械的に比較し、新規デグレードがないことを確認してからゲートを通す（`.kiro/specs/e2e-suite-stabilization` 参照）。

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

# Supabase 型定義の再生成（ローカル Supabase 起動中に実行）
npm run gen:types
```

## 主要な技術決定 (Key Technical Decisions)

- **リスト種別の後方互換**: `QuizList.listType`（`quiz` | `question`）は未設定ドキュメントを `quiz` と解釈する `resolveListType()` を型層に集約し、UI・サービスは `list.listType` の直参照を避ける。
- **ハイブリッド共通レイアウト**: PC/タブレットは左 Sidebar（275px / 70px）、モバイルは BottomNav + ミニ Header。`/play` パスでは全ナビを非表示にし没入型プレイを維持する（`LayoutWrapper` がパス判定）。
- **Tailwind + shadcn 基盤（Phase 24）**: UI 刷新の基盤として Tailwind CSS v4 + shadcn/ui を採用。テーマは shadcn 標準（`dark` クラス + CSS 変数）。移行期は `data-theme` dual bridge で旧 CSS Modules と共存。共通プリミティブは `src/components/ui/`（shadcn CLI 生成）に集約。
- **二重検証（Defense-in-Depth）**: フロントエンド（Cookie等）での権限チェックはUX向上のためだけに使用し、実際のデータ更新や操作は Supabase の Row Level Security（RLS）ポリシーおよびサーバーサイドでのトークン検証で厳格に認可します。
- **画像のSVGアップロード禁止**: XSS（スクリプト埋め込み）攻撃を防ぐため、Supabase Storageへの画像アップロード（アイコン含む）は `PNG`, `JPEG`, `GIF` に限定し、Storage ポリシーで容量・MIMEタイプを厳格にチェックします。
- **Stripe課金フローと複数有料プラン**: 無料プランに加え、Player および Creator の複数有料プランをサポート。Stripe Checkout Session（サーバー生成）および Webhook（`/api/webhooks/stripe`）によるサブスクリプション状態の同期に加え、プラン間のアップグレード（即時適用・日割り）およびダウングレード（失われる機能の確認ダイアログ表示後の確定実行）のプラン変更 API を提供します。`src/lib/stripe/server.ts` にサーバー側クライアントを集約し、クライアントバンドルへの秘密鍵漏洩を防止します。
- **広告の動的ロードと制御（Quizetika Ads）**: 有料プラン（Player/Creator）のアクティブな状態で広告スクリプト（Google AdSense）のロードを動的にスキップし、パフォーマンスおよび不要なネットワークリクエストを排除する。一時的広告非表示フラグ環境変数 `NEXT_PUBLIC_DISABLE_ADS` が `'true'` の場合、すべての広告コンポーネントおよびフックで非表示処理にフォールバックする。
- **ハイブリッド無限スクロール設計**: クイズ一覧等におけるページング体験向上のため、初期状態は「もっと見る」ボタンで開始し、クリック後はスクロール交差監視による自動追加ロード（無限スクロール）に移行するハイブリッド方式を採用。データフェッチには Supabase のカーソルベースページング処理（`getQuizzesByAuthorPage` やクイズフィードのカーソル仕様拡張）を適用し、不要な全件フェッチによる読み取りコストを削減する。
- **OAuth（Google/X/Azure AD）の PKCE コード交換**: `signInWithGoogle` 等（`src/lib/supabase/auth.ts`）は `redirectTo` に `/api/auth/callback?redirect=<path>` を指定し、`src/app/api/auth/callback/route.ts` が `supabase.auth.exchangeCodeForSession(code)` でコード交換とログイン後リダイレクトを行う。新規 OAuth プロバイダ追加時もこのコールバックルートを再利用する。
- **RLS ポリシーは SELECT/UPDATE だけでなく操作種別ごとに定義**: 初回サインイン時の `users` 行作成など、クライアントから直接 `INSERT` が走るテーブルには専用の INSERT ポリシーが必要（SELECT/UPDATE ポリシーがあっても INSERT は別途定義しないと拒否される）。新しいテーブル・書き込み経路を追加する際は、想定する全操作（SELECT/INSERT/UPDATE/DELETE）に対応するポリシーが揃っているか確認する。
- **`onAuthStateChange` は購読直後に `INITIAL_SESSION` を発火**: `AuthProvider` 側で個別に `getSession()` を呼んで初期化する必要はない（二重実行によるレースで初回ユーザー作成が重複INSERTになりうる）。
- **Firebase → Supabase 段階移行（完了・ドメイン単位カットオーバー）**: 一括移行ではなく `.kiro/specs/supabase-*`（foundation → auth-migration → core-data → gameplay/governance/storage-migration → cleanup の順）でドメインごとに移行した。全ドメインの移行完了後、`supabase-cleanup` スペックにより `firebase`/`firebase-admin` パッケージと初期化コードをリポジトリから完全に除去し、Supabase 単独構成に一本化した。
- **RDB 正規化の徹底（core-data）**: Firestore ドキュメント構造をそのまま PostgreSQL に転写しない。文字列連結の疑似ドキュメントID（例: `follower_id + '_' + following_id`）は複合主キーに、配列/JSONB による埋め込み（バッジ・フォロー中ジャンル・タグ・問題構成）は中間テーブル（`user_badges`, `user_genre_follows`, `quiz_tags`, `quiz_questions` 等）に正規化する。サービス層の TypeScript インターフェースは変更せず、内部クエリのみを差し替えるブラックボックス置換を徹底する。

---
_updated_at: 2026-07-05 — supabase-cleanup 完了に伴い Supabase 単独構成の記述に更新_
_updated_at: 2026-07-06 — e2e-suite-stabilization 完了に伴い、Failure Ledger + ベースライン差分検証によるE2Eスイート安定化パターンを追記_
_updated_at: 2026-07-09 — OAuth PKCEコールバック実装（`/api/auth/callback`）に伴い、OAuthリダイレクトパターンおよびRLS INSERTポリシー要件・`onAuthStateChange`初期化パターンを追記_
_updated_at: 2026-07-14 — 複数有料プラン（Player/Creator）拡張およびプラン変更（アップグレード・ダウングレード確認）統合に伴いStripe課金フローと広告動的スキップロジックを更新_

_Document standards and patterns, not every dependency_
