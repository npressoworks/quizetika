# quizeum 詳細設計仕様書

本ドキュメントは、クイズ投稿SNS「quizeum」における詳細設計仕様を定義します。本仕様は、要件定義書、画面遷移図、論理DB設計書、およびAPI仕様書に基づき、システムの耐障害性、セキュリティ、データ整合性、およびユーザー体験（UX）を最大化するための具体的な技術設計を策定したものです。

---

## 1. 主要機能のシーケンス図 (Mermaid)

主要なビジネスロジックにおけるフロントエンド、サービスレイヤー、およびデータベース（Firestore）間の相互作用を定義します。

### 1.1 クイズ解答〜結果登録フロー
通常モードおよび模擬試験モードにおける解答データの永続化、プレイ数カウント更新、およびハイスコアリーダーボード更新フローです。プレイ中の不意の離脱を保護するオフライン・リロード保護セッションを含みます。

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant QP as クイズプレイ画面 (/quiz/[id]/play)
    participant LS as localStorage
    participant AS as AttemptService
    participant QS as QuizService
    participant US as UserService
    participant DB as Firestore (Database)

    Player->>QP: プレイ開始 (通常/模擬試験/弱点克服/リストモード)
    QP->>LS: 解答セッション初期化保存 (quizId, 解答状態)
    
    loop 設問解答ごと (通常/弱点克服モードのみ)
        Player->>QP: 解答を選択/入力
        QP->>QP: 正誤判定・解説表示
        QP->>LS: 現在の進捗・スコアを更新保存
    end

    Player->>QP: 全問解答完了 (または一括採点実行)
    Note over QP, AS: プレイ結果の永続化とアトミックなカウント加算
    QP->>AS: saveAttempt(attemptData)
    Note over AS: リストプレイ時 listId を含めて保存 (mode = 'list')
    activate AS
    AS->>DB: トランザクション開始
    DB->>DB: attempts ドキュメント新規作成
    DB->>DB: quizzes.playCount を +1 インクリメント (アトミック)
    AS-->>QP: 保存完了 (attemptId)
    deactivate AS

    alt 弱点克服（復習）プレイ完了
        Note over QP, AS: 正解した間違った問題を一括削除
        QP->>AS: updateFailedQuestions(uid, quizId, solvedQuestionIds)
        activate AS
        AS->>DB: トランザクション開始
        DB->>DB: attempts.failedQuestionIds からアトミック削除
        DB->>DB: users.totalFailedQuestionsCount をアトミック減算
        AS-->>QP: 削除完了
        deactivate AS
    end

    Note over QP, US: ユーザー統計更新と称号判定 (非同期トリガー)
    QP->>US: checkAndAwardBadges(uid)
    activate US
    US->>DB: トランザクション開始
    DB->>DB: users.totalPlayCount を +1 インクリメント
    US->>DB: 称号バッジ獲得条件の検証 (totalPlayCount, etc)
    alt 新規バッジ獲得条件達成
        DB->>DB: users.badges 配列へアトミック追加 (Badge)
    end
    US-->>QP: 新規獲得バッジリスト
    deactivate US

    Note over QP, QS: ハイスコア・タイムアタックの記録更新判定
    alt 全問正解 または 自己ベスト更新
        QP->>QS: updateLeaderboard(quizId, record)
        activate QS
        QS->>DB: トランザクション開始
        DB->>DB: quizzes.leaderboard 配列を取得
        QS->>QS: 新規記録を挿入・ソートし上位5名にスライス
        DB->>DB: quizzes.leaderboard を更新
        QS-->>QP: 更新完了
        deactivate QS
    end

    QP->>LS: 解答セッション(localStorage)の破棄
    QP->>Player: 結果画面 (/quiz/[id]/result) へ遷移
```

---

### 1.2 クイズ作成・公開フロー
クリエイターによるクイズ作成時における、Zodスキーマ検証、NGワードチェック、下書き保存、および公開制限設計です。

```mermaid
sequenceDiagram
    autonumber
    actor Creator as 作家 (クリエイター)
    participant QC as クイズ作成画面 (/quiz/create)
    participant MS as ModerationService
    participant QS as QuizService
    participant US as UserService
    participant DB as Firestore (Database)

    Creator->>QC: タイトル、説明、初期難易度(1-10)、問題群を入力
    
    alt 下書き保存の場合 (isPublished = false)
        Creator->>QC: 「下書き保存」をクリック
        QC->>QC: 最小限のバリデーション (タイトル入力)
        QC->>QS: createQuiz / updateQuiz (status = 'draft')
        activate QS
        QS->>DB: quizzes ドキュメント保存
        QS-->>QC: 保存完了
        deactivate QS
        QC-->>Creator: 下書き保存完了通知
        
    else 公開申請の場合 (isPublished = true)
        Creator->>QC: 「公開する」をクリック
        Note over QC: Zodによる厳格なスキーマ検証 (quizPublishSchema)
        QC->>QC: 設問数(>=1)、各設問正解設定、文字数制限（水平思考のAI用コンテキストは20〜2000文字）などを検証
        
        alt バリデーション失敗
            QC-->>Creator: エラー箇所を赤色強調表示、修正指示トースト表示
        else バリデーション成功
            Note over QC, MS: 保存前の不適切表現チェック
            QC->>MS: checkNGWords(全テキスト)
            activate MS
            MS-->>QC: 検知結果 (true = NGワードあり / false = なし)
            deactivate MS
            
            alt NGワード検知 (true)
                QC-->>Creator: 「不適切な表現が含まれています」と警告表示 (保存ブロック)
            else 検知なし (false)
                QC->>QS: createQuiz / updateQuiz (status = 'published')
                activate QS
                Note over QS, DB: 仮想統合（書き込み時解決）
                QS->>DB: metadata_genres / metadata_tags マスタを参照
                DB-->>QS: 統合先 canonicalId の解決
                QS->>DB: トランザクション開始
                DB->>DB: 各設問を questions コレクションに独立保存
                DB->>DB: quizzes ドキュメント保存<br>(questionIds配列 + questions非正規化ネストコピー + canonicalGenreId / canonicalTagIds)
                QS-->>QC: 保存完了 (quizId)
                deactivate QS
                
                Note over QC, US: 作成統計更新と称号バッジ判定
                QC->>US: checkAndAwardBadges(uid)
                activate US
                US->>DB: トランザクション開始
                DB->>DB: users.createdQuizzesCount を +1 インクリメント
                US->>DB: 作家称号バッジ獲得条件の検証
                alt 新規バッジ獲得条件達成
                    DB->>DB: users.badges 配列へアトミック追加 (Badge)
                end
                US-->>QC: 判定完了
                deactivate US
                
                QC->>Creator: 作家ダッシュボード (/creator/dashboard) へ自動遷移
            end
        end
    end
```

---

### 1.3 間違い指摘フィードバック修正完了オート通知フロー
プレイヤーによる間違い指摘から、作家の修正、および指摘者のオート感謝通知までのクローズドフィードバックループです。

```mermaid
sequenceDiagram
    autonumber
    actor Player as 指摘プレイヤー
    actor Creator as クイズ作家
    participant QR as 結果画面 (/quiz/[id]/result)
    participant RS as ReportService
    participant CD as 作家ダッシュボード
    participant QE as クイズ編集画面
    participant NS as NotificationService
    participant DB as Firestore (Database)

    Player->>QR: 間違い・別解指摘ボタンをクリック
    Player->>QR: 指摘カテゴリ選択・内容入力して送信
    QR->>RS: submitReport(reportData)
    activate RS
    RS->>DB: feedbackReports ドキュメント新規作成 (status = 'open')<br>※ quizTitle, questionText を非正規化同期
    RS-->>QR: 送信成功 (ポップアップ感謝ダイアログ表示)
    deactivate RS
    
    Note over Creator, CD: 作家による指摘の確認と修正
    Creator->>CD: 作家ダッシュボードを開く
    CD->>RS: getReportsForCreator(creatorId)
    activate RS
    RS->>DB: feedbackReports から status = 'open' を検索
    DB-->>RS: 未解決指摘リスト
    RS-->>CD: 指摘一覧表示
    deactivate RS
    
    Creator->>CD: 対象指摘の「修正する」をクリック
    CD->>QE: 該当クイズの編集画面へ遷移 (指摘箇所をロード)
    Creator->>QE: 設問を編集・修正し「公開更新」をクリック
    QE->>DB: quizzes ドキュメントを更新
    QE-->>CD: 編集ダッシュボードへ復帰
    
    Note over Creator, NS: 指摘解決とプレイヤーへのオート感謝通知
    Creator->>CD: 指摘の「解決済みにする」をクリック
    CD->>RS: resolveReport(reportId, uid)
    activate RS
    RS->>DB: トランザクション開始
    DB->>DB: feedbackReports.status を 'resolved' に変更
    RS->>NS: createNotification(notificationData)
    activate NS
    NS->>DB: notifications ドキュメント新規作成 (type = 'correction_resolved')<br>※ 指摘者宛て
    NS-->>RS: 通知登録完了
    deactivate NS
    RS-->>CD: 解決処理完了
    deactivate RS
    
    Note over Player, DB: 指摘プレイヤー側への通知到達
    Player->>DB: 通知コレクションの変更をリアルタイム購読 (または再ロード)
    DB-->>Player: 通知受信 (「あなたが指摘した問題が修正されました」)
```

---

### 1.4 通報による自動保留（非公開）フロー
不適切なクイズに対する通報（flags）が一定回数に達した際、システムがアトミックにコンテンツを非公開化し、管理モデレーションにキューイングする自動防衛フローです。

```mermaid
sequenceDiagram
    autonumber
    actor User as 通報ユーザー
    actor Admin as 管理者
    participant QD as クイズ詳細画面 (/quiz/[id])
    participant MS as ModerationService
    participant DB as Firestore (Database)
    participant AD as 管理モデレーション画面

    User->>QD: 「不適切なコンテンツ通報」をクリック
    User->>QD: 理由カテゴリ選択、詳細を入力して送信
    QD->>MS: submitFlag(flagData)
    activate MS
    MS->>DB: トランザクション開始
    DB->>DB: flags ドキュメント新規作成
    DB->>DB: quizzes.flagsCount を +1 インクリメント (アトミック)
    DB->>DB: 対象クイズの flagsCount を確認
    
    alt 累計通報数 (flagsCount) >= 5
        Note over DB: コンテンツ自動保留・一時非公開化
        DB->>DB: quizzes.status を 'suspended' に強制変更
    end
    
    MS-->>QD: 通報受付完了
    deactivate MS
    
    Note over Admin, AD: 管理者によるモデレーション審査
    Admin->>AD: モデレーション管理画面を開く
    AD->>MS: getPendingFlags()
    activate MS
    MS->>DB: quizzes から status = 'suspended' を検索取得
    DB-->>MS: 審査待ち保留クイズ一覧
    MS-->>AD: 保留クイズ・通報詳細リストを表示
    deactivate MS
    
    Admin->>AD: コンテンツ検証と最終判定
    alt 通報が妥当 (違反確認)
        Admin->>AD: 「永久非公開 / 削除」を実行
        AD->>MS: resolveFlag(flagId, 'approve')
        activate MS
        MS->>DB: quizzes.status を 'suspended' から削除/永久非公開ステータスへ変更
        MS-->>AD: 処理完了
        deactivate MS
    else 通報が不当 (誤通報・安全確認)
        Admin->>AD: 「通報却下 / 公開復帰」を実行
        AD->>MS: resolveFlag(flagId, 'reject')
        activate MS
        MS->>DB: トランザクション開始
        DB->>DB: quizzes.status を 'published' に復帰
        DB->>DB: quizzes.flagsCount を 0 にリセット
        MS-->>AD: 処理完了
        deactivate MS
    end
