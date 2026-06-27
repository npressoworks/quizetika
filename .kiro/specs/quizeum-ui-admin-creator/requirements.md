# Requirements Document

## Project Description (Input)

Quizetika の管理者・モデレーター・クリエイター・コミュニティ運営者は、ユーザー管理、モデレーション審査、クリエイターダッシュボード、ジャンル管理・マージ投票といった dense なテーブル/フォーム UI を利用している。現状、これらは CSS Modules（admin 各 ~450 行、community/genres ~687 行）と旧 Quizetika ビジュアルで実装されており、Phase 24 の shadcn 標準寄せ UI 刷新方針と整合しない。

本スペック（`quizetika-ui-admin-creator`）は、`quizetika-ui-foundation` と `quizetika-ui-layout-shell` が提供する shadcn 標準テーマと共通プリミティブの上に、管理画面（`/admin/users`, `/admin/moderation`）、クリエイターダッシュボード（`/creator/dashboard`）、コミュニティツール（`/community/genres`, `/community/merge`）、および関連チャート・スケルトンコンポーネントを再構築する。テーブル、フィルタ、モデレーションアクション、統計チャートの機能は維持し、管理者/モデレーター権限ガード（middleware + UI）は変更しない。認可 middleware/API、reputation サービス、Firestore admin API、Stripe ダッシュボード連携は範囲外とする。

## Introduction

Quizetika は Next.js 16 + React 19 のクイズ SNS である。Phase 24 では shadcn/ui + Tailwind による段階的 UI 刷新が進行中であり、基盤（foundation）とシェル（layout-shell）完了後、管理/クリエイター/コミュニティドメインを垂直スライスとして移行する。

本スペックは Phase 24 の第 7 スペックとして、内部運用者向け dense UI を shadcn 標準のクリーンな見た目に置換し、当該ドメインの CSS Modules を削除する。管理画面は内部ユーザー向けのため視覚刷新の許容度はやや高いが、機能・データフロー・認可契約は厳守する。移行完了時に関連 Playwright E2E および Jest テストがグリーンであることを要求する。

## Boundary Context

- **In scope**:
  - `/admin/users`, `/admin/moderation` ページの UI 再構築
  - `/creator/dashboard` および配下クライアント/セクション/アクションコンポーネントの UI 再構築
  - `/community/genres`, `/community/merge` ページの UI 再構築
  - `src/components/charts/*`（analytics-chart, selection-pie, スケルトン）の UI 再構築
  - クリエイターダッシュボード関連スケルトン（quiz-list-skeleton, feedback-skeleton）の UI 再構築
  - 当該ドメイン `.module.css` の削除
  - 破壊的モデレーション操作への確認ダイアログ提供（誤操作防止）
  - 既存 `data-testid` および E2E 互換の `id` 属性の維持
  - ライト/ダーク両テーマでの視認性確保
  - 関連 E2E・Jest 回帰確認
- **Out of scope**:
  - 認可 middleware/API のロジック変更
  - reputation サービス・Firestore admin API の変更
  - Stripe ダッシュボード連携
  - 新ルート追加・IA 変更・新機能追加
  - シェル（Sidebar/Header/BottomNav）の変更
  - `variables.css` の完全削除（`css-modules-cleanup` 候補）
- **Adjacent expectations**:
  - `quizetika-ui-foundation` は Tailwind、shadcn テーマ、`cn()`、初期プリミティブ（Button, Input, Dialog, Tabs, Skeleton, Badge, Card）を提供済みであること
  - `quizetika-ui-layout-shell` はシェル内 `main` でページを描画する前提を維持すること
  - `quizetika-admin-users-ui`, `quizetika-moderation-governance-ui`, `quizetika-creator-dash-ui` は本移行完了後に design を更新する（roadmap 依存順）

## Requirements

### Requirement 1: 管理画面（ユーザー管理）の視覚再構築
**Objective:** As a 管理者, I want ユーザー管理画面が shadcn 標準のクリーンなテーブル/フォーム UI で表示されること, so that 内部運用を効率的かつ一貫した見た目で行える。

#### Acceptance Criteria
1. When 管理者が `/admin/users` にアクセスしたとき, the Admin Users UI shall UID 検索フォーム、ユーザー情報表示、レピュテーションリセット、BAN/UNBAN 操作を既存と同等の機能で提供する。
2. When 管理者がユーザー検索を実行したとき, the Admin Users UI shall 検索結果をテーブル形式で表示する。
3. When 管理者が BAN またはレピュテーションリセットを実行しようとするとき, the Admin Users UI shall 10 文字以上の理由入力を要求する。
4. The Admin Users UI shall モデレーション画面への導線（`/admin/moderation`）を維持する。
5. The Admin Users UI shall 既存の操作ボタン `id`（`execute-reset-btn`, `execute-ban-btn`, `execute-unban-btn`）を維持する。
6. The Admin Users UI shall 旧 glass/neon スタイルを使用せず、shadcn 標準のサーフェス・ボーダー・タイポグラフィで表示する。

