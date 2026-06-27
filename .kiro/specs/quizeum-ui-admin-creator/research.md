# Research & Design Decisions

## Summary
- **Feature**: `quizetika-ui-admin-creator`
- **Discovery Scope**: Extension（既存 admin/creator/community UI のスタイル層置換）
- **Key Findings**:
  - 5 ページ + 4 チャート/スケルトン CSS Modules（計 9 `.module.css`）が移行対象。`analytics-chart` と `selection-pie` はインラインスタイルのみ
  - 認可は middleware cookie + 各ページの `useAuth` 二次ガードの二層構造。変更禁止
  - 現行コードはモデレーション restore/delete に確認ダイアログなし。brief 制約により shadcn AlertDialog で追加実装が必要
  - クリエイターダッシュボードは `data-testid` 中心の E2E。admin/community は `id` 属性中心
  - dense UI に shadcn Table + AlertDialog + Tabs + Chart（recharts）が適合

## Research Log

### 既存ページ構成と CSS Modules
- **Context**: 移行対象ファイルの特定
- **Sources Consulted**: `src/app/admin/*`, `src/app/creator/dashboard/*`, `src/app/community/*`, `src/components/charts/*`
- **Findings**:
  - Admin: `users.module.css`, `moderation.module.css`（各 ~450 行相当の dense スタイル）
  - Creator: `dashboard.module.css` + `dashboard-client.tsx`, `dashboard-sections.tsx`, `dashboard-actions.tsx`
  - Community: `genres.module.css` (~687 行), `merge.module.css`
  - Charts: `stats-skeleton.module.css`, `charts-skeleton.module.css`; `quiz-list-skeleton.module.css`, `feedback-skeleton.module.css`
  - `analytics-chart.tsx` / `selection-pie.tsx` はインラインスタイル（CSS 変数 `--color-primary` 等参照）
- **Implications**: ページ単位の strangler 移行が可能。チャートは foundation 後に shadcn Chart または Tailwind ラップで統一

### 認可・データ取得パターン
- **Context**: 範囲外だが維持必須の契約確認
- **Sources Consulted**: `src/middleware.ts`, `src/lib/middleware-auth-cookies.ts`, 各 page.tsx
- **Findings**:
  - Admin moderation: Firestore `getDocs` + `resolveFlag()` サービス
  - Admin users: REST `/api/admin/users/{reset,ban,unban}` + Bearer token
  - Creator: `getQuizzesByAuthor`, `getReportsForCreator`, `computeDashboardStats`
  - Community: `tagMerge.ts` サービス + Firestore
  - Client guard: `moderationTier`, `isAdminUser`, login redirect
- **Implications**: UI 層のみ変更。fetch/service 呼び出し・redirect 条件は不変

### 確認ダイアログ現状と brief 制約
- **Context**: Requirement 8 の実装方針
- **Sources Consulted**: `admin/moderation/page.tsx`, `admin/users/page.tsx`, brief.md
- **Findings**:
  - Moderation restore/delete: 即時実行（確認なし）
  - Admin users BAN/reset: 理由 10 文字必須、確認なし（UNBAN のみ `confirm()`）
  - brief: 「モデレーション操作の確認ダイアログ必須」
- **Implications**: 移行時に shadcn AlertDialog を追加。UNBAN の `confirm()` は AlertDialog に統一

### shadcn コンポーネント選定
- **Context**: dense テーブル/フォーム/チャート向けプリミティブ
- **Sources Consulted**: shadcn/ui docs, `quizetika-ui-foundation/design.md`, brief.md
- **Findings**:
  - Table: admin キュー・ユーザー情報・コミュニティリストに適合
  - AlertDialog: 破壊的操作確認（Radix ベース、アクセシブル）
  - Select, Textarea, Label: フォーム入力（BAN 理由、マージ提案等）
  - Chart: shadcn chart（recharts ラップ）で analytics-chart 置換可能
  - 既存 foundation 提供: Button, Input, Dialog, Tabs, Skeleton, Badge, Card
- **Implications**: 本スペックで Table, AlertDialog, Select, Textarea, Label, Chart を追加

### E2E 互換性
- **Context**: 回帰テスト維持
- **Sources Consulted**: `e2e/admin-users.spec.ts`, `e2e/creator-dashboard.spec.ts`, `e2e/creator-streaming-skeleton.spec.ts`, `e2e/moderation-feedback.spec.ts`
- **Findings**:
  - Creator: `data-testid` 依存（skeleton → content 遷移テストあり）
  - Admin: `id` 属性（`execute-ban-btn` 等）とテキストセレクタ
  - Community: `id` 属性（`genre-vote-approve-{id}` 等）