```

---

### 1.5 水平思考クイズ（ウミガメのスープ）AI対話フロー
水平思考クイズ（ウミガメのスープ）におけるプレイヤーと生成AI、およびFirestoreのattempt対話履歴間のシーケンス図です。

#### 1.5.1 AI判定処理フロー（ステートフル・キャッシュ・ターン制限）

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant QP as クイズプレイ画面 (/quiz/[id]/play)
    participant AS as AttemptService (Server-side API Route)
    participant AI as AI Engine (Google Gemini API)
    participant DB as Firestore (Database)

    Player->>QP: 自由記述の質問を入力し送信 (最大100文字)
    QP->>QP: 送信トースト表示、入力フィールドロック

    QP->>AS: askAiQuestion(attemptId, questionText) [Authorization: Bearer <ID_TOKEN> 付与]
    activate AS

    Note over AS: ①IDトークンの署名検証および本人確認<br>JWT 署名を検証し、userId がトークンの uid と完全一致するかチェック
    AS->>DB: attempts/{attemptId} ドキュメントを取得
    DB-->>AS: { quizId, userId, aiQuestionsHistory, aiTurnCount }
    
    Note over AS: ②プレミアムプラン権限昇格の検証（サーバー側DB引き直し）<br>クライアントからの要求は信用せず、users/{uid} の最新情報を直接取得し<br>aiTurnLimit が null (プレミアム) かどうかを検証

    Note over AS: ③同一質問キャッシュ判定
    alt aiQuestionsHistory 内に完全一致 of questionText が存在する
        AS-->>QP: { answerType, aiComment, isFromCache: true } (キャッシュ返却)
        Note over AS: AI呼び出しなし、aiTurnCount も増やさない
    else キャッシュなし
        Note over AS: ④ターン制限チェック (aiTurnLimit != null の場合のみ)
        AS->>DB: users/{uid}/dailyAiTurnCounts/{quizId} から count と lastUpdatedDate を取得
        DB-->>AS: { count, lastUpdatedDate }
        alt count >= 20 且つ lastUpdatedDate == 本日
            AS-->>QP: Error: limit-exceeded
            QP-->>Player: 「無料プランの質問回数上限（20回）に達しました。\nプレミアムプランでは無制限にご利用いただけます。」
        else ターン制限内 (または有料ユーザーで無制限)
            Note over AS: ⑤AIステートフル対話呼び出し
            AS->>DB: quizzes/{quizId} から aiContextDetails を取得
            DB-->>AS: aiContextDetails

            AS->>AI: チャットセッション作成 (startChat)<br>※直近最大20回分の履歴をマッピングして history に渡す
            activate AI
            AS->>AI: 新しい質問 of 送信 (questionText)
            AI->>AI: 過去履歴から文脈・指示代名詞を解決し、「はい/いいえ/関係ありません/判定不能」を判定
            AI-->>AS: { answerType, aiComment }
            deactivate AI

            AS->>DB: トランザクション開始
            DB->>DB: aiQuestionsHistory に { id, questionText, answerType, aiComment, isFromCache: false, createdAt } を arrayUnion
            DB->>DB: attempts.aiTurnCount を +1 アトミックインクリメント
            DB->>DB: users/{uid}/dailyAiTurnCounts/{quizId} の count を +1 （本日日付でアトミック更新）
            AS-->>QP: { answerType, aiComment, isFromCache: false }
        end
    end
    deactivate AS

    QP->>QP: チャットUIとQ&Aリストパネルを動的に更新
    QP->>Player: 回答フィールドロック解除、入力を許可
```

#### 1.5.2 AI判定ビジネスロジック詳細仕様

**① 同一質問キャッシュ（完全一致）**
- `AttemptService.askAiQuestion` の最初の処理として、現在の `attempts/{attemptId}` から `aiQuestionsHistory` 配列を取得します。
- `questionText` が `aiQuestionsHistory` 内のいずれかの `questionText` と **文字列として完全一致** する場合、そのエントリの `answerType` と `aiComment` を即座に返却します。
- キャッシュヒット時は `isFromCache: true` を付与し、`aiTurnCount` は増加させません。
- **意図**: 全く同じ質問を繰り返す場合の無駄なAPI呼び出しを防ぎつつ、AIの回答の一貫性を保証します。

**② ゲスト制限とログインの必須化・認証認可署名検証**
- AI質問のターン制限を `users/{uid}/dailyAiTurnCounts` にて正確に管理し、かつ安全に対話履歴（`attempts`）を保護・永続化する都合上、**ウミガメのスープ形式（AI判定プレイおよび真相自動判定）の開始時はログイン（認証必須）を必須**と定義します。未ログイン of ゲストユーザーは本プレイモードに挑戦できず、開始時にログイン画面へと誘導されます。
- クライアントからサーバーサイドAPI（`/api/attempt/ask-ai` または `/api/attempt/verify-truth`）へのリクエスト時には、必ずヘッダーに `Authorization: Bearer <ID_TOKEN>` を付与して送信します。APIサーバー側では、Firebase Admin SDK によるIDトークン署名検証（`admin.auth().verifyIdToken()`）を強制実行し、`attempts/{attemptId}` 内の `userId` とトークンの `uid` が完全に一致すること（本人確認）を検証し、なりすましや改ざんを確実にブロックします。

**③ ターン制限（1日同一クイズ20回制限）**

無料ユーザーには、同一クイズに対して1日あたり最大20回のAI質問ターン制限が適用されます。別セッション（Attempt）を作り直した場合でもカウントはリセットされず、クイズ単位で累積されます。

* **トラッキングと判定**:
  * ユーザーの `users/{uid}/dailyAiTurnCounts/{quizId}` ドキュメントから、本日の日付（`lastUpdatedDate === YYYY-MM-DD`）の `count` を取得します。
  * 日付が異なる場合、またはドキュメントが存在しない場合は、`count` を `0` として扱います（セルフリセット）。
  * 質問送信（キャッシュ未ヒット）時に `count >= 20` の場合は `limit-exceeded` 例外をスローします。
  * 質問が正常にAIによって判定された際、ドキュメントの `count` を `+1` インクリメントし、`lastUpdatedDate` を本日の日付にアトミック更新します。
* **有料プラン（プレミアム特典）の権限昇格対策**:
  * プレミアムプラン（有料）ユーザーは制限なし（無制限）で質問可能となります。
  * **セキュリティ要件**: クライアントから送信されたプラン情報やトークン内の偽装可能なカスタムクレームのみを信頼することはせず、サーバーサイドAPIで必ず `users/{uid}` ドキュメントの最新ステータス（データベースの値）を直接引き直してプラン情報を厳格に検証します。これにより、リクエストのパラメータ改ざんによるターン制限の不正バイパス（特権昇格）を完全に防止します。
* **キャッシュの扱い**:
  * 同一質問キャッシュ（完全一致）にヒットした場合は、AI呼び出しを行わないため、1日の質問カウントは消費されません。

**③ AIステートフル対話**
- AI API（Google Gemini等）呼び出し時は、`aiQuestionsHistory` に保存されている直近最大20回分（往復）の対話履歴を `Content[]` 形式にマッピングして `startChat` の `history` 引数に渡します。
  - 過去のプレイヤーの質問は `role: 'user'` としてマッピングします。
  - 過去のAIの回答は `role: 'model'` とし、その内容は `q.answerType` を対応する日本語表記（「はい」「いいえ」「関係ありません」「判断できません」のいずれか）に変換したものと、`q.aiComment` を改行で結合した文字列を設定します。
- これにより、AIは前後の文脈や指示代名詞（例：「その男は死にましたか？」「はい」の後の「彼には家族がいましたか？」の『彼』）を正しく文脈から解決し、高精度かつ自然な水平思考パズルのチャット判定を実現します。
- AIからの正常な応答フォーマット（Zodスキーマ検証）:
  ```typescript
  const aiResponseSchema = z.object({
    answerType: z.enum(['yes', 'no', 'irrelevant', 'unknown']),
    aiComment: z.string().optional(),
  });
  ```
  - Zodバリデーション失敗時（AIが予期外のフォーマットで応答した場合）は `answerType: 'unknown'` としてフォールバック処理します。

#### 1.5.3 UI設計仕様（Q&Aリストパネル）

プレイ画面のレイアウトは **2カラム構成** とし、ウミガメのスープ設問プレイ時の専用表示を行います。

```
┌────────────────────────────────────┬──────────────────────────┐
│       チャット入力エリア            │    Q&A 履歴リストパネル   │
│                                    │                          │
│  [問題文表示]                       │  Q: 男は死ぬ予定でした？  │
│                                    │  A: はい                 │
│  ────────────────────────────────  │  ──────────────────────  │
│  [過去の Q&A がチャットバブル形式    │  Q: 水に関係しますか？    │
│   で時系列表示]                     │  A: 関係ありません        │
│                                    │  ──────────────────────  │
│  [テキスト入力欄 / 送信ボタン]      │  Q: 男は一人でしたか？    │
│  残り質問数: 18/20 (無料ユーザー表示)│  A: 関係ありません        │
│                                    │  [←スクロール可能]       │
└────────────────────────────────────┴──────────────────────────┘
```

- **左カラム（チャットエリア）**: 質問と回答をチャットバブル（吹き出し）形式で時系列に表示します。
  - ユーザーの質問: 右寄せのバブル
  - AIの回答: 左寄せのバブル。回答タイプに応じてカラーコーディング（「はい」→緑、「いいえ」→赤、「関係ありません」→グレー）
  - キャッシュヒットの場合、回答バブルに「📋 既存の回答」バッジを表示する。
- **右カラム（Q&Aリストパネル）**: 全質問・回答ペアをシンプルなリスト形式で表示します。
  - 質問（Q）と回答（A）のペアを1行ずつ表示し、長い質問は省略記号（`...`）で切り詰める。
  - スクロール可能。最新の質問は常にリストの最上部（または最下部）に表示する。
- **残り質問数インジケーター**: 無料ユーザーのみ入力欄の下部に「残り質問数: N/20」を表示する。有料ユーザーには表示しない（∞表示も不要）。

#### 1.5.3 B2ハイブリッド自動真相判定処理フロー（真相の解答とハイブリッド判定）

プレイヤーからの「最終解答（真相 of 記述）」に対して、セキュアなサーバーサイドAPI（`/api/attempt/verify-truth`）において、登録必須キーワードの存在チェックによるAIバイパスと、AI（Gemini等）による自然言語判定を組み合わせた「B2ハイブリッド真相判定」を実行するフローです。

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant QP as クイズプレイ画面 (/quiz/[id]/play)
    participant AS as AttemptService (Server-side API Route)
    participant AI as AI Engine (Google Gemini API)
    participant DB as Firestore (Database)

    Player->>QP: 「真相を解き明かす」をクリック
    QP->>QP: 真相入力モーダルを表示 (最大1000文字)
    Player->>QP: 真相の要約をテキスト記述して送信
    QP->>QP: 送信中インジケータ表示、モーダル操作ロック

    QP->>AS: verifyTruth(attemptId, truthText) [Authorization: Bearer <ID_TOKEN> 付与]
    activate AS

    Note over AS: ①IDトークンの署名検証および本人確認<br>JWT 署名を検証し、userId がトークンの uid と完全一致するかチェック
    AS->>DB: attempts/{attemptId} ドキュメントを取得
    DB-->>AS: { quizId, userId }
    AS->>DB: quizzes/{quizId} から { aiContextDetails, explanation, questions } を取得
    DB-->>AS: { aiContextDetails, explanation, questions }

    Note over AS: ①正規化キーワードマッチング判定 (B2方式)
    AS->>AS: 提出回答と必須キーワードの正規化部分一致をチェック
    
    alt 登録必須キーワードがすべて含まれている場合 (AIバイパス即合格)
        Note over AS: AI呼び出しをバイパス（数ミリ秒で完了、APIコストゼロ）
        AS->>DB: トランザクション開始
        DB->>DB: attempts.aiTruthAttempts に結果を arrayUnion (isBypass: true)
        DB->>DB: attempts.completedAt にサーバータイムスタンプを設定
        AS-->>QP: { isCorrect: true, feedback: "お見事！真相の必須要素をすべて含んでいます！", isBypass: true }
    else キーワードが不足している場合 (AIフォールバック判定)
        Note over AS: ②AIによる自然言語判定にフォールバック
        AS->>AI: プロンプト送信 (aiContextDetails + プレイヤー回答 truthText)<br>「真相の核心を突いているか判定せよ」
        activate AI
        AI->>AI: 正誤判定およびフィードバックの生成 (自然言語)
        AI-->>AS: { isCorrect: boolean, feedback: string }
        deactivate AI

        AS->>DB: トランザクション開始
        DB->>DB: attempts.aiTruthAttempts に { id, truthText, isCorrect, aiFeedback, createdAt, isBypass: false } を arrayUnion
        
        alt isCorrect == true (正解合格)
            DB->>DB: attempts.completedAt にサーバータイムスタンプを設定
            AS-->>QP: { isCorrect: true, feedback }
        else isCorrect == false (不正解・差し戻し)
            AS-->>QP: { isCorrect: false, feedback }
        end
    end
    
    alt isCorrect == true (合格)
        QP->>QP: 華やかなクリア演出アニメーションを起動
        QP->>Player: 自動的に結果画面 (/quiz/[id]/result) へ遷移
    else isCorrect == false (不合格)
        QP->>QP: モーダルを閉じ、インラインにAIフィードバック(アドバイス)を警告枠表示
        QP->>Player: フィールドロック解除、質問プレイへ復帰可能に
    end
    deactivate AS
