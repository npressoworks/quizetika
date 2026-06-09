# Requirements Document

## Introduction
現在のQuizeumはデスクトップでもモバイルでもヘッダー（Header）を中心としたナビゲーションになっており、メニュー項目（ホーム、通知、ブックマーク、作問、ダッシュボード、プロフィールなど）が増えるにつれて、ヘッダーに要素が集中するかドロップダウンに隠れてしまい、アクセス性が低下しています。また、一般的なモダンSNS（XやInstagram）と比較して、UIのWOW感やプレミアムな操作性が不足しています。
本スペックでは、PC/タブレットでは左サイドバー、モバイルでは下部ボトムナビ＋上部ミニヘッダーというXやInstagram風のレスポンシブなフルハイブリッドレイアウトへと刷新し、全メニューの統合を行います。

**Phase 22（2026-06-09）**: ディスカバリーホーム（`/`）と検索画面（`/search`）の IA 分離に伴い、Sidebar および BottomNav に「検索」導線を追加し、ホーム（`/`）と検索（`/search`）のアクティブ状態を区別して表示します（各画面のコンテンツは `quizeum-play-flow-ui` が担当）。

**Phase 23（2026-06-09）**: リスト探索（`/lists`）・マイクイズ（`/my-quiz`）・設定（`/settings`）へのナビ導線を追加します。Sidebar に「リスト」「マイクイズ」を追加し、アカウントポップアップに「設定」を追加します。各画面のコンテンツは隣接スペックが担当します。モバイル BottomNav への項目追加は過密のため、本フェーズでは Sidebar 優先とし、モバイル向け到達手段は設計で確定します。

## Boundary Context
- **In scope**:
  - デスクトップ・タブレットサイズ用の縦型左サイドバー（Sidebar）の表示とメニュー統合。
  - タブレットサイズでのサイドバー自動縮小（アイコンのみ表示）。
  - モバイルサイズ（767px以下）用のボトムナビゲーション（BottomNav）の新設。
  - モバイルサイズ用の軽量ミニヘッダーへのリファクタリング。
  - レスポンシブに応じたメインコンテンツの余白（パディング/マージン）の自動調整。
  - ログイン状態に応じたメニュー項目・ユーザー情報の動的切り替え。
  - **Phase 22**: Sidebar および BottomNav への「検索」（`/search`）導線追加、ホーム（`/`）と検索（`/search`）のアクティブハイライト区別。
  - **Phase 23**: Sidebar への「リスト」（`/lists`）・「マイクイズ」（`/my-quiz`）導線追加（ログイン時のみ）。アカウントポップアップへの「設定」（`/settings`）導線追加。`/lists`・`/my-quiz`・`/settings` のアクティブハイライト。モバイル向けリスト／マイクイズ到達手段（BottomNav 以外のパターンを含む）。
- **Out of scope**:
  - クイズプレイ画面（`/play`）におけるナビゲーションレイアウトの表示（非表示のまま維持）。
  - サイドバーまたはボトムナビ上の未読通知バッジ等のリアルタイム更新システム（静的なプレースホルダー表示枠のみをスコープとする）。
- **Adjacent expectations**:
  - ログイン状態やユーザーアバター画像、メールアドレスなどの基本情報は、既存の認証状態（`useAuth` フック）から提供されること。
  - サイドバー等のリンクから遷移する各画面（ホーム、通知、ブックマーク等）のメインコンテンツ自体は、本スペックの管轄外（既存の各UIスペックが所有）であること。
  - **Phase 22**: ディスカバリーホームおよび検索画面のカルーセル・フィルタ UI は `quizeum-play-flow-ui` が提供すること。検索 URL クエリ契約は `quizeum-core` が提供すること。
  - **Phase 23**: リスト探索ページ（`/lists`）は `quizeum-lists-discovery-ui`、マイクイズページ（`/my-quiz`）は `quizeum-my-quiz-ui`、設定ページおよびテーマ切替は `quizeum-user-settings-ui` が提供すること。`layout.tsx` への ThemeProvider 統合は `quizeum-user-settings-ui` が担当し、本スペックはシェル構造の整合に協調すること。

## Requirements

### Requirement 1: 左サイドバーによるPC版グローバルナビゲーション
**Objective:** As a デスクトップユーザー, I want 画面左側に固定されたナビゲーションメニューから各機能へ素早くアクセスできること, so that 広い画面を有効活用して快適にアプリを操作できる。

