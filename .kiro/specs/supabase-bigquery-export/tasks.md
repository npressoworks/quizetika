# Implementation Plan

- [ ] 1. Foundation: DBパイプライン基盤マイグレーション(単一マイグレーションファイル)
- [x] 1.1 pg_net/pg_cron拡張の有効化とanalytics_outboxテーブルの作成
  - CREATE EXTENSION pg_net/pg_cron、outboxテーブル(event_id/table_name/event_type/payload/occurred_at/status/retry_count/last_error/sent_at)、pending部分インデックス、RLS有効化(ポリシーなし=service roleのみ)
  - 完了条件: `supabase db reset`後にanalytics_outboxテーブルと両拡張が存在し、anonクライアントからoutboxが不可視
  - _Requirements: 5.1, 5.2_

- [ ] 1.2 キャプチャトリガー基盤とattempts/quizzes/questionsへの適用
  - 許可カラム列挙方式のキャプチャトリガー関数(SECURITY DEFINER): attempts(全カラム)、quizzes/questions(author_name/author_avatar除外)
  - DELETE時はOLD行のサニタイズ済みスナップショットをevent_type='DELETE'で記録
  - 完了条件: 3テーブルへのINSERT/UPDATE/DELETEでoutbox行が生成され、payloadに除外カラムが含まれない
  - _Requirements: 1.1, 1.2, 2.1, 2.2, 2.3, 4.2, 4.3, 5.4_

- [ ] 1.3 残り4テーブル(quiz_questions/quiz_tags/difficulty_votes/quiz_reviews)へのキャプチャトリガー適用
  - 全カラム許可のホワイトリストで同一パターンを適用。usersほか対象外テーブルにはトリガー未設置
  - 完了条件: 4テーブルの書き込みでoutbox行が生成され、usersのUPDATEではoutboxに行が増えない
  - _Requirements: 1.2, 1.3, 2.4, 4.1, 4.4_

- [ ] 1.4 配送トリガーとpg_cronジョブ(再送・パージ)の実装
  - outbox INSERTトリガーがVaultのシークレットを使いpg_net http_request(タイムアウト5000ms)でFunction URLへ起床通知
  - 再送ジョブ(毎分: pendingが2分以上滞留時に通知)、パージジョブ(毎日: sent 30日超を削除、failedは保持)
  - 完了条件: outbox行INSERTでnet._http_responseにリクエスト記録が残り、cron.jobに2ジョブが登録される
  - _Requirements: 1.4, 5.1_

- [ ] 2. BigQueryスキーマとビュー
- [ ] 2.1 raw_eventsテーブルDDLの作成
  - scripts/bigquery/setup.sql: quizetika_analyticsデータセット、raw_events(event_id/table_name/event_type/occurred_at/payload JSON)、日次パーティション+table_nameクラスタリング
  - 完了条件: bqコマンドでsetup.sqlを適用するとデータセットとテーブルが作成される
  - _Requirements: 2.5, 3.1, 5.3_
  - _Boundary: RawEventsSchema_

- [ ] 2.2 分析ビュー群の作成
  - scripts/bigquery/views.sql: v_dedup_events(event_id重複排除)、v_current_<table>(最新状態+DELETE除外)、v_question_versions(版有効期間)、v_attempt_answers_training(解答詳細UNNEST+版整合結合)、v_quality_signals
  - 完了条件: サンプルイベントをraw_eventsに投入した状態で各ビューが期待列・期待行を返す
  - _Requirements: 2.6, 3.2, 5.3, 5.4_

- [ ] 3. Edge Function bigquery-export の実装
- [ ] 3.1 Edge Functionスキャフォールディングと設定
  - supabase/functions/bigquery-export/ディレクトリ、deno.json、types.ts(OutboxEvent/ExportResult等)、固定200応答を返す最小index.tsスタブ(3.5で本実装に置換)
  - config.tomlに[functions.bigquery-export] verify_jwt=false、.env.local.exampleにGCP_SERVICE_ACCOUNT_JSON/BQ_PROJECT_ID/BQ_DATASET_ID/ANALYTICS_WEBHOOK_SECRETを追加
  - 完了条件: `supabase functions serve bigquery-export`がローカルで起動し200を返す
  - _Requirements: 1.4_

- [ ] 3.2 (P) Google認証モジュールの実装
  - Web Crypto APIでSA鍵からRS256 JWT署名→OAuth2トークンエンドポイントでアクセストークン取得、モジュールスコープで有効期限キャッシュ
  - fetch注入によりDenoグローバル非依存(Jestテスト可能)
  - 完了条件: SA鍵JSONを与えるとBearerトークン文字列が返り、期限内の再呼び出しでHTTP往復が発生しない
  - _Requirements: 1.4_
  - _Boundary: ExportFunction(google-auth)_
  - _Depends: 3.1_