```

##### B2ハイブリッド自動真相判定ビジネスロジック詳細
* **セキュリティ**:
  APIキー保護と安全なプロンプト構築のため、AIへの判定リクエストは必ず Next.js API Route などのサーバーサイド（`AttemptService.verifyTruth`）から発行し、クライアントからのGemini APIへの直接通信はSecurity RulesおよびCORSで完全にブロックします。

* **B2ハイブリッド判定ロジック**:
  真相解答（`truthText`）の正誤判定には、プログラムによるキーワード検証と、AIによる自然言語理解の意味判定を併用した「B2ハイブリッド真相判定」を採用します。
  1. **正規化（Normalizer）処理**:
     表記揺れを極限まで低減するため、入力テキストと登録必須キーワード（`truthKeywords`）の両方に対して以下の正規化を行います。
     - 半角・全角のすべての空白文字・スペースの除去。
     - 英大文字の小文字化（`.toLowerCase()`）。
     - 全角英数記号の半角化。
  2. **AIバイパス（即時合格判定）**:
     作問時に登録されたすべての必須キーワード（`truthKeywords`）が、正規化された解答テキスト内に部分一致ですべて含まれている（全合致）場合、AIの呼び出しを行わずに即時合格（`isCorrect = true`, `isBypass = true`）と判定します。これにより、判定にかかる時間を数ミリ秒に短縮してUXを向上させるとともに、AI APIのコストをゼロにします。
  3. **AI判定へのフォールバック**:
     必須キーワードが1つでも不足している場合、AI（Gemini）による自然言語の意味判定にフォールバックします。AIは「裏設定（`aiContextDetails`）」および「解答・解説（`explanation`）」を参照し、プレイヤーが入力した `truthText` が表記揺れを吸収しつつ核心を捉えているかを総合判定します。

* **不合格（不正解）時のフィードバック設計**:
  単に「不正解」と返すのではなく、AIが「まだ解明されていない謎のヒント」や「考慮すべき矛盾点」をフィードバックテキスト（`aiFeedback`）としてプレイヤーに返します。これによりプレイヤーはそれを参考にチャット質問を重ねることができ、挫折を防ぐ極上のUXを提供します。

---

### 1.6 設問単体のブックマークおよびマイリスト追加フロー
ユーザーがクイズプレイ中または結果画面等から、特定の設問（Question）を個別でお気に入り登録（ブックマーク）したり、自身の作成したクイズリスト（問題集）に追加・削除するフローです。アトミックなトランザクションによりデータ整合性を担保します。

```mermaid
sequenceDiagram
    autonumber
    actor Player as プレイヤー
    participant QP as 設問表示コンポーネント (Play/Result UI)
    participant QService as QuestionService (src/services/question.ts)
    participant DB as Firestore (Database)

    alt 設問単体のブックマーク登録（トグルON）
        Player->>QP: 「設問をブックマーク」をクリック
        QP->>QService: toggleBookmarkQuestion(uid, questionId)
        activate QService
        QService->>DB: トランザクション開始
        DB->>DB: bookmarks ドキュメント作成 (targetType = 'question')
        DB->>DB: questions.bookmarksCount を +1 インクリメント (アトミック)
        QService-->>QP: 登録成功
        deactivate QService
        QP-->>Player: ブックマーク完了トースト表示

    else 設問単体のブックマーク解除（トグルOFF）
        Player->>QP: 「ブックマークを解除」をクリック
        QP->>QService: toggleBookmarkQuestion(uid, questionId)
        activate QService
        QService->>DB: トランザクション開始
        DB->>DB: bookmarks ドキュメント物理削除
        DB->>DB: questions.bookmarksCount を -1 デクリメント (アトミック)
        QService-->>QP: 解除成功
        deactivate QService
        QP-->>Player: ブックマーク解除トースト表示

    else 設問をマイリスト（問題集）に追加
        Player->>QP: 「マイリストに追加」をクリック (リストを選択)
        QP->>QService: addQuestionToList(listId, questionId)
        activate QService
        QService->>DB: トランザクション開始
        DB->>DB: quizLists.questionIds 配列に questionId を arrayUnion
        QService-->>QP: 追加成功
        deactivate QService
        QP-->>Player: マイリスト追加完了トースト表示
    end
```

---

## 3. 運用設計

システムの本番稼働フェーズにおけるデータ保護、セキュリティ、インデックス最適化、およびコンテンツモデレーションの運用方法です。

### 3.1 Firestore インデックス管理
Firestore のクエリ性能をミリ秒単位に維持し、かつ開発環境・本番環境でのインデックス定義の乖離を防ぐための管理方針です。

* **管理ファイル**: `firestore.indexes.json` をリポジトリのルートで一元管理します。
* **デプロイフロー**:
  - 開発時に新しい複合クエリ（例: `where('genre').orderBy('createdAt')`）が必要になった場合、ローカルの Firebase Emulator Suite または開発環境の Firebase Console が自動生成したインデックス用リンクから定義をコピーし、`firestore.indexes.json` に手動でマージします。
  - CI/CD パイプライン（GitHub Actions 等）において、`main` ブランチへのマージ成功時に Firebase CLI コマンド `firebase deploy --only firestore:indexes` を自動実行し、本番環境へ自動適用します。これにより、デプロイ漏れによる本番環境でのクエリ実行エラー（`FAILED_PRECONDITION`）を完全に排除します。

### 3.2 データベースのバックアップとリストア設計
災害、システムバグ、または悪意あるデータ改ざんからデータを保護するための自動バックアップおよび復旧設計です。

* **バックアップ設計**:
  - Firebase の Cloud Firestore Managed Backups または Cloud Storage へのエクスポート機能を使用します。
  - Cloud Scheduler を用いて、毎日午前2:00 (JST) にバックアップ実行関数（Cloud Functions）を起動します。
  - エクスポートされたデータは、アクセス権限が厳格に制御された専用の Cloud Storage バケット（`gs://quizeum-backups/`）に日別フォルダ（`YYYY-MM-DD/`）で保存します。
  - バックアップデータの保存期間（Lifecycle Policy）は 30 日間とし、それ以前の古いバックアップは自動削除します。
* **リストア（復旧）手順**:
  1. 万一の重大な障害発生時、復旧対象のバックアップ日時（フォルダ名）を特定します。
  2. 整合性を確保するため、必要に応じて一時的にアプリケーションをメンテナンスモードに移行（Webフロントエンドからの書き込みを拒否する Security Rules を一時デプロイ）。
  3. `gcloud firestore import gs://quizeum-backups/YYYY-MM-DD/` コマンドを実行し、データを復元します。
  4. 復元完了後、本番の Security Rules を適用し、メンテナンスモードを解除します。

### 3.3 Security Rules 監査と運用
悪意あるユーザーによるデータ破壊や他人のコンテンツ改ざんを確実に防ぐため、Firestore Security Rules のテスト・監査体制です。

* **自動テスト義務化**:
  - すべてのセキュリティルールは、Firebase Local Emulator Suite を用いてローカルで単体テストを実施します。
  - テストフレームワークには `@firebase/rules-unit-testing` を使用し、以下のシナリオを含むテストコードを記述します。
    - 未ログインのゲストがクイズを作成しようとした場合に拒否されること。
    - ログインユーザーが他人の作成したクイズ（`authorId != uid`）を更新・削除しようとした場合に拒否されること。
    - トランザクションなしに `playCount` などのカウンターのみを不正に大きく書き換えようとした場合に拒否されること。
  - すべての Pull Request において、GitHub Actions 上でルールテストが自動実行され、100%パスしなければマージをブロックします。
* **サーバサイドNGワード二重検証の強制**:
  - クライアントブラウザ（UI）でのNGワード検証は、快適なUXを提供するため「一次検知」と位置づけます。
  - セキュリティと健全性を担保するため、クイズの公開（`status == 'published'`）または更新時、Firestoreへの書き込みトランザクション内で Cloud Functions トリガーが起動し、サーバサイドで再度 `checkNGWords` を強制実行します。不適切表現がサーバ側で検知された場合、トランザクションは強制ロールバックされ、ドキュメント status は自動的に保留（`suspended`）に変更され、クリエイター宛てに警告通知（`quiz_review_warning`）がアトミックに送信されます。
* **定期監査**:
  - 四半期に一度、API仕様変更に伴うルールの乖離がないかをセキュリティエンジニアまたは開発リーダーが手動で監査し、不要になったワイルドカードアクセス権限（例: `allow write: if true;` 等の残存）がないか確認します。

### 3.4 通報保留コンテンツ審査フロー
ユーザーからの通報により自動的に保留状態（`status == 'suspended'`）に移行したコンテンツを、迅速かつ適切に処理するための運用フローです。

```
[ ユーザー通報(5回) ] 
       
       ▼ (自動)
[ status = 'suspended' (一時非公開化) ] ── [ 管理者審査キュー (AdminDashboard) へ登録 ]
                                                   
                            ┌─────────────────────┴─────────────────────
                            ▼ (モデレーション承認)                     ▼ (モデレーション却下)
                [ 永久非公開 / コンテンツ削除 ]          [ 公開復帰 (status = 'published') ]
                                                                       
                            ▼                                           ▼
                [ 作家へ警告メール自動送信 ]                 [ 通報カウンター (flagsCount) を 0 にリセット ]
```

* **管理者対応目標**: 保留キューに登録されてから 24 時間以内に一次審査を完了します。
* **意思決定基準**:
  - **削除（モデレーション承認）**: 著作権侵害、公序良俗に反する画像/表現、特定個人・団体へのハラスメント。
  - **復帰（モデレーション却下）**: 悪意あるユーザーによる組織的な虚偽通報、一般的な事実に基づくクイズで問題のないもの。

### 3.5 Firebase Storage 運用設計
クイズのカバー画像、設問画像、ユーザーアバター、ジャンル新設時のアイコンなど、様々なアセットがアップロードされる Firebase Storage の統合セキュリティ設計方針です。

* **共通サービスインタフェース**:
  - アセットのアップロードはフロントエンドで直接実行せず、`StorageService.uploadImage` を仲介して統一的な命名規則とバリデーションを適用します。
* **アセットパス命名規則**:
  - カバー画像: `/quizzes/{quizId}/cover_{timestamp}.png`
  - 設問参考画像: `/quizzes/{quizId}/questions/{questionId}_{timestamp}.png`
  - ユーザーアバター: `/users/{uid}/avatar_{timestamp}.png`
  - ジャンルアイコン: `/genres/{genreId}/icon_{timestamp}.svg`
* **容量・ファイル制限バリデーション**:
  - 最大アップロードサイズは `2MB` 以下に制限します。
  - 許容するファイル形式（MIME Type）は `'image/png', 'image/jpeg', 'image/gif'` のみとします。**[SEC-08対策]** SVG-based XSS脆弱性を防止するため、`'image/svg+xml'` (SVG形式) のアップロードは完全に禁止されています。
* **Storage Security Rules 設計**:
  - アップロードされた画像は全世界から読み取り可能（`allow read: if true;`）としますが、書き込みは認証済みの所有者のみに制限します。
  ```javascript
  match /users/{uid}/{allPaths=**} {
    allow write: if request.auth != null && request.auth.uid == uid;
  }
  match /quizzes/{quizId}/{allPaths=**} {
    allow write: if request.auth != null && request.resource.size < 2 * 1024 * 1024;
  }
  ```

---


### 3.6 アカウント削除時のデータ処理（即時Auth物理削除と非同期タスクキュー分割クレンジング・匿名化） [NEW]
認証済みユーザーが退会（アカウント削除：F-106）した際、ユーザー体験（UX）および「同じメールアドレスで即座に再登録したい」という要件を考慮し、申請を受理した同期フェーズにおいて**即座に Firebase Authentication からアカウントを物理削除**します。

退会ユーザーに紐づくクイズ、リスト、指摘レポート、リアクション、通知等は膨大な量に達する可能性があるため、Firestoreのアトミックバッチ書込（最大500件）上限によるエラーを防ぐため、**Cloud Tasksと連携した非同期ジョブ分割処理アーキテクチャ**を採用し、残されたデータのクレンジングおよび `users/{uid}` ドキュメント自体の物理削除はサーバーサイド（Cloud Functions）にて分割・遅延実行します。

#### 1. 退会受付と初期状態遷移（同期フェーズ：軽量・即時完了）
1. ユーザーが退会を申請すると、フロントエンドはセキュアな**サーバーサイドAPI（Next.js API Route）**に対して退会リクエストを送信します（Security Rulesによる権限喪失を防ぐため、クライアントSDKから直接 Auth 物理削除を行うのではなく、サーバー経由で手続きを行います）。
2. APIサーバー側で、Admin SDK特権を用いて `users/{uid}` ドキュメントの `deleteStatus` フィールドを `'delete_pending'` に変更します。
3. 続いてサーバー側（Admin SDK）から **Firebase Authentication の対象の `uid` を即座に物理削除**します。これにより、同一メールアドレスを使用した再サインアップが即座に解放されます。
4. サーバーサイドで **Cloud Tasks ジョブ** を作成し、退会タスクキュー（`quizeum-user-deletion-queue`）に `uid` を含めてジョブを登録し、クライアントへは即座に成功レスポンスを返します（フロントエンドはAuth削除を検知してログアウト・クリーンアップを完了します）。

