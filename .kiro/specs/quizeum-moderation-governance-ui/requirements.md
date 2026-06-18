# Requirements Document: quizeum-moderation-governance-ui

## Introduction
本ドキュメントは、クイズ投稿SNS「quizeum」における管理者向け通報コンテンツ審査キュー画面、モデレータ向けタグ/ジャンルの仮想マージリクエスト画面、ジャンル新設申請・投票画面、および管理者専用のジャンル直接追加画面を含む、コミュニティ自治（モデレーションとガバナンス）に関するフロントエンドUI要件を定義します。

**Phase 6（2026-06）**: ジャンルアイコンアップロードの仕様文言を SEC-08 / `docs/` と整合（**SVG 禁止、PNG/JPEG/GIF のみ**）。実装済み UI との乖離を解消する。
**管理者ジャンル直接追加機能の追加（2026-06-18 追加）**: システム管理者が直接ジャンルを定義・新設できる専用画面（`/admin/genres`）と、そこへの相互ナビゲーションを追加する。
**ジャンル画像のローカル保存化（2026-06-18 追加）**: ジャンルアイコン画像および一時画像の保存先を Firebase Storage からローカルファイルシステム（`assets/genre/`）へ変更し、Storage への依存を排除する。

## Boundary Context
- **In scope**:
  - 管理者ロール専用の通報審査画面におけるクイズの審査待ちリスト表示（リスト・プロフィールは `quizeum-core` の通報スキーマ整備後に拡張）。
  - 「公開に復帰させる（通報却下）」または「永久非公開化 / 削除」のアクション実行ボタンUI。
  - 審査対象クイズの中身を確認するための「管理者特別検証閲覧ビュー」動線。
  - モデレータ専用のマージリクエスト画面におけるマージ提案 of 起案および保留提案に対する賛否加重投票UI。
  - シニアモデレータに対する「投票重み: x2」のインジケーター表示、および賛成率プログレスバーのリアルタイム可視化。
  - 認証済みユーザー向けの新ジャンル申請フォーム（ID、日本語名、**PNG/JPEG/GIF** アイコン画像のアップロード、最大2MB、**SVG 不可**）。
  - 新設ジャンルの保留中リストに対するモデレータ投票、可決承認条件達成時のシステム自動反映通知、履歴閲覧タブ。
  - `moderationTier` を用いた管理者・モデレータ専用画面への厳格なアクセス制限（ガード）。
  - 管理者専用のジャンル管理・追加画面（`/admin/genres`）の新規作成、およびそこでのジャンル直接追加フォーム（ID、表示名、説明、PNG/JPEG/GIFアイコン画像アップロード）の提供。
  - 管理画面間（`/admin/moderation`, `/admin/users`, `/admin/genres`）の相互ナビゲーション導線の追加。
  - ジャンル直接管理画面（`/admin/genres`）および新ジャンル新設申請画面（`/community/genres`）における、Gemini APIを利用したジャンルアイコン画像AI生成機能の提供。
- **Out of scope**:
  - `metadata_genres` ドキュメントの書き込みや Cloud Functions 側の投票集計トリガー本体のバックエンド処理（`quizeum-core`が担当）。
  - 既存ジャンルの物理的な削除機能（不要になったジャンルは非表示または非アクティブ化で対応し、物理削除は本要件の対象外とする）。
- **Adjacent expectations**:
  - 管理者によるジャンル追加操作は、Firestore の `metadata_genres` コレクションに直接書き込みを行う（Security Rules の `canWriteMetadataGenres()` の定義に依存）。

## Requirements

### Requirement 1: 管理者モデレーション審査画面 (Page: `/admin/moderation`)
**Objective:** システム管理者として、通報されたクイズ、リスト、プロフィールを審査し、プラットフォームの安全性と健全性を維持したい。

