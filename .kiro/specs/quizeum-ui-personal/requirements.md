# Requirements Document

## Project Description (Input)

Quizeum のエンドユーザーは、プロフィール・ブックマーク・通知・設定・カスタムクイズ・ログイン・料金など個人向け画面を利用している。現状、これらは CSS Modules と旧 Quizeum ビジュアル（glass-card、ネオン色、`btn` グローバルクラス）で分散実装されており、フォーム・タブ・グリッド等の UI パターンが shadcn プリミティブに統一されていない。Phase 23 でカスタムクイズ・設定・テーマ切替は機能実装済みだが、Phase 24 の shadcn 標準寄せ方針と整合しない。

本スペック（`quizeum-ui-personal`）は、`quizeum-ui-foundation` と `quizeum-ui-layout-shell` が提供する shadcn 標準テーマ・共通プリミティブ・シェル上に、個人ハブ全画面を Tailwind + shadcn で再構築する。テーマ切替（ライト/ダーク）の settings 連携、カスタムクイズの 4 ソースフィルタ・出題設定・プレイ開始、ブックマーク/プロフィール/通知のタブ・グリッド UI の機能契約は維持する。Firestore データ取得ロジック、認可、プレイ画面起動後の UI、シェルコンポーネントは範囲外とする。

## Introduction

Quizeum は Next.js 16 + React 19 のクイズ SNS である。Phase 24 では UI 刷新をドメイン別垂直スライスで進めており、本スペックは layout-shell 完了後の第 4 スペックとして個人ハブ（7 ルート群）を対象とする。shadcn 標準寄せ（neutral/zinc デフォルト、glass/neon 非再現）を正とし、既存 `data-testid` とルーティング・認証リダイレクト契約を維持する。

移行完了時に関連 Playwright E2E（`user-settings`, `my-quiz`, `auth-profile` 等）および Jest 回帰がグリーンであることを要求する。後続 spec 更新候補（`quizeum-auth-profile-ui`, `quizeum-my-quiz-ui`, `quizeum-user-settings-ui`, `quizeum-billing-subscription-ui`）の UI 記述追随を前提とする。

## Boundary Context

- **In scope**:
  - `/profile/*`, `/bookmarks`, `/notifications`, `/settings`, `/my-quiz`, `/login`, `/pricing` 関連ページとコンポーネントの shadcn + Tailwind 再実装
  - `ThemeToggle` を foundation テーマ bridge（`dark` クラス + `data-theme` dual）と統合した settings UI
  - カスタムクイズ: 4 取得元フィルタ、検索/絞り込み、出題設定、プレイ開始、非公開クイズ問題は自作ソースのみの契約維持
  - ブックマーク/プロフィール/通知のタブ・グリッド/リスト UI の視覚統一（shadcn Tabs, Card, Table 等）
  - `bookmarks-skeleton.tsx`, `notifications-skeleton.tsx` の Tailwind 移行と `.module.css` 削除
  - 個人ハブ関連 `.module.css` の削除
  - 既存 `data-testid` の維持
  - 関連 E2E・Jest 回帰確認
- **Out of scope**:
  - Sidebar / Header / BottomNav / LayoutWrapper（`quizeum-ui-layout-shell`）
  - Tailwind/shadcn 基盤・ThemeProvider 実装（`quizeum-ui-foundation`）
  - Firestore データ取得・認可・`useMyQuizPool` 等フックのビジネスロジック変更
  - プレイ画面起動後の UI（`quizeum-ui-quiz-lifecycle`）
  - Stripe Pricing Table 等サードパーティ埋め込みのスタイル統一
  - 新ルート・IA 変更・API 変更
  - `variables.css` の完全削除（`css-modules-cleanup` 候補）
- **Adjacent expectations**:
  - `quizeum-ui-foundation` は Tailwind、shadcn テーマ、`cn()`、初期プリミティブ（Button, Input, Tabs, Card 等）を提供済みであること
  - `quizeum-ui-layout-shell` はシェル内 `main` でページを描画する前提を維持すること
  - テーマ永続化キー `quizeum-theme` と FOUC 防止は foundation 契約に従うこと
  - 後続 spec 更新候補は本移行完了後に design/requirements の Tailwind 禁止条項を削除・更新する

