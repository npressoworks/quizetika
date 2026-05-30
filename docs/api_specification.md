# quizeum 外部インターフェース（API）仕様書 (改訂版)

本ドキュメントは、クイズ投稿SNS「quizeum」におけるフロントエンドとバックエンド（Firebase Platform: Auth, Firestore, Storage）間のデータ通信、およびサービスインターフェース（API）の仕様を定義します。

---

## 1. 概要と共通設計
「quizeum」は、Next.jsのクライアント/サーバー双方から Firebase JS Client SDK を用いて直接バックエンドとやり取りするアーキテクチャを採用しています。
一部のデータの整合性確保、カウンター更新、通報蓄積による自動非公開化などの重要なビジネスロジックは、Firestore の**トランザクション（Transactions）**または**バッチ書き込み（Write Batches）**を用いてアトミックに実行され、バックエンドでは **Firestore Security Rules** によってアクセス制御を行います。

### 共通エラーコードとレスポンス

Firestoreおよび認証処理において発生し得る代表的な例外と、フロントエンドでの対応ポリシーは以下の通りです。

| エラー名 / コード | 発生原因 | UIでの対応方針 |
| :--- | :--- | :--- |
| **`permission-denied` (403)** | Firestore Security Rulesによる認可違反（他人のクイズを編集しようとした、未ログインで書込を行おうとした等）。 | 「権限がありません。ログイン状態を確認してください」とトースト警告。 |
| **`not-found` (404)** | 指定されたクイズ、ユーザー、またはレポートが存在しない場合。 | 「対象のコンテンツが見つかりませんでした」と表示し、ホーム画面へリダイレクト。 |
| **`validation-error` (400)** | Zodによるクライアントバリデーションエラー、または保存前NGワード検知。 | エラーが発生した入力フォームを赤色で強調表示し、具体的な修正指示（例:「正解を1つ以上選択してください」）をリアルタイムに表示。 |
| **`offline` (Network)** | インターネット一時切断時。 | 「接続が一時的に失われました」と警告し、ローカルセッション（localStorage）へプレイ情報を自動退避。復帰時に同期。 |
| **`limit-exceeded` (429)** | ウミガメのスープAI質問上限（20回）超過時。 | 「このクイズセッションでのAIへの質問回数の上限（20回）に達しました。真相の解答を行ってください」と警告トースト表示。 |

---

## 2. コアサービスインターフェース仕様 (TypeScript Service Interfaces)

ビジネスロジックはサービスレイヤー（`src/services/` 配下）に集約され、厳密にインターフェース化されます。

### 2.1 QuizService (`src/services/quiz.ts`)
クイズのCRUD、高度な複合検索・インクリメンタルサジェスト、ハイスコアリーダーボードの更新を制御します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`getQuiz`** | 指定されたIDのクイズを1件取得する。 | `id: string` | `Promise<Quiz \| null>` | 不要 |
| **`createQuiz`** | クイズを新規作成する（下書きまたは直接公開）。Zodスキーマ検証を通す。ユーザーが入力した生のタグ配列は `originalTags` にそのまま保存され、表記揺れを排除した標準表記タグID配列が `tags` に保存される。さらに仮想マージ解決適用後の統合先（正規）タグID配列が `canonicalTagIds` に保存される。 | `authorId: string`, `quizData: Omit<Quiz, 'id' \| 'authorId'>`, `isPublished: boolean` | `Promise<string>` (作成したクイズID) | 必要 |
| **`updateQuiz`** | クイズのメタ情報や問題配列を更新する。作成者がオリジナルタグを編集した場合は `originalTags` も更新し、それに基づいて `tags` および `canonicalTagIds` を再計算・更新する。 | `id: string`, `authorId: string`, `updates: Partial<Quiz>`, `isPublished: boolean` | `Promise<void>` | 必要 |
| **`deleteQuiz`** | クイズを物理削除（または保留ステータス化）する。 | `id: string`, `authorId: string` | `Promise<void>` | 必要 |
| **`searchQuizzes`** | キーワード、ジャンル、難易度、プレイ状況を組み合わせて検索。 | `queryText: string`, `filters: SearchFilters`, `currentUserId?: string` | `Promise<Quiz[]>` | 不要 |
| **`getSearchSuggestions`** | 検索窓のインクリメンタルサジェスト用の候補を取得。 | `queryText: string` | `Promise<string[]>` | 不要 |
| **`updateLeaderboard`** | プレイ完了時に全問正解または自己ベスト更新時、アトミックにランキングへ記録。 | `quizId: string`, `record: Omit<LeaderboardRecord, 'completedAt'>` | `Promise<void>` | 必要 |
| **`exportQuizzes`** | 指定されたクイズID群を一括エクスポート用パッケージとして出力する。 | `userId: string`, `quizIds: string[]` | `Promise<QuizExportPackage>` | 必要 |

