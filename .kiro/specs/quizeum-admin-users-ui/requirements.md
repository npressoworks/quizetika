# Requirements Document

## Introduction
システム管理者（Super Admin）向けに、特定のユーザーをUIDで検索し、緊急時にそのユーザーの信頼スコア（`reputationScore`）とモデレータティアー（`moderationTier`）を手動でリセットするとともに、その監査ログを `adminLogs` コレクションに記録する画面（`/admin/users`）を新規実装します。また、管理者による不適切ユーザーのアカウント停止（BAN/UNBAN）処理機能を提供し、BANされたユーザーを強制ログアウトの上、専用の停止メッセージ画面（`/banned`）へリダイレクトしてアクセスを遮断します。

**BAN機能見直し（追加）**: 通報された数が多いユーザーを管理者が素早く特定できるよう、ユーザーへの直接通報機能と通報数ランキング一覧を追加します。あわせて、モデレータティアーを任意の下位ティアへ直接引き下げる操作、および誤BAN対策としてBAN済みユーザーをBAN日時で絞り込み・検索し、一覧から解除できる機能を追加します。

**通報数リセット機能（追加）**: 嫌がらせ等による組織的な大量通報（荒らし行為）を受けたユーザーが、不当に通報ランキング上位に表示され続ける事態を是正できるよう、管理者が対象ユーザーへのユーザー直接通報（`user_reports`）を一括で解決済みにし、総通報数を引き下げられる操作を追加します。

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
  - 一般ユーザー向けの「ユーザー本人への直接通報」受付フォームおよび完了表示。
  - 管理者向けの、クイズ通報累計数とユーザー直接通報累計数を合算した「総通報数」順のユーザー一覧表示。
  - モデレータティアーを、現在のティアより下位の任意ティアへ直接引き下げる操作（既存の全リセットとは別に提供）。
  - BAN済みユーザーの一覧表示、BAN日時による期間フィルタ、UID/表示名によるキーワード検索、および一覧からの解除（UNBAN）操作。
  - 対象ユーザーへのユーザー直接通報（`user_reports`）を一括で解決済みにし、総通報数のうち直接通報分をリセットする操作。
- **Out of scope**:
  - ユーザーのアカウント物理削除機能自体。
  - BANされたユーザーが過去に投稿したクイズやコメントの物理削除や非公開化（これらはそのまま残します）。
  - クイズ単位の通報受付・審査キュー処理そのもの（引き続き `quizetika-moderation-governance-ui` が担当）。
  - ユーザー直接通報に対する個別の審査・却下ワークフロー（本要件は一覧表示と通報数集計のみを扱い、通報内容の詳細審査は対象外）。
  - 通報数のしきい値到達による自動BANやティア自動変更（本機能はすべて管理者の手動判断によるアクションのみを対象とする）。
  - クイズ通報累計（`quizzes.flags_count`）のリセット・審査（引き続き `quizetika-moderation-governance-ui` の審査画面が担当。本要件がリセットするのはユーザー直接通報分のみ）。
- **Adjacent expectations**:
  - システム管理者としての認可ガード（ミドルウェアおよび画面レイヤー）は既存の仕組みと統合する。
  - BANされたユーザーの認証ブロックおよびセキュリティルール検証は `quizetika-core` が保証する。
  - クイズ単位の通報累計数（`quizetika-core` / `quizetika-moderation-governance-ui` が管理する既存の通報カウント）を、総通報数の合算対象として参照することを期待する。
  - ユーザー直接通報のデータ永続化・重複防止・監査ログ保存の基盤は `quizetika-core` が提供することを期待する。

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

### Requirement 8: ユーザーへの直接通報機能 (User Direct Report)

**Objective:** As a Quizetika ユーザー, I want 迷惑行為を行う他ユーザーのアカウントを直接通報できるようにしたい, so that 特定のクイズに紐づかない問題行動についても運営に報告できる。

#### Acceptance Criteria