## Requirements

### Requirement 1: shadcn 標準ビジュアルによる個人ハブ統一
**Objective:** As a ユーザー, I want 個人向け画面が shadcn 標準のクリーンな見た目で統一されること, so that Phase 24 UI 刷新の一貫性を体感できる。

#### Acceptance Criteria
1. The Personal Hub UI shall 個人ハブ全画面で旧 Quizeum ビジュアル（glass-card、ネオン色クラス、body gradient 依存）を使用しない。
2. When ライトモードが適用されているとき, the Personal Hub UI shall shadcn 標準ライトパレットで各画面を表示する。
3. When ダークモードが適用されているとき, the Personal Hub UI shall shadcn 標準ダークパレットで各画面を表示する。
4. Where カード・サーフェス・フォームが表示される, the Personal Hub UI shall shadcn `Card` / 標準 border + shadow パターンを用いる。
5. The Personal Hub UI shall タイポグラフィと spacing を shadcn/Tailwind 標準ユーティリティに揃える。

### Requirement 2: 設定画面とテーマ切替
**Objective:** As a ユーザー, I want 設定画面からライト/ダークテーマを切り替え、選択が永続化されること, so that 快適な視覚体験を維持できる。

#### Acceptance Criteria
1. When ユーザーが `/settings` にアクセスしたとき, the Settings Page shall `data-testid="settings-page-container"` を持つコンテナとテーマ切替 UI（`data-testid="settings-theme-toggle"`）を表示する。
2. When ユーザーがライトまたはダークを選択したとき, the Theme Toggle shall `useTheme().setTheme` 経由で `html` 要素の `data-theme` 属性を対応値に更新する。
3. When ユーザーがテーマを変更したとき, the Theme Toggle shall `useTheme().setTheme` 経由で `html` 要素に `dark` クラスを適用（ライト選択時は除去）する。
4. When ユーザーがテーマを変更したとき, the Theme Toggle shall `localStorage` キー `quizeum-theme` に選択値を保存する。
5. When ユーザーがページを再読み込みしたとき, the Settings Page shall 保存されたテーマを復元表示する。
6. When ログインユーザーが設定画面を表示したとき, the Settings Page shall プロフィール編集への導線（`data-testid="settings-profile-edit-link"`）を表示する。
7. When 未ログインユーザーが設定画面を表示したとき, the Settings Page shall アカウントセクション（プロフィール編集リンク）を非表示にする。

### Requirement 3: ログイン画面
**Objective:** As a 未ログインユーザー, I want ログイン画面から既存と同様にソーシャルログインおよび安全なリダイレクトができること, so that 保護された個人機能へアクセスできる。

#### Acceptance Criteria
1. When 未ログインユーザーが `/login` にアクセスしたとき, the Login Page shall Google・X・Azure AD ログインボタンを表示する。
2. When ユーザーがログインに成功したとき, the Login Page shall `redirect` クエリが安全なパスの場合はその先へ、なければホーム（`/`）へ遷移する。
3. When 既にログイン済みユーザーが `/login` にアクセスしたとき, the Login Page shall リダイレクト先（またはホーム）へ自動遷移する。
4. If ログイン処理が失敗したとき, the Login Page shall ユーザー向け日本語エラーメッセージを表示する。
5. Where 開発/E2E テスト環境が有効である, the Login Page shall `#e2e-test-login-btn` を表示し、クリックでテストログインが可能である。
6. The Login Page shall 旧 glass-card / neon スタイルを使用せず shadcn 標準の Card と Button で認証 UI を構成する。

### Requirement 4: プロフィール画面群
**Objective:** As a ユーザー, I want プロフィール閲覧・編集・いいね・フォロー一覧が既存機能を維持したまま閲覧できること, so that ソーシャル機能を継続利用できる。