#### Acceptance Criteria
1. While 画面幅が1024px以上であるとき, the Sidebar Component shall ナビゲーション項目（ロゴ、ホーム、**検索**、通知、ブックマーク、作問、ダッシュボード、マイページ、ログアウト）をテキストラベル付きで縦に固定表示する。
2. While 画面幅が768px以上1023px以下であるとき, the Sidebar Component shall テキストラベルを非表示にし、アイコンのみで縦に固定表示する。
3. When ユーザーが未ログイン状態であるとき, the Sidebar Component shall 通知、ブックマーク、作問、ダッシュボード、マイページ、ログアウトの項目を非表示にし、代わりにログインボタンを配置する。
4. When ユーザーがログイン状態であるとき, the Sidebar Component shall ログイン中ユーザーのアバター画像と表示名をフッター領域に表示する。
5. While 現在のパスがメニュー項目のリンク先と一致しているとき, the Sidebar Component shall 対象のメニュー項目をアクティブ状態としてハイライト表示する。
6. When ユーザーが Sidebar の「ホーム」項目をクリックしたとき, the Sidebar Component shall ディスカバリーホーム（`/`）へ遷移すること。
7. When ユーザーが Sidebar の「検索」項目をクリックしたとき, the Sidebar Component shall 検索画面（`/search`）へ遷移すること。
8. While 現在のパスが `/search` または `/search/` であるとき, the Sidebar Component shall 「検索」項目をアクティブ状態としてハイライト表示し、「ホーム」項目をアクティブ表示してはならない。
9. While 現在のパスが `/` であるとき, the Sidebar Component shall 「ホーム」項目をアクティブ状態としてハイライト表示し、「検索」項目をアクティブ表示してはならない。
10. While ユーザーがクイズプレイ画面（パスに `/play` を含む）を表示しているとき, the Sidebar Component shall 自身を非表示にする。

### Requirement 2: ボトムナビゲーションによるモバイル版グローバルナビゲーション
**Objective:** As a モバイルユーザー, I want 画面下部のナビゲーションバーから主要画面へ親指1タップで遷移できること, so that スマホでの片手操作がスムーズに行える。

#### Acceptance Criteria
1. While 画面幅が767px以下かつユーザーがログイン状態であるとき, the Bottom Navigation Component shall **ホーム**（`/`）、**検索**（`/search`）、通知、ブックマーク、プロフィール（マイページ）の主要リンクを画面下部に固定表示する。
2. While 画面幅が767px以下かつユーザーが未ログイン状態であるとき, the Bottom Navigation Component shall 通知、ブックマーク、プロフィールのリンクを非表示にし、**ホーム**（`/`）および**検索**（`/search`）リンクを画面下部に固定表示する。
3. While 現在のパスが `/search` または `/search/` であるとき, the Bottom Navigation Component shall 検索リンクをアクティブ状態としてハイライト表示する。
4. While 現在のパスが `/` であるとき, the Bottom Navigation Component shall ホームリンクをアクティブ状態としてハイライト表示する。
5. While ユーザーがクイズプレイ画面（パスに `/play` を含む）を表示しているとき, the Bottom Navigation Component shall 自身を非表示にする。

### Requirement 3: モバイル版軽量ヘッダー
**Objective:** As a モバイルユーザー, I want 画面上部に最小限のヘッダーが表示されること, so that アプリのブランドと自身のログイン状態（アバター）および作問アクションを常に確認できる。

#### Acceptance Criteria
1. While 画面幅が767px以下であるとき, the Header Component shall 画面上部にロゴ、作問ボタン、ユーザーアバター（未ログイン時はログインリンク）を横並びで固定表示する。
2. While 画面幅が768px以上であるとき, the Header Component shall 自身を非表示にする。
3. While ユーザーがクイズプレイ画面（パスに `/play` を含む）を表示しているとき, the Header Component shall 自身を非表示にする。

### Requirement 4: グローバルレイアウトの余白とスクロール制御
**Objective:** As a ユーザー, I want メインコンテンツがナビゲーション要素と重ならずにスクロールできること, so that 情報を欠落なく閲覧できる。

#### Acceptance Criteria
1. While 画面幅が1024px以上かつ非クイズプレイ画面であるとき, the Layout Module shall メインコンテンツの左側に275pxの余白を確保する。
2. While 画面幅が768px以上1023px以下かつ非クイズプレイ画面であるとき, the Layout Module shall メインコンテンツの左側に70pxの余白を確保する。
3. While 画面幅が767px以下かつ非クイズプレイ画面であるとき, the Layout Module shall メインコンテンツの下部に60pxの余白を確保する。
4. While ユーザーがクイズプレイ画面（パスに `/play` を含む）を表示しているとき, the Layout Module shall メインコンテンツの上下左右のナビゲーション用余白をすべて排除する。

### Requirement 5: ホーム／検索 IA 分離に伴うナビ更新（Phase 22）
**Objective:** As a ユーザー, I want ディスカバリーホームと検索画面をナビから明確に切り替えられること, so that おすすめ閲覧と条件付き探索の目的に応じて1タップで移動できる。

