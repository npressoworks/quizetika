# Requirements Document

## Introduction
本ドキュメントは、クイズ投稿SNS「quizeum」におけるコアシステム（`quizeum-core`）のユーザーおよびオペレーター向けシステム要件を定義します。クイズの作成、多彩なプレイモード（通常、模擬試験、フラッシュカード、AI連携水平思考クイズ）、ソーシャルエンゲージメント、クローズド指摘フィードバック、自律的なコミュニティモデレーション、およびパフォーマンスやオフライン保護といった非機能要件を含み、高品質かつ高い信頼性を備えたプラットフォームを提供します。

## Boundary Context
- **In scope**:
  - ユーザー認証、プロフィール編集、および称号バッジ自動付与機能。
  - アカウント即時物理削除と、関連データ（作成クイズ、リスト、指摘、通知、リアクション）の非同期匿名化クレンジング。
  - クイズの新規作成、下書き保存、NGワード自動チェック付き公開、編集、削除、および作成したクイズの一括エクスポート。
  - 通常プレイ（1問ごとの正誤解説）、解答制限タイマー、ヒント表示、および総合結果画面表示。
  - 解答セッション保護（ブラウザ再読み込みや通信切断時のローカル永続保存、オフライン時の結果表示、オンライン復帰時の自動同期）。
  - 水平思考クイズ（ウミガメのスープ）でのAIチャット質問（1日20回制限、同一質問キャッシュ）、AI真相自動判定と自然言語フィードバック。
  - フォロー/フォロー解除、タイムライン表示、ブックマーク、および作家リアクション機能。
  - クイズリストの作成、編集、削除、ドラッグ＆ドロップ並び替え、パッケージエクスポート、および連続プレイ記録。
  - クローズドな間違い・別解指摘フィードバック送信、指摘解決時の修正完了オート通知。
  - 👍良問 / 👎悪問による良問評価システム、および仮リセット期間中の再評価と過去評価データの非同期一括物理削除。
  - 保存・更新時のNGワード自動チェック、コンテンツ通報と5回通報到達時の一時自動非公開化・モデレーション審査。
  - 表記揺れタグ/ジャンルの仮想統合（マージリクエスト提案とモデレータ重み付き投票可決）。
  - 新規ジャンル申請・モデレータ可決登録フロー。
- **Out of scope**:
  - 外部システムからのクイズリストやクイズのJSONインポート機能（エクスポートはインスコープ）。
  - リアルタイムマルチプレイヤー対戦プレイ。
  - 有償広告配信サーバー構築そのものの実装。
- **Adjacent expectations**:
  - 生成AI判定に必要な外部AIモデルAPI。
  - 画像アセットをアップロード・保管するオブジェクトストレージサービス。
  - メール送信サービス。

## Requirements

### Requirement 1: ユーザー認証およびプロフィール管理
**Objective:** As a Quizeum User, I want to manage my account and profile securely, so that I can persist my progress, customize my public identity, and control my data visibility.

#### Acceptance Criteria
1. When a user registers or logs in, the User Authentication System shall verify credentials using third-party social identity providers, preventing direct email and password authentication.
2. When an authenticated user updates their profile, the Quizeum System shall validate and save their display name (maximum 30 characters) and biography (maximum 200 characters).
3. When specific milestones (total play count, published quiz count, follower count) are reached by a user, the Quizeum System shall automatically award the corresponding achievement badge and append it to the user's profile.
4. When an authenticated user requests account deletion, the Quizeum System shall immediately delete the user's account from the User Authentication System, allowing immediate re-registration with the same email address.
5. When an account is requested to be deleted, the Quizeum System shall asynchronously anonymize the user's published quizzes, quiz lists, feedback reports, notifications, and reactions, replacing their creator information with "退会済みユーザー" and a system default avatar.
6. While an account deletion is pending, the Quizeum System shall block all external read access to the user's private profile information.

### Requirement 2: クイズ作成と管理機能
**Objective:** As a Quiz Creator, I want to draft, validate, publish, edit, and export my quizzes, so that I can share high-quality knowledge and retain ownership of my content.