### Requirement 2: 管理画面（モデレーション審査）の視覚再構築
**Objective:** As a モデレーターまたは管理者, I want モデレーション審査画面が shadcn 標準 UI で審査キューを操作できること, so that 通報対応を視認性高く実施できる。

#### Acceptance Criteria
1. When 権限を持つユーザーが `/admin/moderation` にアクセスしたとき, the Admin Moderation UI shall suspended クイズの審査キュー、通報理由・詳細、公開復帰・削除アクションを既存と同等の機能で提供する。
2. When 審査対象クイズを選択したとき, the Admin Moderation UI shall 管理者審査用特別閲覧ビュー（`/quiz/{id}?admin_review=1`）への遷移を維持する。
3. Where ユーザーが管理者権限を持つ, the Admin Moderation UI shall ジャンルシード操作 UI を表示する。
4. The Admin Moderation UI shall 既存の操作ボタン `id`（`restore-btn-{id}`, `delete-btn-{id}`, `seed-genres-btn`）を維持する。
5. The Admin Moderation UI shall ユーザー管理画面への導線（`/admin/users`）を維持する。
6. The Admin Moderation UI shall 旧 glass/neon スタイルを使用せず、shadcn 標準のサーフェスで表示する。

### Requirement 3: クリエイターダッシュボードの視覚再構築
**Objective:** As a クリエイター, I want ダッシュボードが shadcn 標準 UI で統計・クイズ一覧・フィードバックを閲覧できること, so that 自分のコンテンツパフォーマンスを把握できる。

#### Acceptance Criteria
1. When ログインユーザーが `/creator/dashboard` にアクセスしたとき, the Creator Dashboard UI shall 統計グリッド、トレンドチャート、クイズ一覧、フィードバックキュー、ヘッダーアクション（エクスポート・作問・リスト作成）を既存と同等の機能で提供する。
2. While ダッシュボードデータの読み込み中であるとき, the Creator Dashboard UI shall スケルトン表示（`stats-skeleton`, `charts-skeleton`, `quiz-list-skeleton`, `feedback-list-skeleton`）を表示する。
3. When データ読み込みが完了したとき, the Creator Dashboard UI shall スケルトンを実コンテンツに置き換える。
4. The Creator Dashboard UI shall 既存の `data-testid`（`stats-section`, `analytics-section`, `creator-quiz-list`, `quiz-card`, `creator-quiz-review-score` 等）を維持する。
5. The Creator Dashboard UI shall クイズカードからエディタ・詳細画面への既存導線を維持する。
6. The Creator Dashboard UI shall 旧 glass/neon スタイルを使用せず、shadcn 標準の Card・Badge で表示する。

### Requirement 4: コミュニティツール（ジャンル管理）の視覚再構築
**Objective:** As a コミュニティ参加者またはモデレーター, I want ジャンル管理画面が shadcn 標準 UI でリクエスト・投票・履歴を操作できること, so that ジャンル提案ワークフローを継続できる。

#### Acceptance Criteria
1. When ユーザーが `/community/genres` にアクセスしたとき, the Community Genres UI shall タブ切替（リクエストフォーム、モデレーター投票、承認履歴）を既存と同等の機能で提供する。
2. When ユーザーがジャンルリクエストを送信するとき, the Community Genres UI shall アイコンアップロードを含むフォーム入力を受け付ける。
3. When モデレーターが投票を行うとき, the Community Genres UI shall 承認/却下操作を既存と同等の機能で提供する。
4. The Community Genres UI shall 既存の投票ボタン `id`（`genre-vote-approve-{id}`, `genre-vote-reject-{id}` 等）を維持する。
5. The Community Genres UI shall 旧 glass/neon スタイルを使用せず、shadcn 標準の Tabs・フォームで表示する。

### Requirement 5: コミュニティツール（マージ投票）の視覚再構築
**Objective:** As a コミュニティ参加者またはモデレーター, I want マージ投票画面が shadcn 標準 UI で提案・投票を操作できること, so that タグ/ジャンル統合ワークフローを継続できる。

