# Research & Design Decisions: quizetika-ui-personal

## Summary
- **Feature**: `quizetika-ui-personal`
- **Discovery Scope**: Extension（既存 CSS Modules UI の shadcn + Tailwind 置換）
- **Key Findings**:
  - 個人ハブは 7 ルート群・約 25 コンポーネント・15+ CSS Modules で構成。ビジネスロジックは hooks/services に分離済みで UI 層のみ移行可能
  - カスタムクイズは `data-testid` が 20 件超と E2E 契約が最も厳密。非公開クイズ除外は `buildMyQuizQuestionPool` が bookmarked 系で `published` のみ収集することで既に実装
  - テーマ切替 E2E は `data-theme` と `localStorage` を検証。foundation dual bridge 下では `ThemeToggle` を shadcn ToggleGroup/Switch に置換しつつ `setTheme` API は維持

## Research Log

### 既存コードベース分析
- **Context**: brownfield 移行対象のファイル境界と testid 契約を確定する
- **Sources Consulted**: `src/app/{profile,bookmarks,notifications,settings,my-quiz,login,pricing}/`, `src/components/{profile,bookmark,my-quiz,settings,pricing}/`, `e2e/*.spec.ts`
- **Findings**:
  - ページは Client Component + 専用 hook/service パターン。CSS Modules は各 page/client と components 配下に分散
  - 保護ルート（bookmarks, notifications, my-quiz）は `useAuth` + `router.push/replace('/login?redirect=...')` パターン
  - 旧スタイル依存: `glass-card`, `btn btn-secondary`, `btn btn-primary`, neon inline color（pricing Sparkles `#00ff66`）
  - foundation 提供済み: Button, Input, Dialog, Tabs, Skeleton, Badge, Card。layout-shell 追加: Avatar, DropdownMenu, Separator
  - 本 spec で追加が必要: Form, Label, Textarea, Select, Switch, Table, Alert, ToggleGroup（または Tabs 代替）
- **Implications**: Strangler パターンでスタイル層のみ置換。hooks/services/types は Out of Boundary

### shadcn プリミティブ選定
- **Context**: brief が Tabs, Form, Select, Switch, Table を指定
- **Sources Consulted**: shadcn/ui 公式コンポーネント一覧、quizetika-ui-foundation design
- **Findings**:
  - カスタムクイズ取得元 4 トグル → `ToggleGroup` + `ToggleGroupItem`（`aria-pressed` 維持）
  - 出題数プリセット → `ToggleGroup` role=radiogroup 相当または shadcn Tabs variant
  - テーマ切替 → `ToggleGroup`（2 択ボタン）が現行 UX に近く E2E `getByRole('button', { name: 'ライト' })` と互換
  - プロフィール編集 → `Form` + `Label` + `Input` + `Textarea`
  - カスタムクイズテーブル → shadcn `Table`（ページネーションは Button 維持）
  - 通知リスト → `Card` 行または `ScrollArea` + カスタム list item
- **Implications**: foundation に追加するプリミティブは本 spec の Task 1 で CLI add

### テーマ bridge 統合
- **Context**: user-settings E2E が `data-theme` を直接検証
- **Sources Consulted**: `src/components/settings/theme-toggle.tsx`, `src/context/theme-context.tsx`, foundation design
- **Findings**:
  - 現行 ThemeToggle は CSS Modules + `useTheme().setTheme`
  - foundation は `applyThemeToDocument` で `dark` class + `data-theme` dual
  - E2E は `data-theme` のみ検証（`dark` class は未検証）— dual bridge 維持で互換
- **Implications**: ThemeToggle は見た目のみ shadcn 化。`useTheme` API 変更禁止

### E2E 影響範囲
- **Context**: selector 更新要否の判断
- **Sources Consulted**: `e2e/user-settings.spec.ts`, `e2e/my-quiz.spec.ts`, `e2e/auth-profile.spec.ts`
- **Findings**:
  - user-settings: testid + role name（ライト/ダーク）— ToggleGroup で維持可能
  - my-quiz: testid 中心 — 維持必須
  - auth-profile: text locator + input/textarea — DOM 構造最小変更
- **Implications**: `data-testid` リネーム禁止。class 依存 selector は本 spec では my-quiz 以外影響小

## Architecture Pattern Evaluation

