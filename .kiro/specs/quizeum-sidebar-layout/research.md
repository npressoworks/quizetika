# Gap Analysis: quizeum-sidebar-layout

## 1. Current State Investigation

現在のアプリケーションのレイアウトとナビゲーション構造は以下の通りです：

* **[layout.tsx](file:///d:/quizeum/src/app/layout.tsx)**:
  * アプリケーション全体のルートレイアウト。`AuthProvider` と `<Header />` を読み込み、その直下に `{children}`（メインコンテンツ）を配置する極めてシンプルな構造。
  * メインコンテンツを囲むコンテナ要素や、レイアウト用のレスポンシブな余白制御クラスは存在しない。
* **[header.tsx](file:///d:/quizeum/src/components/layout/header.tsx)** (既存の唯一のナビゲーション):
  * PC表示用のヘッダーロゴ、ナビゲーションリンク、ユーザーメニュー（作問ボタンとアバタードロップダウン）を所有。
  * モバイル表示（768px以下）では、ハンバーガーメニューによるモーダル/ドロワーナビゲーションを展開。
  * パスに `/play` が含まれるクイズプレイ画面では、ヘッダー自体を非表示（`return null`）にする制御ロジックを内包。
* **[globals.css](file:///d:/quizeum/src/app/globals.css)** / **[variables.css](file:///d:/quizeum/src/styles/variables.css)**:
  * グローバルテーマ（ネオンカラー、Glassmorphismカードなど）を定義しているが、画面全体の枠組み（サイドバー用の2カラム構成など）のためのスタイル定義はない。

---

## 2. Requirements-to-Asset Map

要件と必要な資産、およびギャップの分類は以下の通りです。

| 要件ID | 要件の概要 | 必要なアセット (コード) | 状態 | ギャップの分類・詳細 |
| :--- | :--- | :--- | :--- | :--- |
| **Requirement 1** | 左サイドバーによるPC版グローバルナビゲーション | `src/components/layout/sidebar.tsx`<br>`src/components/layout/sidebar.module.css` | **[Missing]** | 完全新規作成。<br>既存の `header.tsx` からナビゲーション項目、アバター表示、ログアウト等のロジックを移植する。 |
| **Requirement 2** | ボトムナビゲーションによるモバイル版グローバルナビゲーション | `src/components/layout/bottom-nav.tsx`<br>`src/components/layout/bottom-nav.module.css` | **[Missing]** | 完全新規作成。<br>モバイル（767px以下）専用のボトムメニュー。 |
| **Requirement 3** | モバイル版軽量ヘッダー | `src/components/layout/header.tsx`<br>`src/components/layout/header.module.css` | **[Constraint]** | 既存ヘッダーの修正。<br>PC版表示を完全に非表示化し、モバイル（767px以下）でロゴ、作問ボタン、ユーザーアバター（またはログインボタン）のみを表示するミニヘッダーへと軽量化する。 |
| **Requirement 4** | グローバルレイアウトの余白とスクロール制御 | `src/app/layout.tsx`<br>`src/app/layout.module.css`<br>`src/app/globals.css` | **[Constraint]** | 既存レイアウトの修正。<br>サイドバーとボトムナビの表示・非表示および幅に応じて、メインコンテンツ（`{children}`）エリアの左マージン/パディングおよび下マージン/パディングをレスポンシブに制御する。`/play` パスでの全画面表示（余白0）を考慮する必要がある。 |

---

## 3. Technical Challenges & Risks

* **クイズプレイ画面（`/play`）の表示崩れ防止**:
  * クイズプレイ画面ではヘッダー・サイドバー・ボトムナビをすべて隠し、全画面でゲームを表示する必要がある。
  * `layout.tsx` レベルでパスを監視し、`/play` パス時にはレイアウト用グリッドや余白（パディング）クラスを完全に排除するロジックが必要。
* **既存各ページのコンテナ幅・パディングの競合**:
  * 現在の各画面（ホームページ、プロフィール、クリエイターダッシュボード等）は、上部ヘッダー（高さ約70px）の下にコンテンツが配置される前提でマークアップやパディングが設定されている。
  * 左サイドバー（幅275px/70px）を導入した際、各画面のコンテンツ幅（`max-width: 1200px` 等）や中央揃えの設定が崩れないよう、グローバルレイアウトレベルでの強固なレスポンシブ・フレックス/グリッド構造が必要。
* **アバタードロップダウンの再設計**:
  * 既存ヘッダーの「アバターをクリックしてドロップダウンメニューを開く」挙動を、左サイドバーの最下部にどうレイアウトするか。ポップアップメニューの表示位置（上方向に展開）とスクロール時の追従性を考慮する必要がある。

---

## 4. Implementation Approaches

### オプション A: 既存コンポーネントを拡張（ヘッダー統合アプローチ）
* **概要**: `header.tsx` にサイドバーとボトムナビのHTML/CSSをすべて含め、メディアクエリだけで出し分ける。
* **メリット**: 新規ファイル数が最も少ない。
* **デメリット**: `header.tsx` が肥大化し保守性が著しく低下する。また、DOM構造上、上部ヘッダーと左サイドバーが単一コンポーネントに閉じるため、`layout.tsx` での柔軟な配置やグリッド制御が困難になり、スタイルのハック（強引な `position: fixed` など）が必要になる。
* **評価**: 不採用

### オプション B: 新規コンポーネント作成（マルチコンポーネントアプローチ） 【推奨】
* **概要**: `Sidebar` と `BottomNav` を新規コンポーネントとして作成し、`Header` はモバイル専用に縮小リファクタリング。`layout.tsx` でこれらを包含する。
* **メリット**: 各コンポーネントが単一の責務（PC表示、モバイル表示、上部表示）に特化し、可読性と保守性が高い。`layout.tsx` レベルでレスポンシブなラッパー構成を綺麗に定義できる。
* **デメリット**: 新規ファイル数が増加する。
* **評価**: 採用

---

## 5. Research Needed (調査が必要な項目)

* **既存各画面の絶対配置 (position: fixed) 要素の確認**:
  * モバイルスライドドロワーなどの既存絶対配置要素が、左サイドバーやボトムナビの `z-index` と競合しないか、各画面のスタイル定義を走査して確認する（デザインフェーズにて実施）。
* **Playwright E2Eテストへの影響**:
  * ヘッダーの要素名やログインボタン、作問ボタンのセレクタが変更されることで、既存のE2Eテストが失敗しないか。サイドバーやボトムナビの要素に適切なデータ属性（例: `data-testid="sidebar-home"`）を付与する設計が必要。

---

## 6. Effort & Risk Estimate

* **想定工数**: **M (Medium)** (3〜5日)
  * コンポーネント追加自体は容易だが、PC/タブレット/モバイルのレスポンシブ境界におけるメインコンテンツの余白調整や、既存の全21画面における表示崩れの確認・微調整に工数がかかると予想される。
* **想定リスク**: **Medium**
  * クイズプレイ画面や特殊ビュー（モデレーション審査等）での表示崩れ、絶対配置要素の重なり、既存E2Eテストの破壊リスクがあるため、デザインフェーズでの検証計画とコンポーネントの分割設計が重要となる。

---

## Phase 22: ホーム／検索 IA ナビ更新（2026-06-09）

### Summary
Sidebar / BottomNav に `/search` 導線を追加。BottomNav はログイン時5アイコン（ホーム・検索・通知・ブックマーク・プロフィール）。`pathname === '/search'` と `'/'` で active を排他制御。

### Design Decisions
1. **Search icon** — `lucide-react` `Search` をホーム直後に配置。
2. **testid** — `nav-search` / `bottom-nav-search` を要件どおり付与。
3. **Out of scope** — 検索画面コンテンツ・URL lib は触らない。

**Document Status（Phase 22 設計）**: `design.md` Phase 22 節に反映済。

---

## Phase 23: リスト・マイクイズ・設定ナビ拡張（2026-06-09）

### Summary
ログイン時 Sidebar に `/lists`・`/my-quiz` を追加。アカウントポップアップに `/settings` をマイページと区切り線の間に配置。モバイルは BottomNav 5 項目維持のため、Header アバターのプロフィールポップアップでリスト・マイクイズ・設定への代替到達を提供。`layout.tsx` / ThemeProvider は `quizeum-user-settings-ui` が所有。

### Discovery Type
**Light（拡張）** — 既存 Sidebar / Header / BottomNav パターンの延長。新規ルート（`/lists`, `/my-quiz`, `/settings`）は隣接スペックが提供予定。

### Key Findings
1. **Sidebar 現状**: `menuItems` はホーム・検索・Pro + ログイン時通知・ブックマーク。ポップアップはマイページ → 区切り → ログアウトのみ。`isNavItemActive` は `/` と `/search` の排他制御済み。
2. **Header 現状**: モバイルアバターは `/profile/${user.id}` 直行 Link。ポップアップ未実装。Phase 23 で Sidebar 同型シート追加が最小差分。
3. **BottomNav 現状**: ログイン時 5 アイコン（ホーム・検索・通知・ブックマーク・プロフィール）。6 項目化は過密のため非採用。
4. **user-settings 協調**: Req 6.1 で ThemeProvider は `layout.tsx` 配下。sidebar-layout はナビリンクのみ追加し Provider を触らない。

### Design Decisions
1. **Icons** — リスト: `List`、マイクイズ: `ClipboardList`（`BookMarked` は代替候補）。
2. **Active** — `pathname.startsWith('/lists')` / `startsWith('/my-quiz')`。設定は主要ナビ外のため active 任意。
3. **Popup 設定** — `sidebar-settings-link`、`href="/settings"`、マイページ直下・`<hr>` 上。
4. **Mobile（推奨 A）** — Header アバター → ポップアップ（リスト・マイクイズ・設定・マイページ・ログアウト）。BottomNav プロフィールは直行維持。
5. **Mobile 代替** — B: BottomNav 長押し、C: 6–7 項目、D: ハンバーガー復活 — いずれも非推奨と記録。
6. **Out of scope** — 各ページ UI、ThemeProvider、`layout.tsx` 変更。

### Risks
- Header ポップアップ追加で既存「アバター → プロフィール直行」E2E が失敗する可能性 → `header-profile-btn` testid と E2E 更新をタスクに含める。
- Sidebar ナビ項目増による縦スクロール — 768–1023px アイコンのみ表示では影響小。1024px+ で `navMenu` overflow 要確認。

**Document Status（Phase 23 設計）**: `design.md` Phase 23 節に反映済。

