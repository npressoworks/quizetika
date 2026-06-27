# Requirements Document

## Introduction
システム管理者（Super Admin）向けに、特定のユーザーをUIDで検索し、緊急時にそのユーザーの信頼スコア（`reputationScore`）とモデレータティアー（`moderationTier`）を手動でリセットするとともに、その監査ログを `adminLogs` コレクションに記録する画面（`/admin/users`）を新規実装します。また、管理者による不適切ユーザーのアカウント停止（BAN/UNBAN）処理機能を提供し、BANされたユーザーを強制ログアウトの上、専用の停止メッセージ画面（`/banned`）へリダイレクトしてアクセスを遮断します。

## Boundary Context
- **In scope**:
  - 管理者専用の `/admin/users` 画面の提供。
  - ユーザーUIDの入力によるユーザー基本情報（ユーザー名、アバター、現在の信頼スコア、モデレータティアー、退会ステータス、BANステータス）の表示。
  - 強制リセット理由の入力フォーム。
  - リセット処理実行アクション（信頼スコアを 0、モデレータティアーを newcomer に更新）。
  - BAN/UNBAN処理フォームおよび実行アクション（`isBanned` フラグの更新）。
  - リセット・BAN/UNBAN実行時の監査ログ（`adminLogs`）の保存。
  - `/admin/moderation` 画面から `/admin/users` へのリンクナビゲーション。
  - BANされたユーザー向けの専用停止メッセージ画面（`/banned`）の提供。
- **Out of scope**:
  - ユーザーのアカウント物理削除機能自体。
  - BANされたユーザーが過去に投稿したクイズやコメントの物理削除や非公開化（これらはそのまま残します）。
- **Adjacent expectations**:
  - システム管理者としての認可ガード（ミドルウェアおよび画面レイヤー）は既存の仕組みと統合する。
  - BANされたユーザーの認証ブロックおよびセキュリティルール検証は `quizetika-core` が保証する。

## Requirements

### Requirement 1: 管理者専用ユーザー管理画面へのアクセス制限 (Access Control)
**Objective:** As a System Administrator, I want to restrict access to the user management page, so that unauthorized users cannot view or reset player data.

#### Acceptance Criteria
1. While ユーザーがログインしていない、またはユーザーのロールが admin ではないとき, when ユーザーが `/admin/users` にアクセスしたとき, the system shall ユーザーをリダイレクトクエリ付きで `/login` にリダイレクトするか、`/not-found` ページを表示する。
2. While ユーザーが admin としてログインしているとき, when ユーザーが `/admin/users` にアクセスしたとき, the system shall ユーザー管理画面を表示する。

### Requirement 2: ユーザー検索と情報表示 (User Search & Display)
**Objective:** As a System Administrator, I want to search for a user by UID and view their current moderation status, so that I can decide if they need a manual reset.

#### Acceptance Criteria
1. When 管理者がユーザーUIDを入力して検索ボタンをクリックしたとき, the system shall 対象ユーザーの表示名、アバター、信頼スコア、モデレーターティア、退会ステータス、およびBANステータスを取得して表示する。
2. If 指定されたユーザーUIDがシステムに存在しないとき, then the system shall 「ユーザーが見つかりません」というエラーメッセージを表示する。

### Requirement 3: 信頼スコアおよびモデレータティアーの手動リセットとログ記録 (Manual Reset & Auditing)
**Objective:** As a System Administrator, I want to manually reset a user's reputation score and moderation tier with a mandatory reason, so that the reset is logged for audit purposes.

#### Acceptance Criteria
1. When 管理者がリセットボタンをクリックしたとき, the system shall リセット理由が空欄でなく、10文字以上入力されているかを検証する。
2. If リセット理由が有効で、管理者がリセット処理を確定したとき, the system shall 対象ユーザーの `reputationScore` を `0` にリセットし、`moderationTier` を `'newcomer'` に更新し、対象ユーザーのUID、管理者のUID、リセット理由、およびタイムスタンプを含むログエントリを `adminLogs` コレクションに保存する。
3. While リセット処理が実行中のとき, the system shall リセットボタンを非活性化し、ローディングインジケータを表示する。
4. When リセット処理が正常に完了したとき, the system shall 成功メッセージを表示し、画面上のユーザー情報を最新状態に更新する。

### Requirement 4: 管理用ナビゲーション (Admin Navigation)
**Objective:** As a System Administrator, I want to navigate easily between moderation page and user management page, so that I can perform administrator duties efficiently.

#### Acceptance Criteria
1. When 管理者が `/admin/moderation` を表示したとき, the system shall `/admin/users` へのリンクまたはボタンを表示する。
2. When 管理者が `/admin/users` を表示したとき, the system shall `/admin/moderation` へのリンクまたはボタンを表示する。

### Requirement 5: ユーザーのアカウント停止 (BAN) 機能 (User Ban & Access Block)
**Objective:** As a System Administrator, I want to ban or unban a user with a mandatory reason, so that their access is blocked and the action is logged.

