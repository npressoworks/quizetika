# Implementation Plan: quizetika-core

## Tasks

### 1. 基礎フェーズ (Foundation)

- [x] 1.1 共通データモデルとスキーマ型定義の拡張
  - アカウント、クイズ、解答履歴、バッジ、指摘、通報、マージリクエスト、およびメタデータジャンル/タグの定義を共通モデルに実装
  - プロフィール、クイズ、およびプレイ記録のスキーマに対して、非正規化アバター情報、アトミックカウンタ用フィールド、および削除フラグを追加
  - ウミガメスープ問題用必須正解キーワード（`truthKeywords?: string[]`）の型定義を `Question` インターフェースに追加
  - **完了状態**: 型チェックがすべてパスし、`truthKeywords` を含むすべての新規ドメインモデルがコンパイルエラーなしで定義されていること
  - _Requirements: 1.1, 1.2, 1.3, 2.2, 2.7, 3.5, 4.3, 5.5, 6.1, 7.1_

- [x] 1.2 ストレージ管理サービスと自動物理クレンジング基盤
  - カバー画像、問題画像、およびアバター画像のオブジェクトストレージ連携（最大2MB制限バリデーション）を実装
  - 退会ユーザーのアバター画像、および否決されたジャンル新設申請のアイコン画像をストレージから物理消去する削除メソッドを実装
  - **完了状態**: 2MBを超える画像アップロードが拒否され、削除要求時に該当画像ファイルがストレージから完全に抹消されること
  - _Requirements: 1.5, 7.5_

---

### 2. コアフェーズ (Core)

- [x] 2.1 ユーザープロフィールと称号バッジアトミック管理
  - プロフィール（表示名最大30文字、バイオ最大200文字、フォロージャンル）の更新機能を実装
  - 累計プレイ回数や作成数のマイルストーン達成をフックし、トランザクションで称号バッジをアトミックに付与するロジックを実装
  - **完了状態**: プロフィールがバリデーション付きで保存され、条件達成時に重複なく `users.badges` 配列に称号バッジが即時永続化されること
  - _Requirements: 1.2, 1.3, 5.1_
  - _Boundary: UserService_

- [x] 2.2 (P) クイズ管理および公開時バリデーション
  - タイトル、説明、初期難易度（1〜10）、およびNGワード二重検証を用いたクイズの下書き保存・公開機能を実装
  - タグ入力時の小文字名寄せ正規化、および類似タグ検出時のインライン推奨サジェスト警告を実装
  - クイズエディタ (`quiz-editor.tsx`) で、ウミガメスープ形式の作成時にタグのように複数追加・削除できるリッチな必須キーワード入力UIを実装
  - クイズ公開バリデーション (`quiz-validation.ts`) にて、ウミガメスープ形式の時は必須キーワードが最低1つ指定されていることを検証するルールを追加
  - **完了状態**: ウミガメスープ作成時に必須キーワードが視覚的に追加・削除でき、キーワード未設定時のクイズ公開がバリデーションエラーでブロックされること
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.7, 2.8_
  - _Boundary: QuizService_

- [x] 2.3 (P) 解答セッション保護およびオフライン自動同期
  - プレイ中の制限時間タイマー（1問カウントダウンおよび模擬試験用全体カウントダウン）を実装
  - プレイ進捗のローカル永続化（再読み込み離脱防止）、オフライン時の解説結果表示、およびオンライン復帰時のバッチ自動同期を実装
  - **完了状態**: オフラインで完了したプレイ結果がローカルに退避され、接続復旧時にバックグラウンドで attempts へ漏れなく同期永続化されること
  - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.6, 5.5_
  - _Boundary: AttemptService_

- [x] 2.4 (P) 水平思考クイズ（ウミガメのスープ）AI対話エンジン
  - プレイヤーからの質問（最大100文字）に対するAI一問一答判定（Yes/No/Irrelevant/Unknown）をサーバーサイドプロキシ経由で実装
  - attemptsの対話履歴から直近最大20回分を取得し、Gemini SDKの `startChat` 履歴パラメータにマッピングして文脈を考慮したステートフル対話を行うロジックへの修正
  - 無料ユーザーに対する1日同一クイズ20回制限、および同一セッション内での「文字列完全一致質問のキャッシュ返却」を実装
  - **完了状態**: 過去の質問文脈を踏まえた代名詞の質問等（例: 「それは彼ですか？」）に対してGemini Chatが直近最大20回の履歴に基づいて正しく判定し、質問回数およびキャッシュが正常に機能すること
  - _Requirements: 4.1, 4.2, 4.3_
  - _Boundary: AskAiQuestionAPI_

- [x] 2.5 (P) 水平思考AI真相自動判定およびアドバイス生成
  - 提出された真相要約に対し、作問時に登録された必須キーワード（`truthKeywords`）がすべて含まれているかを検証する `verifyKeywords` ロジックを実装
  - 全キーワードが合致する場合はAIをバイパスし、即時合格（`isCorrect: true`）とするロジックを実装
  - キーワードが不足している場合のみ、従来通りGemini APIを用いて裏設定と照合し核心に到達しているかどうかのフォールバック判定を実装
  - 真相不合格（不正解）時に、プレイヤーが矛盾を解消するための具体的なAI解決アドバイス（フィードバック）を返却するロジックを実装
  - **完了状態**: 必須キーワード全一致でAIを呼ばずに即合格判定され、一部不足時はAIによる柔軟な意味判定（合格なら完了、不合格ならAIアドバイス表示）が期待通り実行されること
  - _Requirements: 4.5, 4.6, 4.7_
  - _Boundary: VerifyTruthAPI_

- [x] 2.6 (P) ソーシャル機能およびリスト管理
  - フォロー/フォロー解除時のカウンタアトミック更新、お気に入り登録、およびフォロー中の最新新着タイムライン表示を実装
  - 収録クイズのドラッグ＆ドロップ順序編集機能、リスト内連続 Attempt 記録（listId付与）、およびリストパッケージのエクスポートを実装
  - **完了状態**: リストの連続プレイ時に attempts.listId に親リストIDが正しく付与され、エクスポート時に全収録クイズが1ファイルで保存されること
  - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.6_
  - _Boundary: QuizListService_

- [x] 2.7 (P) 指摘フィードバックおよび良問評価システム
  - クローズド指摘フィードバック送信、指摘解決時のオート通知、👍/👎良問評価（作成者除外アトミック集計）を実装
  - 修正再評価（仮リセット7日間）期間中の評価マスク、およびリセット承認時の過去評価データの非同期分割物理削除を実装
  - **完了状態**: 悪問投票時の理由送信や指摘解決通知が正常に到達し、リセット承認時に過去レコードが通信エラーなしで全消去されること
  - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  - _Boundary: ReviewService_

- [x] 2.8 (P) モデレーションおよびメタデータ自治ガバナンス
  - コンテンツ通報、累計5回到達時の一時自動保留（非公開化）、および管理者による公開復帰/永久削除審査を実装
  - 表記揺れタグ/ジャンルの仮想マージ提案投票（Senior Moderatorは投票重み2）、新規ジャンル申請・投票承認自動有効化を実装
  - **完了状態**: 5回通報されたクイズが即時非表示化して審査キューに並び、可決された新規ジャンルが自動でカテゴリ一覧に追加されること
  - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6_
  - _Boundary: ModerationService_

---

### 3. 結合フェーズ (Integration)

- [x] 3.1 即時退会と大規模関連データ非同期クレンジングの統合
  - 退会申請時の users.deleteStatus = 'delete_pending' 設定、Auth上の uid 即時物理削除処理を実装
  - Cloud Tasks/Functionsと連動し、退会ユーザーが作成した全公開クイズ・リスト・指摘を100件チャンクで "退会済みユーザー" に非同期匿名化クレンジングする機能を実装
  - **完了状態**: アカウント削除のトリガーにより、Authは瞬時に消去されて再登録可能になり、膨大な関連ドキュメントがバックグラウンドで漏れなく匿名化更新され、最後にプロフィール自体が安全に物理消去されること
  - _Depends: 1.1, 1.2, 1.5, 2.1, 2.2_
  - _Requirements: 1.4, 1.5, 1.6_

---

### 4. 検証フェーズ (Validation)

- [x] 4.1 コアプレイフロー統合検証および非機能要件テスト
  - クローラーおよびプレビュー生成エンジン向けの、JavaScript未実行時高速HTML応答（0.5秒以内）と動的SEO/OGPメタデータの自動挿入を検証
  - 高負荷（スパイクアクセス）シミュレーション下でのエラー率（0.1%未満）の可用性テストを実行
  - **完了状態**: テストにおいて、クローラー向けレスポンス内のOGPタグの整合性、および多数の同時クイズプレイ接続時の応答速度が正常値を示すこと
  - _Requirements: 8.1, 8.2, 8.3_

---

### 5. Phase 5 拡張 — リーダーボード分割 & 本人プレイ履歴（2026-06）

> 既存タスク 2.3 / 2.5 の単一 `leaderboard`・全問正解ガードは本フェーズで置き換える。

- [x] 5.1 クイズ型と初期値の二系統リーダーボード対応
  - `Quiz` に `leaderboardFirstPlay` / `leaderboardReplay` を追加し、新規作成・下書き初期化で空配列を設定する
  - 読み取り時に旧 `leaderboard` がのみ存在するドキュメントは `leaderboardFirstPlay` のフォールバックとして扱うヘルパーを用意する
  - **完了状態**: 型チェックが通り、新規クイズ保存ペイロードに両フィールドが含まれること
  - _Requirements: 9.2, 9.3_
  - _Boundary: types, QuizService_

- [x] 5.2 リーダーボード順位比較・マージの純関数モジュール
  - 正解数降順→同点時は合計解答時間昇順の比較、厳密優位判定、ユーザー1枠マージ、上位5抽出を実装する
  - prior 完了件数から `firstPlay` / `replay` を決定する振り分け関数を実装する
  - **完了状態**: 単体テストで同点タイム・非優位差し替え拒否・5件超過時の切り捨てが期待どおりであること
  - _Requirements: 9.4, 9.5, 9.6_
  - _Depends: 5.1_
  - _Boundary: leaderboard-ranking_

- [x] 5.3 `saveAttempt` トランザクション内の二系統LB更新
  - 全問正解ガードを撤廃し、永続化対象の完了試行ごとに LB 更新候補とする（ゲスト・test-play は除外）
  - 新規 attempt 作成前に同一 user+quiz の完了件数を数え、初回は `leaderboardFirstPlay`、2回目以降は `leaderboardReplay` のみ更新する
  - **完了状態**: 初回プレイ後に replay 配列が空のまま、2回目以降に firstPlay 上の当該ユーザー行が変わらないこと
  - _Requirements: 3.6, 9.1, 9.2, 9.3, 9.7_
  - _Depends: 5.2_
  - _Boundary: AttemptService_

- [x] 5.4 (P) ウミガメ真相判定完了時のLB更新統合
  - `verify-truth` ルート内の重複 LB ロジックを共通ヘルパーに置き換え、合格完了時に 5.3 と同一規則で更新する
  - **完了状態**: 真相合格後のクイズドキュメントに正しい board 側のみが更新され、順位規則が `saveAttempt` と一致すること
  - _Requirements: 9.8_
  - _Depends: 5.2_
  - _Boundary: VerifyTruthAPI_

- [x] 5.5 本人プレイ履歴クエリサービス
  - 認証ユーザー自身の完了済み attempts を `completedAt` 降順で取得し、test-play 等を除外する
  - 各件にクイズタイトル・正解数・総問題数・モード・経過秒を付与し、20件＋カーソルでページングする
  - **完了状態**: モックまたは統合テストで2ページ目取得と test-play 除外が確認できること
  - _Requirements: 10.1, 10.2, 10.3_
  - _Depends: 5.1_
  - _Boundary: AttemptService_

- [x] 5.6 本人プレイ履歴API Route
  - `GET /api/user/play-history` で ID トークン検証後、トークン `uid` の履歴のみ返す（他ユーザー指定は 403）
  - **完了状態**: 未認証で 401、有効トークンで `PlayHistoryPage` JSON、クエリに他人 uid を渡してもトークン本人のみ返ること
  - _Requirements: 10.4, 10.5_
  - _Depends: 5.5_
  - _Boundary: PlayHistoryAPI_

- [x] 5.7 Firestore インデックスと読み取り互換の結合確認
  - `attempts` の `userId` + `completedAt` 降順クエリに必要な複合インデックスを定義・デプロイ手順を記載する
  - 旧 `leaderboard` のみのクイズを読み込んだクライアント／サービスが firstPlay として表示できることを確認する
  - **完了状態**: インデックス定義がリポジトリに追加され、履歴APIが本番相当クエリでエラーにならないこと
  - _Depends: 5.5, 5.6_

- [x] 5.8 Phase 5 統合検証
  - 初回／リプレイ振り分け、正解数優先ソート、非全問正解での掲載、本人履歴APIの認可を統合テストで検証する
  - **完了状態**: 関連 Jest 統合テストがグリーンであり、手動で2回プレイ＋履歴API取得のスモークが成功すること
  - _Depends: 5.3, 5.4, 5.6_
  - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5, 9.6, 9.7, 9.8, 10.1, 10.2, 10.3, 10.4, 10.5_

- [x]* 5.9 Phase 5 回帰スモーク（任意）
  - 既存 `saveAttempt` スコア検証・オフライン同期が Phase 5 変更後も動作することをスモーク確認する
  - **完了状態**: 既存 attempt 関連テストスイートがグリーンであること
  - _Depends: 5.8_

---

### 6. Phase 6 拡張 — ジャンル・タグメタデータ整合（2026-06）

> 設計: `metadata-resolution` 集約 + 読み取り C2（canonical 優先 + `genre in` フォールバック）。UI は隣接スペック。

- [x] 6.1 メタデータ型定義の追加
  - `GenreMetadata` / `TagMetadata` を共通型に追加し、`Quiz` の `canonicalGenreId` / `canonicalTagIds` コメントを設計と一致させる
  - **完了状態**: 型チェックが通り、メタデータ読み取り結果を型安全に受け取れること
  - _Requirements: 11.4_
  - _Boundary: types_

- [x] 6.2 canonical 解決ライブラリの実装
  - 有効ジャンル検証、canonical ジャンル/タグ ID 解決、マージ済みジャンル ID 展開（`in` 10件チャンク）、未登録タグのマスタ自動 create を単一モジュールに実装する
  - 単体テストで循環 `canonicalId` 拒否・チャンク分割・解決結果の期待値を検証する
  - **完了状態**: `metadata-resolution` 関連 Jest がグリーンで、解決関数が Firestore マスタを参照して正規 ID を返すこと
  - _Requirements: 2.2, 2.4, 2.5, 11.2, 11.6_
  - _Depends: 6.1_
  - _Boundary: metadata-resolution_

- [x] 6.3 クイズ保存パイプラインへのメタデータ解決統合
  - 下書き・公開の `saveQuiz` でジャンルマスタ存在検証後に `canonicalGenreId` / `canonicalTagIds` を必ず埋め込む（表示用 `genre` / `tags` は変更しない）
  - 公開バリデーションとマスタ検証の二重整合、無効ジャンル時の `validation-error` を返す
  - **完了状態**: 下書き保存後のクイズドキュメントに非空の `canonicalGenreId` が含まれ、存在しないジャンル ID で保存が拒否されること
  - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  - _Depends: 6.2_
  - _Boundary: QuizService, quiz-validation_

- [x] 6.4 Firestore Security Rules（メタデータ・ガバナンス）
  - `metadata_genres` / `metadata_tags` / `mergeRequests` / `genreRequests` の read/create/update ルールを `detailed_design.md` §6.5 方針で追加する
  - **完了状態**: エミュレータまたはルールユニットテストで、未認証のマスタ改ざんが拒否され、認証ユーザーのタグ新規 create が許可されること
  - _Requirements: 11.6_
  - _Depends: 6.1_
  - _Boundary: firestore.rules_

- [x] 6.5 Firestore 複合インデックス（canonical 探索）
  - `quizzes` に `status` + `canonicalGenreId` + (`createdAt` | `playCount` | `bookmarksCount`) の複合インデックスを定義する
  - タグ一覧用 `canonicalTagIds` + `createdAt` インデックスを追加する
  - **完了状態**: `firestore.indexes.json` に Phase 6 エントリが追加され、canonical クエリがインデックスエラーにならないこと
  - _Requirements: 11.1, 11.2, 11.3_
  - _Depends: 6.1_

- [x] 6.6 (P) ジャンル別公開クイズ一覧（C2 読み取り）
  - `canonicalGenreId ==` クエリを優先し、未バックフィル向けに `genre in` フォールバックをチャンク実行して `quizId` で dedupe する
  - 新着・人気・トレンドのソート引数に対応する
  - **完了状態**: マージ済み旧ジャンル `genre` のみを持つクイズと、canonical 設定済みクイズが同一一覧に重複なく含まれること
  - _Requirements: 11.1, 11.2_
  - _Depends: 6.2, 6.5_
  - _Boundary: QuizService_

- [x] 6.7 (P) タグ別公開クイズ一覧（canonical 優先）
  - `canonicalTagIds` の `array-contains` を第一選択とし、legacy `tags` フォールバックを併用して欠落なく返す
  - **完了状態**: マージ前タグ名のみのクイズが正規タグ ID 一覧に含まれること
  - _Requirements: 11.3_
  - _Depends: 6.2, 6.5_
  - _Boundary: QuizService_

- [x] 6.8 (P) 有効ジャンルマスタ一覧と複合検索
  - `isActive` なジャンルの表示名・アイコン URL を返す一覧 API をサービス層に追加する
  - ジャンル・難易度・問題数等の複合条件で公開クイズを返す検索を実装し、ジャンル条件は canonical 解決と整合させる
  - **完了状態**: `listActiveGenres` が空でない本番相当データで結果を返し、`searchQuizzes` が複合フィルタを AND で適用すること
  - _Requirements: 11.4, 11.5_
  - _Depends: 6.2_
  - _Boundary: QuizService_