#### 2. 非同期分割クリーンアップと状態遷移（非同期フェーズ）
Cloud Functions で動作するワーカー（`onDeleteUserJob`）が Cloud Tasks からジョブを受信し、以下のステップに沿って**ドキュメントを分割処理（Chunked execution）**します。

##### ステップ1: 作成したクイズ・リストの匿名化（存続）
* クイズ (`quizzes`) とクイズリスト (`quizLists`) コレクションから、`authorId == uid` のドキュメントを検索。
* 1バッチあたり最大100件のチャンクに分割し、アトミックバッチを用いて以下の通り作成者情報を書き換え（匿名化）：
  - `authorId` ➔ `"deleted_user"`
  - `authorName` ➔ `"退会済みユーザー"`
  - `authorAvatar` ➔ 退会ユーザー用のシステム規定デフォルトアバター画像URL
* クイズの公開状態は **`status = 'published'` および `isPublished = true` のまま完全に公開を維持**し、他のユーザーのプレイやリスト内への格納も存続させます。

##### ステップ2: 間違い指摘・通知・リアクションの匿名化（存続）
* 過去の送信指摘レポート (`feedbackReports`)、通知 (`notifications`)、およびリアクション (`reactions`) から、`reporterId`、`senderId`、`receiverId` が `uid` に一致するドキュメントを走査。
* これらも100件ごとのチャンクでアトミックに匿名化し、個人情報を完全に抹消しつつ、対話履歴や作家側の獲得統計データを保護します。
  - `reporterName`/`senderName` ➔ `"退会済みユーザー"`
  - 各種関連画像URL ➔ デフォルトURL

##### ステップ3: ユーザープロフィールおよびアバター画像の物理削除
* すべての関連データの匿名化およびクレンジング処理が完了したことをタスク内で確認後、Firebase Storage 内の該当ユーザー専用アバター画像ファイル（`/users/{uid}/avatar_*.png`）を物理削除します（デフォルト画像は除く）。
* 最後に、Firestoreの `users/{uid}` ドキュメント自体を物理削除します。これにより、退会処理に関わるすべてのデータクレンジングが完全に完了します。（※Firebase Authentication の物理削除は同期フェーズで完了済みです）。

##### 3. 退会処理中の過渡状態におけるセキュリティ制限とフォールバック表示
* **Firestore Security Rules**:
  * `users/{uid}` ドキュメントの `deleteStatus == 'delete_pending'` である間、第三者または未認証の接続による `private` 系データ（非公開バッジ、興味ジャンル等）への読み取りアクセスを完全に拒否します。
  * `allow read: if resource.data.deleteStatus != 'delete_pending' || request.auth.uid == uid;` のルールにより、過渡状態にあるプロフィールの漏洩を防ぎます。
* **画面（UI）でのフォールバック処理**:
  * プロフィール画面（`/profile/[uid]`）への直接アクセス時、該当ドキュメントの `deleteStatus` が `'delete_pending'` の場合、UIは「このアカウントは削除処理中です」とメッセージを表示、または404画面へフォールバックして遷移をブロックします。
  * リストや作成したクイズ内の作成者表示エリアでは、非同期ジョブ完了までの間も、画面側で `displayName` を「退会済みユーザー」、`avatarUrl` を退会ユーザー用デフォルト画像として擬似的に差し替えて表示するガード処理を行います。

##### 障害リトライと監視
* 途中のチャンク処理でFirestoreの通信エラー等が発生した場合、Cloud Tasksの自動リトライ設計（指数バックオフ、最大5回）に基づき、タスクは安全にロールバック・再試行されます。
* 異常により最大リトライを超過した場合は `deleteStatus` を `'failed'` に更新し、Google Cloud Monitoring で管理者アラートを発行します。

## 4. ログ設計

障害発生時の迅速な根本原因究明（RCA）と、システムの健全性監視のための多層ログ収集設計です。

### 4.1 クライアントエラー・アクティビティログ
ユーザーのブラウザ環境（Client-side）で発生したエラー情報を収集し、開発チームへ自動転送する設計です。

* **ログ収集基盤**: Sentry または同等のフロントエンド監視プラットフォームを Next.js に統合。
* **収集対象**:
  - React のエラー境界（Error Boundary）でキャッチされたレンダリングエラー。
  - Firebase JS SDK の通信エラー（特に `permission-denied` やネットワークタイムアウト）。
  - クライアント Zod バリデーションエラーの発生度。
* **メタデータ付与方針**:
  - 障害の再現性を高めるため、すべてのクライアントログには以下のコンテキストを自動付与します（ただし、パスワードやメールアドレスなどの個人情報はマスクする）。
    - 匿名化されたユーザーID（`hashed_uid`）。
    - ブラウザの User-Agent およびデバイス情報。
    - エラー発生直前の画面遷移履歴（Breadcrumbs）。
    - アプリケーションのリリースバージョン（Git Commit Hash）。

### 4.2 サーバサイド実行ログ
Cloud Functions for Firebase などのバックエンドで動作するプロセスの実行ログ設計です。

* **ログ出力標準**: `firebase-functions/logger` パッケージを使用し、構造化ログ（Structured JSON Log）形式で出力します。
* **ログレベルの使い分け**:
  - `logger.info()`: プロセスの正常開始・終了（バッチ処理コミット完了、定期集計完了等）。
  - `logger.warn()`: Zodバリデーションの一時的な失敗（下書き保存時）、NGワード自動検知による保存ブロック、リトライ可能な一時的なネットワークエラー。
  - `logger.error()`: トランザクションの連続失敗（ロールバック）、バックアップエクスポート失敗、同期バッチ処理における規定回数リトライアウト。
* **モニタリングとアラート**:
  - Google Cloud Logging のログバケットに収集。
  - `severity = ERROR` のログが 15 分間に 5 件以上発生した場合、Slack の開発者チャンネルおよび管理者へ即時アラート（Google Cloud Monitoring Alert）を通知します。

### 4.3 セキュリティ・監査ログ
不正アクセスの予兆や機密情報の漏洩リスクを早期に検知するための監査用ログ設計です。

* **監視イベント**:
  - **認可違反の急増**: 同一の `uid` または `IP` から、Firestore Security Rules で拒否されたアクセス（`permission-denied`）が 1分間に 10回以上発生した場合、パス・トラバーサルや脆弱性スキャンの予兆とみなして警告ログを発行。
  - **異常な大量書き込み**: クイズ作成やブックマーク登録が同一アカウントから短時間に連続実行（DoS行動・Botによる荒らし行為）された場合。
* **ログの不変性**:
  - 監査ログは改ざんを防ぐため、通常のアプリケーションエラーログとは隔離された、閲覧制限が極めて厳しいログストレージに保管し、1年間保管します。

### 4.4 パフォーマンスログ
要件定義書に定義された「表示速度 0.5 秒以内」「高負荷時エラー 0.1% 未満」をクリアし続けるためのパフォーマンス監視設計です。

* **計測ツール**: Firebase Performance Monitoring を適用。
* **主なカスタムトレース (Custom Traces)**:
  - `quiz_page_load`: クイズ詳細画面にアクセスしてから、インタラクティブに操作可能になるまでの時間。
  - `quiz_attempt_submit`: プレイ結果の送信（`saveAttempt`メソッド呼び出し）から、レスポンスが完了するまでの時間。
* **アラート閾値**:
  - ネットワーク遅延やFirestoreの競合により、`quiz_attempt_submit` の第95パーセンタイル（95%のプレイセッション）が 500ms（0.5秒）を超えた場合、動的にパフォーマンス警告チケットを発行し、インデックス再設計やクエリ最適化のトリガーとします。

---

## 5. エラーハンドリング設計

システムで予期せぬエラーが発生した際、ユーザーを迷わせず、データの整合性を守り抜くためのフロントエンドおよびバックエンドのハンドリング設計です。

### 5.1 例外体系の分類
発生する例外を5つの主要カテゴリに分類し、それぞれに対する明確な対応ポリシーを定義します。

| カテゴリ | 具体的な発生例 | キャッチ箇所 | エラーハンドリング・ポリシー |
| :--- | :--- | :--- | :--- |
| **一時的通信エラー (Network)** | 地下鉄移動中などの一時的なオフライン、Wi-Fi切断など。 | サービスレイヤーの共通通信クラス | UI上に「一時的なネットワークエラー」をトースト警告。データを `localStorage` に退避し、自動リトライを実行。 |
| **認証エラー (Authentication)** | トークン有効期限切れ、セッション無効化。 | Next.js ミドルウェア、Authコンテキスト | 実行中アクションを安全に中断し、現在のURLをクエリパラメータに同封して `/login` 画面へ強制リダイレクト。 |
| **認可エラー (Authorization)** | 他人のクイズ編集アクセス、管理者以外によるモデレーション実行。 | Firestore Security Rules 評価 (`permission-denied`) | 画面に「この操作を実行する権限がありません」とダイアログ表示し、3秒後にホーム画面へ自動リダイレクト。 |
| **バリデーションエラー (Validation)** | Zod検証失敗、NGワード自動検知。 | フロントエンド入力フォーム直前、保存前サービスメソッド | フォーム送信をブロック。エラーの発生した入力項目（タイトル等）を赤色で強調表示し、ヘルプテキスト（修正指示）を表示。 |
| **システムエラー (Server Error)** | Firestore の内部エラー、高負荷時の書き込み競合など。 | 各サービスメソッドの最外周 catch ブロック | ユーザーには「システムエラーが発生しました。時間をおいて再度お試しください」と汎用エラー画面を表示。開発ログに詳細なスタックトレースを出力。 |

### 5.2 一時エラー時リトライ設計とオフライン保護
プレイヤーの快適なクイズプレイ体験を保護するため、一時的な電波障害等による解答データ消失を防ぐ仕組みです。

* **自動リトライアルゴリズム**:
  - API呼び出し（特に `saveAttempt` や `updateLeaderboard`）で一時的なネットワークエラー（`code == 'unavailable'` 等）を検知した場合、即時にエラーとせず、自動でリトライを実行する。
  - リトライは **指数バックオフ (Exponential Backoff)** を採用し、最大3回（1回目: 1秒後、2回目: 2秒後、3回目: 4秒後）試行する。
* **オフライン保護（解答セッション退避）**:
  - 3回のリトライがすべて失敗、またはブラウザが完全にオフライン状態であることを検知した場合、現在の解答進捗（`Attempt` オブジェクトの生データ）を `localStorage` の退避領域（`quizeum_offline_attempts`）にアトミックにシリアライズして保存する。
  - 画面上部には「オフラインモードでプレイ中（結果は接続復旧時に自動送信されます）」というバナーを常時表示する。
  - ブラウザの `online` イベントを検知した際、バックグラウンドで `localStorage` に退避されているデータを自動抽出し、再度 `saveAttempt` を呼び出してバックエンドと自動同期し、同期完了後にローカル退避データを安全に削除する。

### 5.3 Zod バリデーションエラーの UI 表示仕様
クイズ公開時などの入力検証失敗において、ユーザーがどこを修正すべきか直感的に理解できるようにするための表示設計です。

* **検証タイミング**: フォーム送信（「公開する」ボタンクリック）時に、Zod スキーマ検証をフロントエンドで実行。
* **表示処理ロジック**:
  1. `quizPublishSchema.safeParse(formData)` を実行。
  2. 結果が不合格（`success == false`）の場合、`error.format()` からエラーリストを抽出。
  3. 各入力フィールド（例: `title`, `description`, `questions[0].questionText` 等）の状態管理変数に、それぞれ対応するエラーメッセージ（例: 「問題文は5文字以上で入力してください。」）をセットする。
  4. エラーが存在する入力フィールドのボーダーカラーを赤色（Tailwind: `border-red-500`）に変更し、フィールド下部に警告用テキストをアニメーション表示する。
  5. 最上部には「入力内容に不備があります。赤色の項目を確認してください」というグローバルトースト警告を表示し、最初のエラー項目まで画面を自動スクロール（Smooth Scroll）させる。

### 5.4 Firestore 認証・認可エラーへの対処
Firestore のルールによって書き込み・読み込みがブロックされた際の、適切なフォールバック処理です。