1. When 認証済みユーザーが対象ユーザーのプロフィール画面等で「ユーザーを通報」操作を行ったとき, the [User Direct Report機能] shall 通報理由の選択（例: ハラスメント、なりすまし、スパム等）と自由記述の入力フォームを表示すること。
2. If 通報理由が未選択、または自由記述欄が空欄のまま送信されたとき, then the [User Direct Report機能] shall 送信をブロックし、インラインエラーを表示すること。
3. When ユーザーが通報を送信したとき, the [User Direct Report機能] shall 通報者ID・対象ユーザーID・理由・タイムスタンプを記録し、「通報を受け付けました」という完了メッセージを表示すること。
4. If 認証されていないユーザーが通報操作を行おうとしたとき, then the [User Direct Report機能] shall ログインを促すメッセージを表示し、通報の送信をブロックすること。
5. If ユーザーが自分自身のアカウントを対象に通報しようとしたとき, then the [User Direct Report機能] shall 通報操作をブロックし、該当するエラーメッセージを表示すること。
6. If 同一ユーザーが同一対象ユーザーに対して既に未処理の通報を送信済みであるとき, then the [User Direct Report機能] shall 通報の重複登録を行わず、既存の通報状態を維持すること（同一通報者による多重カウントで総通報数が不当につり上がることを防止する）。

### Requirement 9: 通報数上位ユーザー一覧画面

**Objective:** As a System Administrator, I want 通報された数が多い順にユーザーを一覧表示したい, so that 対応優先度の高い問題ユーザーを素早く特定できる。

#### Acceptance Criteria

1. If 認証されたユーザーが admin ロールを持っていないとき, then the [Admin Users UI] shall [404または403ページを表示してアクセスを制限すること]。
2. The [Admin Users UI] shall `/admin/users` 画面内に「通報数上位ユーザー」一覧表示エリアを提供すること。
3. The [Admin Users UI] shall 各ユーザーについて、そのユーザーが作成したクイズへの通報累計数と、そのユーザー自身への直接通報累計数（Requirement 8）を合算した「総通報数」を算出すること。
4. The [Admin Users UI] shall 一覧を総通報数の降順で表示し、総通報数が同数の場合は直近の通報日時が新しい順に並べること。
5. The [Admin Users UI] shall 総通報数が1件以上のユーザーのみを一覧に含め、一定件数ごとのページネーションで表示すること。
6. For each 一覧項目について, the [Admin Users UI] shall 表示名、UID、現在のモデレータティアー、現在のBANステータス、および総通報数を表示すること。
7. When 管理者が一覧内のユーザー行を選択したとき, the [Admin Users UI] shall そのユーザーの詳細情報表示エリア（Requirement 2 と同等の情報表示、およびRequirement 3・5・10のアクション）を画面内に展開すること。
8. While 通報数上位ユーザー一覧データの読み込み中である間, the [Admin Users UI] shall 一覧表示エリアに専用のローディングプレースホルダー（`data-testid="admin-reported-users-skeleton"`）を表示すること。
9. If 一覧に該当するユーザーが1件も存在しないとき, then the [Admin Users UI] shall 「通報されたユーザーはいません」という空状態メッセージを表示すること。

### Requirement 10: モデレータティアーの段階的引き下げ (Tier Downgrade)

**Objective:** As a System Administrator, I want ユーザーのモデレータティアーを任意の下位ティアへ直接変更したい, so that 信頼度に応じた柔軟な処分ができる（全リセットに限らない）。

#### Acceptance Criteria

1. The [Admin Users UI] shall 対象ユーザーの詳細情報表示エリアに、現在のティアより下位のティアのみを選択肢とするティア引き下げ用の選択操作を提供すること。
2. The [Admin Users UI] shall 現在と同一のティアおよび現在より上位のティアを、引き下げ選択肢に含めないこと（誤って昇格させることを防止する）。
3. When 管理者が下位ティアを選択し、引き下げ理由（10文字以上）を入力して確定したとき, the [Admin Users UI] shall 対象ユーザーのモデレータティアーを選択されたティアに変更し、対象ユーザーのUID、実行者のUID、変更前後のティア、理由、およびタイムスタンプを含むログエントリを `adminLogs` コレクションに保存すること。
4. If 引き下げ理由が10文字未満のとき、または引き下げ先のティアが未選択のまま確定操作が行われたとき, then the [Admin Users UI] shall 実行をブロックし、インラインエラーを表示すること。
5. While ティア引き下げ処理が実行中のとき, the [Admin Users UI] shall 実行ボタンを非活性化し、ローディングインジケータを表示すること。
6. When ティア引き下げ処理が正常に完了したとき, the [Admin Users UI] shall 成功メッセージを表示し、画面上のティア表示を最新状態に更新すること。
7. If 対象ユーザーが現在すでに最下位ティア（newcomer）であるとき, then the [Admin Users UI] shall ティア引き下げ操作を非活性化すること。

