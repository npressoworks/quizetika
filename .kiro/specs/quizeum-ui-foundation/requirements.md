# Requirements Document

## Project Description (Input)

Quizetika の開発チームおよびエンドユーザーは、現行の Vanilla CSS / CSS Modules（約 80 ファイル）による UI スタックと、steering および複数 UI スペックで明文化された「Tailwind 不使用」方針の間に矛盾を抱えている。ユーザーは shadcn/ui + Tailwind による UI 刷新を求めており、Phase 24 以降のドメイン別垂直スライス（layout-shell, discovery, personal 等）を実装するための共通基盤が存在しない。

本スペック（`quizetika-ui-foundation`）は、Tailwind CSS と shadcn/ui をビルドパイプラインに統合し、shadcn 標準テーマ（neutral/zinc 系デフォルト）を正としたライト/ダークテーマ基盤、`cn()` ユーティリティ、および初期共通プリミティブ（Button, Input, Dialog, Tabs, Skeleton, Badge, Card 等）を提供する。既存の `localStorage` 永続化（キー `quizetika-theme`）と FOUC 防止スクリプトは維持し、旧 `variables.css` のネオン/Glassmorphism トークンは移植せず移行完了後に削除可能な状態とする。個別ページ・ドメインコンポーネントの移行、シェル（Sidebar/Header）、API/認可変更は範囲外とする。

## Introduction

Quizetika は Next.js 16 + React 19 で構築されたクイズ SNS である。現状、UI は `variables.css`（67 CSS 変数、ネオン紫/ティール、Glassmorphism）と CSS Modules で構成され、shadcn/ui や Tailwind は未導入である。Phase 24 では shadcn 標準寄せのビジュアル方針が確定し、基盤スペックを先行して strangler パターンで段階移行する。

本スペックは Phase 24 の最初のスペックとして、後続 6 スペック（layout-shell, discovery, personal, quiz-lifecycle, editor, admin-creator）が共有するスタイル基盤と共通プリミティブを確立する。既存 Playwright E2E は foundation マージ後も通過することを要求する。

## Boundary Context

- **In scope**:
  - スタイル基盤の導入とビルドパイプライン統合（CI グリーン）
  - shadcn 標準テーマによるライト/ダーク両モード（`dark` クラス戦略）
  - 既存 `ThemeProvider` / `localStorage`（`quizetika-theme`）/ FOUC 防止の維持と互換移行
  - `cn()` ユーティリティと初期 shadcn プリミティブ群の `src/components/ui/` 配置
  - 移行期の旧 `variables.css` 共存（未移行ドメインの CSS Modules 継続利用）
  - `.kiro/steering/tech.md` / `structure.md` のスタイリング方針改定
  - foundation 単体の Jest テストおよびビルド/E2E 回帰確認
- **Out of scope**:
  - Sidebar / Header / BottomNav / LayoutWrapper の移行（`quizetika-ui-layout-shell`）
  - 各機能ドメインのページ・コンポーネント移行（後続 Phase 24 スペック）
  - 旧 Quizetika ビジュアル（ネオングロー、Glassmorphism、body gradient）の再現
  - Framer Motion 導入
  - API / 認可 / データモデル変更
  - `variables.css` の完全削除（全スライス完了後の直接実装候補 `css-modules-cleanup`）
- **Adjacent expectations**:
  - `quizetika-user-settings-ui` はテーマ切替 UI を本基盤の `dark` クラス方式に追随更新する（Dependencies: quizetika-ui-foundation）
  - 後続 UI スペックは本基盤の `src/components/ui/` プリミティブと Tailwind ユーティリティを利用し、Tailwind 禁止条項を撤廃する
  - 未移行ドメインは移行完了まで CSS Modules のまま共存可能である

## Requirements

### Requirement 1: ビルド・開発基盤の整備
**Objective:** As a 開発者, I want UI 刷新基盤がプロジェクトのビルドパイプラインに統合されること, so that 後続スペックが安全にスタイル実装を開始できる。

#### Acceptance Criteria
1. When 開発者が本番ビルドを実行したとき, the UI Foundation shall エラーなく完了する。
2. When 開発者が開発サーバーを起動したとき, the UI Foundation shall アプリケーションを正常に表示できる。
3. When 開発者が lint を実行したとき, the UI Foundation shall 本スペックで追加した設定・ファイルに起因する新規 lint エラーを発生させない。
4. The UI Foundation shall 既存の TypeScript strict モードと互換である。

### Requirement 2: shadcn 標準テーマによるライト/ダーク表示
**Objective:** As a ユーザー, I want ライトモードとダークモードが shadcn 標準のクリーンな見た目で切り替わること, so that 一貫した視覚体験を得られる。

