# Implementation Plan: quizeum-core

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
  - 各件にクイズタイトル・正解数・総設問数・モード・経過秒を付与し、20件＋カーソルでページングする
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
  - 指定ジャンル時にマージ展開 ID 集合でクイズを絞り込み、誤答設問抽出に反映する（オールジャンルは従来どおり全件）
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

## Implementation Notes

- LB 順位ロジックは `src/lib/leaderboard-ranking.ts`（純関数）と `src/lib/leaderboard-update.ts`（Firebase 非依存ヘルパー）に分離。`countPriorCompletedAttempts` は `attempt.ts` 内に保持。
- プレイ履歴は `GET /api/user/play-history`（Bearer トークンの uid のみ）。UI は `quizeum-auth-profile-ui` が未実装。
- クイズ詳細の二系統 LB 表示は暫定で `quiz/[id]/page.tsx` を更新（本番 UI 仕上げは `quizeum-play-flow-ui`）。
- **Phase 6**: canonical 解決は `src/lib/metadata-resolution.ts` に集約。読み取りは C2（canonical クエリ + `genre in` フォールバック + dedupe）。ホーム/エディタ UI は `quizeum-play-flow-ui` / `quizeum-creator-dash-ui` が `listActiveGenres` に依存。