* **Zodバリデーションの適用仕様**: 
  `createQuiz` および `updateQuiz` において、`isPublished: true` (公開申請) の場合は後述の `quizPublishSchema` による厳格な検証を行います。`isPublished: false` (下書き保存) の場合は、タイトルなどの最低限の入力チェックのみ行い、途中の未完成状態であっても保存できるようにします。

* **ジャンル・タグの整合性および自動登録仕様**:
  - `createQuiz` および `updateQuiz` において、`isPublished: true` の場合、指定された `genre` が実在するジャンルマスタ（`metadata_genres`）に登録されているか検証します。存在しない場合は `validation-error` となります。
  - 公開・更新処理時に、指定された `genre` および各 `tags` に対し、仮想統合マスタ（`metadata_genres`/`metadata_tags`）を参照して統合先正規IDを動的に解決し、クイズドキュメント内の非正規化フィールド `canonicalGenreId` および `canonicalTagIds` 配列に埋め込んで保存します。
  - 送信される `tags` 配列の要素は、フロントエンドで自動正規化処理（空白排除、小文字化、記号排除）が適用された後の正規化タグIDです。
  - クイズの保存/更新トランザクション内で、`tags` 配列に含まれる各タグIDが `metadata_tags` コレクションに存在するかを判定し、未登録の新規タグIDが含まれている場合は、トランザクション内でアトミックに `metadata_tags` に新規登録（`tagName` にユーザーのオリジナル表記、`canonicalId = null`, `mergedTagIds = []`, `createdBy = uid` をセット）します。これにより、マスタデータとクイズの整合性を常にリアルタイムで担保します。

* **タグ・ジャンル仮想統合のクエリ高速化仕様（書き込み時解決）**:
  - `searchQuizzes` および `getQuizzesByTag` において、マスタドキュメントをフェッチして検索時にクエリ配列を展開する（`array-contains-any` 等の展開型）必要はありません。
  - クイズ保存時にすでに `canonicalGenreId` や `canonicalTagIds` が非正規化保持されているため、検索時はシンプルに対象の正規タグIDまたはジャンルIDを指定した単一の等価クエリ（例：`where('canonicalTagIds', 'array-contains', targetTagId)`）で一括高速検索を行います。これにより、Firestoreの複合インデックスの数を最小限に抑え、ミリ秒単位での超高速応答を保証します。

#### 主要な引数・型定義

```typescript
export interface SearchFilters {
  genre?: string;
  difficulty?: number; // 1〜10の整数値。難易度による絞り込み。
  minQuestions?: number;
  maxQuestions?: number;
  playStatus?: 'unplayed' | 'played'; // ログインユーザーのプレイ履歴に基く絞り込み
}

export interface LeaderboardRecord {
  userId: string;
  displayName: string;
  score: number;
  elapsedSeconds: number;
  completedAt: Date;
}
```

---

### 2.2 QuestionService (`src/services/question.ts`) [NEW]
設問（Question）単体の取得、設問単位のブックマーク、およびクイズリスト（問題集）への追加・削除を制御します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`getQuestion`** | 指定されたIDの設問を1件取得する。 | `id: string` | `Promise<Question \| null>` | 不要 |
| **`getQuestionsByQuiz`** | 指定されたクイズIDに紐づくすべての設問を取得する（順序はクイズの `questionIds` に準拠）。 | `quizId: string` | `Promise<Question[]>` | 不要 |
| **`toggleBookmarkQuestion`** | 特定の設問をブックマーク登録/解除（トグル）し、トランザクションで設問ドキュメントの `bookmarksCount` をアトミックに加減算する。 | `userId: string`, `questionId: string` | `Promise<void>` | 必要 |
| **`getBookmarkedQuestions`** | ユーザー自身がブックマークした設問一覧を取得する。 | `userId: string` | `Promise<Question[]>` | 必要 |
| **`addQuestionToList`** | ユーザーが所有するクイズリスト（問題集）に特定の設問を追加し、リストの `questionIds` 配列にアトミック追加する。 | `listId: string`, `questionId: string` | `Promise<void>` | 必要 |
| **`removeQuestionFromList`** | ユーザーが所有するクイズリスト（問題集）から特定の設問を削除し、リストの `questionIds` 配列からアトミック削除する。 | `listId: string`, `questionId: string` | `Promise<void>` | 必要 |

---