#### Acceptance Criteria
1. If [認証されたユーザーが 'admin' または 'senior_moderator' ロールを持っていないとき], then the [Moderation Governance UI] shall [404または403ページを表示してアクセスを制限すること]。
2. The [Moderation Governance UI] shall [通報数が閾値の5回に達し `status` が 'suspended' になったクイズの審査待ちキューを表示すること] (リストおよびプロフィールは、core側で同等の通報/保留フィールドが提供されるまで対象外)。
3. For each [キュー項目について], the [Moderation Governance UI] shall [具体的な違反フラグ（ハラスメント、スパム等）とプレイヤーが提供したフィードバック詳細を表示すること]。
4. The [Moderation Governance UI] shall [「公開に復帰 (Restore)」（通報カウントを0にリセット）または「コンテンツ削除 (Permanent Hide/Delete)」（作成者に警告通知を送信）のアクションを実行できるボタンを表示すること]。
5. When [管理者がキュー内の通報されたクイズをクリックしたとき], the [Moderation Governance UI] shall [「管理者審査用特別ビュー」のヘッダーオーバーレイが付いた閲覧専用の特別クイズ詳細ビューを開くこと]。

### Requirement 2: タグ/ジャンルマージリクエスト画面 (Page: `/community/merge`)
**Objective:** コミュニティモデレータとして、同義タグやジャンルのマージ提案および保留中のリクエストへの投票を行い、タグとジャンルを論理的かつ一貫して整理したい。

#### Acceptance Criteria
1. If [ユーザーの `moderationTier` が 'moderator' 未満であるとき], then the [Moderation Governance UI] shall [404または403ページを表示してアクセスを制限すること]。
2. The [Moderation Governance UI] shall [マージ元のタグ/ジャンル、マージ先の正規タグ/ジャンル、およびマージ理由を入力するフォームを含む「提案起案」タブを表示すること]。
3. The [Moderation Governance UI] shall [保留中のマージリクエスト一覧を表示する「投票一覧」タブを表示すること]。
4. When [モデレータがリクエストカード内のマージ元タグまたはジャンルをクリックしたとき], the [Moderation Governance UI] shall [分割表示で対応するタグ/ジャンルクイズリスト画面に遷移させること]。
5. The [Moderation Governance UI] shall [権限を持つモデレータが賛否投票（👍 賛成 / 👎 反対）を行えるようにすること]。
6. When [シニアモデレータがマージリクエストカードを表示したとき], the [Moderation Governance UI] shall [「投票の重み: x2」バッジを表示し、クリック時に2倍の投票重みを適用すること]。
7. The [Moderation Governance UI] shall [賛否の加重投票数（`weightedVotesFor`, `weightedVotesAgainst`）と現在の賛成率を可視化するリアルタイムプログレスバーを表示すること]。

### Requirement 3: ジャンル新設申請・投票画面 (Page: `/community/genres`)
**Objective:** Quizeum ユーザーとして新規ジャンルを申請し、モデレータとして申請の承認・非承認に投票することで、共同でクイズカタログを拡張したい。

#### Acceptance Criteria
1. The [Moderation Governance UI] shall [すべての認証済みユーザーに表示される「申請フォーム」タブを表示すること。このタブには、英語ジャンルID（小文字、ハイフン区切り）、日本語表示名、および PNG, JPEG, GIF 形式のみ（最大2MB）を受け入れるアイコンアップロードフィールドを含み、SVG やその他の形式はローカル一時ディレクトリに保存される前にインラインエラーで拒否されること]。
2. The [Moderation Governance UI] shall [`moderationTier >= 'moderator'` のユーザーにのみ表示され、保留中のジャンル申請一覧を表示する「投票」タブを表示すること]。
3. The [Moderation Governance UI] shall [モデレータが保留中のジャンル申請に対して賛否投票を行えるようにすること]。
4. If [ジャンル申請が承認閾値（加重投票数 >= 5 かつ賛成率 >= 80%）に達したとき], then the [Moderation Governance UI] shall [一時アイコン画像をローカルの一時ディレクトリから正規のジャンル用ローカルディレクトリ（`assets/genre/`）に移動し、ジャンルを `metadata_genres` に自動登録して「ジャンルが追加されました」という成功アラートを表示すること]。
5. The [Moderation Governance UI] shall [処理が完了したジャンル申請を表示する「承認・否決履歴」タブを表示すること]。

### Requirement 4: ジャンルアイコン仕様整合（Phase 6 & 保存先ローカル化）
**Objective:** プラットフォーム運営者として、ジャンル申請UIおよびドキュメントでSVGアップロードを一貫して禁止し、ローカルファイル保存をサポートすることで、SEC-08のXSS防御が損なわれるのを防ぎ、ファイル管理を簡素化したい。