#### Acceptance Criteria
1. When a creator starts a new quiz, the Quizeum System shall allow saving the quiz as a draft with only a title, preventing external users from viewing it.
2. When a creator publishes a quiz, the Quizeum System shall validate the quiz using publish constraints (at least 1 question, correct answers specified) and verify that it contains no prohibited words before making it publicly visible.
3. When a creator inputs a tag, the Quizeum System shall normalize the text (trim, convert to lowercase, remove spaces and symbols) and display a warning suggest if a highly similar canonical tag already exists in the system.
4. When a creator edits a quiz title, the Quizeum System shall automatically synchronize the updated title across all related feedback reports, reactions, and notifications.
5. When a creator deletes a quiz, the Quizeum System shall asynchronously clean up or soft-delete all associated bookmarks, feedback reports, notifications, and reactions.
6. When a creator requests export, the Quizeum System shall compile all quizzes created by the user (including drafts) into a single downloadable structured format.
7. When a creator configures a lateral-thinking question, the Quizeum System shall allow the creator to add and remove multiple truth keywords (essential essences) using a visual tag-like input interface, storing them as a list of strings.
8. When a creator publishes a quiz containing a lateral-thinking question, the Quizeum System shall validate that at least one truth keyword is registered for the lateral-thinking question, preventing publication if no keywords are specified.

### Requirement 3: クイズプレイとセッション保護
**Objective:** As a Quiz Player, I want to play quizzes in various modes with progress protection, so that I can enjoy a seamless and uninterrupted playing experience even under unstable network conditions.

#### Acceptance Criteria
1. When a player plays in normal mode, the Quizeum System shall display immediate correctness feedback and detailed explanations for each question solved, and save the attempt history.
2. While a player is playing a quiz, the Quizeum System shall continuously serialize and save the playing progress to persistent local client storage to prevent data loss on page reload or network disconnection.
3. If the network is disconnected during play, the Quizeum System shall allow the player to complete the quiz offline, presenting an offline results view (explanation review only, disabled voting and reactions), and queue the attempt data in persistent local client storage for automatic synchronization when connectivity is restored.
4. If a player is offline while playing a quiz list, when the player attempts to proceed to the next quiz from the results view, the Quizeum System shall block the transition and display a connectivity error message.
5. When a player completes a quiz, the Quizeum System shall display the results view, which includes correct/incorrect lists, overall score, elapsed time, difficulty rating (1-10 scale), closed feedback report form, creator reaction button, and social sharing links.
6. When a player completes a quiz and achieves a perfect score or a personal best, the Quizeum System shall atomically record their score and elapsed time to the quiz's leaderboard.

### Requirement 4: 水平思考クイズ（ウミガメのスープ）プレイモード
**Objective:** As a Quiz Player, I want to interact with a stateless AI to solve lateral-thinking quizzes, so that I can query for clues dynamically and receive intelligent, real-time validation of my solution.

#### Acceptance Criteria
1. While playing a lateral thinking quiz, when a player submits a free-text question (up to 100 characters), the Quizeum System shall retrieve up to the last 20 question-and-comment pairs from the session's Q&A history, and securely pass them along with the new question to the AI engine using the secret setup context of the quiz, and return one of the predefined answers (Yes / No / Irrelevant / Unknown) with a brief comment.
2. If a player is a free-tier user, the Quizeum System shall limit their AI questions to a maximum of 20 per day per quiz, sharing the count across all sessions of the same quiz and resetting it daily at midnight.
3. When a player submits a question that exactly matches a question in their current session's Q&A history, the Quizeum System shall instantly return the cached answer without invoking the AI engine or decrementing the daily turn count.
4. The Quizeum System shall present a two-column layout on the lateral-thinking play screen, displaying the interactive chat interface on the left and a scrollable Q&A history list panel on the right.
5. When a player submits a truth summary to verify their solution, the Quizeum System shall verify whether all of the registered truth keywords (essential essences) are contained in the user's truth summary.
6. When the verification confirms all truth keywords are contained in the user's truth summary, the Quizeum System shall bypass the AI engine, immediately mark the solution as correct (VERDICT: CORRECT), and trigger a clear animation and redirect the player to the results view.
7. When the verification finds any truth keyword is missing, the Quizeum System shall securely pass the truth summary along with the secret setup context to the AI engine to evaluate if the core solution is reached.
8. If the AI engine confirms the truth summary is correct, the Quizeum System shall trigger a clear animation and redirect the player to the results view.
9. If the AI engine rejects the truth summary, the Quizeum System shall display AI-generated advice detailing unsolved contradictions, allowing the player to resume questioning.