* **`permission-denied` (Firestore Code: 3) 発生時**:
  - フロントエンドのグローバルエラーハンドラー（または API 呼び出しクラスの最外周）でこれをキャッチ。
  - 単なるバグとしてのクラッシュを防ぐため、エラーダイアログ（Modal）を起動。
  - ダイアログには「データへのアクセス権限がないか、セッションが切断されました。再度ログインをお試しください」と表示し、「ログイン画面へ」ボタンを設置。ボタンクリックで `/login?redirect=現在のパス` に遷移させる。
* **`not-found` (Firestore Code: 5) 発生時**:
  - 削除済みのクイズ詳細ページへ直接URL入力でアクセスされた場合などに発生。
  - クライアント側で `getQuiz` が `null` または `not-found` を検知した際、即座にカスタムの 404 エラー画面（Next.js の `not-found.tsx`）を描画。
  - 画面上に「お探しのクイズは削除されたか、公開が終了しています」というメッセージを表示し、「ホームへ戻る」ボタンを設置してユーザーの離脱を防止する。

---

## 6. タグ・ジャンルの仮想統合に関する運用・機能設計 (ユーザー主導仮想統合アプローチ)

NoSQLデータベース Firestore において、クイズ（`quizzes`）やユーザー（`users`）ドキュメントのタグ・ジャンル区分を直接一括で書き換えるバッチ処理は、書き込みコストが高く、権限管理（Security Rules）も複雑になりがちです。
本システムでは、データの物理的な書き換え（バッチ処理）を**一切不要**とし、一般ユーザーまたはクイズ作成者自身が画面上から瞬時にタグやジャンルを統合・マージできる、NoSQLに最適化された極めて軽量な**「仮想統合 (Virtual Merge)」**アーテクチャを採用します。

### 6.1 仮想統合基本概念
表記揺れや重複しているタグ（例: `#react`, `#reactjs`, `#React`）やジャンルがある場合、データベース上のクイズドキュメントに紐付いているタグ情報は変更せず、マスタ側のマージ関係を表現する `canonicalId`（正規ID）を参照して、クエリ時に自動展開・名寄せを行います。

1. **表記揺れの検知とマージ**:
   - `metadata_tags` または `metadata_genres` マスタにおいて、代表する一つの正規化ドキュメント（例: `id = 'react'`）を決定します。
   - 他の重複タグ（例: `id = 'reactjs'`) のドキュメントに `canonicalId = 'react'` をセットし、正規タグへマージ（統合）します。
2. **クエリ時の自動展開**:
   - ユーザーが「#react」タグでクイズを検索した際、APIサービスレイヤーは自動的に `metadata_tags` のマージ関係を参照します。
   - `id = 'react'` に統合されているすべてのタグID（`['react', 'reactjs']`）を抽出し、クエリ時に `in` または `array-contains-any` を使用して展開します。
3. **高速検索**:
   - Firestore に対し、`where('tags', 'array-contains-any', ['react', 'reactjs', 'react-js'])` クエリを発行してクイズを高速に一括検索します。これにより、クイズ側のデータを書き換えることなく、表記揺れを完全に吸収した仮想統合検索を実現します。

---

### 6.2 メタデータマスタの設計

動的なマージ関係を表現するための、メタデータコレクションの型定義です。一般ユーザーにも解放されるため、セキュリティとシンプルさを両立させます。

#### 6.2.1 `metadata_genres` コレクション (ドキュメントID: ジャンルID、例: `'programming'`)
ジャンルの仮想統合と表示情報を管理します。

| フィールド名 | 論理型 / 物理型 | 必須 / 任意 | 初期値 / 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | 必須 | ドキュメントID | ジャンルの識別名（例: `'programming'`） |
| `displayName` | `string` | 必須 | 最大20文字 | 画面表示用の正式名（例: `'プログラミング'`） |
| `iconImageUrl` | `string` | 必須 | Firebase Storage画像URL | 表示に使用する正方形のアイコン画像URL（SEC-08対策のためSVG形式は排除され、PNG/JPEG/GIFのみ許容） |
| `canonicalId` | `string` | 任意 | `null` / ジャンルID参照 | 統合先のジャンルID。自身が存続ジャンルの場合 `null` |
| `mergedGenreIds` | `array (string)` | 必須 | `[]` | 自身に統合された古いジャンルIDのリスト（引き当て高速化用） |

#### 6.2.2 `metadata_tags` コレクション (ドキュメントID: 小文字統一のタグID、例: `'reactjs'`)
フリータグのユーザー主導によるマージ・表記揺れ吸収を管理します。

| フィールド名 | 論理型 / 物理型 | 必須 / 任意 | 初期値 / 制約 | 説明 |
| :--- | :--- | :--- | :--- | :--- |
| `id` | `string` | 必須 | 空白排除・小文字化 | 表記揺れを防ぐため小文字統一ID（例: `'reactjs'`） |
| `tagName` | `string` | 必須 | 正規表記文字列 | 正式な画面表示用の表記名（例: `'React'`） |
| `canonicalId` | `string` | 任意 | `null` / タグID参照 | 統合先（マージ先）タグID。自身が存続タグの場合 `null` |
| `mergedTagIds` | `array (string)` | 必須 | `[]` | 自身に統合された古いタグIDのリスト（引き当て高速化用） |
| `createdBy` | `string` | 必須 | `users.id` 参照 | このタグマスタ（またはマージ関係）を作成したユーザーの `uid` |
| `updatedAt` | `timestamp` | 必須 | `request.time` | 最終更新・マージ適用日時 |

---

### 6.3 ユーザー主導統合・マージ機能設計

ユーザーがクイズを整理する際、画面から直接「タグAをタグBに統合する」と指示した場合の API と状態遷移です。

#### 6.3.1 タグマージAPI (`mergeTags` サービスメソッド)

* **実行権限**: 認証済みユーザー全員（または、一定プレイ回数以上のユーザー、クイズ作成者など）
* **インターフェース**:
  ```typescript
  async function mergeTags(sourceTagId: string, targetTagId: string, userId: string): Promise<void>
  ```
* **処理ロジック**:
  1. **マスタの循環参照防止チェック**:
     - `targetTagId` の `canonicalId` が `sourceTagId` を指していないかを検証（AをBにマージし、かつBをAにマージするような無限ループを防ぐ）。
  2. **アトミック更新 Firestore トランザクション**:
     - `metadata_tags/{sourceTagId}` ドキュメントを更新:
       - `canonicalId = targetTagId`
       - `updatedAt = request.time`
     - `metadata_tags/{targetTagId}` ドキュメントを更新:
       - `mergedTagIds` 配列に `sourceTagId` を追加 (`arrayUnion`)
       - もし `sourceTagId` 自体がすでに別のタグを吸収している場合（`mergedTagIds` が空でない場合）、その配下の子タグもすべて `targetTagId` の `mergedTagIds` にマージし、インデックスを書き換える。
* **メリット**:
  - このトランザクションはわずか 2 ドキュメントの書き込みで完了するため、実行時間は 0.1 秒未満、Firestoreの書き込みコストは極小です。クイズデータ（`quizzes`）は1件も書き換えないため、ユーザーが実行してもシステムに一切負荷がかかりません。

---

### 6.4 クエリ時展開同義語解決機能設計

データの物理的な更新をしない代わりに、検索や一覧表示をする際にシステム側で自動的にマージ関係を解決してクエリを実行します。

#### 6.4.1 タグ別クイズ一覧取得 (`getQuizzesByTag` 処理ロジック)

* **処理フロー**:
  1. ユーザーが `#react` のタグページを開く、またはタグで検索を実行する。
  2. サービスレイヤーは、まず対象タグ `metadata_tags/react` を取得する。
  3. 取得したマスタの `mergedTagIds` 配列（例: `['reactjs', 'react.js']`）を取り出す。
  4. 検索クエリ用の対象タグIDリストを構築する:
     `const targetTags = ['react', ...mergedTagIds];` (例: `['react', 'reactjs', 'react.js']`)
  5. Firestore にて、`in` または `array-contains-any` 演算子を用いてクイズをクエリ取得する:
     ```typescript
     const q = query(
       collection(db, 'quizzes'),
       where('status', '==', 'published'),
       where('tags', 'array-contains-any', targetTags), // 同義語リストを array-contains-any クエリで一発取得
       orderBy('createdAt', 'desc')
     );
     ```
* **制限と対応**:
  - Firestore の `array-contains-any` 演算子は一度に最大 30 件の要素しか指定できません。そのため、一つの代表タグにマージできる子タグの上限は 29 件となります。
  - 一般的な利用において、一つのタグに対する表記揺れが 30 件を超えることは極めて稀なため、この制限は実用上問題ありません。万一超える場合、画面側でサジェスト時に正規化を強く促すバリデーションを設けます。

#### 6.4.2 ジャンル別クイズ一覧取得 (`getQuizzesByGenre` 処理ロジック)

* **処理フロー**:
  1. ユーザーが「プログラミング (`'programming'`)」ジャンルを選択する。
  2. `metadata_genres/programming` を取得し、`mergedGenreIds`（例: `['prog', 'code']`）を取得。
  3. 検索対象ジャンルリスト `['programming', 'prog', 'code']` を用い、同様に `in` クエリを実行する:
     ```typescript
     where('genre', 'in', ['programming', 'prog', 'code'])
     ```
  4. クイズ側の非正規化ジャンル名を一切書き換えることなく、統合前後すべてのクイズが「プログラミング」ジャンル一覧に正しく瞬時に表示されます。

---

### 6.5 ユーザー主導統合を支える Security Rules 設計

