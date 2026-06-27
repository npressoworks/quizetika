# Research & Design Decisions

## Summary
- **Feature**: `quizetika-ui-layout-shell`
- **Discovery Scope**: Extension（既存シェルのスタイル移行）
- **Key Findings**:
  - 既存シェルは 4 コンポーネント + 4 CSS Modules（合計約 400 行 CSS）で、`quizetika-sidebar-layout` の機能要件を満たしている
  - レスポンシブ契約は 1024px / 768px / 767px ブレークポイントと 275px / 70px / 60px 余白で固定化されている
  - E2E `layout.spec.ts` は `aside`/`header`/`nav` セマンティクス、`data-testid`、および `class` の `/active/` マッチに依存
  - foundation は Button/Card 等 7 種のみ提供。シェルには Avatar, Separator, DropdownMenu（ポップアップ）が追加必要

## Research Log

### 既存シェル実装の分析
- **Context**: brownfield 移行のため現行コードの契約を洗い出す
- **Sources Consulted**: `src/components/layout/*.tsx`, `*.module.css`, `e2e/layout.spec.ts`, `quizetika-sidebar-layout` spec
- **Findings**:
  - `LayoutWrapper` は `pathname.includes('/play')` でシェル分岐。プレイ時は `playContainer` のみ
  - Sidebar は `glass-card`, `text-neon-primary` 等の旧クラスに依存。タブレット時はラベル非表示でアイコンのみ
  - Header ポップアップは独自 backdrop + absolute 配置（Sheet 未使用）
  - BottomNav は `position: fixed` + glass-card。ログイン時 5 項目、未ログイン時 2 項目
  - アクティブ判定は `isNavItemActive` ヘルパーで `/`, `/search`, `/lists`, `/list/`, `/my-quiz` を個別処理
- **Implications**: ロジックは極力維持、スタイルのみ Tailwind/shadcn に置換。E2E 互換のため `active` クラス名を Tailwind の `cn()` で付与

### foundation 上流依存の確認
- **Context**: 許可されるプリミティブとテーマ契約を確定
- **Sources Consulted**: `quizetika-ui-foundation/design.md`, `requirements.md`
- **Findings**:
  - shadcn 標準テーマ（neutral/zinc）、`dark` クラス、`cn()` が正
  - 初期プリミティブ: Button, Input, Dialog, Tabs, Skeleton, Badge, Card
  - ThemeProvider / `quizetika-theme` / dual bridge は foundation が所有。シェルは `bg-background` 等の CSS 変数を消費するのみ
  - `layout.tsx` Provider 順序: PostHog → Auth → Theme → LayoutWrapper（変更不可）
- **Implications**: シェル移行は ThemeProvider を変更しない。追加 shadcn コンポーネント（Avatar, Separator, DropdownMenu）は本スペックで CLI add

### shadcn コンポーネント選定
- **Context**: brief が Sheet をモバイルメニューに言及。現行は DropdownMenu 相当のポップアップ
- **Sources Consulted**: shadcn/ui ドキュメント、既存 Header/Sidebar ポップアップ実装
- **Findings**:
  - Sidebar/Header のアカウントポップアップは小さなメニュー（5 項目）で DropdownMenu が適合
  - Sheet は全画面・半画面ドロワー向け。現行 UX を変えず DropdownMenu + backdrop で置換可能
  - ログインボタンは foundation Button（variant 適宜）で置換。作問ボタンも Button
  - Avatar は shadcn Avatar（Image + Fallback）で既存 img タグをラップ
  - Separator はポップアップ内区切り線（既存 `<hr>`）の置換
- **Implications**: Sheet は初版スコープ外（挙動変更リスク）。DropdownMenu を採用

### E2E 互換リスク
- **Context**: 移行後の回帰防止
- **Sources Consulted**: `e2e/layout.spec.ts`
- **Findings**:
  - PC 1200px: `aside` visible, `header` hidden, bottom nav hidden
  - Mobile 375px: inverse
  - Active state: `toHaveAttribute('class', /active/)` — Tailwind では `cn(..., isActive && 'active')` で文字列 `active` を残す
  - Play page: 全ナビ hidden（desktop + mobile）
  - Phase 23 tests: `nav-lists`, `header-profile-btn`, `header-nav-my-quiz` に依存