### 2.3 AttemptService (`src/services/attempt.ts`)
解答結果（プレイ履歴）の永続化、および間違えた問題の復習データ（弱点克服）の抽出・更新を担当します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`saveAttempt`** | クイズ解答結果を保存し、クイズの `playCount` をトランザクションでアトミックに加算する。 | `attempt: Omit<Attempt, 'id'>` | `Promise<string>` (AttemptのID) | 必要 |
| **`getFailedQuestions`** | 特定クイズにおいて、過去に自身が間違えた設問配列のみを抽出し、復習用データとして提供。`genreFilter = null` (または未指定) の場合は全クイズID横断で集約する。 | `userId: string`, `quizId?: string`, `genreFilter?: string \| null` | `Promise<Question[]>` | 必要 |
| **`updateFailedQuestions`** | 復習プレイ（弱点克服）で正解した設問を、ユーザーの過去の間違いリストからアトミックに削除する。 | `userId: string`, `quizId: string`, `solvedQuestionIds: string[]` | `Promise<void>` | 必要 |
| **`askAiQuestion`** | 水平思考クイズ（ウミガメのスープ）において、AIへ自由記述の質問を送信し、判定結果と補足コメントを取得・履歴保存する。本プレイモードはAI質問 of ターン制限を管理する都合上、ゲストプレイは不可（ログイン必須）とする。**①質問文字数上限**: `questionText` は最大100文字に制限し、超過時は `validation-error` をスロー。**②同一質問キャッシュ**: `aiQuestionsHistory` を照合し、`questionText` が完全一致する履歴が存在する場合はAI API呼び出しを行わず即座に既存の回答を返す（`isFromCache: true`、質問カウントも消費しない）。**③1日同一クイズ20回制限（無料枠）**: 無料ユーザーは同一クイズに対して1日最大20ターンに制限する。別セッション（Attempt）を開始した場合でもカウントは累積され、毎日日付変更時にクリアされる。判定時は `users/{uid}/dailyAiTurnCounts/{quizId}` から当日の `count` を読み込んでチェックし、質問成立時にアトミックにインクリメント・本日日付を更新する。超過時は `limit-exceeded` をスロー。有料プラン（`aiTurnLimit: null`）は無制限。**④AIステートフル対話**: AI API呼び出し時は `aiQuestionsHistory` に記録された直近最大20回分の質問・回答履歴をマッピングして Gemini API（`startChat`）へ送信し、文脈（「それ」「彼」などの代名詞など）を考慮したステートフルな対話を行う。**⑤セキュリティ**: APIキー漏洩防止のため、Next.js API Route または Cloud Functions 等のサーバーサイドを経由して呼び出し、クライアントからの直接呼び出しを禁止する。 | `attemptId: string`, `questionText: string` (max 100文字) | `Promise<{ answerType: 'yes' \| 'no' \| 'irrelevant' \| 'unknown', aiComment?: string, isFromCache: boolean }>` | 必要 |
| **`verifyTruth`** | 水平思考クイズにおいて、プレイヤーが入力した真相要約が核心を突いているか判定する。**B2ハイブリッド判定**を採用し、入力された回答に作問時に登録された必須キーワード（`truthKeywords`）がすべて含まれているかを正規化部分一致でチェックする。全キーワードが合致すればAIをバイパスして即時合格（`isCorrect = true`, `isBypass = true`）とし、不足している場合のみAI（Gemini）を呼び出す判定にフォールバックする。 | `attemptId: string`, `truthText: string` | `Promise<{ isCorrect: boolean, feedback: string, isBypass: boolean }>` | 必要 |

---

### 2.4 SocialService (`src/services/social.ts`)
ユーザー間のフォロー関係、クイズ、クイズリスト、および個別の設問のブックマーク操作、タイムラインフィード、クイズリスト（設問アタッチ対応）の管理を処理します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`followUser`** | 他のクリエイターをフォロー/フォロー解除（トグル）し、互いのフォロー・フォロワー数をアトミックに更新する。 | `followerId: string`, `followingId: string` | `Promise<void>` | 必要 |
| **`getFollowers`** | 指定されたユーザーのフォロワー一覧を取得。 | `userId: string` | `Promise<UserProfile[]>` | 不要 |
| **`getFollowing`** | 指定されたユーザーがフォローしているユーザー一覧を取得。 | `userId: string` | `Promise<UserProfile[]>` | 不要 |
| **`toggleBookmark`** | クイズ、クイズリスト、または個別の設問をブックマーク登録/解除し、トランザクションで `bookmarksCount` を加減算。 | `userId: string`, `targetId: string`, `targetType: 'quiz' \| 'list' \| 'question'` | `Promise<void>` | 必要 |
| **`getBookmarkedQuizzes`** | ユーザーがブックマークしたクイズ一覧を取得する。 | `userId: string` | `Promise<Quiz[]>` | 必要 |
| **`getBookmarkedLists`** | ユーザーがブックマークしたクイズリスト一覧を取得する。 | `userId: string` | `Promise<QuizList[]>` | 必要 |
| **`getTimelineFeed`** | 自身がフォローしているユーザーが作成した最新の公開クイズ一覧を時系列で取得。デフォルト20件、最大100件。 | `userId: string`, `limitCount?: number` (default: 20, max: 100) | `Promise<Quiz[]>` | 必要 |
| **`createQuizList`** | 複数のクイズや特定の設問をまとめるクイズリスト（問題集）を新規作成する。 | `authorId: string`, `listData: Omit<QuizList, 'id'>` | `Promise<string>` (リストID) | 必要 |
| **`getQuizList`** | 指定されたIDのクイズリストを1件取得する。 | `listId: string` | `Promise<QuizList \| null>` | 不要 |
| **`updateQuizList`** | クイズリストのメタ情報、収録クイズID配列、および収録設問ID配列を更新する。 | `listId: string`, `authorId: string`, `updates: Partial<QuizList>` | `Promise<void>` | 必要 |
| **`deleteQuizList`** | クイズリストを削除する。 | `listId: string`, `authorId: string` | `Promise<void>` | 必要 |
| **`getQuizListsByUser`** | 特定のユーザーが作成した公開（ログイン中の自作であれば非公開含む）クイズリスト一覧を取得。 | `userId: string` | `Promise<QuizList[]>` | 不要 |