一般ユーザーが安全にタグやジャンルのマージ関係（`canonicalId`）を更新できるようにしつつ、いたずらや不正な書き換えを防止するための Security Rules 定義です。

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    
    // タグメタデータのセキュリティルール
    match /metadata_tags/{tagId} {
      allow read: if true; // タグ定義は誰でも閲覧可能
      
      // 新規タグ登録は認証ユーザーなら誰でも可能
      allow create: if request.auth != null 
                    && request.resource.data.id == tagId
                    && request.resource.data.canonicalId == null
                    && request.resource.data.mergedTagIds == [];
      
      // マージ（canonicalId）の更新、循環参照を防ぐ Zod / API バリデーションを通すため
      // ユーザー情報と更新可能フィールドを限定する
      allow update: if request.auth != null
                    && request.resource.data.id == resource.data.id
                    && (
                      // canonicalId を新規にセットする更新を許可
                      (resource.data.canonicalId == null && request.resource.data.canonicalId != null)
                      || 
                      // 自身にマージされたタグIDリスト(mergedTagIds)のアトミックな追加を許可
                      (request.resource.data.mergedTagIds.hasAll(resource.data.mergedTagIds))
                    );
    }

    // ジャンルメタデータのセキュリティルール
    match /metadata_genres/{genreId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update: if request.auth != null;
    }
  }
}
```

### 6.6 本アプローチによる劇的なメリット
1. **驚異的なパフォーマンス**: クイズプレイや作成時のデータ整合性へのオーバーヘッドがゼロであり、読み込み・検索が常にミリ秒単位で完了します。
2. **コストの極小化**: クイズが100万件に達したとしても、タグ統合に必要なFirestoreの書き込みコストはわずか2ドキュメント分（数円以下）であり、バッチ処理によるデータベースの全スキャンコストを完全に排除できます。
3. **コミュニティ主導の成長**: 運営の手間を増やすことなく、ユーザー自身が表記揺れや重複タグを自然に整理・統合していく健全な情報エコシステムが実現します。

### 6.7 コミュニティ参加型モデレーション・マージリクエスト投票ガバナンス設計
代表タグやジャンルのマージ、新規追加における悪意ある書き換えや不適切な整理を防ぐため、モデレータ（貢献度の高いユーザー）による分散型承認投票フローを適用します。

#### 6.7.1 コミュニティ・モデレータ投票資格定義
シビルアタック（Botによる世論工作）を防止するため、投票・起案権を持つ「モデレータ」には、実績に基づく信頼スコアと権限資格を割り当てます。
- **モデレータ（Moderator）**: 信頼スコアが `totalPlayCount >= 30` かつ `createdQuizzesCount >= 3` に達したユーザー。
- **シニアモデレータ（Senior Moderator）**: さらに高いコミュニティ貢献度（信頼スコア一定値以上）を持ち、投票の重みが「2倍 (x2)」となります。

#### 6.7.2 `mergeRequests` コレクションの導入
マージ提案、投票数、可決時の自動決議ステータスをアトミックに管理します。

#### 6.7.3 トランザクション・ライフサイクルフロー
1. **マージリクエストの起案 (`createMergeRequest`)**:
   - 起案者（モデレータ）が `sourceId`（統合元）と `targetId`（統合先）を指定して起案。起案時点で自動的に賛成1票（重み付き）が加算されます。
2. **投票処理と自動適用 (`voteMergeRequest`)**:
   - モデレータ資格ユーザーが「賛成 👍 / 反対 👎」を投票。
   - **可決条件**: 重み付き賛成票が `5票以上` に達し、かつ賛成率が `70%以上` である場合。
     - トランザクション内で `status` を `'approved'` に更新。
     - アトミックにマスタデータを書き換えます（`metadata_tags/{sourceId}.canonicalId = targetId`, `metadata_tags/{targetId}.mergedTagIds.arrayUnion(sourceId)`）。
   - **否決条件**: 反対票が `3票以上`（重み付き）に達するか、起案から `7日間` 経過しても可決条件を満たさなかった場合。
     - `status` を `'rejected'` に更新し、マスタデータは変更せず終了します。

#### 6.7.3.1 過去のクイズデータ一括書き換えバッチ（方針A）と対策設計
マージが可決（`status == 'approved'`）された際、検索性能を最速に維持するため（Read重視のNoSQL鉄則）、過去のクイズドキュメントの `canonicalTagIds` を非同期で一括更新します。大量ドキュメントの更新競合やデータ破損リスクを排除するため、以下の**4つの対策設計**を適用します。

##### 1. 分割実行によるタイムアウト回避と移行完了検知（Chunked Execution）
* **問題**: 数千〜数万件のクイズドキュメントを一度に更新すると、Firestore バッチの上限（500件）や Cloud Functions の実行制限（9分）に衝突します。
* **対策**: **Cloud Tasks を用いた「Cursor型再帰呼び出し」**を採用。1回の呼び出しにつき **最大100件** をクエリ・更新し、完了後に次の100件を処理する新規タスクを Cloud Tasks キューに登録して遅延起動（再帰）させます。リソースと時間を極小化しつつ、数万件でも完全に処理しきります。**移行完了の自動検知**: 次の100件のクエリで取得結果が `0` 件だった（全件の書き換えが完了した）時点で、`mergeRequests.migrationStatus` を `'completed'` に自動更新し、ジョブを正常終了します。

##### 2. 同時編集競合の防止（楽観的排他トランザクション）
* **問題**: システムがバックグラウンドでタグを書き換えているまさにその瞬間に、クイズの作成者がクイズ編集画面から同一のクイズを保存した場合、書き込み競合（先祖返り）が発生します。
* **対策**: 書き換えバッチ処理においても、Firestore の **アトミックトランザクション（Transactions）** を使用。ドキュメントの `updatedAt` を検証し、処理中の競合が発生した場合は処理を自動リトライ・退避させ、整合性を守ります。

##### 3. データ移行中の検索フォールバックとセーフガード（過渡状態の保護）
* **問題**: 再帰バッチの開始から完了までの数分間、一部のクイズが正規タグID（`targetId`）に更新済みで、残りが旧タグID（`sourceId`）のままという「移行中の過渡状態」が発生し、検索結果に一時的な漏れが生じます。また、万一移行タスクが途中でクラッシュした場合、フォールバック検索が永続化してシステム全体のパフォーマンスが低下します。
* **対策**: マージ可決時に `mergeRequests.migrationStatus` を `'processing'` に設定。移行完了（`'completed'`）するまでの間、検索 API は一時的に `array-contains-any` で新旧両方のタグを検索するフォールバックロジックを起動します。移行完了後は自動的に最速の `array-contains` 単一等価クエリへ戻します。**タイムアウトセーフガード**: 移行開始から `24時間` が経過しても `'processing'` のままの場合は、強制的に `'failed'` ステータスに遷移させ、Google Cloud Monitoring でシステム管理者に警告アラートを発行します。

##### 4. originalTags 不変フィールドを用いたデータ復旧（ロールバック設計）
* **問題**: モデレータのミスやシビルアタック（悪意ある工作）で不適切なマージが可決され、過去の全データが誤って上書きされ、元に戻せなくなるリスク。
* **対策**: クイズドキュメントに、作成時にユーザーが入力した生のオリジナルタグ配列を保持する **`originalTags`（不変・Read-Only）** を保持。`canonicalTagIds` はこれに基づく二次算出フィールドと定義。万一の誤マージ時には、管理者がマージをロールバックすることで、`originalTags` から正しい正規IDを再計算して一括再更新する復旧ジョブをキックできます。

#### 6.7.4 セキュリティを担保するルール設計 (Security Rules)
```javascript
// mergeRequests コレクションのセキュリティルール
match /mergeRequests/{requestId} {
  allow read: if true;
  
  // 起案: 認証済みでモデレータ資格を持つユーザーのみ許可、かつ初期ステータスを強制制約
  allow create: if request.auth != null
                && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.createdQuizzesCount >= 3
                && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.totalPlayCount >= 30
                && request.resource.data.status == 'pending'
                && request.resource.data.votesForCount == 1
                && request.resource.data.votesAgainstCount == 0
                && request.resource.data.votedUserIds == [request.auth.uid]
                && request.resource.data.targetType in ['tag', 'genre'];
                
  // 投票と適用の安全な実行:
  // 投票による得票数のインクリメントや、条件可決時マスタ自動更新といった複雑かつ特権的なデータ結合処理は、
  // クライアントからの直接の書き換え（allow update: if false;）を拒否し、
  // Firebase Cloud Functions (HTTPS Callable API) からサーバサイド特権 Admin SDKでトランザクションを実行します。
  // これにより、クライアントからの不正なステータス変更やアトミックインクリメント偽装を物理的に遮断します。
  allow update: if false;
  allow delete: if false; // 投票・合意履歴の完全性を保護するため、削除は一切禁止
}
```

---

### 6.8 タグ・ジャンルの新規作成におけるバリデーションと運用設計

マージ統合といった事後名寄せモデレーションを効率化し、最初から表記揺れを極限まで抑え込むための、新規作成時（投稿・編集システム仕様）および申請承認運用プロセスを定義します。

#### 6.8.1 新規タグの作成フローと表記揺れ自動抑制

ユーザーはクイズの新規作成・編集時に新しいタグを自由に起案できますが、以下3層のバリデーションとサジェストUIによって重複を水際で防止します。

##### 1. 空白排除と小文字標準化による「自動名寄せ (Normalizer)」
ユーザーが `#React JS` や `#REACT_JS` などと入力した場合、フロントエンドおよび API サービスレイヤーは自動的に以下の整形処理 (Normalizer) を行い、タグの一意なIDである `id` を決定します。
* **整形仕様**:
  - 文字列全体のトリム処理
  - すべてのアルファベットを小文字に統一 (`.toLowerCase()`)
  - 半角スペース、全角スペース、および記号（`_`, `-`, `.`, `/`, `#` 等）を完全に排除。マルチバイト日本語（ひらがな・カタカナ・漢字など）を誤って排除しないように、記号とスペースのみをピンポイントで排除する正規表現（`.replace(/[\s!"#$%&'()*+,\-./:;<=>?@\[\\\]^_\`{|}~]/g, '')`）を使用します。
  - 例: `「React.js」` ➔ `id = 'reactjs'`、`「REACT JS」` ➔ `id = 'reactjs'`、`「#リアクト」` ➔ `id = 'リアクト'`
* **自動アタッチ判定**:
  - 生成された `id` が `metadata_tags` コレクションにすでに存在する場合、システムは新規タグの作成をスキップし、**自動的に既存タグを参照**します。クイズカード等の画面表示は、マスタに登録されている正規表記名 (`tagName`、例: `'React'`) に自動補正されて描画されます。

##### 2. 類似タグの検索とサジェスト警告（水際対策）
ユーザーが入力したタグIDがマスタに存在しない場合、システムは文字列の類似度（部分一致、前方一致、レーベンシュタイン距離などの簡易アルゴリズム）を用いて類似する既存タグ（例: `'reactjs'` に対してすでに `'react'` や `'reactnative'` が存在する場合）を検索します。
* **UIでの誘導仕様**:
  - 類似するタグが検知された場合、クイズ作成フォームのタグ入力下部に **「推奨: 類似するタグ #React が既に存在します。新しいタグを作成する代わりに、既存のタグを使用することをお勧めします。」** というサジェスト警告を表示します。
  - これにより、同一概念の微妙に異なるタグが乱立するのを、ユーザーの意識面から強力に抑制します。

##### 3. 完全に新しいタグの登録
類似するタグがなく、本当に新しいトピックであると判断された場合のみ、ユーザーは新規タグを登録できます。
* **タグ登録処理**:
  - `metadata_tags` コレクションに `id = '正規化ID'`, `tagName = 'ユーザーが入力した文字列'`, `canonicalId = null`, `mergedTagIds = []`, `createdBy = uid` で自動登録されます。
  - この処理は `QuizService` のクイズ作成・更新トランザクションの中に内包され、アトミックに実行されます。

---

#### 6.8.2 新規ジャンル大カテゴリ申請承認運用フロー (100% コミュニティ完結設計)

ジャンルカテゴリは、ユーザー画面の主要ナビゲーション、アイコンUI、および詳細検索フィルタの構造に直結する**「システム共通大カテゴリマスタ」**です。これを一般ユーザーが自由に新規作成できるようにすると、プラットフォーム全体の統一感が崩れ、著しく検索性が低下します。
しかし、本システムは管理者1人で開発・運営しているため、管理者による手動承認やアイコン設定などの「人的オペレーションコスト」を完全に排除する必要があります。

そこで、新ジャンルの新設は、画像アイコンのアップロード機能とモデレータ投票を組み合わせ、**「基準をクリアした時点でシステムが動的にジャンルをアクティブ化しマスタ登録、システム全体に公開する」という、完全にユーザーコミュニティの力だけで完結する自律型DAO調フロー**を構築します。

```
[ ユーザー ] ── 起案 (ジャンルID/表示名、正方形アイコン画像を Storage へアップロード)
                      
                      ▼
        [ genreRequests コレクションへ登録 (status = 'pending') ]
                      
                      ▼ (モデレータ投票による自治)
        [ 投票期間 (賛成 5票以上、賛成 80%以上で可決) ]
                      
                      ▼ (条件達成時にトランザクションで自動実行)
       [ metadata_genres にドキュメントを自動作成 (isActive = true) ]
                      
                      ▼ (即座に自動反映)
       [ ホーム画面・ナビゲーション・投稿画面に自動反映 (管理コストゼロ) ]
```

##### 1. ジャンル新設申請と画像アップロード (`submitGenreRequest` サービス)
- **権限**: 認証済みユーザー全員
- **仕様**: ユーザーは、「こんなジャンルのクイズを投稿したいが、適当なジャンルがない」場合に、希望するジャンルID（英語物理キー）、日本語表示名、および説明を入力し、さらに**そのジャンルを象徴する「正方形の画像アイコン（PNG/JPEG/GIF形式、SVGは不可）」を Firebase Storage にアップロード**します（SVG-based XSS防御のためSVG形式は完全排除されました）。
  - **Storageパス**: `genre-icons/{uid}_{timestamp}.png`
- **データ作成**:
  - `genreRequests` コレクションに以下の形式で新規リクエストドキュメントを保存します。
    - `id`: 自動割り当てID
    - `genreId`: `string` (希望する物理ID、例: `'retro-games'`)
    - `displayName`: `string` (例: `'レトロゲーム'`)
    - `iconImageUrl`: `string` (アップロードされた Storage の公開URL)
    - `status`: `'pending'`
    - `votesForCount`: `1` (起案時に自動で賛成1票)
    - `votesAgainstCount`: `0`
    - `votedUserIds`: `[requesterId]`
    - `createdAt`, `updatedAt`: `request.time`

##### 2. モデレータ投票およびアトミック自動適用 (`voteGenreRequest` サービス)
- **投票権限**: モデレータ資格ユーザー (`totalPlayCount >= 30` かつ `createdQuizzesCount >= 3`)
- **トランザクション処理**:
  1. `genreRequests/{requestId}` を取得し、`status == 'pending'` であることを確認します。
  2. `votedUserIds` に `voterId` が含まれていないことを検証します（二重投票防止）。
  3. `votesForCount` (または `votesAgainstCount`) をインクリメントします。
  4. **自動適用判定（可決条件）**:
     - 賛成票 of 累計 `votesForCount >= 5` に達し、かつ総投票数に対する賛成率 `votesForCount / (votesForCount + votesAgainstCount) >= 0.8`（80%以上）の場合:
       - `genreRequests.status` を `'approved'` に更新します。
       - **同一トランザクション内にて、`metadata_genres` マスタデータを自動作成・有効化**:
         - `id`: `request.genreId` (例: `'retro-games'`)
         - `displayName`: `request.displayName` (例: `'レトロゲーム'`)
         - `iconImageUrl`: `request.iconImageUrl`
         - `canonicalId`: `null`
         - `mergedGenreIds`: `[]`
         - `isActive`: `true`
         - `createdAt`, `updatedAt`: `request.time`
       - 非可決時（否決決定時または期限切れ時）のクリーンアップとして、Storageの申請用画像を安全に破棄するバッチをキックします。