- [x] 6.9 弱点克服プレイのジャンルフィルタ整合
  - 指定ジャンル時にマージ展開 ID 集合でクイズを絞り込み、誤答問題抽出に反映する（オールジャンルは従来どおり全件）
  - **完了状態**: 子ジャンルにのみ分類されたクイズの誤答が、親ジャンルフィルタで取得できること
  - _Requirements: 3.7_
  - _Depends: 6.2_
  - _Boundary: AttemptService_

- [x] 6.10 ガバナンス実装の単一経路化
  - 未使用のジャンル申請スタブ（重複モジュール内）を削除し、マージ可決 70%・ジャンル新設 80% が `tagMerge` のみで満たされることをテストで固定する
  - **完了状態**: ジャンル新設・マージの呼び出し経路が一つに集約され、重複 export がリポジトリに残らないこと
  - _Requirements: 7.4, 7.5, 7.6, 7.8, 11.7_
  - _Boundary: TagMergeService, ModerationService_

- [x] 6.11 Phase 6 統合検証
  - `saveQuiz` canonical 埋め込み、`getQuizzesByGenre` C2、可決後の `listActiveGenres`、`getFailedQuestions` フィルタを統合テストで検証する
  - **完了状態**: Phase 6 関連 Jest がグリーンであり、手動でジャンル一覧・下書き保存のスモークが成功すること
  - _Depends: 6.3, 6.4, 6.6, 6.8, 6.9, 6.10_
  - _Requirements: 2.1, 2.2, 2.4, 3.7, 7.5, 7.8, 11.1, 11.2, 11.4, 11.5, 11.7_

- [ ]* 6.12 Phase 6 E2E スモーク（任意）
  - ジャンル新設可決後に探索 UI が新ジャンルを利用できること、マージ後にジャンル一覧が漏れないことを E2E または手動チェックリストで確認する
  - **完了状態**: `e2e` またはチェックリスト記録が残り、Phase 6 受け入れが再現可能であること
  - _Depends: 6.11_
  - _Requirements: 11.1, 11.4_

---

### 7. Phase 7 追記 — ユーザーのBAN機能およびアクセス制限（2026-06）

- [x] 7.1 (P) BAN/UNBAN アカウント状態操作と監査ログ記録
  - `ReputationService` に `banUser` および `unbanUser` 処理を実装し、ユーザーの `isBanned` フラグの設定・解除を行い、`adminLogs` コレクションに監査ログ（`action: 'ban'` / `'unban'`）をアトミックに記録する。
  - **完了状態**: ユニットテストが通り、管理者権限によるBAN/UNBAN時にデータベースに `isBanned` と監査ログが正確に記録されること。
  - _Requirements: 12.1, 12.2_
  - _Boundary: ReputationService_

- [x] 7.2 (P) 管理者用 BAN/UNBAN API ルートの構築
  - `/api/admin/users/ban` および `/api/admin/users/unban` の API ルートを構築し、管理者以外の認可を制限しつつ `ReputationService` を呼び出す。
  - **完了状態**: 統合テストにおいて管理者以外のトークンでのアクセスが `403 Forbidden` となり、管理者のトークンでのみBAN/UNBANが実行されること。
  - _Requirements: 12.1, 12.2_
  - _Depends: 7.1_
  - _Boundary: API Layer_

- [x] 7.3 (P) Firestore Security Rules による書き込み拒否（isNotBanned）
  - `firestore.rules` に `isNotBanned()` ヘルパーを定義し、ユーザーデータ、クイズデータ、指摘データなどの主要コレクションの書き込み（create, update, delete）ルールに適用する。
  - **完了状態**: ルールテストにおいて、`isBanned: true` のユーザーからの Firestore 書き込み要求がすべてセキュリティルールによりブロックされること。
  - _Requirements: 12.3_
  - _Boundary: firestore.rules_

- [x] 7.4 (P) 認証セッション無効化と Cookie 連携による即時ログアウト
  - 認証ミドルウェアおよび `AuthContext` において、`isBanned: true` を検知した際にセッションを無効化（ログアウト）し、`quizetika_banned` Cookie を設定してBAN制限画面（`/banned`）へ強制遷移するクライアント・サーバー連携ロジックを実装する。
  - **完了状態**: BANされたユーザーが次回アクセス時、または即座に強制ログアウトされ、BAN画面に誘導されること。
  - _Requirements: 12.3_
  - _Boundary: AuthService, API Layer_

- [x] 7.5 BAN/UNBAN 機能の統合検証
  - BANから強制ログアウト、Security Rules によるデータ書き込み遮断、管理者APIの権限ガード、およびUNBANによる復旧フローが一貫して動作することを統合テストおよび動作確認によって検証する。
  - **完了状態**: ユーザーBAN機能に関連するテストスイートがすべてグリーンであり、BAN時の制限とUNBAN後の復帰が正常に行われること。
  - _Depends: 7.1, 7.2, 7.3, 7.4_
  - _Requirements: 12.1, 12.2, 12.3_

---

### 8. Phase 8 拡張 — 分類ブックマーク・問題リスト・参照リンク作問（2026-06）

> 設計: `question-list-validation` / `linked-question` を lib に集約。UI は隣接スペック（play-flow / creator-dash / auth-profile）が担当。

- [x] 8.1 Phase 8 ドメイン型とスキーマ拡張
  - クイズリストに `listType`（`quiz` | `question`）を追加し、未設定読み取り時は `quiz` と解釈するヘルパーを型層に定義する
  - 解答履歴のプレイモードに `question-list` を追加し、問題リストプレイ契約（`listId` + 親 `quizId` + `totalQuestions: 1`）を型コメントで明示する
  - 分類ブックマーク取得用の `BookmarkFeed` / `BookmarkedQuestionEntry` 型を追加する
  - エディタ送信用の参照リンク識別（`linkKind: 'reference'`）を問題ペイロード型に追加する（Firestore 永続化フィールドは必須としない）
  - **完了状態**: 型チェックが通り、新規 `listType` 作成ペイロードと `question-list` attempt がコンパイルエラーなく表現できること
  - _Requirements: 14.1, 14.2, 14.8_
  - _Boundary: types_

- [x] 8.2 (P) 問題リスト・ブックマーク検証ライブラリ
  - 問題の親クイズが公開済みであることのみブックマーク・問題リスト追加を許可する検証を実装する
  - クイズリストへの問題操作・問題リストへのクイズ操作をタイプ不一致として拒否するガードを実装する
  - 非公開・下書き・停止中の親クイズに紐づく問題追加を専用エラーで拒否する
  - 単体テストで公開のみ許可・タイプ不一致拒否・非公開親拒否が期待どおりであること
  - **完了状態**: 検証ライブラリの Jest がグリーンで、422 相当のエラー種別が呼び出し元から区別できること
  - _Requirements: 13.2, 13.3, 14.5, 14.6, 14.7_
  - _Depends: 8.1_
  - _Boundary: question-list-validation_

- [x] 8.3 (P) 参照リンク問題の保存・切り離しライブラリ
  - 保存ペイロードを参照 ID のみと新規/変更問題に分割する純関数を実装する
  - 参照追加時に作成者が問題のソースクイズを所有していることのみ許可する検証を実装する
  - 内容未変更の参照は既存問題ドキュメントを複製せず、内容変更時のみ Copy-on-Write で新規問題 doc を発行する方針を実装する
  - クイズから参照を外しただけでは共有問題ドキュメントを削除しないガードを実装する
  - 単体テストで参照のみ保存・他クイズ参照時の doc 残存・非自作拒否が期待どおりであること
  - **完了状態**: 参照リンク関連 Jest がグリーンで、同一 `questionId` の二重 doc 作成が発生しないこと
  - _Requirements: 15.3, 15.4, 15.5, 15.6_
  - _Depends: 8.1_
  - _Boundary: linked-question_

- [x] 8.4 (P) 分類ブックマークサービスの拡張
  - クイズ・クイズリスト・問題の3種 `toggleBookmark` をアトミックにトグルし、各対象のブックマーク数を更新する
  - 問題ブックマーク登録前に公開親クイズ検証を適用し、非公開親は拒否する
  - `getBookmarkFeed` で3分類一覧を追加日時降順で返し、クイズ BM は公開済みのみ、問題 BM は親メタ付与かつ非公開親を除外する
  - 他ユーザー問題の新規ブックマーク時に作成者へ通知を送信する（既存クイズ・リスト BM 通知と同契約）
  - **完了状態**: 統合テストで3分類フィード取得・非公開親問題の登録拒否・問題 BM 通知が確認できること
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7_
  - _Depends: 8.2_
  - _Boundary: BookmarkService_

- [x] 8.5 (P) 問題リスト対応のクイズリストサービス拡張
  - 新規リスト作成時に `listType` を必須受け取り永続化し、既存リストの `listType` 変更を拒否する
  - 問題リストへの公開問題追加・削除・ID 並び替えを検証ライブラリ経由で実装し、他者の公開問題も追加可能とする
  - クイズリストの従来操作（クイズ追加・並び替え・連続プレイ用メンバー）を `listType` で分離し、タイプ不一致操作を拒否する
  - 作成者のリスト一覧を `listType` フィルタ付きで取得できるようにする
  - 問題リストの順序付き問題一覧（親クイズタイトル付き）と、メタデータ＋問題参照を含むエクスポートを実装する（外部問題は ID 参照のみ）
  - **完了状態**: 問題リスト CRUD・並び替え・エクスポート・タイプ別一覧の統合テストがグリーンであること
  - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.9, 14.10_
  - _Depends: 8.2_
  - _Boundary: QuizListService, QuestionService_

- [x] 8.6 (P) 過去自作クイズ検索サービス
  - 作成者 ID にスコープしたクイズ一覧から、タイトル・説明・タグのキーワード／タグ一致でフィルタする検索を実装する（下書き含む）
  - 検索結果クイズに属する問題の問題文・識別情報を返す取得を提供する
  - **完了状態**: 自作下書きクイズがキーワード・タグ検索でヒットし、問題詳細が取得できること
  - _Requirements: 15.1, 15.2_
  - _Depends: 8.1_
  - _Boundary: AuthorQuizSearchService_

- [x] 8.7 クイズ保存への参照リンク統合
  - クイズ下書き・公開保存時に参照リンク問題パスを適用し、未変更参照は既存問題 doc を再利用する
  - 参照問題の内容変更時は Copy-on-Write で新規 doc を発行し、当該クイズの `questionIds` を差し替える
  - 非自作クイズ由来の問題リンクを拒否する
  - **完了状態**: 同一問題を2クイズが参照しても `questions` ドキュメントが1つのまま、参照解除後も他クイズ参照時は doc が残ること
  - _Requirements: 15.3, 15.4, 15.5, 15.6_
  - _Depends: 8.3_
  - _Boundary: QuizService_

- [x] 8.8 問題リストプレイの attempt 記録統合
  - 問題リスト内の各問題プレイ完了時に `mode: 'question-list'`、`listId`、親 `quizId` を付与して attempt を永続化する
  - 問題リストの順序付きメンバー取得をプレイフロー UI が利用できる契約で公開する
  - **完了状態**: 問題リスト連続プレイ後の attempts に `question-list` と正しい `listId` が記録されること
  - _Requirements: 14.8_
  - _Depends: 8.5_
  - _Boundary: AttemptService, QuizListService_

- [x] 8.9 (P) Firestore インデックスと Security Rules（Phase 8）
  - 作成者別リストタイプ一覧用の複合インデックス（`authorId` + `listType` + `createdAt`）を定義する
  - `quizLists` 作成時に `listType in ['quiz','question']` を推奨し、作成後の `listType` 変更を update ルールで拒否可能とする
  - **完了状態**: インデックス定義がリポジトリに追加され、タイプ別一覧クエリがインデックスエラーにならないこと
  - _Depends: 8.1_
  - _Boundary: firestore.indexes.json, firestore.rules_

- [x] 8.10 Phase 8 統合検証
  - 分類ブックマーク（3分類・公開ガード・通知）、問題リスト CRUD/エクスポート、参照リンク保存、自作クイズ検索を統合テストで検証する
  - **完了状態**: Phase 8 関連 Jest がグリーンであり、手動で問題 BM・問題リスト追加・参照リンク保存のスモークが成功すること
  - _Depends: 8.4, 8.5, 8.6, 8.7, 8.8, 8.9_
  - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6, 13.7, 14.1, 14.2, 14.3, 14.4, 14.5, 14.6, 14.7, 14.8, 14.9, 14.10, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6_

- [ ]* 8.11 Phase 8 回帰スモーク（任意）
  - 既存クイズリスト連続プレイ（`mode: 'list'`）とクイズ・リストブックマークが Phase 8 変更後も動作することを確認する
  - **完了状態**: 既存 bookmark / quiz-list 関連テストスイートがグリーンであること
  - _Depends: 8.10_

## Implementation Notes

- LB 順位ロジックは `src/lib/leaderboard-ranking.ts`（純関数）と `src/lib/leaderboard-update.ts`（Firebase 非依存ヘルパー）に分離。`countPriorCompletedAttempts` は `attempt.ts` 内に保持。
- プレイ履歴は `GET /api/user/play-history`（Bearer トークンの uid のみ）。UI は `quizetika-auth-profile-ui` が未実装。
- クイズ詳細の二系統 LB 表示は暫定で `quiz/[id]/page.tsx` を更新（本番 UI 仕上げは `quizetika-play-flow-ui`）。
- **Phase 6**: canonical 解決は `src/lib/metadata-resolution.ts` に集約。読み取りは C2（canonical クエリ + `genre in` フォールバック + dedupe）。ホーム/エディタ UI は `quizetika-play-flow-ui` / `quizetika-creator-dash-ui` が `listActiveGenres` に依存。
- **Phase 7 (BAN機能)**: 管理者権限によるAPI呼び出しの検証（Authorization ヘッダーでの `idToken` 解析）と、Firestore Rulesでの `isNotBanned()` チェック。Cookie `quizetika_banned` による即時遮断はミドルウェアおよび `AuthContext` と連携。
- **Phase 8**: 検証は `question-list-validation`、参照リンクは `linked-question`、自作検索フィルタは `lib/author-quiz-search.ts` に集約。`getBookmarkFeed` / `exportQuestionList` / `searchAuthorQuizzes` をサービス層に追加。問題リストプレイは `mode: 'question-list'`（`satisfiesQuestionListAttemptContract`）。リスト作成 UI は暫定 `listType: 'quiz'`（`quizetika-creator-dash-ui` で問題リスト選択を実装予定）。
- **Phase 10**: タグ照合は `quiz-tag-match`、存続タグ一覧は `listActiveTags`（`canonicalId == null`）、複数タグ AND は `searchQuizzes` の `filters.tags`。UI サジェストは `quizetika-play-flow-ui` が `listActiveTags` に依存（core 10.x 完了後に play-flow 実装）。
- Phase 10 実装（2026-06-06）: `quiz-tag-match`, `listActiveTags`, `searchQuizzes` tags AND。Jest 415 件 PASS。
- **Phase 11**: 形式照合は `quiz-format-match`（`resolveQuizFormat` 使用）。`SearchFilters.format` + `searchQuizzes` 後段形式フィルタ（ジャンル直後）。探索 UI（アコーディオン・カルーセル・ジャンルページ検索）は `quizetika-play-flow-ui` が core 11.x 完了後に実装。
- Phase 11 実装（2026-06-05）: `quiz-format-match`, `SearchFilters.format`, `searchQuizzes` format 後段フィルタ。Jest 421 件 PASS（format 関連 + 既存検索回帰）。

---

### 9. Phase 9 拡張 — 統合検索（ユニバーサル検索）APIの実装（2026-06）

- [x] 9.1 統合検索サービスAPI（`searchQuizzes`）の拡張
  - `src/services/quiz.ts` の `searchQuizzes` において、`queryText` を受け取った際の並行クエリ処理（タグ一致、作者名完全一致、ジャンル一致、新着クイズ取得）を実装し、取得したクイズの一覧を `id` で重複排除する。
  - 重複排除されたクイズ一覧に対して、タイトル（`title`）、説明（`description`）、作者名（`authorName`）、ジャンル（`genre`）、タグ（`tags`）に小文字化した `queryText` が含まれるかどうかの部分一致フィルタリング処理をメモリ上で実行する。
  - クイズ難易度および問題数の詳細フィルター（`difficultyMin/Max`, `minQuestions/MaxQuestions`）が指定されている場合は、それらも適用した結果を返すようにする。
  - **完了状態**: 検索条件として `queryText` が与えられたとき、Firestore から関連データを並行クエリで取得し、タイトル・説明・作者・ジャンル・タグのいずれかに部分一致するクイズのみが、詳細フィルターの条件を満たした上で重複なく返されること。
  - _Requirements: 11.8, 11.9_
  - _Boundary: QuizService_

- [x] 9.2 統合検索の単体・統合テストの追加
  - `tests/services/quiz-search-universal.test.ts` を新規作成し、統合検索（ハイブリッド検索）における並行クエリ発行、IDによる重複排除、大文字小文字を区別しない部分一致フィルタリング、詳細条件フィルタ（難易度、問題数）の適用が期待通り動作することを検証するテストスイートを記述する。
  - **完了状態**: 新規作成したテストファイル `tests/services/quiz-search-universal.test.ts` を Jest で実行した際に、すべてのテストケースがグリーンであること。
  - _Requirements: 11.8, 11.9_
  - _Depends: 9.1_
  - _Boundary: Testing_