---

### 2.5 ReportService (`src/services/report.ts`)
クローズドな間違い・別解指摘フィードバック、およびクリエイターへの通知ループを制御します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`submitReport`** | プレイヤーが設問の誤字・事実誤認・別解をクローズドに送信する。 | `report: Omit<FeedbackReport, 'id' \| 'createdAt' \| 'status'>` | `Promise<string>` (レポートID) | 必要 |
| **`getReportsForCreator`** | 作家ダッシュボード用に、自作クイズに対する未解決（`status == 'open'`）指摘リストを取得する。 | `creatorId: string` | `Promise<FeedbackReport[]>` | 必要 |
| **`resolveReport`** | 指摘レポートを解決（修正完了）にし、指摘送信ユーザー宛てに「修正完了オート感謝通知」を自動登録する。 | `reportId: string`, `resolverUserId: string` | `Promise<void>` | 必要 |

---

### 2.6 ModerationService (`src/services/moderation.ts`)
コミュニティの健全性を保つための不適切表現（NGワード）検知、ユーザー通報、自動非公開、管理者による審査キューの管理を行います。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`checkNGWords`** | 入力テキストが事前定義されたNGワードリストに引っかかるか検証（検知時は `true` ）。 | `text: string` | `boolean` | 不要 (保存前) |
| **`submitFlag`** | クイズに対する通報を送信。通報数が5回に達した時、トランザクションでクイズを非公開（保留）に強制変更し、管理者モデレーション待ちにする。 | `flag: Omit<Flag, 'id' \| 'createdAt'>` | `Promise<string>` (通報ID) | 必要 |
| **`getPendingFlags`** | 管理者モデレーション画面用に、未処理の通報コンテンツ一覧を取得する。 | - | `Promise<Flag[]>` | 必要（管理者ロール） |
| **`resolveFlag`** | 管理者による通報処理の決定。通報承認時は永久非公開/削除、通報却下時は公開状態に復帰させる。**多重防衛（セキュリティ対策）**: クライアントから直接 Firestore を操作する特権処理を安全にするため、実行者の UID (`executorId`) の引き渡しを必須化。サービス層内部で Firestore から実行者の `users/{uid}` を直接引き直し、実際の `moderationTier` や `role === 'admin'` を検証する認可チェック（Assert）を行い、クライアントサイドでの特権昇格・偽造呼び出しを防御します。 | `flagId: string`, `action: 'approve' \| 'reject'`, `executorId: string` | `Promise<void>` | 必要（管理者ロール） |

---

### 2.7 UserService (`src/services/user.ts`) [NEW]
ユーザープロフィールの取得、更新、獲得した「称号バッジ」の自動判定・付与、およびアカウント削除（退会処理）を制御します。

> **バッジ付与の実行主体**: `checkAndAwardBadges` は『Cloud Functions for Firebase (`firestore.document('users/{uid}').onUpdate`)』をトリガーとしてサーバーサイドで実行されます。フロントエンドからの直接呼び出しは認められません（Security Rulesで保護）。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`getUserProfile`** | 指定されたIDのユーザープロフィール情報を取得する。 | `uid: string` | `Promise<UserProfile \| null>` | 不要 |
| **`updateUserProfile`** | 自身のプロフィール（表示名、アバター、自己紹介、フォローしているジャンルなど）を更新する。 | `uid: string`, `updates: Partial<UserProfile>` | `Promise<void>` | 必要 |
| **`checkAndAwardBadges`** | ユーザーのアクティビティ（累計プレイ数、作成数、フォロワー数など）を検証し、新たに達成した称号バッジがあれば自動的にアトミック付与する。 | `uid: string` | `Promise<Badge[]>` (新規付与されたバッジリスト) | 必要 |
| **`deleteUserAccount`** | ユーザーアカウントの削除（退会）の処理を開始する。**セキュリティ対策 (サーバーサイドへの一本化)**: ブラウザ上の非同期 `setTimeout` による重いバッチループを廃止（データ不整合や通信切断タイムアウトを完全に回避）。フロントエンドは IDトークンを付与して Next.js API Route (/api/user/delete-account) を POST 呼び出しし、サーバーサイド側で安全かつ非同期にクレンジング・物理削除・匿名化バッチ処理を完遂する構造に一本化されました。 | `uid: string` | `Promise<void>` | 必要 |