- [ ] 3.3 (P) BigQuery insertAllクライアントの実装
  - OutboxEvent配列→insertAllリクエスト構築(insertId=event_id必須)、レスポンスのinsertErrorsから成功行/リトライ対象行を分類
  - 完了条件: 部分失敗レスポンスを与えると成功行IDとリトライ対象行IDが正しく分離される
  - _Requirements: 1.1, 1.2, 1.3, 5.3_
  - _Boundary: ExportFunction(bigquery)_
  - _Depends: 3.1_

- [ ] 3.4 (P) outboxアクセスモジュールの実装
  - service roleクライアントでpending行のFOR UPDATE SKIP LOCKEDバッチ取得(RPC経由)、sent消込/retry_count加算/failed遷移
  - 完了条件: 取得→消込の一連の操作でoutbox行のstatusが期待通り遷移する
  - _Requirements: 5.1, 5.2_
  - _Boundary: ExportFunction(outbox), OutboxTable_
  - _Depends: 3.1_

- [ ] 3.5 HTTPハンドラ統合
  - index.tsスタブを本実装に置換: X-Analytics-Webhook-Secret検証(不一致は401でoutbox未接触)、バッチループ(500行/insertAll、wall-clock内で打ち切り)、retry上限10でfailed+last_error記録、{processed, failed}レスポンス
  - 完了条件: raw_eventsテーブル(2.1適用済み)に対し、ローカルでシークレット付きPOSTするとpending行がsentに遷移しBQにイベント行が到達する
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 5.1, 5.3_
  - _Depends: 2.1, 3.2, 3.3, 3.4_

- [ ] 4. テスト
- [ ] 4.1 (P) Edge Function純ロジックのJest単体テスト
  - insertAllリクエストの全行にinsertId=event_idが設定されること、部分失敗分類、JWT組立形状とトークンキャッシュ、シークレット不一致401でoutbox未接触
  - 完了条件: `npm run test`でtests/functions/bigquery-export.test.tsが全件パス
  - _Requirements: 5.1, 5.3_
  - _Boundary: ExportFunction_
  - _Depends: 3.5_

- [ ] 4.2 (P) キャプチャ層の統合テスト(ローカルSupabase)
  - handle_save_attempt実行→attemptsイベント生成(question_answer_details含む)、quizzes/questions UPDATEでauthor_name/author_avatar不在、users UPDATEでoutbox無反応、attempts DELETEでDELETEイベント生成
  - 完了条件: ローカルSupabaseに対する検証SQLまたはテストスクリプトが全ケースで期待結果を返す
  - _Requirements: 1.1, 2.2, 2.3, 4.1, 4.2, 4.4, 5.4_
  - _Boundary: CaptureTriggers, OutboxTable_
  - _Depends: 1.3_

- [ ] 5. 運用ドキュメントと旧資産整理
- [ ] 5.1 運用READMEの作成
  - scripts/bigquery/README.md: セットアップ手順(SA作成→DDL→secrets→マイグレーション→デプロイ)、監視クエリ2本(failed検出/pending滞留)、シークレットローテーション手順、自由記述PIIリスクの留意事項、旧Firestoreパイプライン退役の経緯
  - 完了条件: READMEに監視クエリ・PII留意事項・退役経緯のセクションが存在する
  - _Requirements: 4.5, 5.2, 6.1, 6.2_

- [ ] 5.2 旧資産の削除とアーカイブ注記
  - extensions/firestore-bigquery-export.envとscripts/bq-import-guide.mdを削除、旧spec quizeum-analytics-bigqueryのspec.jsonにアーカイブ注記を追加
  - 完了条件: 両ファイルがリポジトリに存在せず、旧spec.jsonにアーカイブ注記が含まれる
  - _Depends: 5.1_
  - _Requirements: 6.1, 6.2_

## Implementation Notes

- タスク1.1: design.mdのFile Structure Planは1.1〜1.4を単一マイグレーションファイルとする想定だったが、タスク単位でのレビュー・ロールバックを容易にするため、タスクごとに個別のマイグレーションファイルへ分割した(`20260713000000_bigquery_export_outbox.sql`)。以降の1.2〜1.4も同様に個別ファイルとし、タイムスタンプは直前のマイグレーションより後にする。既存最新マイグレーションは`20260712000000_fix_immutable_fields_admin_exception.sql`だった(タスク生成時点の想定`20260710000000_ng_words.sql`より新しい)。