- [x]* 9.3 統合検索の回帰スモークテスト（任意）
  - 統合検索機能の拡張後も、既存の `searchQuizzes` （`queryText` なしで詳細フィルターのみを指定するパターンなど）が正常に動作し、既存のクイズ検索・一覧のテストスイートが破壊されていないことを確認する。
  - **完了状態**: 既存のクイズ・検索に関連するテストスイート（`tests/services/quiz-genre-query.test.ts` など）を実行した際に、テストがすべてパスすること。
  - _Requirements: 11.5_
  - _Depends: 9.2_
  - _Boundary: Testing_

---

### 10. Phase 10 拡張 — タグマスタ一覧と複数タグ AND 複合検索（2026-06）

- [x] 10.1 (P) クイズ×タグ照合の純関数（タグ AND 検索の共通ロジック）
  - 単一クイズが指定タグ（canonical 解決済み）を満たすかを判定する純関数を実装し、`canonicalTagIds` 優先・legacy `tags` フォールバックの照合規則を `getQuizzesByTag` と一致させる
  - 複数タグ指定時にすべてのタグ条件を満たすかを判定する AND 用ヘルパーを実装する
  - 照合ロジックの単体テスト（canonical のみ一致、legacy のみ一致、マージ旧タグ文字列一致、不一致）を追加する
  - **完了状態**: `quiz-tag-match` の単体テストがグリーンであり、要件 11.3 と同一規則でタグ一致が判定できること
  - _Requirements: 16.7, 16.8_
  - _Boundary: quiz-tag-match_

- [x] 10.2 (P) 有効タグマスタ一覧 API（`listActiveTags`）
  - `metadata_tags` から存続タグ（`canonicalId` が未設定）のみを読み取り、ドキュメント ID と `tagName` を含む一覧を返す API を実装する
  - 返却一覧を一貫した並び順（`tagName` のロケール昇順、同順時は `id`）でソートし、0 件時は空配列を返す
  - 読み取り失敗時は例外をそのまま伝播し、ハードコードフォールバックを行わない
  - 存続タグフィルタ・ソート・空配列の単体テストを追加する
  - **完了状態**: `listActiveTags()` がマージ吸収済みタグを含まず、安定ソートされた `TagMetadata[]` を返し、関連テストがグリーンであること
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5_
  - _Boundary: QuizService_

- [x] 10.3 `searchQuizzes` への複数タグ AND フィルタ拡張
  - 複合検索フィルタにタグ識別子配列を追加し、各要素を `normalizeTag` で正規化して重複を除去してから照合に用いる
  - 複数タグ指定時は各タグ条件を AND で適用し、キーワード（自由テキスト）・ジャンル・難易度・問題数フィルタと AND 合成する
  - キーワードが空でタグのみ（またはタグ＋詳細フィルタのみ）指定された場合も検索を実行し、単一タグ時は既存タグ一覧取得、複数タグ時はタグごとの候補集合の積集合を母集団とする
  - タグ配列が空または未指定のときは従来の `searchQuizzes` 挙動を維持する
  - **完了状態**: `searchQuizzes('', { tags: ['a','b'] })` が両タグを満たすクイズのみ返し、`searchQuizzes('kw', { tags: ['x'] })` がキーワード部分一致とタグ x を同時に満たすクイズのみ返すこと
  - _Requirements: 16.6, 16.9, 16.10, 16.11, 16.12, 16.13, 16.14, 16.15_
  - _Depends: 10.1_
  - _Boundary: QuizService_

- [x] 10.4 タグ AND 複合検索の単体・統合テスト
  - 単一タグ・複数タグ AND、キーワード併用、タグのみ検索、重複タグ除去、legacy タグフォールバックを検証するテストスイートを追加する
  - **完了状態**: 新規テストファイルを Jest で実行した際にすべてグリーンであること
  - _Requirements: 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12, 16.13_
  - _Depends: 10.2, 10.3_
  - _Boundary: Testing_

- [x] 10.5 Phase 10 統合検証
  - `listActiveTags` と拡張済み `searchQuizzes`（`tags` 配列）を統合テストで検証し、Phase 9 統合検索の既存パスが破壊されていないことを確認する
  - **完了状態**: Phase 10 関連 Jest がグリーンであり、`quiz-search-universal` 等の既存検索テストもパスすること
  - _Depends: 10.4_
  - _Requirements: 16.1, 16.2, 16.3, 16.4, 16.5, 16.6, 16.7, 16.8, 16.9, 16.10, 16.11, 16.12, 16.13, 16.14, 16.15_

- [x]* 10.6 Phase 10 回帰スモーク（任意）
  - `getQuizzesByTag` および Phase 9 `searchQuizzes`（キーワードのみ）が Phase 10 変更後も期待どおり動作することを確認する
  - **完了状態**: `quiz-genre-query`・`quiz-search-universal` 関連テストがグリーンであること
  - _Depends: 10.5_
  - _Boundary: Testing_

---

### 11. Phase 11 拡張 — 出題形式フィルタ付き複合検索（2026-06）

> 設計: 形式照合は `quiz-format-match` に集約。判定は `resolveQuizFormat` 経由（UI カード表示と同一規則）。Firestore インデックス新設なし。探索 UI は `quizetika-play-flow-ui` が `searchQuizzes` 拡張に依存。

- [x] 11.1 (P) クイズ×出題形式照合の純関数
  - 単一クイズが指定出題形式を満たすかを `resolveQuizFormat` で判定する純関数を実装する（`quiz.format` 直読み禁止）
  - クイズ配列に対する形式フィルタヘルパーを実装し、`format` 未指定時は入力配列をそのまま返す
  - 単体テストで `format` フィールド一致、問題 `type` からの推定一致、不一致、未指定パススルーを検証する
  - レガシーフィクスチャ `{ format: undefined, questions: [] }` が `mixed` フィルタのみ一致し、他形式では不一致となることを固定する
  - **完了状態**: `quiz-format-match` 関連 Jest がグリーンであり、UI と同一 lib 規則で形式一致が判定できること
  - _Requirements: 17.1, 17.6_
  - _Boundary: quiz-format-match_

- [x] 11.2 `searchQuizzes` への出題形式フィルタ拡張
  - 複合検索フィルタに出題形式（`QuizFormat`）を追加し、未指定時は形式による追加絞り込みを行わない
  - 後段フィルタの canonical 順序を `needle → tags AND → genre → format → difficulty/questionCount` とし、形式フィルタはジャンル直後・数値フィルタ直前に適用する
  - ジャンル識別子固定の scoped 検索では既存 `expandGenreIdsForQuery` を維持し、他ジャンルのクイズを結果に含めない
  - キーワード・タグ・ジャンル・難易度・問題数等の既存条件と形式フィルタを AND 合成する
  - キーワード・タグ・ジャンルが空で形式のみ指定された場合は既存どおり最新公開クイズを母集団とし、後段で形式フィルタを適用する
  - **完了状態**: `searchQuizzes('', { format: 'multiple-choice' })` が選択式クイズのみ返し、`searchQuizzes('', { genreId: 'science', format: 'lateral-thinking' })` が当該ジャンル内のウミガメ形式のみ返ること
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.7_
  - _Depends: 11.1_
  - _Boundary: QuizService_

- [x] 11.3 出題形式フィルタの単体・統合テスト
  - 形式のみ、ジャンル+形式 scoped、キーワード+タグ+形式 AND、形式未指定時の Phase 10 回帰を検証するテストスイートを追加する
  - Firestore インデックス新設なし（後段フィルタ）であることをモック母集団で確認する
  - **完了状態**: 新規テストファイル（`quiz-format-match` / 形式フィルタ付き `searchQuizzes`）を Jest で実行した際にすべてグリーンであること
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_
  - _Depends: 11.2_
  - _Boundary: Testing_

- [x] 11.4 Phase 11 統合検証
  - 拡張済み `searchQuizzes`（`format` フィルタ）と Phase 10 タグ AND 検索・Phase 9 統合検索の既存パスが破壊されていないことを統合テストで検証する
  - **完了状態**: Phase 11 関連 Jest がグリーンであり、`quiz-search-universal` 等の既存検索テストもパスすること
  - _Depends: 11.3_
  - _Requirements: 17.1, 17.2, 17.3, 17.4, 17.5, 17.6, 17.7_

- [ ]* 11.5 Phase 11 回帰スモーク（任意）
  - `format` 未指定の `searchQuizzes` 呼び出し（キーワードのみ・タグのみ・ジャンルのみ）が Phase 11 変更後も Phase 10 と同一結果になることを確認する
  - **完了状態**: 既存 `quiz-search-universal`・タグ AND 検索テストスイートがグリーンであること
  - _Depends: 11.4_
  - _Requirements: 17.3_
  - _Boundary: Testing_

---

### 12. Phase 12 拡張 — スマートサジェスト向けデータ提供と検索ログ（2026-06）

- [x] 12.1 (P) 検索ログ記録用モジュールと `writeSearchLog` の実装
  - `src/lib/search-log.ts` を作成し、認証ユーザーが空でないキーワードまたはタグで検索した際に `search_logs` コレクションにログを記録する `writeSearchLog` を実装する。
  - エラー発生時は呼び出し元（検索処理）を中断せず、エラーログ出力のみでサイレントに無視する。未認証時や空クエリ時は早期リターンする。
  - **完了状態**: ユニットテストが通り、指定条件下で `search_logs` ドキュメントが正しく生成されること。
  - _Requirements: 18.11, 18.12, 18.13, 18.14, 18.15, 18.16_
  - _Boundary: search-log_

- [x] 12.2 週間人気ジャンル集計 API エンドポイントの実装
  - `src/app/api/genres/weekly-top/route.ts` を作成し、直近7日間に完了した `attempts` の中からプレイ件数（完了数）の多い順にジャンルTop5を返すAPIを実装する。
  - 不足分はダミーデータで埋めず、Next.js revalidate による30分（1800秒）キャッシュを適用する。
  - **完了状態**: API が正しいソート順で `{ genres: GenreWeeklyEntry[] }` を返し、テストスイートがパスすること。
  - _Requirements: 18.1, 18.2, 18.3, 18.4, 18.5_
  - _Boundary: API Layer_

- [x] 12.3 週間人気ワード／タグ集計 API エンドポイントの実装
  - `src/app/api/search/weekly-top/route.ts` を作成し、直近7日間の `search_logs` から人気ワードTop5および人気タグTop5を別フィールドとして返すAPIを実装する。
  - revalidate による30分キャッシュを適用する。
  - **完了状態**: API が `{ keywords: string[], tags: string[] }` を件数順ソートで返し、テストスイートがパスすること。
  - _Requirements: 18.6, 18.7, 18.8, 18.9, 18.10_
  - _Boundary: API Layer_

- [x] 12.4 統合検索 `searchQuizzes` へのログ記録組み込み
  - `src/services/quiz.ts` の `searchQuizzes` 内で、検索キーワードやタグが存在する場合に `writeSearchLog` を fire-and-forget で呼び出すよう修正する。
  - **完了状態**: `searchQuizzes` 呼び出しにより検索ログがサイレントに記録されるが、書き込み失敗時も検索処理自体は正常終了すること。
  - _Requirements: 18.11, 18.12, 18.13_
  - _Depends: 12.1_
  - _Boundary: QuizService_

- [x] 12.5 Phase 12 統合検証
  - 検索ログ記録、二系統の週間集計APIが正常に動作し、既存の検索機能が破壊されていないことを Jest で検証する。
  - **完了状態**: スマートサジェストデータ提供機能に関連するテストスイートがすべてグリーンであること。
  - _Depends: 12.2, 12.3, 12.4_

---

### 13. Phase 13 拡張 — 難易度5段階化 (2026-06)

- [x] 13.1 (P) データモデルとバリデーションルールの変更
  - `Quiz` 型の `difficulty` の許容範囲を 1〜5 に、`Attempt` 型の `difficultyVote` の許容範囲を 1〜5 に更新する。
  - クイズ公開バリデーション (`validateQuizForPublish`) にて、難易度が 1〜5 の範囲内であることを検証するようにする。
  - 難易度投票時のバリデーション（`submitDifficultyVote` など）における範囲を 1〜5 に修正する。
  - **完了状態**: 難易度 6 以上のクイズ保存や難易度 6 以上の投票がバリデーションエラーで弾かれ、1〜5 の範囲内なら保存できること。
  - _Requirements: 3.5_
  - _Boundary: types, QuizService, AttemptService_

- [x] 13.2 (P) テストデータおよび既存ユニットテストの修正
  - 既存のテストデータ (`test_data.json` 等) に含まれる 6 以上の難易度を、1〜5 の範囲に手動で丸める。
  - 既存のユニットテストにおいて、難易度の期待値が 6 以上になっているケースを 1〜5 に適合するように修正する。
  - **完了状態**: テストデータ読み込みでバリデーションエラーが発生が発生せず、既存のテストスイートが正常にパスすること。
  - _Requirements: 3.5_
  - _Boundary: Testing, Data_

- [x] 13.3 Phase 13 統合検証
  - 難易度5段階化に伴う型定義、クイズ保存、難易度投票、およびテストスイート全体が正常に動作することを確認する。
  - **完了状態**: コア層のすべてのテスト（Jest）が正常にパスすること。
  - _Depends: 13.1, 13.2_

---

### 14. Phase 14 拡張 — Stripe サブスクリプション（Pro プラン）（2026-06）

> 要件 19・設計 Phase 13 に対応。旧 Phase 13（難易度5段階化）とは別フェーズ。

- [x] 14.1 サブスクリプション基盤型・プラン定義・Stripe クライアント初期化
  - `SubscriptionTier`（`free` | `pro` | `premium`）、`SubscriptionStatus`、課金関連フィールドを共通ユーザー型に追加し、未設定時は `free` として解釈する契約を型層に定義する
  - 有料 tier 定義マスタ（初版 Pro のみ、月額/年額 Price ID マッピング、`priceIdToTier`）を単一モジュールに集約し、将来 Premium 追加時は定義配列への1エントリ追加で拡張可能にする
  - Stripe サーバー SDK のシングルトン初期化と、起動時の必須環境変数（Secret Key、Webhook Secret、Pro Price ID 2種、`NEXT_PUBLIC_APP_URL`）検証を実装する
  - **完了状態**: 型チェックが通り、Pro の Price ID から `pro` tier が解決され、必須 env 未設定時に明確なエラーが返ること
  - _Requirements: 19.1, 19.2, 19.3, 19.4_
  - _Boundary: subscription-plans, types_

- [x] 14.2 Firestore Security Rules による課金フィールド保護
  - `users` 更新時に `subscriptionTier`、`isPremium`、`stripeCustomerId`、`stripeSubscriptionId`、`subscriptionStatus`、`currentPeriodEnd` がオーナー操作で変更不可となるルールを追加する
  - 新規ユーザー作成時は課金フィールド未設定、または `subscriptionTier == 'free'` かつ `isPremium == false` のみ許可する
  - `stripe_processed_events` コレクションはクライアント read/write 不可とする（Admin SDK のみ書き込み）
  - **完了状態**: `npm run deploy:rules` 後、クライアント SDK から `isPremium: true` への自己更新が Rules で拒否されること
  - _Requirements: 19.18_
  - _Depends: 14.1_
  - _Boundary: firestore.rules_

- [x] 14.3 エンタイトルメント解決サービスの実装
  - ユーザーの契約 tier・契約状態・請求期間終了日時を一貫した規則で解釈し、`hasPaidEntitlements`（`pro`/`premium` かつ `active`/`trialing`）を返すサービスを実装する
  - モデレーター/シニアモデレーターは契約 tier に関わらず AI 質問無制限と判定する既存特権免除を維持する
  - Stripe サブスクリプションスナップショットから Firestore ユーザードキュメントへ tier・識別子・`isPremium` 同期書き込みを行う更新メソッドを実装する（Admin SDK 経由）
  - **完了状態**: `free` / active `pro` / 解約済み `pro` / モデレーターの4ケースで `hasUnlimitedAiQuestions` が期待どおり判定されること
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.11, 19.15, 19.16, 19.19_
  - _Depends: 14.1_
  - _Boundary: EntitlementService_

- [x] 14.4 (P) Stripe 購読・契約管理サービスの実装
  - Firebase UID とメールから Stripe Customer を取得または新規作成し、`metadata.firebaseUid` を付与して永続化する
  - 認証済み無料ユーザー向けに Checkout Session（subscription モード、月額/年額選択、動的 payment methods）を発行し、リダイレクト URL を返す。既存有料契約者には 409 を返す
  - 有効な有料契約者向けに Customer Portal Session を発行する。契約未保有者には 404 を返す
  - **完了状態**: free ユーザーが Checkout URL を取得でき、active pro ユーザーが Portal URL を取得し、重複 Checkout は拒否されること
  - _Requirements: 19.5, 19.7, 19.8, 19.13, 19.14_
  - _Depends: 14.3_
  - _Boundary: SubscriptionService_

- [x] 14.5 (P) Stripe Webhook ハンドラの実装
  - raw body + 署名検証（Node runtime）で Webhook を受信し、署名失敗時は状態更新せず 400 を返す
  - `checkout.session.completed`、`customer.subscription.created/updated/deleted`、`invoice.payment_failed` を処理し、`priceIdToTier` で tier を解決してエンタイトルメントサービスへ委譲する
  - `stripe_processed_events/{eventId}` による冪等処理を実装し、同一イベントの二重適用を防ぐ
  - **完了状態**: テスト用署名付き subscription.updated イベントで `users.subscriptionTier` が `pro` に更新され、同一 eventId の再送で二重更新されないこと
  - _Requirements: 19.9, 19.10, 19.11, 19.12_
  - _Depends: 14.3_
  - _Boundary: StripeWebhookAPI_