| Option                      | Description                                            | Strengths        | Risks / Limitations                 | Notes               |
| --------------------------- | ------------------------------------------------------ | ---------------- | ----------------------------------- | ------------------- |
| Strangler（スタイル層のみ） | コンポーネント責務・props 維持、CSS Modules → Tailwind | 低リスク、段階的 | 一時的に旧グローバル class 参照残存 | layout-shell と同一 |
| ページ単位 Big Bang         | 7 ルートを一括書き換え                                 | 短期完了         | レビュー不能、E2E 同時破綻          | 却下                |
| 共通 PersonalLayout 抽象    | 個人ハブ専用 layout コンポーネント新設                 | DRY              | スコープ拡大、既存 page 構造変更    | 却下                |

## Design Decisions

### Decision: shadcn 標準寄せ（Phase 24 Visual Direction 準拠）
- **Context**: roadmap Phase 24 で shadcn デフォルトを正と確定
- **Alternatives Considered**:
  1. ブランド維持（ネオン/Glass 移植）
  2. shadcn 標準寄せ
- **Selected Approach**: neutral/zinc デフォルト、Card border+shadow、neon/glass 不使用
- **Rationale**: 保守性・一貫性・後続スペックとの統一
- **Trade-offs**: 既存ユーザーは見た目変化大。機能は不変
- **Follow-up**: pricing Sparkles の inline color 削除

### Decision: ドメイン別コンポーネント境界維持
- **Context**: 既存 folder 構造（profile/, bookmark/, my-quiz/ 等）
- **Selected Approach**: ファイル配置変更なし。各コンポーネント内スタイル層のみ置換
- **Rationale**: インポートパス・テスト・downstream spec への影響最小
- **Trade-offs**: 横断パターン（PersonalPageHeader 等）の共通化は見送り

### Decision: カスタムクイズ Table + ToggleGroup
- **Context**: フィルタテーブルと 4 ソースチップの UI 要件
- **Selected Approach**: shadcn Table + ToggleGroup。ページネーションは既存 Button + testid 維持
- **Rationale**: brief 指定と testid 互換
- **Follow-up**: 行数多時の ScrollArea は optional

## Risks & Mitigations
- **my-quiz testid 退行** — コンポーネント移行時に grep で testid 一覧をチェックリスト化
- **テーマ E2E 失敗** — ThemeToggle 移行後に user-settings spec を Task 10 で必須実行
- **auth-profile text locator 脆性** — ボタン/リンクの visible text（編集、保存、ログアウト）を維持
- **Stripe 埋め込み** — Pricing Page の Checkout ボタンは ProPlanCard 内ロジック維持、見た目のみ Card/Button 化

## References
- `.kiro/steering/roadmap.md` Phase 24 Visual Direction
- `.kiro/specs/quizetika-ui-foundation/design.md` — Theme bridge, primitives
- `.kiro/specs/quizetika-ui-layout-shell/design.md` — Shell boundary

## Design Synthesis: Phase 3 Player/Creator 表記への更新（2026-07-13）

### Summary
- **Discovery Type**: Light（レイアウト・表示文言の更新のみ）
- **背景**: `quizetika-billing-subscription-ui` Phase 3 の多プラン化により、料金比較カードが2枚（Free/Pro）から3枚（Free/Player/Creator）に増える。本スペックは shadcn 化されたカードラッパー（`PricingPageContent`）のグリッドレイアウトのみを所有し、カード内部のロジック（価格・CTA・エンタイトルメント判定）は billing-subscription-ui が正本。

### Design Decisions
#### Decision: グリッド列数のみ調整、カード内部ロジックには関与しない
- **Context**: 3枚レイアウトへの変更が必要だが、本スペックは Boundary 上「決済処理・エンタイトルメント判定」を所有しない。
- **Selected Approach**: `md:grid-cols-2` → `md:grid-cols-3` のスタイル変更のみを本スペックのタスクとし、カード内部（`PaidPlanCard`）の実装は `quizetika-billing-subscription-ui` のタスクに委ねる。
- **Rationale**: 既存の Boundary Commitments（「Stripe 埋め込みは ProPlanCard 内ロジック維持、見た目のみ Card/Button 化」）と整合する最小差分。

### Risks & Mitigations（Phase 3）
- **カード3枚化によるモバイルレイアウト崩れ** — `md:grid-cols-3` はデスクトップのみ適用とし、モバイルは既存の縦積みレイアウトを維持する。

### Document Status（Phase 3）
- 入力: `quizetika-billing-subscription-ui` design.md Phase 3 節
- 出力: `design.md` 該当節、本節
- shadcn/ui documentation — Form, Table, Toggle Group components