### Requirement 11: BAN済みユーザーの一覧・検索・日時フィルタ・解除 (Banned Users List, Search & Unban)

**Objective:** As a System Administrator, I want BAN済みユーザーを一覧表示しBAN日時で絞り込み・検索して確認し、誤BANを速やかに解除したい, so that 誤って停止したユーザーのアクセスを早期に復旧できる。

#### Acceptance Criteria

1. If 認証されたユーザーが admin ロールを持っていないとき, then the [Admin Users UI] shall [404または403ページを表示してアクセスを制限すること]。
2. The [Admin Users UI] shall `/admin/users` 画面内にBAN済みユーザーの一覧表示エリアを提供すること。
3. For each BAN済みユーザーの一覧項目について, the [Admin Users UI] shall 表示名、UID、BAN理由、BAN実行日時、および実行した管理者を表示すること。
4. The [Admin Users UI] shall BAN実行日時の期間（開始日時・終了日時）を指定して一覧を絞り込む入力操作を提供すること。
5. The [Admin Users UI] shall UIDまたは表示名によるキーワード検索で一覧を絞り込む入力操作を提供すること。
6. The [Admin Users UI] shall 一覧をBAN実行日時の降順（最新のBANが先頭）で表示すること。
7. When 管理者が一覧内のBAN済みユーザー行の「解除」操作を実行し確認操作を行ったとき, the [Admin Users UI] shall Requirement 5.5 と同等のBAN解除（UNBAN）処理を実行し、対象ユーザーを一覧から除外するか、そのステータス表示を更新すること。
8. If 指定した期間または検索条件に合致するBAN済みユーザーが存在しないとき, then the [Admin Users UI] shall 「該当するBAN済みユーザーが見つかりません」という空状態メッセージを表示すること。
9. While BAN済みユーザー一覧データの読み込み中である間, the [Admin Users UI] shall 一覧表示エリアに専用のローディングプレースホルダー（`data-testid="admin-banned-users-skeleton"`）を表示すること。

### Requirement 12: ユーザー直接通報数のリセット (Direct Report Count Reset)

**Objective:** As a System Administrator, I want 嫌がらせ等による組織的な大量通報を受けたユーザーへのユーザー直接通報を一括で解決済みにしたい, so that そのユーザーが不当に通報ランキング上位に表示され続ける状態を是正できる。

#### Acceptance Criteria

1. If 認証されたユーザーが admin ロールを持っていないとき, then the [Admin Users UI] shall [404または403ページを表示してアクセスを制限すること]。
2. The [Admin Users UI] shall 検索結果詳細表示エリア（Requirement 2の検索結果表示箇所）に、対象ユーザーへのユーザー直接通報数リセット操作を提供すること。
3. When 管理者がリセット理由（10文字以上）を入力してリセットを実行し確認操作を行ったとき, the [Admin Users UI] shall 対象ユーザーに対する未処理（`status='open'`）のユーザー直接通報をすべて解決済み（`status='resolved'`）に変更し、対象ユーザーのUID、実行者のUID、リセット理由、およびタイムスタンプを含むログエントリを `admin_logs` に保存すること。
4. If リセット理由が10文字未満のとき、またはリセット先の確定操作が行われないまま送信が試みられたとき, then the [Admin Users UI] shall 実行をブロックし、インラインエラーを表示すること。
5. While ユーザー直接通報リセット処理が実行中のとき, the [Admin Users UI] shall 実行ボタンを非活性化し、ローディングインジケータを表示すること。
6. When リセット処理が正常に完了したとき, the [Admin Users UI] shall 成功メッセージを表示し、画面上の通報数表示（該当する場合は通報数ランキング一覧の該当行を含む）を最新状態に更新すること。
7. If 対象ユーザーに未処理のユーザー直接通報が1件も存在しないとき, then the [Admin Users UI] shall リセット操作を非活性化すること。
8. The [Admin Users UI] shall 本操作がクイズ通報累計（`quizzes.flags_count`）には影響を与えないことを、画面上の説明文で明示すること。