#### Acceptance Criteria
1. When ユーザーが `/profile/[uid]` にアクセスしたとき, the Profile Page shall `data-testid="profile-page-container"` を持つプロフィール詳細を表示する。
2. While プロフィールデータ読み込み中である, the Profile Page shall `data-testid="profile-skeleton"` スケルトンを表示する。
3. When ログインユーザーが自身のプロフィールを表示したとき, the Profile Page shall 編集導線を表示する。
4. When ユーザーがプロフィールのコンテンツタブ（クイズ・リスト・履歴等）を切り替えたとき, the Profile Page shall 対応コンテンツを表示し、履歴タブに `data-testid="profile-tab-history"` を維持する。
5. When ユーザーが `/profile/edit` にアクセスしたとき, the Profile Edit Page shall 表示名・自己紹介等の編集フォームと保存操作を提供する。
6. When ユーザーが `/profile/[uid]/likes` にアクセスしたとき, the Likes Page shall `data-testid="likes-page-container"` を持ついいね一覧を表示する。
7. When ユーザーが `/profile/[uid]/connections` にアクセスしたとき, the Connections Page shall `data-testid="connections-page-container"` を持つフォロー/フォロワー一覧を表示する。
8. The Profile UI shall フォロー/アンフォロー、バッジ表示、モデレーション tier 表示等の既存インタラクション契約を維持する。

### Requirement 5: ブックマーク画面
**Objective:** As a ログインユーザー, I want ブックマークしたクイズ・リスト・問題をタブで切り替えて閲覧・解除できること, so that 保存したコンテンツを整理できる。

#### Acceptance Criteria
1. When 未ログインユーザーが `/bookmarks` にアクセスしたとき, the Bookmarks Page shall `/login?redirect=/bookmarks` へリダイレクトする。
2. When ログインユーザーが `/bookmarks` にアクセスしたとき, the Bookmarks Page shall `data-testid="bookmarks-page-container"` を表示する。
3. The Bookmarks Page shall クイズ・リスト・問題の 3 タブ（`data-testid="bookmarks-tabs"`, `bookmarks-tab-quiz`, `bookmarks-tab-list`, `bookmarks-tab-question`）を提供する。
4. When ユーザーがタブを切り替えたとき, the Bookmarks Page shall 対応するグリッドまたはリストコンテンツを表示する。
5. When ブックマーク対象が空であるとき, the Bookmarks Page shall 空状態（例: `data-testid="bookmarks-empty-question"`）を表示する。
6. While データ読み込み中である, the Bookmarks Page shall `data-testid="bookmarks-skeleton"` スケルトンを表示する。

### Requirement 6: 通知画面
**Objective:** As a ログインユーザー, I want 通知一覧を閲覧し、未読通知を既読にできること, so that アクティビティを把握できる。

#### Acceptance Criteria
1. When 未ログインユーザーが `/notifications` にアクセスしたとき, the Notifications Page shall `/login?redirect=/notifications` へリダイレクトする。
2. When ログインユーザーが `/notifications` にアクセスしたとき, the Notifications Page shall 通知一覧を表示する。
3. When ユーザーが未読通知をクリックしたとき, the Notifications Page shall 該当通知を既読に更新する。
4. When 通知タイプに応じた遷移先が定義されているとき, the Notifications Page shall クリック後に適切なルート（プロフィール、クイズ等）へ遷移する。
5. While 通知読み込み中である, the Notifications Page shall スケルトン表示を提供する。

### Requirement 7: カスタムクイズ画面
**Objective:** As a ログインユーザー, I want 複数ソースから問題を選び、出題設定を調整してプレイを開始できること, so that カスタム復習セッションを実行できる。

