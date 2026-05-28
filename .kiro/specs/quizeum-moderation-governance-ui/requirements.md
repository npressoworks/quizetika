# Requirements Document: quizeum-moderation-governance-ui

## Introduction
本ドキュメントは、クイズ投稿SNS「quizeum」における管理者向け通報コンテンツ審査キュー画面、モデレータ向けタグ/ジャンルの仮想マージリクエスト画面、およびジャンル新設申請・投票画面を含む、コミュニティ自治（モデレーションとガバナンス）に関するフロントエンドUI要件を定義します。

## Boundary Context
- **In scope**:
  - 管理者ロール専用の通報審査画面におけるクイズ、リスト、プロフィールの審査待ちリスト表示。
  - 「公開に復帰させる（通報却下）」または「永久非公開化 / 削除」のアクション実行ボタンUI。
  - 審査対象クイズの中身を確認するための「管理者特別検証閲覧ビュー」動線。
  - モデレータ専用のマージリクエスト画面におけるマージ提案の起案および保留提案に対する賛否加重投票UI。
  - シニアモデレータに対する「投票重み: x2」のインジケーター表示、および賛成率プログレスバーのリアルタイム可視化。
  - 認証済みユーザー向けの新ジャンル申請フォーム（ID、日本語名、PNG/SVGアイコン画像のアップロード対応）。
  - 新設ジャンルの保留中リストに対するモデレータ投票、可決承認条件達成時のシステム自動反映通知、履歴閲覧タブ。
  - `moderationTier` を用いた管理者・モデレータ専用画面への厳格なアクセス制限（ガード）。
- **Out of scope**:
  - `metadata_genres` ドキュメントの書き込みや Cloud Functions 側の投票集計トリガー本体のバックエンド処理（`quizeum-core`が担当）。

## Requirements

### Requirement 1: 管理者モデレーション審査画面 (Page: `/admin/moderation`)
**Objective:** As a System Administrator, I want to review flagged quizzes, lists, and profiles, so that I can keep the platform safe and clean.

#### Acceptance Criteria
1. The Admin Moderation Screen shall restrict access, showing a 404/403 page if the authenticated user does not have the 'admin' or 'senior_moderator' role.
2. The Admin Moderation Screen shall display a moderation queue of items (quizzes, lists, profiles) that have reached the flag count threshold of 5.
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
1. The Community Genre Screen shall display an "申請フォーム" tab visible to all authenticated users, containing fields for English genre ID (lowercase, hyphen-separated), Japanese display name, and a PNG/SVG icon upload field.
2. The Community Genre Screen shall display a "投票" tab visible only to users with `moderationTier >= 'moderator'`, displaying pending genre requests.
3. The Community Genre Screen shall allow moderators to cast Pro/Con votes on pending genre requests.
4. If a genre request reaches the approval threshold (weighted votes >= 5 and approval rate >= 80%), then the system shall automatically register the genre to `metadata_genres` and show an success alert "ジャンルが追加されました".
5. The Community Genre Screen shall display an "承認・否決履歴" tab displaying completed genre requests.