- [x] 14.6 購読開始 API エンドポイントの実装
  - Bearer 認証済みユーザーのみ `POST /api/billing/checkout-session` を受け付け、`priceInterval`（monthly/yearly）を検証して Checkout Session URL を返す
  - 未認証リクエストは 401、BAN ユーザーは 403、既存有料契約は 409 を返す
  - **完了状態**: 有効トークン + free ユーザーで `{ sessionUrl }` が返り、未認証で 401 になること
  - _Requirements: 19.5, 19.6, 19.7_
  - _Depends: 14.4_
  - _Boundary: CheckoutSessionAPI_

- [x] 14.7 契約管理 API エンドポイントの実装
  - Bearer 認証済みかつ有料契約中ユーザーのみ `POST /api/billing/portal-session` で Customer Portal URL を返す
  - 無料ユーザーは 404、未認証は 401、BAN ユーザーは 403 を返す
  - **完了状態**: active pro ユーザーが Portal URL を取得し、free ユーザーが 404 になること
  - _Requirements: 19.13, 19.14_
  - _Depends: 14.4_
  - _Boundary: PortalSessionAPI_

- [x] 14.8 水平思考 AI 質問 API の tier ベース制限連携
  - AI 質問 API がクライアント送信のプラン情報を盲信せず、エンタイトルメントサービスから最新の `hasUnlimitedAiQuestions` を参照して日次20回制限を判定する
  - 無料 tier で上限到達時は 429 とともに Pro プラン購読で制限解除される旨のメッセージを返す
  - 認証コンテキストのユーザープロフィール読み取り時に `subscriptionTier` 未設定を `free` として扱う（UI 連携用）
  - **完了状態**: active pro ユーザーの21回目 AI 質問が 429 にならず、free ユーザーの20回目で 429 + Pro 誘導メッセージになること
  - _Requirements: 4.2, 4.3, 4.4, 19.15, 19.17, 19.19_
  - _Depends: 14.3_
  - _Boundary: AskAiQuestionAPI, auth-context_

- [x] 14.9 Phase 14 統合検証
  - エンタイトルメント解決、Checkout/Portal API、Webhook 冪等、ask-ai tier 連携、Rules 拒否の Jest 結合テストを追加する
  - 既存 `ask-ai-utils` テストおよび全コアテストスイートがグリーンであることを確認する
  - **完了状態**: Phase 14 関連テストがすべてパスし、既存テストに回帰がないこと
  - _Depends: 14.2, 14.5, 14.6, 14.7, 14.8_
  - _Requirements: 19.1, 19.2, 19.3, 19.4, 19.5, 19.6, 19.7, 19.8, 19.9, 19.10, 19.11, 19.12, 19.13, 19.14, 19.15, 19.16, 19.17, 19.18, 19.19, 4.2, 4.3, 4.4_
  - _Boundary: Testing_

- [ ]* 14.10 Phase 14 Stripe CLI 手動検証（任意）
  - `stripe listen --forward-to localhost:3000/api/webhooks/stripe` で Checkout 完了後に Firestore の tier が `pro` に更新されることを手動確認する
  - **完了状態**: テストモード Checkout → Webhook → `users.subscriptionTier === 'pro'` の一連フローがローカルで再現できること
  - _Depends: 14.5, 14.6_
  - _Requirements: 19.8, 19.9_
  - _Boundary: Testing_

---

### 15. Phase 14 拡張 — ウミガメのスープ真相 AI 意味判定（2026-06-08）

> 要件 Phase 14・設計 Phase 14 に対応。旧タスク 2.5 の B2 ハイブリッド（キーワード全一致 → AI バイパス）を本フェーズで置き換える。テストプレイのローカルキーワード判定は対象外。

- [x] 15.1 真相判定プロンプトへのエッセンスキーワード組み込み
  - 真相判定用プロンプト構築処理に `truthKeywords` 引数を追加し、裏設定・必須エッセンス・プレイヤー要約の3要素を AI へ渡す文言を生成する
  - 判定基準に「キーワード文言の出現は不要、エッセンスの意味が捉えられていれば合格可」を明示し、既存のプロンプトインジェクション防衛ルールは維持する
  - キーワードが空配列の場合もプロンプトが生成され、実行時に AI 判定可能なフォールバック文言を含める
  - **完了状態**: プロンプト出力に裏設定・各 `truthKeywords`・プレイヤー要約・エッセンス意味判定の指示が含まれ、型チェックが通ること
  - _Requirements: 4.7, 4.8, 4.9_
  - _Boundary: verify-truth-utils_

- [x] 15.2 真相判定 API の AI 一本化（キーワードバイパス廃止）
  - 真相判定 API から文字列部分一致による即合格分岐を削除し、真相提出のたびに AI 意味判定を実行する
  - AI 呼び出し時に拡張済みプロンプト構築処理へ `truthKeywords` を渡す。合格・不合格時の attempt 更新・リーダーボード更新・履歴追加の既存フローは変更しない
  - AI 利用不能時は 503 を返し、文字列一致による代替合格は行わない
  - **完了状態**: キーワードが要約に全て含まれていても API が常に AI を呼び出し、AI 不合格時は不合格となること（バイパス経路がコード上存在しないこと）
  - _Requirements: 4.7, 4.10, 4.11, 4.12_
  - _Depends: 15.1_
  - _Boundary: VerifyTruthAPI_

- [x] 15.3 (P) 真相 AI 意味判定の単体テスト更新
  - プロンプト構築の既存テストを3引数呼び出しに更新し、エッセンスキーワードと意味判定指示がプロンプトに含まれるケースを追加する
  - `verifyKeywords` の単体テストは維持する（テストプレイ向けロジックの回帰防止）
  - **完了状態**: `verify-truth-utils` 関連 Jest がグリーンで、新規プロンプト検証ケースがパスすること
  - _Depends: 15.1_
  - _Requirements: 4.8, 4.9_
  - _Boundary: verify-truth-utils, Testing_

- [x] 15.4 Phase 15 統合検証
  - 真相判定 API のモック Gemini 結合テストを追加し、常時 AI 呼び出し・CORRECT 時の完了更新・INCORRECT 時のアドバイス返却・Gemini 例外時の 503 を検証する
  - 既存コアテストスイートが回帰なくグリーンであることを確認する
  - **完了状態**: Phase 15 関連テストがすべてパスし、旧 B2 バイパス前提のテストが残っていないこと
  - _Depends: 15.2, 15.3_
  - _Requirements: 4.7, 4.8, 4.9, 4.10, 4.11, 4.12_
  - _Boundary: VerifyTruthAPI, Testing_

---

### 16. Phase 16 — 水平思考プレイ UX 改修（2026-06）

> 要件 4.6, 4.12–4.19・設計 Phase 16 に対応。チャット統合入力、諦め、経過時間、不合格フィードバック簡素化、ルール説明。

- [x] 16.1 真相判定 API の Admin SDK 化と経過秒数保存
  - 真相判定 API を Firebase Admin SDK で Firestore 更新し、ID トークン検証と attempt 本人確認を行う
  - 合格時にクライアント送信 `elapsedSeconds` を attempt およびリーダーボードエントリへ保存する
  - **完了状態**: サーバー側 `request.auth` 不足による permission-denied が発生せず、合格 attempt に経過秒数が記録されること
  - _Requirements: 4.17, 4.19_
  - _Boundary: VerifyTruthAPI_

- [x] 16.2 不合格フィードバックの固定2種正規化
  - 真相判定プロンプトで AI に `REASON: MISSING_ESSENCE` / `UNRELATED` のみ出力させる
  - レスポンスパースで「必須要素が足りていません。」「提出された内容は真相と異なります。」に正規化し、詳細ヒントを表示しない
  - **完了状態**: 不合格時 `advice` が上記2文言のいずれかのみであること
  - _Requirements: 4.12_
  - _Boundary: verify-truth-utils_

- [x] 16.3 諦め API と解説開示
  - 諦め API を新設し、認証済み本人の未完了 attempt を不合格完了（`score: 0`）として記録する
  - `explanation` 優先・未設定時 `aiContextDetails` フォールバックで `revealText` を返却する
  - `playCount` をインクリメントし、クライアント計測 `elapsedSeconds` を保存する
  - **完了状態**: 諦め後に解説が表示され、質問・真相入力が不可になること
  - _Requirements: 4.15, 4.17, 4.19_
  - _Boundary: GiveUpLateralAPI, lateral-give-up-utils_

- [x] 16.4 プレイ画面 UI（チャット統合入力・経過時間・ルール説明）
  - チャット下部に「質問する」「回答する」切替を実装し、真相入力をチャットに統合する
  - チャットヘッダーに経過時間を表示する（右パネルタイトル横には表示しない）
  - 諦め／合格時に入力・送信・モード切替をロックし、送信ボタンをグレーアウトする
  - 右パネルにプレイヤー向けルール説明（システム説明なし）を表示する
  - **完了状態**: 質問モードと回答モードが切り替え可能で、ルールが右パネルから把握できること
  - _Requirements: 4.6, 4.13, 4.14, 4.16, 4.18_
  - _Depends: 16.3_
  - _Boundary: quiz-play-client_

- [x] 16.5 (P) Phase 16 単体・API テスト
  - `lateral-give-up-utils`、`format-play-elapsed`、`give-up-lateral` API、`verify-truth-utils` REASON 正規化のテストを追加・更新する
  - **完了状態**: Phase 16 関連 Jest がグリーンであること
  - _Depends: 16.1, 16.2, 16.3_
  - _Requirements: 4.12, 4.15, 4.17_
  - _Boundary: Testing_

---

### 17. Phase 17 — ウミガメ認証・二層制限・諦めフロー改定（2026-06-08）

> 要件 4（Phase 17 節）・要件 19.11, 19.15, 19.17–19.18, 19.20・設計 Phase 17 に対応。Phase 16 の諦め解説開示（16.3）を本フェーズで上書き廃止。旧タスク 2.4 / 14.8 の日次20回制限を二層制限（30/クイズ・150/日横断）に置き換える。

- [x] 17.1 AI 質問制限・正規化ユーティリティの拡張
  - 同一クイズ 30 回/日・全クイズ横断 150 回/日の定数と二層制限判定ロジックを実装する
  - 質問文の正規化（trim・小文字化・空白統一）と正規化一致によるキャッシュ検索を実装する
  - 成功応答の残り回数をクイズ別・横断の 2 値形状に変更する
  - **完了状態**: 単体テストで 30 回目/150 回目の制限超過、正規化一致キャッシュ、Pro 無制限が期待どおりであること
  - _Requirements: 4.6, 4.7, 4.10_
  - _Boundary: ask-ai-utils_

- [x] 17.2 AI 質問 API の二層制限と横断カウンタ連携
  - クイズ別（`dailyAiTurnCounts/{quizId}`）と横断（`dailyAiTurnCounts/_global`）の日次カウンタを同一トランザクションで読み書きし、新規 AI 呼び出し時のみ attempt・両カウンタを同期更新する
  - 無料 tier で上限到達時に 429 と `limitType`（`per-quiz` / `global-daily`）を返却する
  - サーバー側エンタイトルメント参照を維持し、正規化キャッシュヒット時は全カウンタを消費しない
  - 契約失効後の free ユーザーに 30/150 制限が再適用され、active pro ユーザーは 31 回目・151 回目も 429 にならない
  - **完了状態**: free ユーザーが 30 回目または 150 回目で正しい `limitType` の 429 を受け、真相提出 API は引き続き利用可能であること
  - _Requirements: 4.6, 4.7, 4.8, 4.9, 4.11, 19.11, 19.15, 19.17, 19.18, 19.20_
  - _Depends: 17.1_
  - _Boundary: AskAiQuestionAPI_

- [x] 17.3 (P) 水平思考 attempt 作成の制限値と listId 引き継ぎ
  - lateral attempt 作成時の AI 質問上限を 30 に更新する
  - リスト連続プレイ文脈から渡された `listId` を attempt に保存する
  - **完了状態**: 新規 lateral attempt の `aiTurnLimit` が 30 であり、`listId` 付き URL から開始した attempt に `listId` が記録されること
  - _Requirements: 4.4, 4.23_
  - _Boundary: AttemptService_

- [x] 17.4 (P) 諦め API の真相非返却化
  - 諦め API の成功応答から解説テキスト返却を除去し、`{ completed: true }` のみ返す
  - attempt の不合格完了・経過秒数保存・`playCount` 更新は維持する
  - **完了状態**: 諦め API の 200 応答に `revealText` キーが含まれず、attempt が `score: 0` で完了すること
  - _Requirements: 4.21, 4.25, 4.27_
  - _Boundary: GiveUpLateralAPI_

- [x] 17.5 クライアント AI 質問状態管理のサーバー同期
  - 共有正規化関数を利用し、クライアント側の重複 20 回ガードを削除する
  - サーバー返却の残り回数（perQuiz / globalDaily）と `limitType` 付きエラーを UI 状態に反映する
  - **完了状態**: 表記ゆれの重複質問が API を呼ばずキャッシュ返却され、上限到達時にサーバー由来の `limitType` が利用できること
  - _Requirements: 4.10, 4.11_
  - _Depends: 17.1, 17.2_
  - _Boundary: useAiPlayState_

- [x] 17.6 プレイ画面の認証・制限誘導・諦めナビ・エンタイトルメント連携
  - 未登録のウミガメ直アクセス時にログイン画面へ戻り先付きで誘導し、詳細画面の「会員登録してプレイする」表記を維持する
  - `isPremium` ハードコードを廃止しサーバー解決した契約状態を反映する
  - 制限到達時に Pro プラン（`/pricing`）への誘導を表示する
  - 諦め後に真相・解説を表示せず、チャット内に「結果画面へ」を常時表示し、`listId` がある場合は「次の問題へ」も表示する
  - 右パネルのルール説明を 30/150 制限に更新する
  - **完了状態**: 諦め後に解説が表示されずチャット内 CTA が機能し、制限到達時に `/pricing` へのリンクが表示されること
  - _Requirements: 4.1, 4.2, 4.3, 4.11, 4.12, 4.22, 4.23, 4.24, 4.26_
  - _Depends: 17.3, 17.4, 17.5_
  - _Boundary: quiz-play-client, quiz-detail-client_

- [x] 17.7 (P) 料金表示の Free プラン上限文言更新
  - 料金表示モジュールの無料プラン説明を「同一クイズ 30 回/日・全クイズ横断 150 回/日」に更新する
  - **完了状態**: 料金画面の Free プラン説明が新制限値と一致すること
  - _Requirements: 4.6, 4.7_
  - _Boundary: pricing-display_

- [x] 17.8 Phase 17 単体・API テスト更新
  - `ask-ai-utils`・`give-up-lateral` のテストを Phase 17 契約（30/150、正規化、`limitType`、`completed: true`）に更新する
  - ask-ai 統合テスト（二層制限・キャッシュ非消費）を追加する
  - **完了状態**: Phase 17 関連 Jest がグリーンであり、旧 20 回制限・`revealText` 期待のテストが残っていないこと
  - _Depends: 17.1, 17.2, 17.4_
  - _Requirements: 4.6, 4.7, 4.10, 4.21_
  - _Boundary: Testing_

- [x] 17.9 Phase 17 統合検証
  - Phase 14 真相 AI 意味判定・Phase 16 プレイ UX（統合入力・経過時間・固定不合格メッセージ）の回帰がないことを確認する
  - 全コアテストスイートがグリーンであることを確認する
  - **完了状態**: 既存テストに回帰がなく、Phase 17 の受け入れ基準が満たされること
  - _Depends: 17.### 29. Phase 41: 有料プランの多層化・二重課金防止・プラン変更 (2026-07-13)

- [x] 29.1 (P) tier→capability マッピングの実装
  - `entitlement-shared.ts` に `SubscriptionCapability` 型（`ad_free` / `unlimited_ai_questions` / `quiz_visibility_control` / `ai_authoring_assist`）と tier ごとの capability 集合マップを追加する
  - `computeUserEntitlements()` の戻り値に `hasCreatorEntitlements` フィールドを追加する（`creator`/`premium` かつ有効契約のときのみ true）
  - **完了状態**: `free`/`player`/`creator`/`premium` × 契約状態の全組み合わせに対し `hasPaidEntitlements`・`hasUnlimitedAiQuestions`・`hasCreatorEntitlements` が仕様通りの値を返す単体テストがグリーンであること
  - _Requirements: 33.1, 33.2, 33.14, 33.15_
  - _Boundary: EntitlementShared_

- [x] 29.2 (P) tier定義の拡張と Price ID 解決 of tier 引数化
  - `subscription-plans.ts` に `player` tier 定義を追加し、既存 `pro` エントリの `tier` フィールド値を `creator` に変更する
  - `getPriceIdForInterval()` を tier 引数を取る形へシグネチャ変更する
  - **完了状態**: `getPriceIdForInterval('player', 'monthly')` と `getPriceIdForInterval('creator', 'yearly')` がそれぞれ正しい Price ID を返すこと
  - _Requirements: 33.1, 33.4, 33.17_
  - _Boundary: SubscriptionPlans_

- [x] 29.3 (P) クイズ限定公開ゲートの判定切り替え
  - `quiz-access.ts` の `canAccessProVisibility()` の判定を `hasPaidEntitlements` から `hasCreatorEntitlements` へ変更する
  - `ProRequiredForVisibilityError` のメッセージ文言を Creator 表記へ更新する
  - **完了状態**: `player` tier のエンタイトルメントで `canAccessProVisibility()` が `false` を返し、`creator`/`premium` では `true` を返すこと
  - _Requirements: 33.14, 33.15_
  - _Depends: 29.1_
  - _Boundary: QuizAccessGate_