#### Acceptance Criteria
1. The Sidebar Component shall 「検索」メニュー項目を Sidebar の主要ナビゲーションに含めること。
2. When ユーザーが Sidebar または BottomNav のロゴをクリックしたとき, the Layout Module shall ディスカバリーホーム（`/`）へ遷移すること（既存挙動を維持）。
3. The Bottom Navigation Component shall モバイル表示時に検索画面（`/search`）への導線を提供すること。
4. The Sidebar Component shall 「検索」項目に `data-testid="nav-search"`、「ホーム」項目に `data-testid="nav-home"` を付与すること。
5. The Bottom Navigation Component shall 検索リンクに `data-testid="bottom-nav-search"`、ホームリンクに `data-testid="bottom-nav-home"` を付与すること（既存 `bottom-nav-home` がある場合は `/` 向けとして維持）。
6. The Sidebar Component shall [ディスカバリーホームのカルーセル内容・検索画面のフィルタ UI を本要件の範囲に含めない（`quizeum-play-flow-ui` が担当）]。

### Requirement 6: リスト・マイクイズ・設定へのナビ拡張（Phase 23）
**Objective:** As a ログインユーザー, I want リスト探索・マイクイズ・設定へナビからアクセスできること, so that 個人向け学習機能と表示設定に素早く到達できる。

#### Acceptance Criteria

**Sidebar 主要ナビ（ログイン時）**
1. When ユーザーがログイン状態であるとき, the Sidebar Component shall 「リスト」（`/lists`）および「マイクイズ」（`/my-quiz`）のメニュー項目を主要ナビゲーションに含めること。
2. When ユーザーが未ログイン状態であるとき, the Sidebar Component shall 「リスト」および「マイクイズ」のメニュー項目を非表示にすること。
3. When ユーザーが Sidebar の「リスト」項目をクリックしたとき, the Sidebar Component shall リスト探索画面（`/lists`）へ遷移すること。
4. When ユーザーが Sidebar の「マイクイズ」項目をクリックしたとき, the Sidebar Component shall マイクイズ画面（`/my-quiz`）へ遷移すること。
5. While 現在のパスが `/lists` または `/lists/` で始まるとき, the Sidebar Component shall 「リスト」項目をアクティブ状態としてハイライト表示すること。
6. While 現在のパスが `/my-quiz` または `/my-quiz/` で始まるとき, the Sidebar Component shall 「マイクイズ」項目をアクティブ状態としてハイライト表示すること。
7. The Sidebar Component shall 「リスト」項目に `data-testid="nav-lists"`、「マイクイズ」項目に `data-testid="nav-my-quiz"` を付与すること。

**アカウントポップアップ（設定導線）**
8. When ログインユーザーが Sidebar フッターのアカウントボタンを操作しポップアップを開いたとき, the Sidebar Component shall 「マイページ」リンクの下、区切り線の上に「設定」リンク（`/settings`）を表示すること。
9. When ユーザーがポップアップ内の「設定」をクリックしたとき, the Sidebar Component shall 設定画面（`/settings`）へ遷移し、ポップアップを閉じること。
10. The Sidebar Component shall ポップアップ内の「設定」リンクに `data-testid="sidebar-settings-link"` を付与すること。
11. While 現在のパスが `/settings` または `/settings/` で始まるとき, the Sidebar Component shall ポップアップを開いた状態の視覚的強調は不要とし、主要ナビのアクティブ表示は設計で任意とする（設定はポップアップ経由のため、主要ナビ項目のアクティブ化は必須としない）。

**モバイル到達手段**
12. While 画面幅が767px以下かつユーザーがログイン状態であるとき, the Navigation Layout shall リスト探索画面（`/lists`）およびマイクイズ画面（`/my-quiz`）へ到達できる導線を少なくとも1つ提供すること（初版は BottomNav への直接追加を必須としない。プロフィールポップアップ、ヘッダーメニュー、または同等の代替導線を設計で選択してよい）。
13. When モバイル向けに BottomNav へ「リスト」「マイクイズ」を追加しない設計を採用した場合, the Navigation Layout shall 代替導線の到達先が Sidebar と同一ルート（`/lists`・`/my-quiz`）であること。

**境界・隣接**
14. The Sidebar Component shall [リスト探索ページの検索・公開/非公開タブ UI を本要件の範囲に含めない（`quizeum-lists-discovery-ui` が担当）]。
15. The Sidebar Component shall [マイクイズのフィルタ・出題数・プレイ開始 UI を本要件の範囲に含めない（`quizeum-my-quiz-ui` が担当）]。
16. The Sidebar Component shall [設定ページのテーマ切替 UI および ThemeProvider 実装を本要件の範囲に含めない（`quizeum-user-settings-ui` が担当）]。
17. The Sidebar Component shall [マイページからのリアクション履歴導線削除を本要件の範囲に含めない（`quizeum-auth-profile-ui` が担当）]。