#### Acceptance Criteria
1. When 管理者がBANボタンをクリックしたとき, the system shall BAN理由が空欄でなく、10文字以上入力されているかを検証する。
2. If BAN理由が有効で、管理者がBAN処理を確定したとき, the system shall 対象ユーザーの `isBanned` フィールドを `true` に設定し、対象ユーザーのUID、管理者のUID、BAN理由、アクションタイプ `'ban'`、およびタイムスタンプを含むログエントリを `adminLogs` コレクションに保存する。
3. While BAN処理が実行中のとき, the system shall BANボタンを非活性化し、ローディングインジケータを表示する。
4. When BAN処理が正常に完了したとき, the system shall 成功メッセージを表示し、表示されるユーザーのステータスを「BAN済み」に更新し、UNBANボタンを活性化する。
5. When 管理者がUNBANボタンをクリックして処理を確定したとき, the system shall 対象ユーザーの `isBanned` フィールドを `false` に設定し、対象ユーザーのUID、管理者のUID、アクションタイプ `'unban'`、およびタイムスタンプを含むログエントリを `adminLogs` コレクションに保存し、表示されるユーザーステータスを更新する。

### Requirement 6: BANユーザーのアクセス即時遮断と停止画面 (Immediate Block & Banned Page)
**Objective:** As a Banned User, I want to see a clear account suspension notice, so that I know why I cannot access the service.

#### Acceptance Criteria
1. While ログイン中のユーザーの `isBanned` が `true` である、またはBANされたユーザーがログイン状態のままアクセス・遷移したとき, the system shall ユーザーセッションを破棄（強制ログアウト）し、専用のアカウント停止メッセージ画面（`/banned`）にリダイレクトする。
2. When 未認証ユーザーまたは非BANユーザーが `/banned` にアクセスしたとき, the system shall ホーム画面（`/`）にリダイレクトする。
3. While ユーザーの `isBanned` が `true` であるとき, the system shall すべてのログインおよびユーザー認可が必要な機能へのアクセスを遮断する。

### Requirement 7: 管理者ユーザー管理画面およびアカウント停止画面の非同期表示最適化 (Asynchronous Data Fetch & Skeleton Loading) (Phase 12 追加)
**目的:** システム管理者またはBANされたユーザーとして、管理者用ユーザー管理画面やアカウント停止画面にアクセスした際、画面全体の白紙ローディングを待つことなく、静的なページレイアウトが即座に表示され、データが揃った箇所から順番にコンテンツが表示されるようにしたい。これにより、待機時のストレスや画面の点滅による不快感を防ぐことができる。

#### 受け入れ基準

**管理者ユーザー管理画面における非同期表示最適化**
1. When [管理者がユーザー管理画面（`/admin/users`）にアクセスしたとき], the [Admin Users UI] shall [サーバーコンポーネントとして管理者用サイドバー、ヘッダー、タイトル枠、およびUID入力エリアを含む静的なページフレームを即座にレンダリングし、Next.jsのStreaming機能を通じてクライアントへ送信すること]。
2. While [検索対象のユーザー情報（現在の信頼スコア、モデレータティアー等）または実行中の処理状態の読み込み中である間], the [Admin Users UI] shall [ユーザー情報表示エリアに、専用のスケルトンプレースホルダー（Skeleton）を表示すること]。
3. When [データのロードが完了したとき], the [Admin Users UI] shall [スケルトン表示領域を、実際のユーザー情報表示コンテンツに差し替えること]。
4. While [監査ログ（`adminLogs`）の履歴リストの取得中である間], the [Admin Users UI] shall [監査ログ表示エリアに、専用のローディングスケルトンを表示すること]。
5. When [監査ログデータのロードが完了したとき], the [Admin Users UI] shall [スケルトン表示領域を実際の監査ログ履歴リストに差し替えること]。

**アカウント停止メッセージ画面における非同期表示最適化**
6. When [ユーザーがアカウント停止メッセージ画面（`/banned`）にアクセスしたとき], the [Admin Users UI] shall [サーバーコンポーネントとしてヘッダー、タイトル、および停止通知の基本フレームを即座にレンダリングし、Next.jsのStreaming機能を通じてクライアントへ送信すること]。
7. While [BANされた詳細情報（BAN理由、日時等）の読み込み中である間], the [Admin Users UI] shall [コンテンツ表示エリアに専用のスケルトンプレースホルダーを表示すること]。
8. When [詳細データのロードが完了したとき], the [Admin Users UI] shall [スケルトン表示領域を実際のBAN理由詳細コンテンツに差し替えること]。

**アクセシビリティ・テスト支援**
9. The [Admin Users UI] shall [ユーザー情報のスケルトン領域に `data-testid="admin-user-info-skeleton"`、監査ログのスケルトン領域に `data-testid="admin-logs-skeleton"` を付与すること]。
10. The [Admin Users UI] shall [アカウント停止画面のスケルトン領域に `data-testid="banned-info-skeleton"` を付与すること]。

