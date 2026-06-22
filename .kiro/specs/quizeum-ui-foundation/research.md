# Research & Design Decisions

## Summary
- **Feature**: `quizeum-ui-foundation`
- **Discovery Scope**: Extension（既存 Next.js 16 + React 19 コードベースへのスタイル基盤追加）
- **Key Findings**:
  - Tailwind CSS / PostCSS / shadcn は未導入。`package.json` に該当依存なし、`components.json` なし。
  - 現行テーマは `data-theme` 属性 + `variables.css`（67 変数、ネオン/Glassmorphism）。`ThemeProvider`・FOUC script・`quizeum-theme` localStorage は `quizeum-user-settings-ui` で実装済み。
  - `src/components/ui/` に独自プリミティブ 7 件（skeleton 系、number-stepper 等）が CSS Modules 付きで存在。foundation では shadcn プリミティブを追加し、既存ファイルは段階置換（本スペックでは削除しない）。
  - steering（`tech.md`）は「TailwindCSSは使用しません」を明記。foundation 完了後に改定が必要。

## Research Log

### 既存テーマ実装の調査
- **Context**: shadcn は `document.documentElement.classList.toggle('dark')` を標準とする。現行は `dataset.theme` 方式。
- **Sources Consulted**: `src/lib/theme.ts`, `src/context/theme-context.tsx`, `src/app/layout.tsx`, `quizeum-user-settings-ui` design.md
- **Findings**:
  - `THEME_STORAGE_KEY = 'quizeum-theme'`, `DEFAULT_THEME = 'dark'`
  - `getThemeInitScript()` は `document.documentElement.dataset.theme` を同期設定
  - `ThemeProvider.applyThemeToDom` も `dataset.theme` を使用
  - 設定画面の `theme-toggle.tsx` は `useTheme` 経由で切替
- **Implications**: `lib/theme.ts` と `theme-context.tsx` を `dark` クラス方式に移行。移行期は `data-theme` も dual 設定し未移行 CSS Modules の `[data-theme='light']` セレクタを維持。