---

### 2.8 NotificationService (`src/services/notification.ts`) [NEW]
ユーザー宛ての時系列アクティビティ通知の取得、既読管理、通知作成を担当します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`getNotifications`** | ログイン中ユーザーが受け取った通知一覧を時系列降順で取得する。 | `userId: string` | `Promise<Notification[]>` | 必要 |
| **`markAsRead`** | 指定された通知を既読状態（`isRead = true`）に更新する。 | `notificationId: string` | `Promise<void>` | 必要 |
| **`createNotification`** | システムアクションに伴い新規通知を発行する（フォローされた、ブックマークされた、指摘が修正された等）。 | `notificationData: Omit<Notification, 'id' \| 'createdAt' \| 'isRead'>` | `Promise<string>` (通知ID) | 必要 |

---

### 2.9 ReactionService (`src/services/reaction.ts`) [NEW]
クイズプレイ完了時にプレイヤーから作家へ送る「いいね・感謝」リアクション、およびリアクション履歴の取得を制御します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`sendReaction`** | プレイ結果画面からクイズ作家宛てにリアクションを送信し、作家の累計獲得リアクション数に反映させる。 | `senderId: string`, `receiverId: string`, `quizId: string`, `type: 'like' \| 'thank'` | `Promise<void>` | 必要 |
| **`getSentReactions`** | ユーザー自身が過去に送信したリアクションの履歴を取得する。 | `userId: string` | `Promise<Reaction[]>` | 必要 |
| **`getReceivedReactions`** | 作家として、自身の投稿クイズに寄せられた獲得リアクション履歴を取得する。 | `userId: string` | `Promise<Reaction[]>` | 必要 |

---

### 2.10 RatingService (`src/services/rating.ts`) [NEW]
クイズ結果画面から行う「体感難易度投票」の永続化を担当します。星1〜5段階の面白さ評価は廃止され良問評価（ReviewService）へ一本化されたため、本サービスは難易度投票のみを管理します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`submitDifficultyVote`** | 体感難易度（1〜10）をアトミックに保存する。同一ユーザーは最新値で上書き保存され、クイズの難易度分布データにアトミック反映される。 | `quizId: string`, `userId: string \| null`, `difficultyVote: number` (1-10) | `Promise<void>` | 不要（匿名投票可） |

---

### 2.11 ReviewService (`src/services/review.ts`) [NEW]
クイズに対する「良問（👍）/ 悪問（👎）」評価（Steam風レビュー）の登録・参照・リセット申請を担当します。バッジの計算・付与は週次Cloud Functionsバッチで実行されます。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`submitReview`** | クイズに対する良問/悪問評価を登録。全問解答済みのユーザーのみ可能。同一ユーザーが同一クイズを再度評価する場合は上書きとなる。自分のクイズは評価不可。**評価・変更・削除と同一トランザクション内で `quizzes/{quizId}` の `positiveCount` / `negativeCount` (仮リセット期間中の場合は `tempPositiveCount` / `tempNegativeCount`) をリアルタイムにアトミック加減算更新する（週次バッチ処理の集計負荷削減）。** | `quizId: string`, `reviewerId: string`, `type: 'positive' \| 'negative'`, `reason?: string` | `Promise<void>` | 必要 |
| **`getReviewStats`** | 指定クイズの良問率・良問数・悪問数・バッジ指定を取得。仮リセット期間中の場合は `tempPositiveCount` / `tempNegativeCount` に基づく値を返し、過去の評価をマスクする。 | `quizId: string` | `Promise<{ reviewScore: number \| null, positiveCount: number, negativeCount: number, reviewBadge: string \| null, tempPositiveCount?: number, tempNegativeCount?: number }>` | 不要 |
| **`submitReviewResetRequest`** | 「要改善」バッジのクイズの `reviewScore` リセット申請を `reviewResetRequests` コレクションに登録する。クイズの作成者のみ実行可能。申請後7日間の「仮リセット（再評価）期間」に入り、過去評価が一時的にマスクされる。7日後に新規評価（5件以上かつ良問率80%以上）の可決基準をクリアして承認された際、過去の該当クイズの `quizReviews` 評価ドキュメント群は **Cloud Tasks と連携した非同期分割クレンジング（Chunked Execution）によりアトミックかつ安全に物理削除**される。同時に、仮評価カウンター（`tempPositiveCount`/`tempNegativeCount`）の値を正規カウンター（`positiveCount`/`negativeCount`）に差し替える。基準未達で却下された場合は、仮評価カウンター値を正規カウンター値に合算加算したうえで仮カウンターをリセットし、過去の評価と統合させてマスクを解除する。 | `quizId: string`, `requesterId: string` | `Promise<string>` (リクエストID) | 必要 |