#### Acceptance Criteria
1. All [仕様内のジャンルアイコンアップロードに関するすべての参照記述] shall [PNG/JPEG/GIFのみを許可し、SVGを明示的に除外すること（`docs/security_architecture.md`, `docs/screen_transition.md`, およびローカルのアプリケーション検証ルールに準拠）]。
2. The [Moderation Governance UI] shall [ジャンル申請画面のファイル入力の `accept` 属性およびクライアントサイドの MIME 検証を、許可されるセット（`image/png`, `image/jpeg`, `image/gif`）および最大サイズ（2MB）と一致させること]。
3. When [ユーザーが許可されていないファイル（`.svg` または `image/svg+xml` を含む）を選択したとき], the [Moderation Governance UI] shall [送信をブロックして明確なインラインエラーを表示し、ローカルファイルシステムにファイルを保存しないこと]。
4. On [ジャンル申請の承認時], the [Moderation Governance UI] shall [アイコン画像をローカルの一時パスから正規のローカルディレクトリ（`assets/genre/`）に移動し、`metadata_genres` の `iconImageUrl` を更新してローカルアセットパスを指すようにすること（本仕様ではSVGノーマライズのステップは不要とする）]。
5. The [Testing Framework] shall [UIレイヤーでSVG選択が拒否されることをE2Eまたは単体テストで検証すること] (タスク 5.4 の任意推奨事項)。

### Requirement 5: 初期ジャンル一括投入機能 (System Administration: Seed Initial Genres)
**Objective:** システム管理者として、事前定義された初期ジャンル（シードデータ）のリストをデータベースに一括投入し、手動設定なしでクリエイターとプレイヤーが利用できる標準的なデフォルトカテゴリを用意したい。

#### Acceptance Criteria
1. If [認証されたユーザーが 'admin' ロールまたは `moderationTier` 'admin' を持っていないとき], then the [Moderation Governance UI] shall [初期ジャンル一括投入のUIセクションへのアクセスを制限すること]。
2. The [Moderation Governance UI] shall [管理者用ワークスペース内に「初期ジャンル一括投入」のボタンまたはセクションを表示すること]。
3. When [管理者が一括投入ボタンをクリックしたとき], the [Moderation Governance UI] shall [`src/data/initial_genres.json` に事前定義された初期ジャンルを取得し、専用のバックエンド API ルート（例: `/api/admin/seed-genres`）にリクエストを送信すること]。
4. The [Moderation Governance UI] shall [事前定義された初期ジャンルをパースし、Firestore の `metadata_genres` コレクションに書き込むこと]。
5. While [一括投入の実行中], the [Moderation Governance UI] shall [各ジャンルIDがすでに `metadata_genres` 内に存在するかチェックし、存在する場合はレコードをスキップまたは更新して重複やプライマリーキーの衝突を避けること]。
6. While [一括投入リクエストが実行中である間], the [Moderation Governance UI] shall [ローディング状態（ボタンの非活性化、スピナーの表示等）を表示すること]。
7. When [一括投入処理が正常に実行されたとき], the [Moderation Governance UI] shall [追加/更新されたジャンル数を明記した成功メッセージを表示すること]。If [処理が失敗したとき], then the [Moderation Governance UI] shall [適切なエラーアラートを表示すること]。

### Requirement 6: モデレーション関連画面の非同期表示最適化 (Asynchronous Data Fetch & Skeleton Loading) (Phase 12 追加)
**目的:** コミュニティモデレータや管理者、一般プレイヤーとして、通報審査画面、マージリクエスト画面、ジャンル新設申請画面等にアクセスした際、画面全体の白紙ローディングを待つことなく、静的なサイドバー、ヘッダー、タイトル枠、タブ等が即座に表示され、データが揃った箇所から順番にコンテンツが表示されるようにしたい。これにより、待機時のストレスや画面の点滅による不快感を防ぐことができる。

#### 受け入れ基準

**管理者モデレーション審査画面における非同期表示最適化**
1. When [管理者が通報審査画面（`/admin/moderation`）にアクセスしたとき], the [Moderation Governance UI] shall [サーバーコンポーネントとして管理者用サイドバー、ヘッダー、タイトル枠等の静的フレームを即座にレンダリングし、Next.jsのStreaming機能を通じてクライアントへ送信すること]。
2. While [通報審査待ちクイズキューがロード中である間], the [Moderation Governance UI] shall [審査キュー表示エリアに専用 of スケルトンプレースホルダーを表示すること]。
3. When [審査待ちクイズキューのロードが完了したとき], the [Moderation Governance UI] shall [スケルトン表示領域を、実際の審査待ちリストコンテンツに差し替えること]。