### Tailwind CSS v4 + Next.js 16 互換性
- **Context**: Next.js 16 推奨構成での Tailwind 導入方法を確認。
- **Sources Consulted**: [Tailwind CSS v4 公式ドキュメント](https://tailwindcss.com/docs/installation/framework-guides/nextjs), shadcn/ui Next.js インストールガイド
- **Findings**:
  - Tailwind v4 は `@tailwindcss/postcss` プラグインと `postcss.config.mjs` で統合
  - `globals.css` に `@import "tailwindcss"` を追加
  - shadcn CLI（`npx shadcn@latest init`）は Next.js 16 + React 19 をサポート
  - `components.json` で `style: "new-york"` または `"default"`、`baseColor: "neutral"` または `"zinc"` が標準
- **Implications**: PostCSS 設定を新設。`globals.css` を shadcn テンプレートに置換し、移行期のみ `@import "../styles/variables.css"` を末尾に残す。

### shadcn/ui 初期化と依存パッケージ
- **Context**: 必要な npm パッケージと CLI 手順を確認。
- **Sources Consulted**: shadcn/ui 公式ドキュメント、既存 `package.json`
- **Findings**:
  - 必須: `tailwindcss`, `@tailwindcss/postcss`, `postcss`, `clsx`, `tailwind-merge`, `class-variance-authority`
  - プリミティブごとに `@radix-ui/react-*` が必要（Dialog, Tabs 等）
  - `@mui/icons-material`（Material Icons）および `@mui/material/CircularProgress` を導入済み（`lucide-react` から完全移行）
  - `src/lib/utils.ts` に `cn()` を配置（shadcn 標準）
- **Implications**: CLI で init 後、Button/Input/Dialog/Tabs/Skeleton/Badge/Card を `npx shadcn@latest add` で追加。

### 既存 UI プリミティブとの共存
- **Context**: `src/components/ui/` の既存ファイルとの衝突リスク。
- **Sources Consulted**: `src/components/ui/` ディレクトリ一覧
- **Findings**:
  - 既存: `skeleton-card.tsx`, `grid-skeleton.tsx`, `number-stepper.tsx` 等（shadcn の Skeleton/Button と名前衝突なし）
  - shadcn Skeleton は `skeleton.tsx`、既存は `skeleton-card.tsx` で共存可能
  - 既存ファイルは CSS Modules 依存。foundation では削除・置換しない
- **Implications**: 新規 shadcn ファイルを追加のみ。後続スペックで段階的に既存プリミティブを置換。

### ビジュアル方針（ユーザー確認済み 2026-06-09）
- **Context**: Phase 24 Visual Direction の確定内容。
- **Sources Consulted**: `brief.md`, `roadmap.md` Phase 24
- **Findings**:
  - shadcn CLI デフォルトテーマ（neutral/zinc）をそのまま採用
  - ネオン/Glassmorphism/body gradient は再現しない
  - カスタム primary 色は初版では不要（optional）
  - フォント: Geist（Next.js 標準）または Inter。Outfit 依存は撤廃可
- **Implications**: `globals.css` の shadcn デフォルト CSS 変数をそのまま使用。`--primary` カスタムは初版スキップ。

## Architecture Pattern Evaluation

| Option | Description | Strengths | Risks / Limitations | Notes |
|--------|-------------|-----------|---------------------|-------|
| A: 一括 globals 置換 + variables 削除 | foundation で旧トークンを即削除 | トークン二重管理なし | 未移行 80 CSS Modules が即破綻 | 却下 |
| B: strangler + dual theme bridge | shadcn 基盤追加、variables 共存、data-theme + dark 併用 | 段階移行可能、E2E 維持 | 移行期のテーマ二重適用 | **採用**（roadmap Approach B） |
| C: CSS Modules に Tailwind を併用のみ | @apply や任意クラスで段階導入 | 変更最小 | shadcn 標準パターンと乖離、保守コスト高 | 却下 |

## Design Decisions

### Decision: shadcn 標準 `dark` クラス + `data-theme` dual bridge
- **Context**: 未移行 CSS Modules は `[data-theme='light']` セレクタに依存。shadcn/Tailwind は `.dark` クラスに依存。
- **Alternatives Considered**:
  1. `dark` のみ — 未移行 CSS が即時破綻
  2. `data-theme` のみ — shadcn 標準から乖離、tailwind `dark:` 修飾子が効かない
- **Selected Approach**: `applyThemeToDom` と FOUC script で `dark` クラスと `data-theme` 属性を同時設定。移行完了後に `data-theme` を削除可能。
- **Rationale**: strangler パターンの移行期要件を満たしつつ shadcn エコシステム標準に準拠。
- **Trade-offs**: テーマ適用ロジックが一時的に二系統。全スライス完了後の cleanup で解消。
- **Follow-up**: `css-modules-cleanup` 直接実装候補で `data-theme` 削除を実施。

### Decision: shadcn CLI デフォルトテーマを初版そのまま採用
- **Context**: ブランド維持型テーマ移植は roadmap で却下済み。
- **Alternatives Considered**:
  1. Quizeum 紫 primary の `--primary` 上書き
  2. CLI デフォルト（neutral/zinc）
- **Selected Approach**: CLI デフォルトをそのまま使用。カスタム色は初版では行わない。
- **Rationale**: 保守性・一貫性最大化。後続スペックで必要なら `--primary` 微調整を別タスク化可能。
- **Trade-offs**: 初版は Quizeum ブランド色と異なる見た目。意図的な方針転換。
- **Follow-up**: 全スライス完了後にブランド色検討があれば別スペックで対応。

### Decision: デフォルトテーマは `dark` を維持
- **Context**: shadcn 標準はライトデフォルトが多いが、既存 `DEFAULT_THEME = 'dark'` とユーザー設定が存在。
- **Alternatives Considered**:
  1. ライトをデフォルトに変更
  2. 既存 `dark` デフォルト維持
- **Selected Approach**: `DEFAULT_THEME = 'dark'` を維持。
- **Rationale**: 既存ユーザー体験の連続性。`quizeum-user-settings-ui` の要件 3.3 と整合。
- **Trade-offs**: shadcn 公式サンプルと初期表示が異なる。
- **Follow-up**: なし（意図的決定）。

### Decision: Geist フォント採用
- **Context**: 現行は Google Fonts Outfit。shadcn + Next.js は Geist を推奨。
- **Alternatives Considered**:
  1. Inter（Google Fonts）
  2. Geist（next/font）
- **Selected Approach**: `next/font` の Geist Sans / Geist Mono を `layout.tsx` に追加。
- **Rationale**: Next.js 16 ネイティブ、追加 HTTP リクエスト不要、shadcn テンプレート互換。
- **Trade-offs**: Outfit からの視覚変化。後続スライスで顕在化。
- **Follow-up**: `globals.css` の `--font-family` 参照を Geist に更新。

## Risks & Mitigations
- **Risk**: globals.css 置換により未移行ページのレイアウト崩れ — **Mitigation**: variables.css を import 継続、body gradient/glass は削除するが CSS Modules の個別スタイルは維持
- **Risk**: FOUC script と ThemeProvider の不整合 — **Mitigation**: 両方を同一ヘルパー（`applyThemeToDom`）経由に統一、Jest で検証
- **Risk**: shadcn init が既存 ESLint/TS 設定と衝突 — **Mitigation**: init 後に `npm run lint` と `npm run build` を即時確認タスクに含める
- **Risk**: E2E がテーマ関連セレクタ（`data-theme`）に依存 — **Mitigation**: dual bridge で `data-theme` 維持。E2E 回帰タスクを必須化

## References
- [Tailwind CSS — Install Tailwind CSS with Next.js](https://tailwindcss.com/docs/installation/framework-guides/nextjs) — PostCSS 統合手順
- [shadcn/ui — Installation](https://ui.shadcn.com/docs/installation/next) — Next.js 16 向け init 手順
- [shadcn/ui — Theming](https://ui.shadcn.com/docs/theming) — CSS 変数と `dark` クラス戦略
- `.kiro/steering/roadmap.md` Phase 24 — 境界戦略と Visual Direction
- `.kiro/specs/quizeum-user-settings-ui/design.md` — 既存テーマ実装の所有境界