- [x] 29.4 (P) AI作問アシスタントゲートの判定切り替え
  - `ai-authoring-utils.ts` の `canAccessAiAuthoring()` の判定を `hasCreatorEntitlements` ベースへ変更する
  - **完了状態**: `player` tier のエンタイトルメントで `canAccessAiAuthoring()` が `false` を返し、`creator`/`premium` では `true` を返すこと
  - _Requirements: 33.14, 33.15_
  - _Depends: 29.1_
  - _Boundary: AiAuthoringGate_

- [x] 29.5 (P) 広告表示判定の一本化
  - `useAds.ts` の独自 tier 文字列比較ロジックを削除し、`computeUserEntitlements().hasPaidEntitlements` を参照する形へ置き換える
  - **完了状態**: `player`/`creator`/`premium` いずれの有効契約でも広告が非表示になり、`free` では表示されること
  - _Requirements: 33.14_
  - _Depends: 29.1_
  - _Boundary: UseAdsHook_

- [x] 29.6 (P) tier別価格取得サービスの実装
  - `billing-prices.ts` の `fetchProPricesFromStripe()` を `fetchPlanPricesFromStripe()` に置き換え、`player`・`creator` 両方の月額・年額価格を取得して返すよう変更する
  - **完了状態**: Stripe mock に対して2 tier 分の Price ID で `prices.retrieve` が呼ばれ、`{ player, creator }` 形状のオブジェクトが返ること
  - _Requirements: 33.4_
  - _Depends: 29.2_
  - _Boundary: BillingPrices_

- [x] 29.7 価格取得APIのレスポンス形状変更
  - `/api/billing/prices` route を `fetchPlanPricesFromStripe()` を呼び出す形へ更新し、レスポンスを `{ player, creator }` 形状で返す
  - **完了状態**: `GET /api/billing/prices` が新形状のJSONを返し、既存の単一 tier 形状を返さないこと
  - _Requirements: 33.4_
  - _Depends: 29.6_
  - _Boundary: BillingPricesAPI_

- [x] 29.8 購読開始APIのプラン引数化と重複拒否
  - `subscription.ts` の `createCheckoutSession()` に `plan: 'player' | 'creator'` 引数を追加する
  - 既存有効契約（`player`/`creator` いずれか）を持つユーザーからの新規購読開始要求を、プラン変更（29.16）を案内するエラーで拒否する
  - **完了状態**: `plan` 引数に応じて対応する Price ID で Checkout Session が作成され、既存契約者からの新規購読要求が拒否されること
  - _Requirements: 33.8, 33.9, 33.10, 33.11, 33.12_
  - _Depends: 29.2_
  - _Boundary: SubscriptionService_

- [x] 29.9 購読開始APIルートのプラン検証
  - `/api/billing/checkout-session` route のリクエストボディから `plan` を検証・伝搬する
  - **完了状態**: `plan` が `player`/`creator` 以外の場合に 400 を返すこと
  - _Requirements: 33.8_
  - _Depends: 29.8_
  - _Boundary: CheckoutSessionAPI_

- [x] 29.10 (P) Webhookの有料判定一般化
  - `stripe-webhook.ts` の `buildSnapshotFromSubscription()` の有料判定を `mappedTier === 'pro' || mappedTier === 'premium'` から `mappedTier !== 'free'` へ変更する
  - **完了状態**: `player` tier にマッピングされる Price ID を持つ Subscription イベントで `isPremium` 相当の有料フラグが `true` になること
  - _Requirements: 33.5, 33.6, 33.7, 33.16_
  - _Depends: 29.2_
  - _Boundary: StripeWebhookAPI_

- [x] 29.11 (P) 既存 `pro` 契約者データの `creator` への移行
  - `UPDATE users SET subscription_tier = 'creator' WHERE subscription_tier = 'pro'` を含む Supabase migration ファイルを追加する
  - **完了状態**: migration 実行後、`subscription_tier = 'pro'` の行が0件になり、他フィールド（`stripe_subscription_id` 等）が変化しないこと
  - _Requirements: 33.5, 33.6, 33.7_
  - _Boundary: Migration_

- [x] 29.12 (P) 重複サブスクリプション検知・解約・返金サービスの実装
  - `duplicate-subscription-guard.ts` を新規作成し、指定 Stripe 顧客の有効サブスクリプション一覧を取得、2件以上ある場合は作成日時が最古の1件を残して他を解約、解約分の直近支払い済みInvoiceを全額返金する関数を実装する
  - **完了状態**: 作成日時が異なる2件の有効サブスクリプションを渡した Stripe mock に対し、新しい方が解約・返金され古い方のIDが返る単体テストがグリーンであること
  - _Requirements: 34.4, 34.5, 34.6, 34.7_
  - _Boundary: DuplicateSubscriptionGuard_

- [x] 29.13 (P) 重複インシデント監査テーブルの追加
  - `billing_duplicate_subscription_incidents` テーブルを作成する Supabase migration を追加する（クライアントアクセス不可）
  - **完了状態**: migration 適用後にテーブルが存在し、Admin クライアント以外からの読み書きが RLS で拒否されること
  - _Requirements: 34.7_
  - _Boundary: Migration_

- [x] 29.14 購読開始時のライブ重複チェック統合
  - `createCheckoutSession()` に、DBキャッシュではなく Stripe 側の顧客の有効サブスクリプション一覧をライブ参照する事前チェックを追加する
  - **完了状態**: DB上は `free` だが Stripe上に既に有効なサブスクリプションが存在するケースで購読開始が拒否されること
  - _Requirements: 34.1, 34.2_
  - _Depends: 29.8_
  - _Boundary: SubscriptionService_

- [x] 29.15 Webhookへの重複検知統合
  - `handleStripeSubscriptionEvent()` の冒頭で `duplicate-subscription-guard.ts` の解決関数を呼び出し、返された正のサブスクリプションのみを `applySubscriptionFromStripe()` に渡すよう統合する
  - **完了状態**: 重複解約が発生したイベントで `users.subscription_tier` が正のサブスクリプションの tier のみに更新されること
  - _Requirements: 34.3, 34.4, 34.6_
  - _Depends: 29.10, 29.12_
  - _Boundary: StripeWebhookAPI_

- [x] 29.16 プラン変更サービスの実装
  - `subscription.ts` に `changeSubscriptionPlan(uid, targetPlan)` を追加し、既存サブスクリプションの `items` を対象 Price ID へ `proration_behavior: 'create_prorations'` で更新する。同一プラン指定時は例外をスローする
  - **完了状態**: `player`→`creator` 指定で Stripe `subscriptions.update` が正しい Price ID・`proration_behavior` で呼ばれ、同一tier指定時は Stripe API を呼ばず例外がスローされること
  - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8_
  - _Depends: 29.8_
  - _Boundary: SubscriptionService_

- [x] 29.17 プラン変更APIルートの実装
  - `POST /api/billing/change-plan` route を新規作成し、Bearer認証・`targetPlan` 検証のうえ `changeSubscriptionPlan()` を呼び出す
  - **完了状態**: 有料契約なしユーザーからの呼び出しが403を返し、有効な `player`/`creator` 契約者からの呼び出しが200でtierを返すこと
  - _Requirements: 35.1, 35.2, 35.3, 35.4_
  - _Depends: 29.16_
  - _Boundary: ChangePlanAPI_

- [x] 29.18 (P) Phase 41 単体テストの追加
  - capability マップ、tier引数化、重複検知、プラン変更の各関数について、tier×状態の境界値を含む単体テストを追加する
  - **完了状態**: Phase 41 で変更・追加した全関数の単体テストがグリーンでパスすること
  - _Requirements: 33.1, 33.2, 33.14, 33.15, 34.4, 34.5, 35.1, 35.2, 35.5, 35.6_
  - _Depends: 29.9, 29.14, 29.15, 29.17_
  - _Boundary: Testing_

- [x] 29.19 (P) Phase 41 結合テストの追加
  - 購読開始API・Webhook・プラン変更APIの結合テストを追加し、重複購読拒否・重複解約返金・プラン切替後のtier反映を検証する
  - **完了状態**: Phase 41 に関連する全結合テストがグリーンでパスすること
  - _Requirements: 33.8, 33.9, 33.10, 33.11, 34.1, 34.2, 34.3, 35.7, 35.8_
  - _Depends: 29.9, 29.14, 29.15, 29.17_
  - _Boundary: Testing_

- [x] 29.20 Phase 41 統合検証
  - コア全体のテストスイートを実行し、`subscription_tier = 'pro'` の残存件数確認を含むデプロイ後検証手順を実施する
  - **完了状態**: 全ての Jest テストがグリーンでパスし、`npm run build` がエラーなく成功し、`SELECT count(*) FROM users WHERE subscription_tier = 'pro'` が0件であること
  - _Requirements: 33.1, 33.5, 33.6, 33.7, 34.1, 34.3, 35.1, 35.2_
  - _Depends: 29.18, 29.19_
  - _Boundary: Integration_�ード用カーソル（並び種別・クイズ ID・ソートキー）の encode/decode を実装する
  - 複合検索用オフセットカーソル（offset・クエリ fingerprint）の encode/decode を実装する
  - 無効・改ざんカーソルはエラーを返し、先頭ページへのサイレントフォールバックを行わないこと
  - **完了状態**: カーソル round-trip の単体テストが通り、壊れた base64 入力で例外または明示エラーになること
  - _Requirements: 21.1, 21.2, 21.3, 21.6_
  - _Boundary: quiz-feed-cursor, types_

- [x] 20.2 複合検索パイプラインの素材化関数抽出
  - 既存複合検索のマージ・フィルタ・AND 合成ロジックを、ページングと非ページングで共有する素材化関数へ抽出する
  - 非ページング版 `searchQuizzes` は従来どおり全件返却を維持し、ジャンル scoped 等の既存利用者との互換を保つこと
  - 素材化結果は安定ソート（新着順）で並べ、重複 ID が含まれないこと
  - **完了状態**: 既存 `searchQuizzes` の戻り値がリファクタ前と同等であり、素材化関数が単体でフィルタ結果を返すこと
  - _Requirements: 21.12, 21.13, 21.16, 21.17_
  - _Depends: 20.1_
  - _Boundary: QuizService, materializeSearchQuizzes_

- [x] 20.3 タブ別フィードの段階的取得 API
  - 新着・人気・トレンド・フォロー TL それぞれについて、初回ページと続きページを返す API を実装する
  - `limit + 1` 件取得で続き可否を判定し、同一条件で連続取得してもクイズ ID が重複しないこと
  - フォロー TL は未認証時に空配列を返す既存挙動を維持する
  - 既存の一括取得関数（`getLatestQuizzes` 等）は内部で先頭ページ API を呼ぶ薄いラッパーに変更して互換を保つこと
  - **完了状態**: 各タブで2ページ連続取得の統合テストが通り、2ページ目の先頭 ID が1ページ目に含まれないこと
  - _Requirements: 21.4, 21.5, 21.7, 21.8, 21.9, 21.10, 21.11, 21.15, 21.16, 21.17_
  - _Depends: 20.1_
  - _Boundary: QuizService_

- [x] 20.4 複合検索の段階的取得 API
  - 素材化結果をオフセットでスライスし、初回・続きページを返す `searchQuizzesPaginated` を実装する
  - 続き要求時に fingerprint が一致しない場合はエラーとする
  - 素材化上限（初版 200 件）を超える offset は続き不可とし、誤解を招く空ページを返さないこと
  - 1ページの件数が要求件数未満でも続きがあればカーソルを付与できること
  - **完了状態**: offset 0/20 で合計件数が整合し、条件変更後の古いカーソルでエラーになること
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5, 21.12, 21.13, 21.14, 21.15_
  - _Depends: 20.2_
  - _Boundary: QuizService_

- [x] 20.5 (P) Phase 21 単体・統合テスト
  - カーソルユーティリティ、タブ別ページ API、検索ページ API のテストを追加する
  - 無効カーソル・fingerprint 不一致・published のみ含有を検証する
  - 既存 `searchQuizzes` / `getLatestQuizzes` の後方互換テストを維持する
  - **完了状態**: 関連 Jest がグリーンであり、Phase 21 要件 21.18–21.21（UI 境界）は play-flow-ui に委譲されていること
  - _Requirements: 21.6, 21.16, 21.17, 21.18, 21.19, 21.20, 21.21_
  - _Depends: 20.3, 20.4_
  - _Boundary: Testing_

- [x] 20.6 Phase 21 統合検証
  - コアテストスイート全体がグリーンであることを確認する
  - タブ別・検索別のページング契約が `PaginatedQuizResult` で統一されていることを確認する
  - **完了状態**: `quizetika-play-flow-ui` Phase 26 が消費可能な API 契約が揃っていること
  - _Requirements: 21.1, 21.2, 21.3, 21.4, 21.5_
  - _Depends: 20.5_
  - _Boundary: Integration_

## Implementation Notes (Phase 21)

- 実装順: 20.1 → 20.2/20.3（並行可）→ 20.4 → 20.5 → 20.6。play-flow-ui Phase 26 は 20.3・20.4 完了後に着手。
- ページサイズ既定値は `HOME_FEED_PAGE_SIZE = 20`（design.md Phase 21）。
- ジャンル別・タグ別一覧の段階的取得は本フェーズ対象外。
- 全文検索エンジン化や `searchQuizzes` パイプラインの根本置換は行わない。

---

### 21. Phase 22: ディスカバリーホーム向けデータ提供と検索 URL 状態（2026-06-09）

- [x] 21.1 ディスカバリーフィード定数と既存 API 契約の明文化
  - トレンド Top 10・新着 Top 10 用の件数定数（初版 10 件）を lib に定義する
  - 既存トレンド・新着・有効ジャンル一覧 API が公開中クイズのみを返し、検索画面タブと同一ソート規則であることをコードコメントまたは薄いラッパーで明示する
  - **完了状態**: 定数が export され、ディスカバリーホームと検索タブが同じ件数・ソート規則を参照できること
  - _Requirements: 22.1, 22.2, 22.3, 22.4, 22.12, 22.13_
  - _Boundary: QuizService, GenreMetadata_

- [x] 21.2 検索 URL 状態の型とパース実装
  - 探索タブ・探索フィルタ・フィルタパネル初期展開・プレイ状況を表す URL 状態型を定義する
  - URL クエリ文字列から上記状態へ変換するパース関数を実装する（無効 tab は新着、未知キーは無視、数値は clamp）
  - `openFilters=1` をフィルタパネル初期展開として解釈できること
  - **完了状態**: `tab=trending` / `genreId=xxx` / `openFilters=1` を含むクエリが正しくパースされること
  - _Requirements: 22.5, 22.7, 22.8, 22.9, 22.10, 22.17_
  - _Boundary: search-url-state_

- [x] 21.3 検索 URL 状態のシリアライズ実装
  - 探索タブおよび探索フィルタ条件から URL クエリへ変換するシリアライズ関数を実装する
  - 既定値と同一のパラメータは URL から省略し、タグは正規化・ソートして安定化する
  - Next.js router 用にクエリ文字列（先頭 `?` なし）を組み立てるヘルパを提供する
  - **完了状態**: パース → シリアライズ → 再パースでタブ・フィルタ・openFilters の意味が失われないこと
  - _Requirements: 22.6, 22.11_
  - _Depends: 21.2_
  - _Boundary: search-url-state_

- [x] 21.4 (P) Phase 22 単体テスト
  - 双方向整合、無効 tab 正規化、genreId 深いリンク、既定フィルタの空クエリ省略を検証する
  - **完了状態**: `tests/lib/search-url-state.test.ts` がグリーンであること
  - _Requirements: 22.10, 22.11_
  - _Depends: 21.3_
  - _Boundary: Testing_

- [x] 21.5 Phase 22 統合検証
  - コアテストスイートがグリーンであることを確認する
  - 検索画面段階的取得 API（要件 21）と URL 契約が矛盾しないことを確認する
  - **完了状態**: `quizetika-play-flow-ui` Phase 27 が import 可能な lib が揃っていること
  - _Requirements: 22.14, 22.15, 22.16_
  - _Depends: 21.4_
  - _Boundary: Integration_

## Implementation Notes (Phase 22)

- 実装順: 21.1 → 21.2 → 21.3 → 21.4 → 21.5。`quizetika-play-flow-ui` Phase 27.5 は 21.3 完了後に着手。
- URL 変換 lib の適用対象は `/search` ルートのみ（要件 22.17）。
- 新 ranking エンジン・ジャンル／タグ一覧 URL 共通化は対象外。

---

### 22. Phase 23: リスト探索・カスタムクイズ Core API（2026-06-09）

> 要件 23–25・設計 Phase 23 に対応。`searchLists`、`buildMyQuizQuestionPool`、`my-quiz-session`、`Attempt.mode: 'my-quiz'` 試行記録、`saveAttempt` 1問契約。UI は `quizetika-lists-discovery-ui` / `quizetika-my-quiz-ui` が担当。

- [x] 22.1 リスト探索用一覧取得 API の実装
  - 公開リスト（`isPublished === true`）と本人非公開リスト（作者一致かつ非公開）を区分して Firestore から取得する `searchLists` を実装する
  - 探索パラメータ型（公開/非公開区分・キーワード・作者 ID・取得上限）と初版既定上限定数（50 件）を定義する
  - キーワード指定時はタイトル・説明文への大文字小文字を区別しない部分一致で in-memory 絞り込みを行う（既存一覧 API の後段 filter と同型）
  - 非公開探索時に作者 ID が未指定または空の場合はエラーを返し、他人の非公開リストを結果に含めない
  - 返却配列を作成日時降順で並べ、公開結果に非公開リストを含めない
  - 各リストの種別は既存 `resolveListType` 規則で解釈可能にする
  - **完了状態**: `searchLists` が public/private/keyword/limit 契約を満たし、型チェックが通ること
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9, 23.10_
  - _Boundary: QuizListService_