## 7. 信頼スコア (Reputation Score) およびゲーミフィケーション設計

### 7.1 設計思想とスコアモデル

前セクションで設計した「モデレータ投票によるタグ・ジャンル統合ガバナンス」において、**投票権限をごく一部の固定メンバーに限定するとコミュニティの活性度が低下し、また管理者（開発者）が介入しなければならないリスク**が生じます。

この問題を解決するため、「信頼スコア (reputationScore)」を導入します。スコアはユーザーのコミュニティへの貢献度を定量化した値であり、以下の目的で使用します。

| 目的 | 説明 |
|---|---|
| **動的モデレータ権限** | 固定条件ではなく、スコアの閾値でモデレータ資格を動的に付与・剥奪します。 |
| **投票の重み付け** | スコアが高いほど投票の影響力が大きくなります（加重投票）。 |
| **スパム抑止** | 低スコアユーザーによる大量申請や投票操作を抑制します。 |
| **コミュニティの可視化** | プロフィールへのスコア表示でメンバーの貢献を称えます。 |

---

### 7.2 信頼スコアの計算モデル

信頼スコアは、**ユーザーの行動ごとに定義されたポイントを加算・減算することで、日次再計算バッチまたはイベント駆動で計算**されます。

#### 7.2.1 加算イベント一覧

| イベントID | イベント内容 | ポイント | 日次上限 | 通算上限 |
|---|---|---:|---:|---:|
| `QUIZ_CREATED` | クイズを公開する | +10 | +50 | なし |
| `QUIZ_PLAY_RECEIVED` | 自作クイズがプレイされる | +1 | +30 | なし |
| `QUIZ_GOOD_RATING` | 自作クイズが 👍（良問）評価を受ける | +5 | +20 | なし |
| `REPORT_VALIDATED` | 送信した間違い指摘が事実として承認される（報告者） | +3 | +15 | なし |
| `VOTE_PARTICIPATED` | タグ/ジャンルの統合マージ投票に参加する | +2 | +10 | なし |
| `VOTE_CORRECT` | 投票した結果が多数派として最終決定と一致する | +3 | +15 | なし |
| `MERGE_REQUEST_APPROVED` | 自作マージリクエストが可決される | +20 |  | なし |
| `GENRE_REQUEST_APPROVED` | 自作ジャンル新設申請が可決される | +30 |  | なし |
| `PLAY_STREAK_7DAY` | 7日連続でプレイ（ログイン＆完遂）を達成する | +10 |  | なし |

#### 7.2.2 減算イベント一覧

| イベントID | イベント内容 | ポイント | 日次上限 |
|---|---|---:|---:|
| `QUIZ_DELETED_BY_REPORT` | 自作クイズが通報・審査により物理削除または保留化される | -30 |  |
| `VOTE_SPAM_DETECTED` | 短時間の大量投票がシステムにより不正検知される | -50 |  |
| `MERGE_REQUEST_REJECTED` | 自作マージリクエストが否決される | -5 |  |
| `GENRE_REQUEST_REJECTED` | 自作ジャンル申請が否決される | -10 |  |
| `QUIZ_TAG_OVERRIDDEN` | 自作クイズに設定したタグがコミュニティ投票で削除・上書きされる（1タグにつき） | -2 | -10 |
| `QUIZ_GENRE_OVERRIDDEN` | 自作クイズのジャンルがモデレータ投票で変更される | -5 |  |
| `QUIZ_REVIEW_NEGATIVE` | 自作クイズの良問率が週次で閾値 30% を下回り「要改善」となる | -10 |  |

> **備考**: スコアの下限は `0` であり、マイナスにはなりません。  
> **タグ上書き減算設計意図**: 大幅な表記ズレやモデレーション誤りによるタグ設定は、クイズの品質・発見性を損なうため、軽微な減算で適切なフィードバックを行います。なお、仮想統合（シノニム展開によるマージ）は統合の正常運用であるため、上書き減算の対象外とします。

---

### 7.3 モデレータ権限の動的付与

固定の達成条件（`totalPlayCount >= 30` 等）を廃止し、**信頼スコアによるリアルタイム自動判定**へ移行します。

#### 7.3.1 権限ティアー定義

| ティアー | `reputationScore` 閾値 | 付与される権限 |
|---|---:|---|
| **Newcomer** | 0 〜 49 | クイズ投稿・プレイ・いいね・評価投票 |
| **Contributor** | 50 〜 149 | 上記 + タグ/ジャンル申請起案権 |
| **Moderator** | 150 〜 499 | 上記 + タグ/ジャンル統合マージへの投票参加権 |
| **Senior Moderator** | 500 以上 | 上記 + 投票の重みが「2倍 (x2)」となる加重投票権 |

> **設計思想**: モデレータ資格の取得・剥奪は、スコア再計算後にバッチまたはトランザクション内で自動更新されます。管理者による手動操作は不要です。

#### 7.3.2 モデレータ資格の自動更新ロジック

```typescript
// バッチ処理または投票トランザクション完了時に呼び出し
function resolveModerationTier(reputationScore: number): ModerationTier {
  if (reputationScore >= 500) return 'senior_moderator';
  if (reputationScore >= 150) return 'moderator';
  if (reputationScore >= 50)  return 'contributor';
  return 'newcomer';
}

// users ドキュメント更新
await userRef.update({
  reputationScore: newScore,
  moderationTier: resolveModerationTier(newScore),
  updatedAt: FieldValue.serverTimestamp(),
});
```

---

### 7.4 加重投票 (Weighted Vote) 設計

「Senior Moderator（スコア 500 以上）」は、投票時に重みが「x2」となります。これにより、長期間コミュニティに貢献してきたメンバーの意見をより正確に反映させます。

#### 7.4.1 有効票数の計算方法

投票の可決判定は、**生票数 (rawVotes) ではなく重み付き票数 (weightedVotes)** で行います。

```
weightedVotesFor = Σ ( votingWeight(voter) )
  ただし vote.type == 'for' のみ

votingWeight(voter):
  - moderationTier == 'senior_moderator' ➔ weight = 2
  - それ以外                            ➔ weight = 1
```

#### 7.4.2 Firestore スキーマへの反映

`mergeRequests` および `genreRequests` のドキュメントに以下のフィールドを追加します。

```
mergeRequests/{requestId}
  ├── weightedVotesFor:    number   // 重み付き賛成票合計
  ├── weightedVotesAgainst: number  // 重み付き反対票合計
  ├── votes: [                      // 投票明細（可決判定ログ用）
       {
         voterId:   string,
         type:      'for' | 'against',
         weight:    1 | 2,
         votedAt:   Timestamp
       }
     ]
  └── ...既存フィールド
```

#### 7.4.3 可決条件の再定義（加重投票版）

| 条件 | 旧設計（生票数） | 新設計（重み付き票数） |
|---|---|---|
| 最小賛成票 | `votesForCount >= 5` | `weightedVotesFor >= 5` |
| 賛成率 | `votesFor / total >= 80%` | `weightedVotesFor / (weightedVotesFor + weightedVotesAgainst) >= 80%` |
| 否決（反対票） | `votesAgainstCount >= 5` | `weightedVotesAgainst >= 5` |
| タイムアウト | 14日経過で否決 | 変更なし（14日経過で否決） |

---

### 7.5 Firestore スキーマ `users` コレクション追加フィールド

```
users/{uid}
  ├── reputationScore:    number    // 信頼スコア合計値 (default: 0)
  ├── moderationTier:     string    // 'newcomer' | 'contributor' | 'moderator' | 'senior_moderator'
  ├── reputationHistory: [          // 直近30件の変動ログ（デバッグ・不正調査用）
       {
         eventId:   string,         // イベントID (e.g. 'QUIZ_CREATED')
         delta:     number,         // 変動量 (e.g. +10 or -30)
         reason:    string,         // 人間可読な理由
         createdAt: Timestamp
       }
     ]
  └── lastReputationCalculatedAt: Timestamp  // 最終バッチ計算日時
```

---

### 7.6 信頼スコアの日次更新バッチ処理

毎晩深夜に、ユーザーの行動履歴から信頼スコアを再集計し、必要に応じてモデレータ資格を自動更新するバッチ処理（Cloud Functions / Scheduled Job）を定義します。

#### 7.6.1 処理フロー
1. クエリにより、前日に活動（クイズ作成、プレイ、評価、投票等）のあったアクティブユーザーを抽出します。
2. 対象ユーザーの `reputationEvents` サブコレクションから、未処理 (`processedAt == null`) のスコアイベントをアトミックに集計します。
3. 加算・減算処理を計算し、下限 `0` を適用したうえで新規スコアを決定します。
4. 新規スコアからモデレータ資格（`moderationTier`）を再評価し、`users/{uid}` ドキュメントを一括更新します。

#### 7.6.2 バッチ実行フロー図

```mermaid
flowchart TD
    Start([バッチ起動]) --> FetchUsers["前日活動のあった\nユーザーを抽出"]
    FetchUsers --> LoopStart{ユーザーごとにループ}
    
    subgraph ユーザー処理
        LoopStart --> GetEvents["未処理の reputationEvents を取得\n(processedAt == null)"]
        GetEvents --> CalcDelta["ポイント差分を計算\n(加算・減算)"]
        CalcDelta --> ApplyFloor
        ApplyFloor["新スコア = max(0, 現スコア + 差分)\n(下限 0 を保証)"]
        ApplyFloor --> ResolveTier
        ResolveTier["moderationTier を計算\n(resolveModerationTier)"]
        ResolveTier --> UpdateUser["users/{uid} を更新\n(reputationScore, moderationTier,\nreputationHistory, lastReputationCalculatedAt)"]
    end

    LoopStart --> LogResult
    LogResult["処理結果をログ出力\n(成功数, スキップ数, エラー数)"]
    LogResult --> End([処理完了])
```

#### 7.6.3 `reputationEvents` コレクション設計

スコア計算のソースデータとして、`reputationEvents` サブコレクションを `users/{uid}` の下に持ちます。

```
users/{uid}/reputationEvents/{eventId}
  ├── type:        string       // イベントID (e.g. 'QUIZ_CREATED')
  ├── delta:       number       // ポイント変動量
  ├── senderId:    string       // アクションを起こした送信者UID (同一ユーザー加算上限制限の判定に使用)
  ├── sourceId:    string       // 対象リソースID (quizId, requestId 等)
  ├── createdAt:   Timestamp
  └── processedAt: Timestamp | null  // バッチ処理済みフラグ (null = 未処理)
```

- アクション発生時（クイズ公開、プレイ受信、投票参加等）に、Cloud Functions がアトミックに `reputationEvents` へイベントレコードを書き込みます。
- バッチ処理では、`processedAt == null` のイベントのみを集計し、処理後に `processedAt` にサーバータイムスタンプを書き込み同期完了フラグとします。

---

### 7.7 信頼スコアの不正操作（チート）対策 [NEW]
ユーザー間の相互高評価によるスコアの水増しや、別アカウントによる自作自演行為を防止するため、以下の不正検知制限をバッチ処理および集計トランザクションに組み込みます。
* **同一評価者からの加算上限制限 (非正規化 Limits カウンターによる高速化)**:
  - 特定のユーザー（評価者）が、同一のクイズ作成者（作家）に対して行う「良問評価（👍）」や「リアクション」によって、作家が得られる信頼スコアの加算累計は、**1クリエイターあたり最大 +5 pt まで** とします。上限に達した後の 👍 評価は、クイズの良問率には反映されますが、作家の信頼スコア（`reputationScore`）の加算としては処理されません。
  - **計算コストの最適化設計**: 日次再計算バッチにおいて過去の全イベントを走査するコストを削減するため、`users/{uid}/reputationLimits/{senderId}` サブコレクションを導入します。評価アクション発生時にアトミックなトランザクションでこのサブコレクションの `totalDelta` をインクリメント（上限 5）し、加算が許容される場合のみ `reputationEvents` へのイベント書き込みを実行します。これにより、日次バッチは当日の未処理イベント（`processedAt == null`）の処理のみで完結し、過去のイベントを毎回全スキャンする必要がなくなります。

---

### 7.8 フロントエンド表示設計

#### 7.8.1 プロフィール画面への反映

| 要素 | 表示内容 |
|---|---|
| **スコア数値** | `reputationScore` の現在値（例: `283 pt`） |
| **ティアーバッジ** | ティアー名に対応する色付きバッジ（例:  Moderator） |
| **スコア履歴** | 直近5件 of 変動ログイベント名・変動量・日時 |

#### 7.8.2 ティアーバッジのカラーデザイン