#### Acceptance Criteria
1. When ライトモードが適用されているとき, the Theme System shall アプリ全体を shadcn 標準のライトパレットで表示する。
2. When ダークモードが適用されているとき, the Theme System shall アプリ全体を shadcn 標準のダークパレットで表示する。
3. The Theme System shall 旧 Quizetika のネオン紫/ティール/Glassmorphism ビジュアルを新テーマ基盤で再現しない。
4. Where カード・サーフェスが新基盤のスタイルで描画される, the UI Foundation shall shadcn デフォルトの border と shadow を用いる。
5. The UI Foundation shall タイポグラフィを shadcn 推奨フォント（Geist または Inter）に合わせる。

### Requirement 3: テーマ永続化とフラッシュ防止の維持
**Objective:** As a ユーザー, I want 選択したテーマがリロード後も維持され、読み込み時に一瞬別テーマが表示されないこと, so that 快適な視覚体験を損なわない。

#### Acceptance Criteria
1. When ユーザーがテーマを変更したとき, the Theme System shall `localStorage` キー `quizetika-theme` に `dark` または `light` を保存する。
2. When ユーザーがアプリを再読み込みしたとき, the Theme System shall 保存されたテーマを復元する。
3. When ページの初回 HTML 描画が行われる前, the Theme System shall `localStorage` の `quizetika-theme` を同期的に読み取り、正しいテーマを適用する。
4. While React のクライアントハイドレーションが完了する前, the Theme System shall 初回描画時のテーマがユーザー保存値と一致する。
5. If `localStorage` に有効なテーマ値が存在しないとき, the Theme System shall デフォルトテーマ `dark` を適用する。
6. If `localStorage` に `dark` / `light` 以外の値が保存されているとき, the Theme System shall デフォルトテーマ `dark` を適用する。

### Requirement 4: 共通 UI プリミティブの提供
**Objective:** As a 開発者, I want 再利用可能な共通 UI プリミティブが利用可能であること, so that 後続スペックが一貫したコンポーネントで UI を構築できる。

#### Acceptance Criteria
1. The UI Foundation shall **Primitive Wave 1** として `src/components/ui/` に Button, Input, Dialog, Tabs, Skeleton, Badge, Card の共通プリミティブを提供する。
2. The UI Foundation shall **Primitive Wave 2** として `src/components/ui/` に Form, Label, Select, Switch, Table, Alert, Accordion, RadioGroup, Progress, Popover, Textarea, ToggleGroup, AlertDialog, Chart（recharts）, Avatar, DropdownMenu, Separator を提供する。
3. The UI Foundation shall クラス名結合ユーティリティ `cn()` をエクスポートし、後続コンポーネントから利用可能にする。
4. When 開発者が共通プリミティブをインポートしたとき, the UI Foundation shall TypeScript 型付きのコンポーネント API を提供する。
5. The UI Foundation shall 共通プリミティブを shadcn 標準のデフォルトスタイルで提供する。
6. The UI Foundation shall 後続ドメインスペックが `npx shadcn add` を再実行せず、Wave 1+2 プリミティブの存在確認のみで実装を開始できる状態にする。

### Requirement 5: 移行期スタイル共存
**Objective:** As a 開発者, I want 未移行ドメインが引き続き動作すること, so that strangler パターンで段階的に UI を置き換えられる。

#### Acceptance Criteria
1. While 後続スペックによるドメイン移行が未完了である間, the UI Foundation shall 旧 `variables.css` トークンを参照する既存 CSS Modules が引き続き描画できる。
2. When 新基盤の `globals.css` が適用されたとき, the UI Foundation shall 旧 body gradient および glass ユーティリティを新テーマの正としない。
3. The UI Foundation shall 未移行ページの既存 DOM 構造および `data-testid` 属性を変更しない。

### Requirement 6: 既存機能の回帰維持
**Objective:** As a オペレーター, I want foundation マージ後も既存 E2E が通過すること, so that UI 基盤変更が機能退行を引き起こさない。

#### Acceptance Criteria
1. When foundation 実装がマージされたとき, the UI Foundation shall 既存 Playwright E2E スイートがグリーンである。
2. When foundation 実装がマージされたとき, the UI Foundation shall 既存 Jest テストスイートがグリーンである。
3. The UI Foundation shall 既存ルート・インタラクション・認可契約を変更しない。

### Requirement 7: プロジェクト方針の更新
**Objective:** As a 開発者, I want steering 文書が新スタイル方針を反映すること, so that 後続スペックが Tailwind + shadcn を正として実装できる。

#### Acceptance Criteria
1. The UI Foundation shall `.kiro/steering/tech.md` のスタイリング方針を Tailwind CSS + shadcn/ui 採用に更新する。
2. The UI Foundation shall `.kiro/steering/structure.md` のスタイル関連記述を新基盤に合わせて更新する。
3. The UI Foundation shall steering 更新後、Tailwind 不使用条項を後続スペックが撤廃可能な状態にする。