- [x] 22.2 (P) リスト探索 API の単体テスト
  - public 結果から `isPublished === false` が除外されること、keyword 部分一致、private 時の `authorId` 必須 throw、他人リスト除外を検証する
  - 既定 limit 50・`createdAt` 降順・空キーワード時の全件返却を検証する
  - **完了状態**: `tests/services/search-lists.test.ts` がグリーンであること
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9_
  - _Depends: 22.1_
  - _Boundary: Testing_

- [x] 22.3 Firestore 複合インデックス（リスト探索クエリ）
  - `quizLists` コレクション向けに `isPublished` + `createdAt` 降順、および `authorId` + `isPublished` + `createdAt` 降順の複合インデックスを定義する
  - 公開リスト探索・本人非公開リスト探索クエリがインデックスエラーにならないこと
  - **完了状態**: `firestore.indexes.json` に Phase 23 エントリ 2 件が追加されていること
  - _Requirements: 23.1, 23.2, 23.7_
  - _Boundary: firestore.indexes.json_

- [x] 22.4 カスタムクイズ用4ソース問題プール合成の実装
  - 有効化された取得元のみを統合し、問題候補配列を返す `buildMyQuizQuestionPool` を実装する
  - 4ソース（自作クイズ・ブックマーククイズ・ブックマークリスト内クイズ・ブックマーク問題）の収集規則を設計どおり適用する（問題リスト直接メンバーはブックマークリスト経路から除外）
  - 全取得元フラグ false 時は空配列を返す
  - 各候補に問題 ID・問題文・親クイズ ID/タイトル・取得元種別・ジャンル・タグ・出題形式・難易度を付与する
  - 複数取得元で同一問題 ID が重複する場合は先勝ちで1件に統合する（既存 dedupe 規則と整合）
  - ブックマーク経路では親クイズが公開済みでない問題を候補に含めない
  - **完了状態**: 4ソース merge/dedupe/published 除外が設計契約どおり動作し、型チェックが通ること
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9_
  - _Boundary: my-quiz-pool_

- [x] 22.5 (P) カスタムクイズ問題プールの単体テスト
  - 全 flags false → 空配列、同一 questionId 重複時の先勝ち（own 優先）、ブックマーク経路での非公開親除外を検証する
  - 候補メタデータ（format・difficulty・source 等）が期待どおり付与されることを検証する
  - **完了状態**: `tests/lib/my-quiz-pool.test.ts` がグリーンであること
  - _Requirements: 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9_
  - _Depends: 22.4_
  - _Boundary: Testing_

- [x] 22.6 カスタムクイズアドホックセッション管理の実装
  - sessionStorage 上でセッション ID・出題順序付き問題エントリ・現在インデックスを保持する CRUD を実装する（既存問題リストセッションとキー分離）
  - セッション読み取り、インデックス同期、次問題への進行、次エントリ参照のみ（非進行）、セッションクリア、プレイ画面 URL 生成を提供する
  - プレイ URL に `mode=my-quiz`・`sessionId`・`questionId`・`qIndex` を含める
  - セッション欠落時は `null` を返し、呼び出し側がエラー表示可能とする
  - **完了状態**: init/read/advance/peek/clear/URL 生成の round-trip が動作し、問題リストセッションキーと衝突しないこと
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_
  - _Boundary: my-quiz-session_

- [x] 22.7 (P) カスタムクイズセッションの単体テスト
  - sessionStorage round-trip、URL に `mode=my-quiz` が含まれること、`MY_QUIZ_SESSION_KEY` ≠ 問題リストセッションキーを検証する
  - `syncMyQuizSessionIndex` による URL `qIndex` と `currentIndex` の同期を検証する
  - **完了状態**: `tests/lib/my-quiz-session.test.ts` がグリーンであること
  - _Requirements: 25.1, 25.2, 25.3, 25.4, 25.5_
  - _Depends: 22.6_
  - _Boundary: Testing_

- [x] 22.8 `my-quiz` プレイモードの試行型契約拡張
  - 解答履歴のプレイモードに `my-quiz` を追加し、任意の `sessionId` フィールドを定義する
  - カスタムクイズ attempt 契約（`mode: 'my-quiz'`・親クイズ ID 必須・`totalQuestions: 1`）を満たすか判定するヘルパを型層に追加する
  - `listId` は不要（省略または null）であることを型コメントで明示する
  - **完了状態**: 型チェックが通り、`satisfiesMyQuizAttemptContract` が契約どおり true/false を返すこと
  - _Requirements: 25.6, 25.7, 25.10, 25.11_
  - _Boundary: types_

- [x] 22.9 `saveAttempt` の1問単位検証分岐
  - `question-list` / `my-quiz` モードでは親クイズ全問題数との照合をスキップし、`totalQuestions === 1` のみ必須とする
  - 1問モードの `score` は `1 - failedQuestionIds.length`（0 または 1）で検証し、`failedQuestionIds` は当該1問 ID のみ許可する
  - `question-list` は既存契約（`listId` 必須）を維持し、`my-quiz` は `satisfiesMyQuizAttemptContract` を適用する（`sessionId` は任意）
  - 通常モードの全問数不一致 reject 挙動は変更しない
  - **完了状態**: 親クイズ10問でも `totalQuestions: 1` の `my-quiz` / `question-list` 試行が保存成功し、通常モードの全問数不一致は従来どおり reject されること
  - _Requirements: 25.6, 25.8, 25.9_
  - _Depends: 22.8_
  - _Boundary: AttemptService_

- [x] 22.10 (P) 1問単位試行保存の単体・統合テスト
  - `saveAttempt` の `my-quiz` 成功パス、`question-list` 回帰、存在しない `failedQuestionIds` での reject を検証する
  - `isLeaderboardEligibleAttempt({ mode: 'my-quiz' }) === true` の回帰を追加する
  - **完了状態**: `tests/services/attempt-single-question.test.ts` および更新した leaderboard テストがグリーンであること
  - _Requirements: 25.6, 25.8, 25.9, 25.10_
  - _Depends: 22.8, 22.9_
  - _Boundary: Testing_

- [x] 22.11 Phase 23 統合検証
  - `searchLists`、`buildMyQuizQuestionPool`、セッション lib、`saveAttempt` 1問契約が設計どおり連携することを統合テストで検証する
  - コアテストスイート全体がグリーンであることを確認する
  - 要件 23.11–23.13、24.10–24.12、25.12–25.14（UI 境界）は隣接スペックタスクに委譲されていることを確認する
  - **完了状態**: Phase 23 関連 Jest がすべてグリーンであり、`quizetika-lists-discovery-ui` / `quizetika-my-quiz-ui` が import 可能な API 契約が揃っていること
  - _Depends: 22.2, 22.3, 22.5, 22.7, 22.10_
  - _Requirements: 23.1, 23.2, 23.3, 23.4, 23.5, 23.6, 23.7, 23.8, 23.9, 23.10, 24.1, 24.2, 24.3, 24.4, 24.5, 24.6, 24.7, 24.8, 24.9, 25.1, 25.2, 25.3, 25.4, 25.5, 25.6, 25.7, 25.8, 25.9, 25.10, 25.11_
  - _Boundary: Integration_

## Implementation Notes (Phase 23)

- 実装順: 22.1/22.3/22.4/22.6/22.8（並行可）→ 22.2/22.5/22.7/22.10（各実装直後）→ 22.9（22.8 後）→ 22.11。lists-discovery-ui Phase 1 は 22.1 完了後、my-quiz-ui Phase 1 は 22.4 完了後に着手可能。
- 正本: リスト探索は `quiz-list.ts` の `searchLists`、問題プールは `my-quiz-pool.ts`、セッションは `my-quiz-session.ts`（キー `quizetika_my_quiz_session`）。dedupe は `question-attach-search.ts` を再利用。
- `saveAttempt` 1問契約は `question-list` 回帰を含む。LB eligibility 本体は変更不要（`my-quiz` は `question-list` と同方針で登録対象）。
- サーバー側セッション永続化・カスタムクイズ URL 共有可能化・フィルタプリセット保存は対象外（要件 25.14、24.11）。
- Phase 23 実装完了（2026-06-09）: Jest 158 suites / 805 tests グリーン。隣接 UI は `quizetika-lists-discovery-ui` / `quizetika-my-quiz-ui` が import 可能。

---

### 23. Phase 26: リスト機能の完全廃止（2026-06-10）

- [x] 23.1 リスト関連型契約の縮小
  - `QuizList`・`QuizListType`・`resolveListType`・`satisfiesQuestionListAttemptContract` を除去する
  - `Bookmark.targetType` を `quiz` / `question` のみにし、`BookmarkFeed` から `lists` を除去する
  - `Attempt.mode` は既存履歴読み取り用に `list` / `question-list` を union に残し、新規保存拒否用ヘルパを型層に追加する
  - **完了状態**: 型チェックが通り、リスト専用型への参照がコア層から消えること
  - _Requirements: 26.1, 26.2, 26.6_
  - _Boundary: types_

- [x] 23.2 ブックマークサービスの2分類化
  - ブックマーク登録で `targetType: 'list'` を即拒否する（`INVALID_BOOKMARK_TARGET`）
  - ブックマーク一覧取得はクイズ・問題のみ返却し、リスト取得 API を除去する
  - **完了状態**: `getBookmarkFeed()` が `{ quizzes, questions }` のみ返し、`toggleBookmark('list')` が reject されること
  - _Requirements: 26.3, 26.4, 26.16_
  - _Depends: 23.1_
  - _Boundary: bookmark_

- [x] 23.3 廃止プレイモードの試行保存拒否
  - 新規試行保存時に `mode` が `list` または `question-list` の場合は拒否する
  - 問題リスト契約検証・`listId` 必須パスを除去し、`my-quiz` 1問契約は維持する
  - **完了状態**: `saveAttempt({ mode: 'list' })` が reject され、`saveAttempt({ mode: 'my-quiz' })` は従来どおり成功すること
  - _Requirements: 26.5, 26.6, 26.16_
  - _Depends: 23.1_
  - _Boundary: AttemptService_

- [x] 23.4 カスタムクイズ問題プールの3ソース化
  - プール合成フラグからブックマークリスト分岐を除去し、自作・ブックマーククイズ・ブックマーク問題の3ソースのみ統合する
  - dedupe 優先順（own → bookmarkedQuizzes → bookmarkedQuestions）を維持する
  - **完了状態**: `bookmarkedLists` フラグなしでプールが構築でき、リスト由来問題が候補に含まれないこと
  - _Requirements: 26.7, 26.16_
  - _Depends: 23.2_
  - _Boundary: my-quiz-pool_

- [x] 23.5 プレイ履歴レガシーラベルの提供
  - 過去試行の `mode` が `list` / `question-list` のとき表示ラベルを `レガシープレイ` に正規化する（lib 1か所を正本）
  - 本人プレイ履歴 API は当該試行を除外せず返却する
  - **完了状態**: 履歴取得結果でレガシーモードが `レガシープレイ` ラベルで表示可能であること
  - _Requirements: 26.14, 26.15, 26.17_
  - _Depends: 23.1_
  - _Boundary: play-history-client_

- [x] 23.6 リスト専用サービス・lib の削除と import 掃除
  - リスト CRUD・探索・問題リストセッション・リスト検証・プロフィールリスト表示用モジュールを削除する
  - 問題サービスからリストへの追加・除去 API を削除し、残存 import をビルド可能な状態に掃除する
  - **完了状態**: `quiz-list`・`question-list-session` 等への参照がリポジトリから消え、`npm run build` が通ること
  - _Requirements: 26.1, 26.2, 26.6_
  - _Depends: 23.2, 23.3, 23.4_
  - _Boundary: quiz-list removal_

- [x] 23.7 Firestore Rules・Indexes・参照の更新
  - Security Rules から `quizLists` match を除去する
  - 複合インデックス定義から `quizLists` エントリを除去し、クライアント参照ヘルパから `quizListsRef` を削除する
  - **完了状態**: rules / indexes に `quizLists` が残らず、エミュレータデプロイが可能であること
  - _Requirements: 26.10, 26.11, 26.12, 26.13_
  - _Depends: 23.6_
  - _Boundary: Firestore_

- [x] 23.8 リスト廃止マイグレーションスクリプトの実装
  - Admin SDK で `quizLists` 全件および `targetType=list` ブックマークをバッチ削除するスクリプトを追加する
  - `--dry-run` で件数のみ出力できること
  - **完了状態**: dry-run が件数を返し、エミュレータ上で実削除が成功すること
  - _Requirements: 26.8, 26.9_
  - _Depends: 23.7_
  - _Boundary: migrate-delete-quizlists_

- [x] 23.9 アカウント削除フローからリスト処理の除去
  - 退会・削除 API からクイズリスト匿名化・`quizLists` 参照を除去する
  - **完了状態**: アカウント削除コードに `quizLists` / リスト匿名化パスが存在しないこと
  - _Requirements: 26.12, 26.13_
  - _Depends: 23.6_
  - _Boundary: user, delete-account_

- [x] 23.10 (P) Phase 26 単体・サービステストの更新
  - ブックマーク list 拒否、廃止モード saveAttempt 拒否、3ソースプール、レガシーラベル、LB 回帰を検証する
  - リスト専用テストファイルを削除し、残存テストを更新する
  - **完了状態**: Phase 26 関連 Jest がすべてグリーンであること
  - _Requirements: 26.3, 26.4, 26.5, 26.7, 26.14, 26.15_
  - _Depends: 23.4, 23.5, 23.8, 23.9_
  - _Boundary: Testing_

- [x] 23.11 Phase 26 統合検証
  - コアテストスイート全体がグリーンであることを確認する
  - 隣接 UI スペック（play-flow / creator-dash / my-quiz）が import 可能な API 契約（2分類ブックマーク・3ソースプール・廃止モード拒否）が揃っていることを確認する
  - **完了状態**: Core 先行マージ可能な状態でビルド・全 Jest がグリーンであること
  - _Requirements: 26.1, 26.2, 26.3, 26.4, 26.5, 26.6, 26.7, 26.8, 26.9, 26.10, 26.11, 26.12, 26.13, 26.14, 26.15, 26.16, 26.17, 26.18_
  - _Depends: 23.10_
  - _Boundary: Integration_

## Implementation Notes (Phase 26)

- 実装順: 23.1 → 23.2/23.3/23.5（並行可）→ 23.4（23.2 後）→ 23.6 → 23.7/23.9（並行可）→ 23.8 → 23.10 → 23.11。UI スペックは **23.6 完了後**（型・サービス削除後）に着手。
- 維持: `my-quiz` セッション、クイズ/問題ブックマーク、`sourceQuestionId` 参照リンク、既存 `attempts` 物理データ。
- 削除禁止（同名）: 探索 `QuizListSort`、ダッシュボード `QuizListSkeleton`。
- マイグレーション本番実行はステージング検証後。UI と同一 PR でも Core コミットを先に適用すること。
- Phase 26 実装完了（2026-06-10）: Jest 166 suites / 835 tests グリーン。リスト API 削除に伴い play-flow 境界の最小 UI 修正（ブックマーク2タブ・ルート削除・プレイ/結果）を同一 PR で実施。`npm run build` は `ai-generate-questions/route.ts` の既存 Schema 型エラーで失敗（Phase 26 外）。

---

### 24. Phase 27: クイズ公開範囲（公開 / 非公開 / フォロワー限定）（2026-06-10）

- [x] 24.1 公開範囲型と読み取り正規化
  - `QuizVisibility` 型と `Quiz.visibility` オプションフィールドを追加する
  - 未設定時 `public` として扱う `resolveQuizVisibility` を lib に提供する
  - **完了状態**: 型チェックが通り、既存クイズ型参照が破綻しないこと
  - _Requirements: 27.1, 27.2, 27.4_
  - _Boundary: types_

- [x] 24.2 閲覧アクセス判定 lib の実装
  - `canViewQuiz` / `assertCanViewQuiz` を `src/lib/quiz-access.ts` に実装する（draft/suspended/public/private/followers、作者・フォロワー・mod）
  - `isFollowing` を followers 判定に利用する非同期 assert パスを提供する
  - **完了状態**: 単体テストで全閲覧パターンが期待どおり判定されること
  - _Requirements: 27.3, 27.5, 27.6, 27.7, 27.8, 27.9, 27.10_
  - _Depends: 24.1_
  - _Boundary: quiz-access_

- [x] 24.3 Pro 限定公開範囲の設定ゲート
  - `assertCanSetQuizVisibility` を実装し、`private` / `followers` 設定時に Pro 契約（またはモデレーター免除）を要求する
  - 無料ユーザーの `public → private|followers` を拒否し、既存 `private|followers` の維持（同一値更新）と `→ public` 変更は許可する
  - **完了状態**: Pro なしで private/followers 保存が reject され、ダウングレード後の既存限定公開維持がテストで確認できること
  - _Requirements: 27.11, 27.12, 27.13, 27.14, 27.15_
  - _Depends: 24.1_
  - _Boundary: quiz-access, entitlement_

- [x] 24.4 createQuiz / updateQuiz への公開範囲統合
  - 作成・更新 API に `visibility` を受け取り、保存前に `assertCanSetQuizVisibility` を呼ぶ
  - 新規 published 保存時、省略時は `public` を永続化する
  - **完了状態**: エディタ/UI から渡された visibility が Firestore に保存され、Pro ゲートがサーバー側で強制されること
  - _Requirements: 27.1, 27.4, 27.11, 27.12, 27.13, 27.14, 27.15_
  - _Depends: 24.3_
  - _Boundary: quiz_