### Requirement 5: ソーシャル機能およびクイズリスト
**Objective:** As a Quizeum User, I want to follow creators, bookmark content, react to quizzes, and organize quizzes into custom lists, so that I can discover, organize, and share quality content.

#### Acceptance Criteria
1. When a user follows or unfollows another user, the Quizeum System shall atomically update their follower/following counts and send a follow notification to the target user.
2. While authenticated, the Quizeum System shall display a personalized chronological timeline of newly published quizzes from followed creators on the home screen.
3. When a user bookmarks a quiz or a quiz list, the Quizeum System shall atomically toggle the bookmark status and update the item's bookmark count.
4. When a user creates or edits a quiz list, the Quizeum System shall allow adding quizzes, sorting their order using drag-and-drop, and setting the list visibility (public/private).
5. When playing a quiz list, the Quizeum System shall record individual quiz attempts sequentially, tagging each attempt with the parent list's ID and marking the mode as "list".
6. When a user requests list export, the Quizeum System shall package the list metadata and the full contents of the user's own quizzes in that list into a downloadable file, referencing external quizzes by ID only.

### Requirement 6: 間違い指摘フィードバックおよび良問評価システム
**Objective:** As a Quizeum User, I want to send private feedback on quiz issues and vote on quiz quality, so that creators can improve their quizzes and players can easily discover highly-rated content.

#### Acceptance Criteria
1. When a player encounters an issue during play or on the result screen, the Quizeum System shall allow sending a private feedback report (containing category and details) directly to the creator.
2. When a creator resolves a feedback report and updates their quiz, the Quizeum System shall automatically send a correction resolution notification to the player who reported the issue.
3. When a player completes a quiz, the Quizeum System shall allow them to cast a binary vote (👍 Good / 👎 Bad) to rate the quality of the quiz, preventing creators from voting on their own content.
4. While a quiz is in a temporary 7-day re-evaluation period after a reset request by the creator, the Quizeum System shall mask its previous quality ratings and display a re-evaluation warning badge.
5. When a quiz reset is approved, the Quizeum System shall asynchronously delete all old rating records associated with that quiz in chunks, integrating the temporary ratings collected during the re-evaluation period as the new base ratings.

### Requirement 7: コミュニティモデレーションとガバナンス
**Objective:** As a Community Moderator or Administrator, I want to flag inappropriate content, manage tag/genre synonym merges, and approve new genres, so that we can maintain a clean, organized, and high-quality platform.

#### Acceptance Criteria
1. When a user flags a quiz for inappropriate content, the Quizeum System shall atomically increment the quiz's flag count.
2. If a quiz's flag count reaches 5, the Quizeum System shall automatically change the quiz's status to suspended, hiding it from public lists and queueing it in the administrator moderation interface.
3. When an administrator evaluates a suspended quiz, the Quizeum System shall allow them to either permanently hide/delete the quiz (sending a warning to the creator) or restore it to published status and reset the flag count to 0.
4. When a moderator proposes a tag or genre merge, the Quizeum System shall create a merge request and allow eligible moderators to cast weighted votes (with Senior Moderators having a vote weight of 2).
5. When a user submits a new genre request (including English ID, Japanese display name, and icon image), the Quizeum System shall queue the request for moderator voting.
6. When a genre request meets the approval threshold (weighted votes >= 5 and approval rate >= 80%), the Quizeum System shall automatically register and enable the new genre across the platform.

### Requirement 8: パフォーマンスおよび非機能要件
**Objective:** As a Quizeum User, I want the pages to load rapidly and the system to remain highly available during spikes, so that I can enjoy a highly responsive and reliable platform.

#### Acceptance Criteria
1. The Quizeum System shall ensure that the initial HTML response and page load time for any public quiz or list page is under 0.5 seconds on average under normal traffic conditions.
2. The Quizeum System shall maintain a service availability such that the 5xx error rate remains below 0.1% during sudden traffic spikes.
3. The Quizeum System shall dynamically render dynamic SEO and OGP metadata tags (title, description, thumbnail) within the initial HTML payload to allow correct parsing by search engine crawlers and social preview generators without JavaScript execution.