#### Acceptance Criteria
1. When 未ログインユーザーが `/my-quiz` にアクセスしたとき, the My Quiz Page shall `/login` へリダイレクトする。
2. When ログインユーザーが `/my-quiz` にアクセスしたとき, the My Quiz Page shall `data-testid="my-quiz-page"` と `data-testid="my-quiz-start-play"` を表示する。
3. The My Quiz Page shall 4 つの取得元トグル（自作クイズ、ブックマーククイズ、ブックマークリスト内クイズ、ブックマーク問題）を `data-testid="my-quiz-source-own"` 等で提供する。
4. When ユーザーが取得元を切り替えたとき, the My Quiz Page shall 問題候補プールを再取得し、フィルタ済みテーブル（`data-testid="my-quiz-filtered-table"`）を更新する。
5. The My Quiz Page shall 検索・絞り込み UI（`data-testid="my-quiz-filters"`）と出題設定（`data-testid="my-quiz-play-settings"`）を提供する。
6. When ユーザーがプレイ開始を実行したとき, the My Quiz Page shall 有効な問題候補に基づきプレイセッションを開始する。
7. While ブックマーク系取得元のみが有効である, the My Quiz Page shall 非公開（未公開）クイズの問題を候補に含めない。
8. While 自作クイズ取得元が有効である, the My Quiz Page shall 下書き・非公開を含む自作クイズの問題を候補に含め得る。
9. If 問題プール取得に失敗したとき, the My Quiz Page shall `data-testid="my-quiz-pool-error"` でエラーと再試行を表示する。

### Requirement 8: 料金画面
**Objective:** As a ユーザー, I want 料金プラン比較とサブスクリプション状態を確認できること, so that Free/Pro プランを理解しアップグレードできる。

#### Acceptance Criteria
1. When ユーザーが `/pricing` にアクセスしたとき, the Pricing Page shall Free プランと Pro プランの比較カードを表示する。
2. While 認証状態読み込み中である, the Pricing Page shall `data-testid="pricing-skeleton"` スケルトンを表示する。
3. When ログインユーザーが Pro 資格を持つとき, the Pricing Page shall サブスクリプション状態バッジを表示する。
4. When チェックアウト完了またはキャンセル後に `?checkout=` クエリ付きでアクセスしたとき, the Pricing Page shall 対応するフィードバックバナーを表示し、URL からクエリを除去する。
5. The Pricing Page shall 旧 neon 装飾を使用せず shadcn 標準 Card でプランカードを構成する。
6. The Pricing Page shall Stripe Checkout 等の既存 CTA 契約（ログイン要求、リダイレクト）を維持する。

### Requirement 9: レガシースタイル削除と DOM 契約維持
**Objective:** As a 開発者, I want 個人ハブ関連 CSS Modules が削除され DOM 契約が維持されること, so that 後続スライスが Tailwind 正の基盤の上に実装できる。

#### Acceptance Criteria
1. When 本スペックの移行が完了したとき, the Personal Hub UI shall 個人ハブ境界内の `.module.css` ファイルを削除する。
2. The Personal Hub UI shall 本スペック対象画面の既存 `data-testid` 属性を維持する。
3. The Personal Hub UI shall 既存ルートパス・認証リダイレクト・未ログインガード契約を変更しない。
4. The Personal Hub UI shall `useAuth`, `useMyQuizPool`, `useBookmarkFeed` 等の既存フック API を変更しない。

### Requirement 10: 回帰テスト維持
**Objective:** As a オペレーター, I want 個人ハブ UI 移行後も関連 E2E と Jest が通過すること, so that 機能退行を検出できる。

#### Acceptance Criteria
1. When 本スペック実装がマージされたとき, the Personal Hub UI shall `e2e/user-settings.spec.ts` がグリーンである。
2. When 本スペック実装がマージされたとき, the Personal Hub UI shall `e2e/my-quiz.spec.ts` がグリーンである。
3. When 本スペック実装がマージされたとき, the Personal Hub UI shall `e2e/auth-profile.spec.ts` がグリーンである。
4. When 本スペック実装がマージされたとき, the Personal Hub UI shall 既存 Jest スイートがグリーンである。
5. When 本スペック実装がマージされたとき, the Personal Hub UI shall `npm run build` が成功する。