- [x] 24.5 探索・一覧・タイムラインクエリの visibility フィルタ
  - 公開探索系 API（新着・人気・トレンド・ジャンル・タグ・検索）に `visibility == 'public'` 条件を追加する
  - フォロー TL に `public | followers`、他人プロフィール作者一覧に `public` のみを適用する
  - **完了状態**: private/followers クイズが公開探索結果に含まれず、フォロー TL で followers クイズがフォロワー向けに取得可能であること
  - _Requirements: 27.16, 27.17, 27.18, 27.19_
  - _Depends: 24.1_
  - _Boundary: quiz_

- [x] 24.6 プレイ・試行・ストリーム API の閲覧ゲート
  - クイズ取得後に `assertCanViewQuiz` を適用する（quick-press-stream、attempt 関連でクイズ本体を参照する経路）
  - 未認可時は一貫したエラーコード（例: `QUIZ_ACCESS_DENIED`）を返す
  - **完了状態**: 非公開・非フォロワーの followers クイズへ URL 直アクセスしてもプレイ開始できないこと
  - _Requirements: 27.7, 27.8, 27.9, 27.10_
  - _Depends: 24.2_
  - _Boundary: AttemptService, quick-press-stream_

- [x] 24.7 ブックマーク・カスタムクイズプール連携
  - ブックマーク検証に閲覧規則を適用し、閲覧不可クイズのブックマーク登録を拒否する
  - カスタムクイズのブックマークソース収集時、親クイズが閲覧不可なら候補から除外する（自作ソースは従来どおり）
  - **完了状態**: 非公開クイズのブックマークが reject され、カスタムクイズプールに他人 private が混入しないこと
  - _Requirements: 27.20, 27.21, 27.22_
  - _Depends: 24.2_
  - _Boundary: bookmark, my-quiz-pool_

- [x] 24.8 Firestore Rules・Indexes の更新
  - `quizzes` read ルールに visibility（public/private/followers）と follows 存在チェックを追加する
  - 探索クエリ用複合インデックスに `visibility` を追加する
  - **完了状態**: rules / indexes がデプロイ可能で、クライアント直 read でも限定公開が漏洩しないこと
  - _Requirements: 27.23, 27.25_
  - _Depends: 24.1_
  - _Boundary: Firestore_

- [x] 24.9 公開範囲バックフィルマイグレーション
  - `scripts/migrate-quiz-visibility-public.mjs` を追加し、published かつ visibility 未設定 doc に `public` を書き込む
  - `--dry-run` で件数出力できること
  - **完了状態**: エミュレータ上で dry-run / 実更新が成功すること
  - _Requirements: 27.2, 27.24_
  - _Depends: 24.8_
  - _Boundary: migrate-quiz-visibility-public_

- [x] 24.10 (P) Phase 27 単体・サービステスト
  - `quiz-access`、create/update Pro ゲート、一覧 filter、bookmark reject、TL followers を Jest で検証する
  - **完了状態**: Phase 27 関連テストがすべてグリーンであること
  - _Requirements: 27.5, 27.7, 27.11, 27.16, 27.17, 27.20_
  - _Depends: 24.4, 24.5, 24.6, 24.7, 24.9_
  - _Boundary: Testing_

- [x] 24.11 Phase 27 統合検証
  - コアテストスイート全体がグリーンであることを確認する
  - 隣接 UI スペック（ui-editor / ui-quiz-lifecycle / billing）が import 可能な API 契約（visibility 型・Pro エラー・canView）が揃っていることを確認する
  - **完了状態**: Core 先行マージ可能な状態でビルド・全 Jest がグリーンであること
  - _Requirements: 27.1, 27.5, 27.10, 27.11, 27.16, 27.20, 27.23, 27.24, 27.26, 27.27, 27.28, 27.29_
  - _Depends: 24.10_
  - _Boundary: Integration_

## Implementation Notes (Phase 27)

- 実装順: 24.1 → 24.2/24.3（並行可）→ 24.4 → 24.5/24.6/24.7（24.2 後並行可）→ 24.8 → 24.9 → 24.10 → 24.11。UI スペックは **24.4 完了後**（保存契約確定後）に着手。
- Pro 限定は **`private` と `followers` の両方**（Discovery A1 確定）。無料ユーザーは既存限定公開を維持、`public → 限定` のみ拒否。
- 正本: 閲覧判定 `src/lib/quiz-access.ts`、設定ゲート `assertCanSetQuizVisibility`、探索は Core クエリ側で `visibility == 'public'`。
- `getQuiz` 単体は引き続き ID 取得可とし、**呼び出し側または assertCanViewQuiz ラッパ**で遮断（lifecycle UI / API が消費）。
- マイグレーション本番実行はステージング検証後。インデックス追加はクエリ変更と同 PR 推奨。
- Phase 27 実装完了（2026-06-10）: Jest 168 suites / 848 tests グリーン。`saveQuiz` も visibility ゲート対象。既存 attempt テストは `assertCanViewQuizAsync` を mock。

---

### 25. Phase 28: クイズプレイ解答詳細トラッキングと二重検証（2026-06）

- [x] 25.1 解答詳細データモデル（QuestionAnswerDetail）の定義
  - `src/types/index.ts` に `QuestionAnswerDetail` インターフェースを定義し、各問題形式特有のフィールド（シャッフル順、クリック回数、早押し時間、並べ替え結果、AI対話ターン、真相要約等）を設定
  - `Attempt` スキーマに `questionAnswerDetails` 配列を追加
  - **完了状態**: コンパイルが正常に通る状態になり、解答詳細の型が安全に参照できること
  - _Requirements: 28.1_
  - _Boundary: types_

- [x] 25.2 saveAttempt トランザクション内のサーバーサイド二重検証
  - `src/services/attempt.ts` の `saveAttempt` にて、送信された `questionAnswerDetails` の数とスコア、および問題IDの実在検証をアトミックに検証するロジックを実装
  - 不整合検知時はエラーをスローし、Firestore への書き込みを拒否する
  - **完了状態**: テストで不整合データ送信時に例外がスローされ、トランザクションがロールバックされること
  - _Requirements: 28.2_
  - _Depends: 25.1_
  - _Boundary: AttemptService_

- [x] 25.3 オフラインプレイ結果の永続化とオンライン自動バッチ同期
  - `localStorage` に退避された未同期データ（`PendingSyncAttempt` 配列）をオンライン復帰時に一括して Firestore へ同期する `syncPendingAttempts` の同期連携処理を実装
  - **完了状態**: オンライン復旧時にバッチ同期処理が走り、未同期 attempts が検証をクリアした上で安全に永続化されること
  - _Requirements: 28.3_
  - _Depends: 25.2_
  - _Boundary: AttemptService_

- [x] 25.4 (P) Phase 28 単体・サービステスト
  - `saveAttempt` のバリデーション（件数不整合、スコア不整合、無効ID）および `syncPendingAttempts` の同期成功/ロールバック挙動を Jest テストで検証する
  - **完了状態**: 解答詳細トラッキング・検証・同期に関連するすべての単体テストがグリーンであること
  - _Requirements: 28.2, 28.3_
  - _Depends: 25.2, 25.3_
  - _Boundary: Testing_

- [x] 25.5 Phase 28 統合検証
  - 全体のクイズプレイフローにおいて、詳細行動のトラッキングデータ（タイマー値、クリック回数、ヒント使用数等）が破損なく保存されることを検証
  - **完了状態**: 統合テストスイートが正常にパスし、既存のクイズプレイおよび統計更新に退行がないこと
  - _Requirements: 28.1, 28.2, 28.3_
  - _Depends: 25.4_
  - _Boundary: Integration_

## Implementation Notes (Phase 28)

- 実装順: 25.1 → 25.2 → 25.3 → 25.4 → 25.5。
- UI プレイ画面（`quizetika-ui-quiz-lifecycle`）側でのフックトラッキング実装が先行または同時に完了している必要があります。

---

### 26. Phase 30: プロフィールSNSリンク登録・表示機能（2026-06-21）

- [x] 26.1 (P) プロフィール型定義とSNSリンク検証機能の追加
  - `src/types/index.ts` の `User` 型と `UpdateProfileData` 型に `snsLinks` フィールドを追加する
  - `src/services/user.ts` にドメイン検証用正規表現パターンを追加し、`validateProfileData` で各URLが URL 形式であり、指定ドメイン（youtube.com/youtu.be, x.com/twitter.com, instagram.com, tiktok.com）に合致することを検証するロジックを実装する
  - 不正な形式や未許可のドメインの場合は適切な `ProfileValidationError` を返すことを保証する
  - **完了状態**: 型チェックがすべて通り、`validateProfileData` の単体テストで正しいドメインがパスし、不正なドメインが弾かれること
  - _Requirements: 1.7, 1.8_
  - _Boundary: UserService_

- [x] 26.2 (P) StorageロゴダウンロードURL取得ヘルパーの実装
  - `src/services/storage.ts` にインメモリキャッシュオブジェクト（`snsLogoCache: Record<string, string>`）を定義する
  - `getSnsLogoUrl(snsName: string): Promise<string>` ヘルパーを実装し、キャッシュに存在すれば即時返し、存在しなければ Firebase Storage 上の `assets/logos/{snsName}.png` の `getDownloadURL` を呼び出してキャッシュに格納したのち返却する
  - **完了状態**: 指定されたSNS名に対する Storage のダウンロードURLが取得でき、2回目以降の呼び出しでは Storage への問い合わせ（API呼び出し）をせずにキャッシュから即座にURLが返されること
  - _Requirements: 1.10_
  - _Boundary: StorageService_

- [x] 26.3 `updateProfile` へのSNSリンク保存の統合
  - `src/services/user.ts` の `updateProfile` サービスにおいて、バリデーションに合格した `snsLinks` オブジェクトを Firestore の `users/{userId}` ドキュメントに保存する処理を実装する
  - **完了状態**: 認証ユーザーが正しいSNSリンク情報を送信した際、データベース上の `users/{userId}` ドキュメント内の `snsLinks` フィールドにオブジェクトが正常に保存されること
  - _Requirements: 1.9_
  - _Depends: 26.1_
  - _Boundary: UserService_

- [x] 26.4 Phase 30 統合検証
  - SNSリンク機能の追加に伴う `UserService` と `StorageService` の連動テスト、および既存のプロフィール更新機能への回帰がないことを Jest テストで検証する
  - **完了状態**: Phase 30 関連の Jest テストがすべてグリーンになり、ビルドが通ること
  - _Requirements: 1.7, 1.8, 1.9, 1.10_
  - _Depends: 26.2, 26.3_
  - _Boundary: Integration_

## Implementation Notes (Phase 30)

- 実装順: 26.1 → 26.2/26.3（26.1 後並行可）→ 26.4。
- `User.snsLinks` は任意項目（オプショナル）であり、YouTube, X, Instagram, TikTok のうち設定されたもののみ保存される。
- SNSロゴ画像は SVG 形式ではなく PNG 形式（`assets/logos/{snsName}.png`）として Storage に保存・取得される。
- インメモリキャッシュ (`snsLogoCache`) を `src/services/storage.ts` に配置し、表示パフォーマンスを担保する。

---

### 27. Phase 31: 複合形式における許容問題形式の拡張 (2026-07)

- [x] 27.1 複合形式許容タイプの定数更新
  - `src/services/ai-authoring-types.ts` および `src/lib/quiz-format.ts` に定義されている `MIXED_ALLOWED_QUESTION_TYPES` に `'association'` を追加する
  - **完了状態**: 型チェックがすべてパスし、`MixedAllowedQuestionType` に `'association'` が含まれていること
  - _Requirements: 31.1_
  - _Boundary: types_

- [x] 27.2 クイズ公開時バリデーションの更新
  - `src/services/quiz-validation.ts` の `validateQuizForPublish` における `quiz.format === 'mixed'` の判定で、許可問題タイプ `allowedTypes` に `'association'` を追加する
  - **完了状態**: 複合形式のクイズ内に `association` 形式の問題が含まれていても、バリデーションエラーを返さず正常に通過すること
  - _Requirements: 31.1, 31.2_
  - _Depends: 27.1_
  - _Boundary: QuizService_

- [x] 27.3 AI作問 API 用スキーマ定義の更新
  - `src/app/api/quiz/ai-generate-questions/route.ts` 内の `buildQuestionItemSchema` において、`format === 'mixed'` 分岐時のレスポンススキーマ `anyOf` に `schemas['association']` を追加する
  - **完了状態**: `buildQuestionItemSchema` の返却するスキーマに `association` 問題のスキーマが含まれていること
  - _Requirements: 31.3_
  - _Depends: 27.1_
  - _Boundary: VerifyTruthAPI_

- [x] 27.4 Phase 31 単体テストの追加・更新
  - `tests/services/ai-authoring-utils.test.ts` および `tests/services/quiz-validation.test.ts` 内の複合形式関連のテストを修正・追加する
  - `validateQuizForPublish` で `mixed` に連想問題が含まれていてもエラーが出ないこと、および `quick-press` や `lateral-thinking` が含まれる場合にエラーが返ることを検証する
  - **完了状態**: Phase 31 に関連するすべての Jest テストがグリーンでパスすること
  - _Requirements: 31.1, 31.2_
  - _Depends: 27.2_
  - _Boundary: Testing_

- [x] 27.5 Phase 31 統合検証
  - コア全体のテストスイートを実行し、ビルドや既存の機能への回帰がないことを確認する
  - **完了状態**: 全ての Jest テストがグリーンでパスし、`npm run build` がエラーなく成功すること
  - _Requirements: 31.1, 31.2, 31.3_
  - _Depends: 27.4_
  - _Boundary: Integration_

## Implementation Notes (Phase 31)

- 実装順: 27.1 → 27.2 / 27.3（27.1 後並行可）→ 27.4 → 27.5。
- 既存の `MIXED_ALLOWED_QUESTION_TYPES` が型と定数の両方で定義されているため、両方を同期させて更新します。

### 28. Phase 39: NGワードマスタ参照によるコンテンツ検証への移行 (2026-07)

- [x] 28.1 (P) NGワード読み取りサービスの新規実装
  - `ng-words.ts` に、`supabase-governance` が所有する `ng_words` マスタから有効な語句一覧のみを取得する読み取り専用関数を実装する（マスタ自体の登録・編集・無効化はここでは行わない）
  - 取得に失敗した場合は例外をそのまま呼び出し元へ伝播させる
  - **完了状態**: 関数呼び出しが `ng_words` の有効な語句配列を返し、Supabaseクエリが失敗した場合は例外がスローされること
  - _Requirements: 32.1, 32.4, 32.5_
  - _Boundary: NgWordsService_

- [x] 28.2 (P) クイズ公開バリデーションのNGワード判定を引数化
  - `quiz-validation.ts` のハードコードされたNGワード配列定数を削除する
  - 禁止語判定関数とクイズ公開バリデーション関数を、NGワード一覧を引数として受け取る形へシグネチャ変更する（純粋関数としての性質は維持する）
  - **完了状態**: 渡されたNGワード一覧に含まれる語句のみが検出され、一覧にない語句は検出されないこと
  - _Requirements: 32.1, 32.2_
  - _Boundary: QuizValidation_

- [x] 28.3 (P) クイズ公開サービスへのNGワードマスタ参照統合
  - クイズ公開処理内でNGワード読み取りサービスを呼び出し、取得した一覧を公開バリデーションへ渡すよう統合する
  - NGワード一覧の取得に失敗した場合は公開処理をエラーとして中断し、未検証のまま公開しない
  - **完了状態**: NGワードマスタに登録済みの語句を含むクイズの公開がバリデーションエラーで拒否され、マスタ取得失敗時にもクイズが公開されないこと
  - _Requirements: 32.1, 32.2, 32.3, 32.4_
  - _Depends: 28.1, 28.2_
  - _Boundary: QuizService_

- [x] 28.4 (P) クイズエディタのクライアント側事前検証への統合
  - クイズエディタの公開前クライアントサイド検証で、NGワード一覧を取得し禁止語チェックに用いるよう更新する
  - 一覧取得に失敗した場合は事前チェックをスキップし、最終防衛線であるサーバー側検証に委ねる
  - **完了状態**: NGワードを含む問題文を入力した状態で公開操作を行うと、クライアント側で送信前に警告が表示されること
  - _Requirements: 32.1, 32.2_
  - _Depends: 28.1, 28.2_
  - _Boundary: QuizEditor_

- [x] 28.5 Phase 39 単体・結合テストの追加・更新
  - 禁止語判定関数・公開バリデーション関数の単体テストを、引数化されたNGワード一覧に基づく判定へ書き換える
  - クイズ公開サービスの結合テストで、NGワード一覧取得失敗時に公開が拒否されること、マスタに新規登録された語句が次回の公開検証から反映されることを検証する
  - **完了状態**: Phase 39 に関連するすべての Jest テストがグリーンでパスすること
  - _Requirements: 32.1, 32.2, 32.3, 32.4_
  - _Depends: 28.3, 28.4_
  - _Boundary: Testing_

- [x] 28.6 Phase 39 統合検証
  - コア全体のテストスイートを実行し、ビルドや既存機能への回帰がないことを確認する
  - **完了状態**: 全ての Jest テストがグリーンでパスし、`npm run build` がエラーなく成功すること
  - _Requirements: 32.1, 32.2, 32.3, 32.4, 32.5_
  - _Depends: 28.5_
  - _Boundary: Integration_

## Implementation Notes (Phase 39)

- 実装順: 28.1 / 28.2（並行可）→ 28.3 / 28.4（並行可、いずれも28.1・28.2に依存）→ 28.5 → 28.6。
- 28.4レビューで判明した落とし穴: モックの返り値と旧ハードコード配列の内容が偶然一致していると、テストは新実装なしでもパスしてしまい「load-bearingでないテスト」になる。NGワードのようなfixtureデータを使うテストでは、モック値・fixtureに旧実装には存在しない合成語（例: `zzz-unique-forbidden-word`）を使い、かつサービス呼び出し自体を`toHaveBeenCalled()`等で明示的に検証することで、RED phaseの偽陽性を防ぐ。
- `ng_words` マスタ自体（テーブル・RPC・CRUDサービス）は `supabase-governance` が所有するため、本スペックのタスクは読み取りとその参照統合のみを対象とする。