**タグ/ジャンルマージリクエスト画面における非同期表示最適化**
4. When [モデレータがマージリクエスト画面（`/community/merge`）にアクセスしたとき], the [Moderation Governance UI] shall [サーバーコンポーネントとしてヘッダー、戻るボタン、およびタブヘッダーを含む静的フレームを即座にレンダリングし、Next.jsのStreaming機能を通じてクライアントへ送信すること]。
5. While [保留中のマージ提案データや投票状況がロード中である間], the [Moderation Governance UI] shall [投票一覧タブエリアに専用 of スケルトンプレースホルダーを表示すること]。
6. When [マージ提案データのロードが完了したとき], the [Moderation Governance UI] shall [スケルトン表示領域を、実際の保留マージ提案リストおよび投票状況に差し替えること]。

**ジャンル新設申請・投票画面における非同期表示最適化**
7. When [ユーザーまたはモデレータがジャンル申請・投票画面（`/community/genres`）にアクセスしたとき], the [Moderation Governance UI] shall [サーバーコンポーネントとしてヘッダー、戻るボタン、および申請フォームの枠組み（タブ等）を含む静的フレームを即座にレンダリングし、Next.jsのStreaming機能を通じてクライアントへ送信すること]。
8. While [保留中・履歴対象のジャンル申請データや投票状況がロード中である間], the [Moderation Governance UI] shall [投票タブや履歴タブのエリアに専用 of スケルトンプレースホルダーを表示すること]。
9. When [ジャンル申請データのロードが完了したとき], the [Moderation Governance UI] shall [スケルトン表示領域を、実際の保留ジャンルリストや履歴コンテンツに差し替えること]。

**管理者専用ジャンル直接追加画面における非同期表示最適化**
10. When [管理者がジャンル管理画面（`/admin/genres`）にアクセスしたとき], the [Moderation Governance UI] shall [サーバーコンポーネントとして管理者用サイドバー、ヘッダー、タイトル枠等の静的フレームを即座にレンダリングし、Next.jsのStreaming機能を通じてクライアントへ送信すること]。
11. While [登録済みジャンル一覧がロード中である間], the [Moderation Governance UI] shall [ジャンル一覧表示エリアに専用のスケルトンプレースホルダーを表示すること]。
12. When [ジャンル一覧データのロードが完了したとき], the [Moderation Governance UI] shall [スケルトン表示領域を、実際の登録済みジャンル一覧コンテンツに差し替えること]。

**アクセシビリティ・テスト支援**
13. The [Moderation Governance UI] shall [通報審査キューのスケルトン領域に `data-testid="moderation-queue-skeleton"` を付与すること]。
14. The [Moderation Governance UI] shall [マージリクエスト投票のスケルトン領域に `data-testid="merge-requests-skeleton"` を付与すること]。
15. The [Moderation Governance UI] shall [ジャンル申請・投票のスケルトン領域に `data-testid="genres-moderation-skeleton"` を付与すること]。
16. The [Moderation Governance UI] shall [ジャンル管理画面のスケルトン領域に `data-testid="genres-management-skeleton"` を付与すること]。

### Requirement 7: 管理者専用ジャンル直接追加画面 (Page: `/admin/genres`)
**Objective:** システム管理者として、コミュニティの投票を待つことなく即座に新しいジャンルをプラットフォームに直接追加し、クイズのカテゴリを整理したい。