- **Implications**: testid/id 維持を design の必須制約とする。AlertDialog 追加時は E2E に確認ステップを追加可能（既存テストが通るよう confirm ボタンに安定 id を付与）

## Architecture Pattern Evaluation

| Option                          | Description                               | Strengths              | Risks / Limitations              | Notes                       |
| ------------------------------- | ----------------------------------------- | ---------------------- | -------------------------------- | --------------------------- |
| Strangler（ページ単位）         | CSS Modules → Tailwind 置換、ロジック維持 | 低リスク、E2E 段階確認 | 一時的に旧インラインスタイル残存 | layout-shell と同一パターン |
| コンポーネント抽出（DataTable） | 共通 DataTable フック化                   | 再利用性               | 3 ページで過剰抽象化             | 初版はページ内 Table で十分 |
| recharts 直接                   | shadcn Chart なし                         | 軽量                   | テーマ統一が手動                 | shadcn Chart 推奨           |
| 既存 confirm() 維持             | ネイティブダイアログ                      | 変更最小               | a11y/UX 不統一、brief 未充足     | 却下                        |

## Design Decisions

### Decision: shadcn Chart（recharts）で analytics-chart を置換
- **Context**: Requirement 6 — テーマ連動チャート
- **Alternatives Considered**:
  1. 既存インラインスタイルを Tailwind ラップのみ — テーマ変数連携が弱い
  2. recharts 直接利用 — shadcn エコシステムから外れる
- **Selected Approach**: `npx shadcn@latest add chart` で Chart コンポーネントを追加し、`AnalyticsChart` を recharts BarChart + shadcn ChartContainer で再実装。`SelectionPie` は PieChart または既存 conic-gradient を Tailwind + CSS 変数で維持（初版は shadcn PieChart）
- **Rationale**: shadcn 標準寄せ方針、ダークモード自動追随
- **Trade-offs**: `recharts` 依存追加。バンドルサイズ微増
- **Follow-up**: モックデータ（playsTrendData 等）は既存維持

### Decision: AlertDialog で破壊的操作確認を統一
- **Context**: Requirement 8 + brief 制約
- **Alternatives Considered**:
  1. 既存 Dialog プリミティブ — AlertDialog の方が確認 UX に特化
  2. window.confirm() 維持 — スタイル不統一
- **Selected Approach**: 共有 `ConfirmActionDialog` ラッパーを `src/components/admin/confirm-action-dialog.tsx` に作成。restore/delete/ban/reset で再利用
- **Rationale**: a11y、shadcn 標準、E2E で `data-testid="confirm-action-btn"` 等を付与可能
- **Trade-offs**: E2E が確認ステップを要求する場合、テスト更新が必要
- **Follow-up**: `e2e/admin-users.spec.ts` の BAN フローに確認クリックを追加

### Decision: ページ内 Table（DataTable パターン簡易版）
- **Context**: dense テーブル UI（admin, community）
- **Alternatives Considered**:
  1. TanStack Table + shadcn DataTable フル実装 — ソート/ページング未使用ページには過剰
  2. Card リスト — 既存テーブルレイアウトと乖離
- **Selected Approach**: shadcn Table コンポーネントで既存行レイアウトを再現。フィルタは既存ロジック維持
- **Rationale**: 最小差分、foundation Tabs/Badge と整合
- **Trade-offs**: 将来の高度 DataTable は別スペックで拡張
- **Follow-up**: なし

## Risks & Mitigations
- **E2E 破損（AlertDialog 追加）** — 確認ボタンに安定 `data-testid` を付与し、admin-users spec を更新
- **recharts バンドル増** — ダッシュボードのみ import。tree-shaking 確認
- **旧 CSS 変数参照（インライン style）** — 移行時に shadcn CSS 変数（`hsl(var(--primary))`）へ置換
- **並列実装のファイル競合** — admin/community は別ディレクトリで `(P)` 安全。charts は creator より先に完了

## References
- [shadcn/ui Table](https://ui.shadcn.com/docs/components/table) — dense リスト表示
- [shadcn/ui Alert Dialog](https://ui.shadcn.com/docs/components/alert-dialog) — 破壊的操作確認
- [shadcn/ui Chart](https://ui.shadcn.com/docs/components/chart) — recharts ラップ
- `quizetika-ui-foundation/design.md` — 基盤プリミティブ・テーマ bridge
- `quizetika-ui-layout-shell/design.md` — シェル内 main 描画前提
