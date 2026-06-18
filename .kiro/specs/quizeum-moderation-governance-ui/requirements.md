# Requirements Document: quizeum-moderation-governance-ui

## Introduction
本ドキュメントは、クイズ投稿SNS「quizeum」における管理者向け通報コンテンツ審査キュー画面、モデレータ向けタグ/ジャンルの仮想マージリクエスト画面、ジャンル新設申請・投票画面、および管理者専用のジャンル直接追加画面を含む、コミュニティ自治（モデレーションとガバナンス）に関するフロントエンドUI要件を定義します。

**Phase 6（2026-06）**: ジャンルアイコンアップロードの仕様文言を SEC-08 / `docs/` と整合（**SVG 禁止、PNG/JPEG/GIF のみ**）。実装済み UI との乖離を解消する。
**管理者ジャンル直接追加機能の追加（2026-06-18 追加）**: システム管理者が直接ジャンルを定義・新設できる専用画面（`/admin/genres`）と、そこへの相互ナビゲーションを追加する。

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
- **Out of scope**:
  - `metadata_genres` ドキュメントの書き込みや Cloud Functions 側の投票集計トリガー本体のバックエンド処理（`quizeum-core`が担当）。
  - 既存ジャンルの物理的な削除機能（不要になったジャンルは非表示または非アクティブ化で対応し、物理削除は本要件の対象外とする）。
- **Adjacent expectations**:
  - 管理者によるジャンル追加操作は、Firestore の `metadata_genres` コレクションに直接書き込みを行う（Security Rules の `canWriteMetadataGenres()` の定義に依存）。

## Requirements

### Requirement 1: 管理者モデレーション審査画面 (Page: `/admin/moderation`)
**Objective:** As a System Administrator, I want to review flagged quizzes, lists, and profiles, so that I can keep the platform safe and clean.

#### Acceptance Criteria
1. The Admin Moderation Screen shall restrict access, showing a 404/403 page if the authenticated user does not have the 'admin' or 'senior_moderator' role.
2. The Admin Moderation Screen shall display a moderation queue of quizzes that have reached the flag count threshold of 5 and `status: 'suspended'`. Lists and profiles are out of scope until core exposes equivalent flag/suspend fields.
3. For each queue item, the Admin Moderation Screen shall display the specific violation flags (harassment, spam, etc.) and player-provided feedback details.
4. The Admin Moderation Screen shall display action buttons allowing the administrator to either "公開に復帰 (Restore)" (which resets flag counts to 0) or "コンテンツ削除 (Permanent Hide/Delete)" (which sends warning notification to creator).
5. When the administrator clicks a flagged quiz in the queue, the system shall open a special read-only Quiz Detail View with a "管理者審査用特別ビュー" header overlay.

### Requirement 2: タグ/ジャンルマージリクエスト画面 (Page: `/community/merge`)
**Objective:** As a Community Moderator, I want to propose synonym merges and vote on pending requests, so that we can organize tags and genres coherently.

#### Acceptance Criteria
1. The Merge Request Screen shall restrict access, showing a 404/403 page if the user's `moderationTier` is less than 'moderator'.
2. The Merge Request Screen shall display a "提案起案" tab containing a form to input source tags/genres, target canonical tag/genre, and structural reasoning.
3. The Merge Request Screen shall display a "投票一覧" tab displaying pending merge requests.
4. When the moderator clicks the source tag or genre in the request card, the system shall redirect them to the corresponding Tag/Genre Quiz List Screen in a split view.
5. The Merge Request Screen shall allow eligible moderators to cast binary votes (👍 Propose / 👎 Reject).
6. When a Senior Moderator views the merge request card, the system shall display a "投票の重み: x2" badge and apply double-weighting on click.
7. The Merge Request Screen shall display a real-time progress bar visualizing `weightedVotesFor` and `weightedVotesAgainst` and the current approval rate.

### Requirement 3: ジャンル新設申請・投票画面 (Page: `/community/genres`)
**Objective:** As a Quizeum User, I want to request new genres, and as a Moderator, I want to vote on request approvals, so that we can expand our quiz catalog collaboratively.

#### Acceptance Criteria
1. The Community Genre Screen shall display an "申請フォーム" tab visible to all authenticated users, containing fields for English genre ID (lowercase, hyphen-separated), Japanese display name, and an icon upload field that accepts **PNG, JPEG, or GIF only** (maximum 2MB). **SVG and other formats shall be rejected** with an inline error before upload.
2. The Community Genre Screen shall display a "投票" tab visible only to users with `moderationTier >= 'moderator'`, displaying pending genre requests.
3. The Community Genre Screen shall allow moderators to cast Pro/Con votes on pending genre requests.
4. If a genre request reaches the approval threshold (weighted votes >= 5 and approval rate >= 80%), then the system shall automatically register the genre to `metadata_genres` and show an success alert "ジャンルが追加されました".
5. The Community Genre Screen shall display an "承認・否決履歴" tab displaying completed genre requests.

### Requirement 4: ジャンルアイコン仕様整合（Phase 6）
**Objective:** As a platform operator, I want genre request UI and documentation to consistently forbid SVG uploads, so that SEC-08 XSS defenses are not undermined by outdated spec text.