#### Acceptance Criteria
1. When [管理者以外のユーザーが `/admin/genres` にアクセスしたとき], the [Moderation Governance UI] shall [404または403エラー画面を表示してアクセスを遮断すること]。
2. While [ユーザーの認証情報を確認中である間], the [Moderation Governance UI] shall [画面全体にローディングインジケータを表示すること]。
3. When [管理者が `/admin/genres` にアクセスしたとき], the [Moderation Governance UI] shall [現在登録されているジャンルの一覧（ID、表示名、説明、ステータス）を表示し、かつ新規ジャンル直接追加用の入力フォームを提供すること]。
4. When [管理者が追加フォームに有効な値（半角英数字とハイフンのみで構成される一意なジャンルID、表示名、説明、および任意でPNG/JPEG/GIF形式かつ最大2MBのアイコン画像）を入力して「ジャンルを追加」ボタンをクリックしたとき], the [Moderation Governance UI] shall [アイコン画像ファイルをローカルの `assets/genre/` ディレクトリ配下に保存し、Firestore の `metadata_genres` コレクションへ新規ジャンル情報を直接書き込み、保存成功メッセージを表示すること]。
5. If [追加時に入力されたジャンルIDがすでに `metadata_genres` 内に存在するとき], the [Moderation Governance UI] shall [「このジャンルIDはすでに登録されています」というエラーメッセージを表示し、書き込み処理を中止すること]。
6. If [追加選択されたアイコン画像ファイルが PNG/JPEG/GIF 形式以外である、またはファイルサイズが 2MB を超えるとき], the [Moderation Governance UI] shall [画面上にエラーメッセージを表示してローカルへのファイル保存処理および登録処理を中止すること]。
7. When [ジャンルの追加登録が成功したとき], the [Moderation Governance UI] shall [ジャンル一覧表示を自動で最新情報に更新し、追加されたジャンルを即座に表示に反映すること]。
8. When [管理者が `/admin/moderation` 画面を表示したとき], the [Moderation Governance UI] shall [新規ジャンル管理画面（`/admin/genres`）へのナビゲーションリンクを表示すること]。

### Requirement 8: 管理者メニューポータル画面 (Page: `/admin`)
**Objective:** システム管理者として、中央メニューポータルページにアクセスし、様々な管理ツールへ簡単に遷移したい。

#### Acceptance Criteria
1. When [管理者以外のユーザーが `/admin` にアクセスしたとき], the [Moderation Governance UI] shall [404または403エラー画面を表示してアクセスを遮断すること]。
2. While [ユーザーの認証情報を確認中である間], the [Moderation Governance UI] shall [画面全体にローディングインジケータを表示すること]。
3. When [管理者が `/admin` にアクセスしたとき], the [Moderation Governance UI] shall [「モデレーション審査（`/admin/moderation`）」「ユーザー評判管理（`/admin/users`）」「ジャンル直接管理（`/admin/genres`）」の各機能のタイトル、説明、および遷移用リンクを含んだナビゲーションカードを表示すること]。


### Requirement 9: AIジャンルアイコン生成機能 (AI Genre Icon Generation)
**Objective:** システム管理者または Quizeum ユーザーとして、ジャンルの表示名と説明に基づいて AI を使用してジャンルアイコン画像を生成し、ファイルを手動でアップロードすることなく高品質なアイコンを簡単に作成したい。

#### Acceptance Criteria
1. When [管理者またはユーザーが「AIで生成」ボタンをクリックしたとき], if [ジャンル名（日本語）または説明文が未入力であるとき], the [Moderation Governance UI] shall [「ジャンル名と説明を入力してください」というインラインエラーを表示し、生成処理を中止すること]。
2. While [AIによるアイコン画像の生成処理が実行中である間], the [Moderation Governance UI] shall [「AIで生成」ボタンを非活性化し、ローディングインジケータを表示すること]。
3. When [AIによるアイコン画像の生成処理が成功したとき], the [Moderation Governance UI] shall [生成された画像のプレビューを表示し、その画像をフォームのジャンルアイコンとして設定すること]。
4. If [AIによる画像生成処理がAPIエラーやタイムアウト等で失敗したとき], the [Moderation Governance UI] shall [「画像の生成に失敗しました。しばらくしてから再度お試しください」というエラーメッセージを表示し、生成ボタンを活性状態に戻すこと]。
5. When [一般ユーザーが新ジャンル申請画面（`/community/genres`）でAIアイコン生成を実行したとき], if [そのユーザーの当日の生成回数がデイリー上限（1日5回）に達しているとき], the [Moderation Governance UI] shall [「本日の画像生成上限に達しました」というエラーメッセージを表示して生成をブロックすること]。
6. When [管理者ユーザーがジャンル管理画面（`/admin/genres`）でAIアイコン生成を実行したとき], the [Moderation Governance UI] shall [デイリー生成上限を適用せずに画像を生成すること]。

