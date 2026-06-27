# Brief: quizetika-ui-foundation

## Problem
Quizetika は Vanilla CSS / CSS Modules で構築されており、steering および 10+ UI スペックで「Tailwind 不使用」が明文化されている。ユーザーは shadcn/ui + Tailwind による UI 刷新を求めており、現行スタックとの方針矛盾と、約 80 CSS Modules の移行基盤が存在しない。

## Current State
- Tailwind / PostCSS / shadcn 未導入（`components.json` なし）
- テーマ: `variables.css`（67 CSS 変数、ネオン/Glassmorphism）+ `[data-theme='light'|'dark']` + `ThemeProvider`
- `src/components/ui/` に 7 ファイルの独自プリミティブ（skeleton, number-stepper 等）
- `tech.md` / `roadmap.md` が Vanilla CSS を正とする

## Desired Outcome
- Tailwind CSS + shadcn/ui がビルドパイプラインに統合され、CI が通る
- **shadcn 標準テーマ**（neutral/zinc 系デフォルト）をベースに、ライト/ダーク両テーマが `dark` クラスで動作
- 既存 `localStorage` 永続化・FOUC 防止スクリプトが維持される
- `cn()` ユーティリティと初期 shadcn プリミティブ（Button, Input, Dialog, Tabs, Skeleton, Badge, Card 等）が利用可能
- 旧 `variables.css` トークン（ネオン/Glassmorphism）は移植せず、移行完了後に削除可能な状態にする

## Approach
shadcn CLI で Next.js 16 + React 19 向けに**デフォルト設定で初期化**。カスタムテーマは最小限（初版は CLI デフォルトをそのまま採用、`--primary` 等の微調整は optional）。`ThemeProvider` を shadcn 標準の `document.documentElement.classList.toggle('dark')` に移行し、`data-theme` は移行期のみ dual サポートまたは削除。`globals.css` を shadcn テンプレートに置換し、旧 body gradient / glass スタイルは撤廃。steering を先に改定して以降スペックの Tailwind 禁止条項を撤廃可能にする。

## Visual Direction
- **shadcn 標準寄せ**（ユーザー確認済み 2026-06-09）
- Card / border / shadow は shadcn デフォルト
- フォント: Geist または Inter（shadcn 推奨）
- 旧 Quizetika ネオン紫/ティール/Glassmorphism は再現しない

## Scope
- **In**: Tailwind 設定、shadcn init（デフォルトテーマ）、globals.css 統合、テーマ bridge、共通プリミティブ追加、steering 更新、foundation 単体テスト
- **Out**: 個別ページ/ドメインコンポーネントの移行（後続スペック）、Framer Motion 導入、ブランド色の本格カスタマイズ

## Boundary Candidates
- Tailwind / PostCSS / shadcn CLI 設定
- shadcn デフォルト CSS 変数（`globals.css`）
- ThemeProvider + FOUC 防止スクリプト
- `src/lib/utils.ts`（`cn()`）
- 初期 shadcn コンポーネント群

## Out of Boundary
- Sidebar / Header 等シェル（→ layout-shell）
- 各機能ドメインのページ移行
- API / 認可 / データモデル

## Upstream / Downstream
- **Upstream**: Next.js 16, React 19, 既存 `lib/theme.ts`
- **Downstream**: 全 Phase 24 UI スペック（layout-shell, discovery, personal, quiz-lifecycle, editor, admin-creator）

## Existing Spec Touchpoints
- **Extends**: quizetika-user-settings-ui（テーマ方式変更）
- **Adjacent**: 全 UI スペック（Tailwind 禁止条項の撤廃）

## Constraints
- 既存 E2E が foundation マージ後も通ること（DOM 構造・data-testid 優先）
- shadcn コンポーネントは `src/components/ui/` に配置（既存ファイルは段階的に置換）
- Node 20+ / TypeScript strict 維持
- 初版テーマは shadcn CLI デフォルトを優先。カスタム primary 色は design フェーズで optional 判断