---

### 2.12 ReputationService (`src/services/reputation.ts`) [NEW]
ユーザーの信頼スコア参照およびモデレータ権限の確認を担当します。スコア更新は日次Cloud Functionsバッチのみが実行します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`getReputationScore`** | 指定ユーザーの`reputationScore`、`moderationTier`、履歴を取得する。 | `uid: string` | `Promise<{ reputationScore: number, moderationTier: string, reputationHistory: object[] }>` | 必要 |
| **`checkModeratorEligibility`** | 指定ユーザーがモデレータ資格（`moderationTier ≥ 'moderator'`）を持っているか検証する。 | `uid: string` | `Promise<boolean>` | 必要 |
| **`getReputationLimit`** | 特定の評価者（`senderId`）からクリエイター（`authorId`）への累計スコア加算上限（最大 +5 pt）を確認・取得する。アトミックなトランザクション内でサブコレクション `users/{uid}/reputationLimits/{senderId}` を参照する。 | `authorId: string`, `senderId: string` | `Promise<{ totalDelta: number }>` | 必要 |

---

### 2.13 TagMergeService (`src/services/tagMerge.ts`) [NEW]
タグ・ジャンルのマージリクエスト・ジャンル新設申請の初提、投票、および可決時のアトミック適用を制御します。詳細は詳細設計書 Section 6.7 を参照。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`createMergeRequest`** | タグ/ジャンルのマージ提案を起案する。循環参照防止チェック、重複起案防止を実行。起案者は自動的に賛成１票。 | `sourceId: string`, `targetId: string`, `targetType: 'tag' \| 'genre'`, `reason: string`, `userId: string` | `Promise<string>` (リクエストID) | 必要 (モデレータ資格) |
| **`voteMergeRequest`** | マージリクイエストに賛成/反対投票を行う。可決条件（重み付き賛成票≥5かつ賛成率≥70%）を実行時、トランザクション内でメタデータマスタをアトミックに自動適用。 | `requestId: string`, `voterId: string`, `opinion: 'approve' \| 'reject'` | `Promise<void>` | 必要 (モデレータ資格) |
| **`submitGenreRequest`** | 新ジャンルの新設申請を登録する。アイコン画像はStorageURIとして渡す。 | `genreId: string`, `displayName: string`, `iconImageUrl: string`, `requesterId: string` | `Promise<string>` (リクエストID) | 必要 |
| **`voteGenreRequest`** | ジャンル新設申請に賛成/反対投票。可決条件（重み付き賛成票≥5かつ賛成率≥80%）でメタデータマスタを自動作成。 | `requestId: string`, `voterId: string`, `opinion: 'approve' \| 'reject'` | `Promise<void>` | 必要 (モデレータ資格) |

---

### 2.14 StorageService (`src/services/storage.ts`) [NEW]
画像（カバー画像、設問画像、アバター、ジャンルアイコン等）の Firebase Storage へのアップロードを管理します。

#### メソッド定義一覧

| メソッド名 | 説明 | 主要引数 | 戻り値 | 認証要否 |
| :--- | :--- | :--- | :--- | :--- |
| **`uploadImage`** | ファイルを Firebase Storage の指定パスにアップロードし、公開URLを返す。**セキュリティ対策 (SVG-based XSS防御)**: スクリプトインジェクションによるセッションハイジャックや特権奪取を完全に防ぐため、アップロード許容MIMEタイプ（`ALLOWED_MIME_TYPES`）から `'image/svg+xml'` (SVG形式) を完全に除外。画像形式を `PNG`, `JPEG`, `GIF` の安全なビットマップ画像のみに厳しく制限しています。 | `file: File`, `path: string` | `Promise<string>` (公開URL) | 必要 |

## 3. Zodによるリクエスト・データバリデーションスキーマ仕様
安全で不整合のないデータ保存を実現するため、Zodによるスキーマ検証を保存直前に実行します。

### 3.1 クイズ登録・公開スキーマ (`quizPublishSchema`)
クイズ公開（`isPublished = true`）時に適用される厳格なバリデーションスキーマ仕様です。

**ジャンル・タグの検証要件**:
- **`genre`**: `metadata_genres` コレクションに存在する有効なジャンルIDでなければなりません。未選択や空文字は許容されません。
- **`tags`**: 最大5個までの文字列配列。各要素はフロントエンドで事前に「自動名寄せ（空白/記号の排除、小文字化）」が適用された、15文字以内の正規化タグID配列である必要があります。