- **Implications**: セマンティック HTML と testid は厳守。アクティブクラスは `active` リテラルを維持

## Architecture Pattern Evaluation

| Option                 | Description                                        | Strengths                 | Risks / Limitations                      | Notes                                  |
| ---------------------- | -------------------------------------------------- | ------------------------- | ---------------------------------------- | -------------------------------------- |
| 全面書き換え           | コンポーネント構造も shadcn Sidebar パターンに変更 | shadcn 公式パターンに近い | IA/E2E 破綻リスク、スコープ拡大          | 却下                                   |
| Strangler スタイル移行 | 既存 TSX 構造・ロジック維持、CSS のみ Tailwind 化  | 機能維持、レビュー容易    | 一時的に旧クラス名（active）が残る       | **採用**                               |
| CSS Modules 共存       | 新 Tailwind と旧 module 併用                       | 段階的                    | トークン二重管理、スライス完了定義が曖昧 | 却下（本スペック完了時に module 削除） |

## Design Decisions

### Decision: Strangler スタイル移行パターン
- **Context**: Phase 24 の機能維持制約と最初のユーザー可視スライス
- **Alternatives Considered**:
  1. shadcn 公式 Sidebar コンポーネント（collapsible）への構造変更
  2. 既存 DOM/ロジック維持のスタイルのみ置換
- **Selected Approach**: 既存コンポーネント構造・ナビ IA・認証連携を維持し、CSS Modules を Tailwind ユーティリティ + shadcn プリミティブに置換
- **Rationale**: `quizetika-sidebar-layout` の要件を再実装せず移行コスト最小化
- **Trade-offs**: shadcn Sidebar 公式パターンからは外れるが、E2E 安定性を優先
- **Follow-up**: 後続で `quizetika-sidebar-layout` spec の Tailwind 禁止条項を更新

### Decision: DropdownMenu によるアカウントポップアップ
- **Context**: brief の Sheet 言及と現行ポップアップの差異
- **Alternatives Considered**:
  1. Sheet（側面/下部ドロワー）
  2. DropdownMenu（Radix Dropdown）
  3. 現行の独自 backdrop + div 維持（Tailwind のみ）
- **Selected Approach**: shadcn DropdownMenu で Sidebar/Header ポップアップを統一
- **Rationale**: アクセシビリティ（focus trap, ESC）、shadcn 標準 UI、既存 UX（小さなメニュー）に適合
- **Trade-offs**: DOM 構造が微変するが testid を同一要素に維持すれば E2E 通過可能
- **Follow-up**: 実装後に `e2e/layout.spec.ts` でポップアップ操作を再確認

### Decision: active クラス名の E2E 互換維持
- **Context**: E2E が CSS class の `/active/` に依存
- **Selected Approach**: Tailwind スタイルは `data-[active]` や `aria-current` ではなく、従来通り `active` 文字列クラスを `cn()` で付与。見た目は Tailwind（`bg-accent` 等）で実装
- **Rationale**: selector 更新を避け、roadmap の data-testid 優先維持方針に合致
- **Follow-up**: 将来 `e2e-selector-audit` で data-attribute ベースへ移行可能

## Risks & Mitigations
- **DropdownMenu による DOM 変更で E2E 失敗** — 既存 `data-testid` を同一インタラクション要素に維持、マージ前に `layout.spec.ts` 実行
- **タブレット縮小 Sidebar の Tailwind 再現漏れ** — 768–1023px でラベル非表示・幅 70px を design の responsive table で明示、E2E viewport テスト追加検討
- **ライトモードでのコントラスト不足** — shadcn `accent` / `muted-foreground` トークンを使用し、両テーマで手動確認をタスクに含める
- **foundation 未完了での着手** — `quizetika-ui-foundation` を前提依存とし、ビルド失敗時は foundation 完了を待つ

## References
- [shadcn/ui Dropdown Menu](https://ui.shadcn.com/docs/components/dropdown-menu) — アカウントポップアップ
- [shadcn/ui Avatar](https://ui.shadcn.com/docs/components/avatar) — ユーザーアバター
- `quizetika-ui-foundation/design.md` — テーマ・プリミティブ契約
- `quizetika-sidebar-layout/requirements.md` — 既存ナビ機能要件
- `e2e/layout.spec.ts` — 回帰テスト契約