### 29. Phase 41: 有料プランの多層化・二重課金防止・プラン変更 (2026-07-13)

- [x] 29.1 (P) tier→capability マッピングの実装
  - `entitlement-shared.ts` に `SubscriptionCapability` 型（`ad_free` / `unlimited_ai_questions` / `quiz_visibility_control` / `ai_authoring_assist`）と tier ごとの capability 集合マップを追加する
  - `computeUserEntitlements()` の戻り値に `hasCreatorEntitlements` フィールドを追加する（`creator`/`premium` かつ有効契約のときのみ true）
  - **完了状態**: `free`/`player`/`creator`/`premium` × 契約状態の全組み合わせに対し `hasPaidEntitlements`・`hasUnlimitedAiQuestions`・`hasCreatorEntitlements` が仕様通りの値を返す単体テストがグリーンであること
  - _Requirements: 33.1, 33.2, 33.14, 33.15_
  - _Boundary: EntitlementShared_

- [x] 29.2 (P) tier定義の拡張と Price ID 解決の tier 引数化
  - `subscription-plans.ts` に `player` tier 定義を追加し、既存 `pro` エントリの `tier` フィールド値を `creator` に変更する
  - `getPriceIdForInterval()` を tier 引数を取る形へシグネチャ変更する
  - **完了状態**: `getPriceIdForInterval('player', 'monthly')` と `getPriceIdForInterval('creator', 'yearly')` がそれぞれ正しい Price ID を返すこと
  - _Requirements: 33.1, 33.4, 33.17_
  - _Boundary: SubscriptionPlans_

- [x] 29.3 (P) クイズ限定公開ゲートの判定切り替え
  - `quiz-access.ts` の `canAccessProVisibility()` の判定を `hasPaidEntitlements` から `hasCreatorEntitlements` へ変更する
  - `ProRequiredForVisibilityError` のメッセージ文言を Creator 表記へ更新する
  - **完了状態**: `player` tier のエンタイトルメントで `canAccessProVisibility()` が `false` を返し、`creator`/`premium` では `true` を返すこと
  - _Requirements: 33.14, 33.15_
  - _Depends: 29.1_
  - _Boundary: QuizAccessGate_

- [x] 29.4 (P) AI作問アシスタントゲートの判定切り替え
  - `ai-authoring-utils.ts` の `canAccessAiAuthoring()` の判定を `hasCreatorEntitlements` ベースへ変更する
  - **完了状態**: `player` tier のエンタイトルメントで `canAccessAiAuthoring()` が `false` を返し、`creator`/`premium` では `true` を返すこと
  - _Requirements: 33.14, 33.15_
  - _Depends: 29.1_
  - _Boundary: AiAuthoringGate_

- [x] 29.5 (P) 広告表示判定の一本化
  - `useAds.ts` の独自 tier 文字列比較ロジックを削除し、`computeUserEntitlements().hasPaidEntitlements` を参照する形へ置き換える
  - **完了状態**: `player`/`creator`/`premium` いずれの有効契約でも広告が非表示になり、`free` では表示されること
  - _Requirements: 33.14_
  - _Depends: 29.1_
  - _Boundary: UseAdsHook_

- [x] 29.6 (P) tier別価格取得サービスの実装
  - `billing-prices.ts` の `fetchProPricesFromStripe()` を `fetchPlanPricesFromStripe()` に置き換え、`player`・`creator` 両方の月額・年額価格を取得して返すよう変更する
  - **完了状態**: Stripe mock に対して2 tier 分の Price ID で `prices.retrieve` が呼ばれ、`{ player, creator }` 形状のオブジェクトが返ること
  - _Requirements: 33.4_
  - _Depends: 29.2_
  - _Boundary: BillingPrices_

- [x] 29.7 価格取得APIのレスポンス形状変更
  - `/api/billing/prices` route を `fetchPlanPricesFromStripe()` を呼び出す形へ更新し、レスポンスを `{ player, creator }` 形状で返す
  - **完了状態**: `GET /api/billing/prices` が新形状のJSONを返し、既存の単一 tier 形状を返さないこと
  - _Requirements: 33.4_
  - _Depends: 29.6_
  - _Boundary: BillingPricesAPI_

- [x] 29.8 購読開始APIのプラン引数化と重複拒否
  - `subscription.ts` の `createCheckoutSession()` に `plan: 'player' | 'creator'` 引数を追加する
  - 既存有効契約（`player`/`creator` いずれか）を持つユーザーからの新規購読開始要求を、プラン変更（29.16）を案内するエラーで拒否する
  - **完了状態**: `plan` 引数に応じて対応する Price ID で Checkout Session が作成され、既存契約者からの新規購読要求が拒否されること
  - _Requirements: 33.8, 33.9, 33.10, 33.11, 33.12_
  - _Depends: 29.2_
  - _Boundary: SubscriptionService_

- [x] 29.9 購読開始APIルートのプラン検証
  - `/api/billing/checkout-session` route のリクエストボディから `plan` を検証・伝搬する
  - **完了状態**: `plan` が `player`/`creator` 以外の場合に 400 を返すこと
  - _Requirements: 33.8_
  - _Depends: 29.8_
  - _Boundary: CheckoutSessionAPI_

- [x] 29.10 (P) Webhookの有料判定一般化
  - `stripe-webhook.ts` の `buildSnapshotFromSubscription()` の有料判定を `mappedTier === 'pro' || mappedTier === 'premium'` から `mappedTier !== 'free'` へ変更する
  - **完了状態**: `player` tier にマッピングされる Price ID を持つ Subscription イベントで `isPremium` 相当の有料フラグが `true` になること
  - _Requirements: 33.5, 33.6, 33.7, 33.16_
  - _Depends: 29.2_
  - _Boundary: StripeWebhookAPI_

- [x] 29.11 (P) 既存 `pro` 契約者データの `creator` への移行
  - `UPDATE users SET subscription_tier = 'creator' WHERE subscription_tier = 'pro'` を含む Supabase migration ファイルを追加する
  - **完了状態**: migration 実行後、`subscription_tier = 'pro'` の行が0件になり、他フィールド（`stripe_subscription_id` 等）が変化しないこと
  - _Requirements: 33.5, 33.6, 33.7_
  - _Boundary: Migration_

- [x] 29.12 (P) 重複サブスクリプション検知・解約・返金サービスの実装
  - `duplicate-subscription-guard.ts` を新規作成し、指定 Stripe 顧客の有効サブスクリプション一覧を取得、2件以上ある場合は作成日時が最古の1件を残して他を解約、解約分の直近支払い済みInvoiceを全額返金する関数を実装する
  - **完了状態**: 作成日時が異なる2件の有効サブスクリプションを渡した Stripe mock に対し、新しい方が解約・返金され古い方のIDが返る単体テストがグリーンであること
  - _Requirements: 34.4, 34.5, 34.6, 34.7_
  - _Boundary: DuplicateSubscriptionGuard_

- [x] 29.13 (P) 重複インシデント監査テーブルの追加
  - `billing_duplicate_subscription_incidents` テーブルを作成する Supabase migration を追加する（クライアントアクセス不可）
  - **完了状態**: migration 適用後にテーブルが存在し、Admin クライアント以外からの読み書きが RLS で拒否されること
  - _Requirements: 34.7_
  - _Boundary: Migration_

- [x] 29.14 購読開始時のライブ重複チェック統合
  - `createCheckoutSession()` に、DBキャッシュではなく Stripe 側の顧客の有効サブスクリプション一覧をライブ参照する事前チェックを追加する
  - **完了状態**: DB上は `free` だが Stripe上に既に有効なサブスクリプションが存在するケースで購読開始が拒否されること
  - _Requirements: 34.1, 34.2_
  - _Depends: 29.8_
  - _Boundary: SubscriptionService_

- [x] 29.15 Webhookへの重複検知統合
  - `handleStripeSubscriptionEvent()` の冒頭で `duplicate-subscription-guard.ts` の解決関数を呼び出し、返された正のサブスクリプションのみを `applySubscriptionFromStripe()` に渡すよう統合する
  - **完了状態**: 重複解約が発生したイベントで `users.subscription_tier` が正のサブスクリプションの tier のみに更新されること
  - _Requirements: 34.3, 34.4, 34.6_
  - _Depends: 29.10, 29.12_
  - _Boundary: StripeWebhookAPI_

- [x] 29.16 プラン変更サービスの実装
  - `subscription.ts` に `changeSubscriptionPlan(uid, targetPlan)` を追加し、既存サブスクリプションの `items` を対象 Price ID へ `proration_behavior: 'create_prorations'` で更新する。同一プラン指定時は例外をスローする
  - **完了状態**: `player`→`creator` 指定で Stripe `subscriptions.update` が正しい Price ID・`proration_behavior` で呼ばれ、同一tier指定時は Stripe API を呼ばず例外がスローされること
  - _Requirements: 35.1, 35.2, 35.3, 35.4, 35.5, 35.6, 35.7, 35.8_
  - _Depends: 29.8_
  - _Boundary: SubscriptionService_

- [x] 29.17 プラン変更APIルートの実装
  - `POST /api/billing/change-plan` route を新規作成し、Bearer認証・`targetPlan` 検証のうえ `changeSubscriptionPlan()` を呼び出す
  - **完了状態**: 有料契約なしユーザーからの呼び出しが403を返し、有効な `player`/`creator` 契約者からの呼び出しが200でtierを返すこと
  - _Requirements: 35.1, 35.2, 35.3, 35.4_
  - _Depends: 29.16_
  - _Boundary: ChangePlanAPI_

- [x] 29.18 (P) Phase 41 単体テストの追加
  - capability マップ、tier引数化、重複検知、プラン変更の各関数について、tier×状態の境界値を含む単体テストを追加する
  - **完了状態**: Phase 41 で変更・追加した全関数の単体テストがグリーンでパスすること
  - _Requirements: 33.1, 33.2, 33.14, 33.15, 34.4, 34.5, 35.1, 35.2, 35.5, 35.6_
  - _Depends: 29.9, 29.14, 29.15, 29.17_
  - _Boundary: Testing_

- [x] 29.19 (P) Phase 41 結合テストの追加
  - 購読開始API・Webhook・プラン変更APIの結合テストを追加し、重複購読拒否・重複解約返金・プラン切替後のtier反映を検証する
  - **完了状態**: Phase 41 に関連する全結合テストがグリーンでパスすること
  - _Requirements: 33.8, 33.9, 33.10, 33.11, 34.1, 34.2, 34.3, 35.7, 35.8_
  - _Depends: 29.9, 29.14, 29.15, 29.17_
  - _Boundary: Testing_

- [x] 29.20 Phase 41 統合検証
  - コア全体のテストスイートを実行し、`subscription_tier = 'pro'` の残存件数確認を含むデプロイ後検証手順を実施する
  - **完了状態**: 全ての Jest テストがグリーンでパスし、`npm run build` がエラーなく成功し、`SELECT count(*) FROM users WHERE subscription_tier = 'pro'` が0件であること
  - _Requirements: 33.1, 33.5, 33.6, 33.7, 34.1, 34.3, 35.1, 35.2_
  - _Depends: 29.18, 29.19_
  - _Boundary: Integration_

## Implementation Notes (Phase 41)

- 実装順: 29.1 / 29.2（並行可、Foundation）→ 29.3 / 29.4 / 29.5（29.1依存、並行可）・29.6（29.2依存）・29.8（29.2依存）・29.10（29.2依存）・29.11 / 29.12 / 29.13（並行可、独立）→ 29.7（29.6依存）・29.9（29.8依存）→ 29.14（29.8依存）・29.15（29.10, 29.12依存）・29.16（29.8依存、`subscription.ts` を共有するため29.8完了後に着手）→ 29.17（29.16依存）→ 29.18 / 29.19（並行可）→ 29.20。
- 29.8 と 29.16 はいずれも `src/services/subscription.ts` を変更するため、ファイル競合を避けるべく 29.16 は 29.8 完了後に着手する（並行不可）。
- 二重課金防止（29.12, 29.14, 29.15）は実際の返金処理を伴うため、実装時は Stripe mock による網羅的なシナリオ検証を最優先する。

### 30. Phase 42: 支払い失敗時の状態遷移と失効検知の安全網 (2026-07-16)

- [x] 30.1 (P) Webhookのtier決定ロジック是正
  - `buildSnapshotFromSubscription()` の `hasPaid` 分岐を削除し、常に `mappedTier` を `subscriptionTier` として採用するよう変更する
  - `subscriptionStatus` は Stripe から届いた値をそのまま格納する（変更なし）
  - 完了状態: `status: 'past_due'` で `creator` にマッピングされる Price ID を持つイベントに対し、`subscriptionTier` が `'creator'` のまま、`subscriptionStatus` が `'past_due'` になる単体テストがグリーンであること
  - _Requirements: 36.1, 36.2, 36.4, 36.5_
  - _Boundary: StripeWebhookAPI_

- [ ] 30.2 (P) 是正監査テーブルの追加
  - `billing_reconciliation_corrections` テーブルを作成する Supabase migration を追加する（クライアントアクセス不可、RLSで拒否）
  - 完了状態: migration 適用後にテーブルが存在し、Admin クライアント以外からの読み書きが RLS で拒否されること
  - _Requirements: 36.9_
  - _Boundary: Migration_

- [ ] 30.3 定期整合性チェックサービスの実装
  - `stripe_customer_id` を持つ全ユーザーをページング取得し、Stripe 実契約状態（active/trialing/past_due を有効とみなし最古1件を正とする）と比較、乖離があれば `applySubscriptionFromStripe()`/`clearPaidEntitlements()` で是正し監査レコードを挿入する `reconcileSubscriptions()` を新規実装する
  - 個別ユーザーの Stripe API 呼び出し失敗はそのユーザーをスキップし処理継続、ユーザー一覧取得等の致命的エラー時はバッチを中断する
  - 完了状態: ローカルDBが `creator`/`active` だが Stripe 上に有効サブスクリプションが存在しないユーザーに対し `free` へ是正し監査レコードが1件挿入される単体テスト、および一部ユーザーで API 呼び出し失敗時に残りのユーザー処理が継続される単体テストがグリーンであること
  - _Requirements: 36.6, 36.8, 36.9, 36.10_
  - _Depends: 30.2_
  - _Boundary: SubscriptionReconciliationService_

- [ ] 30.4 定期整合性チェック起動APIの実装
  - `GET /api/cron/sync-subscriptions` を新規作成し、`Authorization: Bearer CRON_SECRET` を検証したうえで `reconcileSubscriptions()` を呼び出し、処理件数・是正件数・スキップ件数を返す（`runtime = 'nodejs'`）
  - 完了状態: `Authorization` ヘッダーが不正または欠落時に401、正しい `CRON_SECRET` で200とサマリJSONが返る統合テストがグリーンであること
  - _Requirements: 36.6, 36.7_
  - _Depends: 30.3_
  - _Boundary: SyncSubscriptionsCronAPI_

- [ ] 30.5 Vercel Cronスケジュール設定
  - `vercel.json` を新規作成し、`/api/cron/sync-subscriptions` を UTC 19:00（日本時間4時台）に日次起動する `crons` 設定を追加する
  - 完了状態: `vercel.json` の `crons` 配列に対象パスと `schedule: '0 19 * * *'` が定義されていること
  - _Requirements: 36.7_
  - _Depends: 30.4_

- [ ] 30.6 (P) Phase 42 単体テストの追加
  - `buildSnapshotFromSubscription` のtier維持、`computeUserEntitlements` の回帰確認、`reconcileSubscriptions` の是正・エラースキップの単体テストを整理・追加する
  - 完了状態: Phase 42 で変更・追加した全関数の単体テストがグリーンであること
  - _Requirements: 36.1, 36.2, 36.5, 36.8, 36.10_
  - _Depends: 30.1, 30.3_
  - _Boundary: Testing_

- [ ] 30.7 (P) Phase 42 結合テストの追加
  - `customer.subscription.updated`（`past_due`）受信時の tier 維持、`past_due → active` 復帰時の `hasPaidEntitlements` 再付与、`GET /api/cron/sync-subscriptions` の認可・実行結合テストを追加する
  - 完了状態: Phase 42 関連の全結合テストがグリーンであること
  - _Requirements: 36.1, 36.3, 36.4, 36.6, 36.7_
  - _Depends: 30.1, 30.4_
  - _Boundary: Testing_

- [ ] 30.8 Phase 42 統合検証
  - コア全体のテストスイートとビルドを実行し、既存の `canceled` 分岐・エンタイトルメント判定に回帰がないことを確認する
  - 完了状態: 全 Jest テストがグリーンでパスし、`npm run build` がエラーなく成功すること
  - _Requirements: 36.1, 36.2, 36.3, 36.4, 36.5_
  - _Depends: 30.6, 30.7_
  - _Boundary: Integration_

## Implementation Notes (Phase 42)

- 実装順: 30.1 / 30.2（並行可、Foundation）→ 30.3（30.2依存）→ 30.4（30.3依存）→ 30.5（30.4依存）→ 30.6 / 30.7（並行可、それぞれ30.1・30.3 および 30.1・30.4 に依存）→ 30.8。
- 30.3 は既存の `applySubscriptionFromStripe()` / `clearPaidEntitlements()` をそのまま呼び出すのみで 30.1 の変更内容には依存しないため、30.1 と並行して着手できる（30.2 完了後）。
- 要件36.11–36.13（ユーザー通知UI・実行基盤選定・督促ポリシー新設）は Out of Boundary のため、意図的にタスク化していない（design.md Phase 42「Out of Boundary」参照）。