```typescript
import { z } from 'zod';

export const choiceSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  choiceText: z.string().min(1, '選択肢の内容を入力してください。').max(100, '選択肢は100文字以内で入力してください。'),
  isCorrect: z.boolean()
});

export const sortingItemSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  text: z.string().min(1, '並び替え要素の内容を入力してください。').max(50, '要素は50文字以内で入力してください。'),
  correctOrder: z.number().int().min(0)
});

export const questionSchema = z.object({
  id: z.string().uuid().or(z.string().min(1)),
  type: z.enum(['true-false', 'multiple-choice', 'text-input', 'sorting', 'association', 'lateral-thinking']),
  questionText: z.string().min(5, '問題文は5文字以上で入力してください。').max(500, '問題文は500文字以内で入力してください。'),
  explanation: z.string().min(1, '正解時の解説を入力してください。').max(1000, '解説は1000文字以内で入力してください。'),
  imageUrl: z.string().url('有効なURL形式で画像を指定してください。').optional().or(z.literal('')),
  hint: z.string().max(200, 'ヒントは200文字以内で入力してください。').optional(),
  limitTime: z.number().int().min(5, '制限時間は最低5秒以上にしてください。').max(300, '制限時間は最大300秒までです。').optional(),
  choices: z.array(choiceSchema).max(4, '選択肢は最大4つまでです。').optional(),
  correctTextAnswerList: z.array(z.string().min(1)).optional(),
  sortingItems: z.array(sortingItemSchema).max(6, '並び替え要素は最大6つまでです。').optional(),
  associationHints: z.array(z.string().min(1)).max(5, '連想ヒントは最大5つまでです。').optional(),
  aiContextDetails: z.string().max(2000, 'AI用コンテキストは2000文字以内で入力してください。').optional(),
  truthKeywords: z.array(z.string().min(1, 'キーワードは空文字では登録できません。')).min(1, '真相判定用の必須キーワードを最低1つ以上登録してください。').optional()
}).superRefine((data, ctx) => {
  // 〇×（マルバツ）クイズ
  if (data.type === 'true-false') {
    if (!data.choices || data.choices.length !== 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '〇×クイズには2つの選択肢が必要です。',
        path: ['choices']
      });
    } else {
      const hasCorrect = data.choices.some(c => c.isCorrect);
      if (!hasCorrect) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: '正解の選択肢を設定してください。',
          path: ['choices']
        });
      }
    }
  }
  // 多肢選択クイズ
  if (data.type === 'multiple-choice') {
    if (!data.choices || data.choices.length < 2 || data.choices.length > 4) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '選択問題には2〜4つの選択肢が必要です。',
        path: ['choices']
      });
    } else if (!data.choices.some(c => c.isCorrect)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '少なくとも1つの正解を設定してください。',
        path: ['choices']
      });
    }
  }
  // 短答・記述式クイズ
  if (data.type === 'text-input') {
    if (!data.correctTextAnswerList || data.correctTextAnswerList.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '短答式問題には少なくとも1つの正解パターンが必要です。',
        path: ['correctTextAnswerList']
      });
    }
  }
  // 並び替えクイズ (sorting): 提示された複数の要素を、正しい順番（インデックス）にドラッグ＆ドロップ等で並び替える形式
  if (data.type === 'sorting') {
    if (!data.sortingItems || data.sortingItems.length < 2 || data.sortingItems.length > 6) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '並び替え問題には2〜6つの並び替え要素が必要です。',
        path: ['sortingItems']
      });
    } else {
      // correctOrderの重複チェックとインデックス値の検証
      const orders = data.sortingItems.map(item => item.correctOrder);
      const uniqueOrders = new Set(orders);
      const maxOrder = data.sortingItems.length - 1;
      
      const hasDuplicates = uniqueOrders.size !== orders.length;
      const isOutRange = orders.some(o => o < 0 || o > maxOrder);
      
      if (hasDuplicates || isOutRange) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `並び替え要素の正しい順序（インデックス）は 0 から ${maxOrder} までの重複のない連続する整数で指定してください。`,
          path: ['sortingItems']
        });
      }
    }
  }
  // 連想クイズ (association): 段階的なヒント（連想ヒントリスト）を提示して、最終的な正解を導き出させる形式
  if (data.type === 'association') {
    if (!data.associationHints || data.associationHints.length === 0 || data.associationHints.length > 5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '連想問題には1〜5つの段階的ヒント（連想ヒントリスト）が必要です。',
        path: ['associationHints']
      });
    }
    if (!data.correctTextAnswerList || data.correctTextAnswerList.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '連想クイズの最終的な正解判定用として、少なくとも1つの正解パターン（正解テキストパターン）が必要です。',
        path: ['correctTextAnswerList']
      });
    }
  }
  // 水平思考（ウミガメのスープ）
  if (data.type === 'lateral-thinking') {
    if (!data.aiContextDetails || data.aiContextDetails.trim().length < 20) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '水平思考クイズのAI判定を正しく実行するため、20文字以上の詳細な裏設定・判定ルールを入力してください。',
        path: ['aiContextDetails']
      });
    }
    if (!data.truthKeywords || data.truthKeywords.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: '水平思考クイズの自動真相判定を正しく実行するため、必須キーワードを最低1つ以上登録してください。',
        path: ['truthKeywords']
      });
    }
  }
});

export const quizPublishSchema = z.object({
  title: z.string().min(3, 'クイズのタイトルは3文字以上で入力してください。').max(50, 'タイトルは50文字以内で入力してください。'),
  description: z.string().min(10, '説明文は10文字以上で詳細に記入してください。').max(300, '説明文は300文字以内で記入してください。'),
  difficulty: z.number().int().min(1).max(10, '難易度は1から10の整数値で指定してください。'),
  genre: z.string().min(1, 'ジャンルを選択してください。'),
  tags: z.array(z.string().max(15)).max(5, 'タグは最大5つまで設定可能です。'),
  questionIds: z.array(z.string()).min(1, 'クイズを公開するには最低1問以上の問題を追加してください。').optional(),
  questions: z.array(questionSchema).min(1, 'クイズを公開するには最低1問以上の問題を追加してください。') // 非正規化コピーの検証
});

// インポート機能は廃止されたため、インポート用Zodスキーマ定義は存在しません。エクスポート時は出力データの整合性のみ検証されます。
```