#### Acceptance Criteria
1. When ユーザーが `/community/merge` にアクセスしたとき, the Community Merge UI shall タブ切替（保留中のマージ投票、マージ提案）を既存と同等の機能で提供する。
2. When ユーザーがマージを提案するとき, the Community Merge UI shall タグまたはジャンルの統合提案フォームを受け付ける。
3. When モデレーターが投票を行うとき, the Community Merge UI shall 承認/却下操作を既存と同等の機能で提供する。
4. The Community Merge UI shall 既存の投票ボタン `id`（`vote-approve-{id}`, `vote-reject-{id}` 等）を維持する。
5. The Community Merge UI shall 旧 glass/neon スタイルを使用せず、shadcn 標準の Tabs・フォームで表示する。

### Requirement 6: 統計・分析チャートの視覚再構築
**Objective:** As a クリエイター, I want ダッシュボードの統計チャートが shadcn 標準テーマで表示されること, so that トレンドと選択分布を視認しやすく把握できる。

#### Acceptance Criteria
1. When クリエイターダッシュボードにトレンドデータが表示されるとき, the Analytics Chart Component shall 7 日間の棒グラフをタイトル・単位付きで描画する。
2. When クイズ一覧に質問別選択分布が表示されるとき, the Selection Pie Component shall 選択肢ごとの割合を円グラフと凡例で描画する。
3. The Analytics Chart Component shall ライト/ダーク両テーマでコントラストの取れた配色を用いる。
4. The Selection Pie Component shall データ欠損時の既存フォールバック表示を維持する。
5. The Chart Skeleton Components shall 読み込み中に既存 `data-testid`（`stats-skeleton`, `charts-skeleton`）を維持する。

### Requirement 7: 権限・アクセス制御の維持
**Objective:** As a オペレーター, I want 管理/モデレーション/コミュニティ画面の権限ガードが移行後も同一に機能すること, so that 不正アクセスを防止できる。

#### Acceptance Criteria
1. When 未認証ユーザーが管理・モデレーション画面にアクセスしたとき, the Admin Creator UI shall ログイン画面へリダイレクトする（既存 redirect パラメータを維持）。
2. When 権限のないユーザーが管理・モデレーション画面にアクセスしたとき, the Admin Creator UI shall 404 相当の画面へリダイレクトする。
3. When 未認証ユーザーがクリエイターダッシュボードにアクセスしたとき, the Creator Dashboard UI shall ログイン画面へリダイレクトする。
4. The Admin Creator UI shall 既存 middleware による cookie ベースの一次保護契約を変更しない。
5. The Admin Creator UI shall クライアントサイドの二次権限検証（`moderationTier`, `isAdminUser` 等）を維持する。

### Requirement 8: 破壊的操作の確認
**Objective:** As a モデレーターまたは管理者, I want 不可逆な操作の前に確認ダイアログが表示されること, so that 誤操作によるデータ損失を防げる。

#### Acceptance Criteria
1. When モデレーターがクイズの公開復帰を実行しようとするとき, the Admin Moderation UI shall 確認ダイアログを表示し、ユーザーが明示的に承認した場合のみ操作を実行する。
2. When モデレーターがクイズのコンテンツ削除を実行しようとするとき, the Admin Moderation UI shall 確認ダイアログを表示し、ユーザーが明示的に承認した場合のみ操作を実行する。
3. When 管理者がユーザーを BAN しようとするとき, the Admin Users UI shall 確認ダイアログを表示し、ユーザーが明示的に承認した場合のみ操作を実行する。
4. When 管理者がレピュテーションをリセットしようとするとき, the Admin Users UI shall 確認ダイアログを表示し、ユーザーが明示的に承認した場合のみ操作を実行する。
5. If ユーザーが確認ダイアログでキャンセルしたとき, the Admin Creator UI shall 操作を実行せず、画面状態を変更前に維持する。

### Requirement 9: 回帰・テーマ視認性
**Objective:** As a 開発者, I want 移行完了後も既存テストが通過し両テーマで視認できること, so that UI 刷新が機能退行を引き起こさない。

#### Acceptance Criteria
1. When 本スペックの実装がマージされたとき, the Admin Creator UI shall 関連 Playwright E2E（`admin-users`, `creator-dashboard`, `creator-streaming-skeleton`, `moderation-feedback`）がグリーンである。
2. When 本スペックの実装がマージされたとき, the Admin Creator UI shall 関連 Jest テスト（`moderation-seed`, `creator-skeleton-components`, `seed-genres`）がグリーンである。
3. The Admin Creator UI shall ライト/ダーク両テーマでテーブル・フォーム・チャート・バッジのコントラストが十分である。
4. The Admin Creator UI shall 当該ドメインの `.module.css` ファイルを削除し、未参照の CSS Modules が残らない。
5. The Admin Creator UI shall 既存ルート・データ取得・サービス呼び出し契約を変更しない。