| ティアー | バッジカラー | テキスト |
|---|---|---|
| Newcomer | `#9E9E9E` グレー | Newcomer |
| Contributor | `#4CAF50` グリーン | Contributor |
| Moderator | `#2196F3` ブルー | Moderator |
| Senior Moderator | `#FF9800` ゴールド | Senior Moderator |

#### 7.8.3 投票画面への反映

- 投票フォームに「あなたの投票の重み: x1 / x2」を表示し、ユーザーが自身の影響力を把握できるようにします。
- 現在の `weightedVotesFor` / `weightedVotesAgainst` をリアルタイムで可視化するプログレスバーを表示します。

---

### 7.9 不正検知とスコアリセット

#### 7.9.1 自動検知ルール

| 検知条件 | アクション |
|---|---|
| 同一IPから1時間以内に10票以上投票 | `VOTE_SPAM_DETECTED` イベントを発火（-50 pt） |
| 自作自演（同一UIDによる自作クイズへのいいね） | Cloud Functions でブロック（スコアイベント不発火） |
| 同一セッション内の大量クイズ作成（5件/時間以上） | 超過した `QUIZ_CREATED` イベントを無効化 |

#### 7.9.2 管理者による手動リセット（緊急時のみ）

- Firestoreコンソールまたは Admin SDK 経由で `reputationScore: 0`、`moderationTier: 'newcomer'` に直接設定。
- 対応ログを `adminLogs` コレクションへ記録（監査証跡）。
- この操作は通常運用では**使用しない**ことを原則とし、深刻な不正行為が確認された場合のみに限定します。

---

### 7.10 Steam 風 良問評価システム（クイズ品質レビュー）

#### 7.10.1 設計思想と Steam との対応

Steam のレビューシステムでは、プレイヤーが「おすすめ」/「おすすめしない」を投票し、その集計結果によりゲームに「圧倒的好評」〜「圧倒的不評」バッジが動的に付与されます。quizeum では、これと同等の仕組みを**クイズ品質評価**として導入します。

| Steam の概念 | quizeum への対応 |
|---|---|
| 「おすすめ」レビュー | 「良問」評価 |
| 「おすすめしない」レビュー | 「悪問」評価 |
| Positive/Negative 集計率 | 良問率 (`reviewScore`) |
| レビュースコアバッジ（圧倒的好評 等） | 良問バッジ（名作クイズ 等） |
| ゲームの発見性（ストア表示順） | クイズのサジェスト優先度 |
| Steam レビューへの「参考になった」票 | 将来機能として保留 |

---

#### 7.10.2 評価アクション仕様

**評価条件**:
- クイズを**全問解答した**ユーザーのみが評価可能（プレイ中断は不可）。
- 1ユーザー1クイズにつき1票のみ（後から変更可能）。
- クイズの作成者本人は自作クイズを評価不可。

**評価の種類**:

| 評価タイプ | 表示ラベル | 意味 |
|---|---|---|
| `positive` | 👍 良問 | 良質な問題だった（面白かった / 勉強になった / バランスが良い 等） |
| `negative` | 👎 悪問 | 問題があった（誤情報 / 難易度不適切 / 解説不足 等） |

- 「悪問」評価時は、任意でフリーテキストによる理由を入力可能（フィードバック促進）。

---

#### 7.10.3 良問率とリアルタイムアトミック更新

```
reviewScore = positiveCount / (positiveCount + negativeCount)  [0.0 〜 1.0]
```

- `reviewCount = positiveCount + negativeCount`
- スコアは Firestore の `quizzes/{quizId}` ドキュメントに保持します。
- **リアルタイムアトミック更新（トランザクション）**:
  ユーザーが良問（👍/👎）を投票、評価変更、または削除した際、Firestore トランザクションを用いて、対象の `quizzes/{quizId}` 内の `positiveCount` および `negativeCount` フィールドをリアルタイムでアトミックに加減算更新します。これにより、バッチ処理でのクエリ走査コストを抑えつつ、常に最新の評価数をクイズに反映させます。

---

#### 7.10.4 良問バッジ（レビュースコアバッジ）定義

Steam の評価区分を参考に、日本語クイズアプリに合わせた独自バッジを定義します。

| バッジ | 表示アイコン | 良問率 | 最低評価数 |
|---|---|---:|---:|
| 🏆 **殿堂入り名作** | 金バッジ | 95% 以上 | 50件以上 |
| 🥇 **圧倒的良問** | 金バッジ | 90% 以上 | 20件以上 |
| 🟢 **高評価良問** | 緑バッジ | 80% 以上 | 10件以上 |
| 🟡 **賛否両論** | 黄バッジ | 40% 〜 79% | 10件以上 |
| 🔴 **低評価** | 赤バッジ | 30% 〜 39% | 10件以上 |
| ⚠️ **要改善** | 赤バッジ | 30% 未満 | 10件以上 |
| - | 表示なし | - | 10件未満 |

---

#### 7.10.5 クリエイターの信頼スコアへの反映

良問率は、**週次再計算バッチ**でクリエイターの信頼スコアへ反映されます。

**加算イベント** (7.2.1テーブルに追加):

| イベントID | 条件 | ポイント |
|---|---|---:|
| `QUIZ_REVIEW_POSITIVE_BADGE` | クイズが「高評価良問」以上のバッジを獲得した（週次） | +15 |
| `QUIZ_REVIEW_MASTERPIECE` | クイズが「殿堂入り名作」バッジを獲得した（初回のみ） | +50 |

**減算イベント** (7.2.2に既出):

| イベントID | 条件 | ポイント |
|---|---|---:|
| `QUIZ_REVIEW_NEGATIVE` | クイズの良問率が 30% を下回り「要改善」バッジになった（週次） | -10 |

---

#### 7.10.7 Firestoreスキーマ追加フィールド

**`quizzes/{quizId}` への追加フィールド**:

```
quizzes/{quizId}
  ├── reviewScore:       number       // 良問率 [0.0 〜 1.0] (default: null)
  ├── positiveCount:     number       // 👍 票数 (default: 0)
  ├── negativeCount:     number       // 👎 票数 (default: 0)
  ├── tempPositiveCount: number       // 仮リセット期間中の 👍 新規票数 (default: 0)
  ├── tempNegativeCount: number       // 仮リセット期間中の 👎 新規票数 (default: 0)
  ├── reviewBadge:       string       // バッジID ('masterpiece'|'overwhelmingly_positive'|...|null)
  └── reviewUpdatedAt:   Timestamp    // 最終バッチ更新日時
```

**`quizReviews/{reviewId}` コレクション（評価データ）**:

```
quizReviews/{reviewId}
  ├── quizId:      string       // 対象クイズID
  ├── reviewerId:  string       // 評価者ID (uid)
  ├── type:        'positive' | 'negative'
  ├── reason:      string | null  // 悪問時の任意フリーテキスト理由
  └── createdAt:   Timestamp
```

> **複合インデックス**: `quizId ASC, createdAt DESC` を作成し、クイズごとの評価一覧を効率的に取得可能にします。

---

#### 7.10.8 セキュリティルール設計 (Security Rules)

```javascript
// firestore.rules 良問評価関連
match /quizReviews/{reviewId} {
  // 全問解答済みかつ他人のクイズであることを検証
  allow create: if request.auth != null
    && request.resource.data.reviewerId == request.auth.uid
    // quizId の creatorId と reviewerId が一致しないことをサーバー側（Cloud Functions / Security Rules）で検証推奨
    && request.resource.data.keys().hasAll(['quizId', 'type', 'reviewerId', 'createdAt'])
    && request.resource.data.type in ['positive', 'negative'];

  // 自身の評価のみ更新・削除可能
  allow update, delete: if request.auth.uid == resource.data.reviewerId;

  allow read: if true;  // 良問バッジ表示のため公開
}

match /quizzes/{quizId} {
  // reviewScore・reviewBadge・positiveCount・negativeCount・tempPositiveCount・tempNegativeCount はクライアントから直接変更不可
  allow update: if request.auth != null
    && !('reviewScore' in request.resource.data.diff(resource.data).affectedKeys())
    && !('reviewBadge' in request.resource.data.diff(resource.data).affectedKeys())
    && !('positiveCount' in request.resource.data.diff(resource.data).affectedKeys())
    && !('negativeCount' in request.resource.data.diff(resource.data).affectedKeys())
    && !('tempPositiveCount' in request.resource.data.diff(resource.data).affectedKeys())
    && !('tempNegativeCount' in request.resource.data.diff(resource.data).affectedKeys());
}
```

---

#### 7.10.8.1 良問評価リセット承認時の非同期分割物理削除とカウンタ制御
「要改善」バッジのリセット申請が7日間の評価期間を経て承認された際、対象の過去評価（`quizReviews`）のドキュメント群は以下の通り非同期で安全に物理削除され、カウンターがマージされます。

* **1. Cloud Tasksと連携した非同期分割削除 (Chunked Execution)**:
  - 対象の `quizReviews` のドキュメント数が膨大である可能性を考慮し、Firestoreの「1トランザクション500件制限」を回避するため、**Cloud Tasksを活用したCursor型再帰呼び出し（非同期分割処理）**を実行します。
  - 1回のジョブ呼び出しにつき **最大100件** の過去 `quizReviews` ドキュメントをクエリして物理削除し、次の100件を処理する新規タスクを再帰登録します。全件の削除が完了した時点で、ジョブを正常終了します。
* **2. 仮リセット期間中のリアルタイムアトミック更新先切り替え**:
  - `isReviewMasked == true`（仮リセット期間中）の間、ユーザーから新しく投票された 👍/👎 評価は、通常の `positiveCount`/`negativeCount` ではなく、**`tempPositiveCount`/`tempNegativeCount` に対してリアルタイムアトミックに加減算更新**されます。
* **3. 承認（リセット可決）時のカウンター制御**:
  - 審査が承認された場合、過去の古い `quizReviews` 物理削除ジョブが完了したことをトリガーとし、トランザクション内でクイズドキュメントの正規カウンターを仮カウンターの値で上書きし、仮カウンターをリセットします。
    - `positiveCount = tempPositiveCount`
    - `negativeCount = tempNegativeCount`
    - `tempPositiveCount = 0`, `tempNegativeCount = 0`
    - `isReviewMasked = false`, `activeResetRequestId = null`
  - これにより、仮リセット期間中に投票された新規の綺麗な高評価のみで再スタートが完了します。
* **4. 否決（却下・基準未達）時のカウンター復元制御**:
  - 基準をクリアできず却下された場合は、過去の `quizReviews` は削除せずそのまま存続させ、仮カウンターに溜まっていた再評価分の票を正規カウンターにアトミックに合算加算してマスクを解除します。
    - `positiveCount = positiveCount + tempPositiveCount`
    - `negativeCount = negativeCount + tempNegativeCount`
    - `tempPositiveCount = 0`, `tempNegativeCount = 0`
    - `isReviewMasked = false`, `activeResetRequestId = null`
  - これにより、過去の評価データを汚さず安全に元の評価状態へと統合・復帰させます。

---

#### 7.10.9 バッチ処理仕様（良問バッジ週次更新：差分集計最適化）

| 項目 | 仕様詳細 |
|---|---|
| **実行タイミング** | 毎週月曜 04:00 JST (Cloud Scheduler) |
| **処理対象（差分集計）** | **前週に評価数が変動したクイズのみ**（`reviewUpdatedAt` 以降に `quizReviews` に変更があったクイズ）を対象とし、全クイズの走査を避けてFirestoreの読み書きコストを極限まで削減します。 |
| **処理内容** | 対象クイズの `positiveCount` / `negativeCount` から `reviewScore` を再計算し、`reviewBadge` の更新およびクリエイターの `reputationEvents` へのイベント書き込みを実行します。 |
| **冪等性** | `reviewUpdatedAt` が当週月曜日以降なら二重処理をスキップします。 |

---

#### 7.10.10 Cloud Functions トリガー無限ループ防止設計 [NEW]

ユーザーの `users/{uid}` ドキュメントのアクティビティ（`totalPlayCount` や `createdQuizzesCount` 等）の更新をトリガーとする `onUpdate` サーバーサイド関数において、バッジ追加（`badges` フィールドの更新）に伴う無限ループを防止するため、以下の**早期リターン（ガード）ロジック**を義務付けます。

* **ガード条件**:
  - `onUpdate` トリガー関数が起動した際、更新前データ (`change.before.data()`) と更新後データ (`change.after.data()`) を比較します。
  - バッジ獲得の条件となるアクティビティカウンタ（`totalPlayCount`, `createdQuizzesCount`, `followersCount` 等）の数値が一切変化していない場合、または更新されたフィールドの差分（`affectedKeys`）が `badges` および `updatedAt` のみである場合は、アワード処理を行わずに即座に早期リターン（`return null;`）します。
  - これにより、バッジ書き込み時のトリガー再起による無限実行を完全に排除し、安全なアトミック付与を実行します。