---

## 4. 追加サービスに関連する TypeScript データ型定義

新規追加されたサービスおよびリファクタリング後のデータ型定義です。

```typescript
// ユーザープロフィールおよび称号バッジ
export interface Badge {
  id: string;
  title: string;
  description: string;
  iconName: string;
  unlockedAt: Date;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string;
  avatarUrl: string;
  bio?: string;
  followedGenres: string[];
  badges: Badge[];
  createdAt: Date;
  updatedAt: Date;
}

// 指摘フィードバック
// 注意: DB設計書の feedbackReports コレクションには questionText と selectedChoiceText も存在する。
export interface FeedbackReport {
  id: string;
  quizId: string;
  quizTitle: string;
  questionId: string;
  questionText: string;    // 追加: 指摘された設問の設問文（文脈維持用・非正規化保持）
  selectedChoiceText?: string; // 追加: 指摘時にプレイヤーが選択していた選択肢テキスト（選択式のときのみ）
  reporterId: string;
  creatorId: string;
  category: 'typo' | 'fact' | 'alternative';
  content: string;
  status: 'open' | 'resolved';
  createdAt: Date;
}

// コンテンツ通報
// targetType によりクイズ・リスト・プロフィールのいずれも通報可能
export interface Flag {
  id: string;
  targetId: string;   // 変更: quizId から targetId に汎用化
  targetType: 'quiz' | 'list' | 'profile'; // 追加: 通報対象のカテゴリ
  reporterId: string;
  reason: 'spam' | 'harassment' | 'copyright' | 'inappropriate_image' | 'other';
  content?: string;
  createdAt: Date;
}

// 通知
export interface Notification {
  id: string;
  userId: string;
  type: 'follow' | 'bookmark' | 'correction_resolved' | 'badge_unlocked' | 'quiz_review_warning';
  // 'follow'             : フォローされた
  // 'bookmark'          : クイズ・リストがブックマークされた
  // 'correction_resolved': 指摘した問題が修正された（オート感謝通知）
  // 'badge_unlocked'    : 新しい称号バッジを獲得した
  // 'quiz_review_warning': 自作クイズの良問率が「要改善」バッジ基準を下回った
  senderId: string;
  senderName: string;
  senderAvatar: string;
  targetId?: string;
  targetTitle?: string;
  isRead: boolean;
  createdAt: Date;
}

// リアクション（いいね・感謝）
export interface Reaction {
  id: string;
  senderId: string;
  receiverId: string; // クイズ作成者
  quizId: string;
  quizTitle: string;
  type: 'like' | 'thank';
  createdAt: Date;
}

// Attempt のモード型定義
// 'normal'    : 通常モード
// 'exam'      : 模擬試験モード
// 'flashcard' : フラッシュカードモード（解答履歴記録のみ、スコアなし）
// 'review'    : 弱点克服・復習プレイ（対象問題は failedQuestionIds から抄出）
// 'list'      : リストプレイモード（クイズリストから連続してプレイされる場合）
export type AttemptMode = 'normal' | 'exam' | 'flashcard' | 'review' | 'list';

// クイズ・リストインポート/エクスポート用データ型定義
export interface QuizImportData {
  title: string;
  description: string;
  thumbnailUrl?: string;
  difficulty: number;
  genre: string;
  tags: string[];
  questions: any[]; // 設問データ配列（インポート用）
}

export interface QuizExportPackage {
  version: string;
  exportedAt: Date | string;
  quizzes: QuizImportData[];
  list?: {
    title: string;
    description: string;
    isPublished: boolean;
  };
}

// ブックマーク (設問ブックマーク対応)
export interface Bookmark {
  id: string;             // userId_targetId の形式
  userId: string;
  targetId: string;       // クイズID、リストID、または設問ID
  targetType: 'quiz' | 'list' | 'question'; // 'question' を追加
  createdAt: Date;
}
```