#### Acceptance Criteria
1. All in-spec references to genre icon uploads shall state **PNG/JPEG/GIF only** and explicitly **exclude SVG** (aligned with `docs/security_architecture.md`, `docs/screen_transition.md`, and `storage.rules`).
2. The Community Genre Screen's file input `accept` attribute and client-side MIME validation shall match the allowed set (`image/png`, `image/jpeg`, `image/gif`) and maximum size (2MB).
3. When the user selects a disallowed file (including `.svg` or `image/svg+xml`), the Community Genre Screen shall block submit and show a clear inline error; it shall not upload to Storage.
4. On genre request approval, the system shall continue to copy `iconImageUrl` from the approved request into `metadata_genres` via existing core transaction (`voteGenreRequest`); no SVG normalization step is required in this spec.
5. E2E or unit tests shall assert that SVG selection is rejected at the UI layer (optional but recommended in task 5.4).

### Requirement 5: 初期ジャンル一括投入機能 (System Administration: Seed Initial Genres)
**Objective:** As a System Administrator, I want to batch-insert a predefined list of initial genres (seed data) into the database, so that the application has a standardized set of default categories available for creators and players without manual setup.

#### Acceptance Criteria
1. The Admin Moderation Screen shall restrict access to the Seed Genres UI section, making it visible or accessible only if the authenticated user has the 'admin' role or `moderationTier` is 'admin'.
2. The Admin Moderation Screen shall display a "初期ジャンル一括投入 (Seed Initial Genres)" button or section within the admin workspace.
3. When the administrator clicks the seeding button, the system shall fetch the initial genres predefined in `src/data/initial_genres.json` and send a request to a dedicated backend API route (e.g. `/api/admin/seed-genres`).
4. The backend seeding logic shall parse the pre-defined initial genres and write them to the `metadata_genres` Firestore collection.
5. During seeding, the system shall check if each genre ID already exists in `metadata_genres`. If it exists, the system shall skip or update the record, avoiding duplicates or primary key conflicts.
6. The Admin Moderation Screen shall display a loading state (e.g., disable the button, show a spinner) while the seeding request is in progress.
7. Upon successful execution of the seeding process, the Admin Moderation Screen shall display a success message specifying the count of added/updated genres. If a failure occurs, it shall display an appropriate error alert.

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
**Objective:** As a System Administrator, I want to add new genres directly to the platform, so that I can organize quiz categories instantly without waiting for community votes.

#### Acceptance Criteria
1. When [管理者以外のユーザーが `/admin/genres` にアクセスしたとき], the [Moderation Governance UI] shall [404または403エラー画面を表示してアクセスを遮断すること]。
2. While [ユーザーの認証情報を確認中である間], the [Moderation Governance UI] shall [画面全体にローディングインジケータを表示すること]。
3. When [管理者が `/admin/genres` にアクセスしたとき], the [Moderation Governance UI] shall [現在登録されているジャンルの一覧（ID、表示名、説明、ステータス）を表示し、かつ新規ジャンル直接追加用の入力フォームを提供すること]。
4. When [管理者が追加フォームに有効な値（半角英数字とハイフンのみで構成される一意なジャンルID、表示名、説明、および任意でPNG/JPEG/GIF形式かつ最大2MBのアイコン画像）を入力して「ジャンルを追加」ボタンをクリックしたとき], the [Moderation Governance UI] shall [Firestore の `metadata_genres` コレクションへ新規ジャンル情報を直接書き込み、保存成功メッセージを表示すること]。
5. If [追加時に入力されたジャンルIDがすでに `metadata_genres` 内に存在するとき], the [Moderation Governance UI] shall [「このジャンルIDはすでに登録されています」というエラーメッセージを表示し、書き込み処理を中止すること]。
6. If [追加選択されたアイコン画像ファイルが PNG/JPEG/GIF 形式以外である、またはファイルサイズが 2MB を超えるとき], the [Moderation Governance UI] shall [画面上にエラーメッセージを表示してアップロード処理および登録処理を中止すること]。
7. When [ジャンルの追加登録が成功したとき], the [Moderation Governance UI] shall [ジャンル一覧表示を自動で最新情報に更新し、追加されたジャンルを即座に表示に反映すること]。
8. When [管理者が `/admin/moderation` 画面を表示したとき], the [Moderation Governance UI] shall [新規ジャンル管理画面（`/admin/genres`）へのナビゲーションリンクを表示すること]。

### Requirement 8: 管理者メニューポータル画面 (Page: `/admin`)
**Objective:** As a System Administrator, I want to access a central menu portal page, so that I can easily navigate to various admin tools.

#### Acceptance Criteria
1. When [管理者以外のユーザーが `/admin` にアクセスしたとき], the [Moderation Governance UI] shall [404または403エラー画面を表示してアクセスを遮断すること]。
2. While [ユーザーの認証情報を確認中である間], the [Moderation Governance UI] shall [画面全体にローディングインジケータを表示すること]。
3. When [管理者が `/admin` にアクセスしたとき], the [Moderation Governance UI] shall [「モデレーション審査（`/admin/moderation`）」「ユーザー評判管理（`/admin/users`）」「ジャンル直接管理（`/admin/genres`）」の各機能のタイトル、説明、および遷移用リンクを含んだナビゲーションカードを表示すること]。

