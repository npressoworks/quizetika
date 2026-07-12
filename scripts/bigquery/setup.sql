-- =============================================================================
-- BigQuery セットアップDDL: quizetika_analytics データセット + raw_events テーブル
-- =============================================================================
-- Spec: supabase-bigquery-export (Task 2.1, Boundary: RawEventsSchema)
-- Requirements: 2.5 (発生時刻の保持), 3.1 (版履歴の追記蓄積), 5.3 (重複排除情報の保持)
--
-- 適用方法（例）:
--   bq query --project_id=<GCP_PROJECT_ID> --use_legacy_sql=false < scripts/bigquery/setup.sql
--
-- 冪等性: CREATE SCHEMA IF NOT EXISTS / CREATE TABLE IF NOT EXISTS のため、
--         複数回適用しても安全（既存オブジェクトは変更されない）。
--
-- リージョン: asia-northeast1
--   旧Firestoreパイプライン(extensions/firestore-bigquery-export.env の
--   DATASET_LOCATION)との継続性のため、asia-northeast1 を採用する。
-- =============================================================================

-- -----------------------------------------------------------------------------
-- データセット: quizetika_analytics
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `quizetika_analytics`
OPTIONS (
  location = 'asia-northeast1',
  description = 'quizetika BigQuery Sync Pipeline: 追記専用イベントログと分析ビュー群を格納するデータセット'
);

-- -----------------------------------------------------------------------------
-- テーブル: quizetika_analytics.raw_events
-- -----------------------------------------------------------------------------
-- 設計上の役割（design.md「RawEventsSchema」/ research.md「BigQuery側は追記専用の
-- 単一raw_eventsテーブル+ビュー群」より）:
--   Supabase側の同期対象7テーブル（attempts / quizzes / questions /
--   quiz_questions / quiz_tags / difficulty_votes / quiz_reviews）すべての
--   変更イベントを、テーブルごとに型付きテーブルを分けるのではなく、
--   table_name（ソーステーブル discriminator）+ payload（JSON）を持つ
--   単一の汎用イベントテーブルに集約する。
--   これにより、ソーススキーマの変更やテーブル追加があってもBigQuery側の
--   DDL変更が不要になり（Data Contracts & Integration参照）、かつ
--   追記専用であることそのものが版履歴（Req 3.1）と削除トゥームストーン
--   （Req 5.4）の基盤となる。
--
-- 【重要】追記専用（append-only）運用ルール:
--   このテーブルへの UPDATE / DELETE 文の実行は運用上禁止する。
--   BigQueryのDDL/権限機構にはテーブルを物理的に追記専用へ強制する
--   ネイティブな仕組みが存在しないため、これは技術的強制ではなく
--   *運用規約* である。書き込み経路はSupabase Edge Function
--   （bigquery-export）の tabledata.insertAll のみとし、それ以外からの
--   直接UPDATE/DELETEは行わないこと。
--   重複排除・最新状態・版整合・トゥームストーン除外は本テーブルを
--   直接クエリせず、scripts/bigquery/views.sql のビュー群を経由すること。
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `quizetika_analytics.raw_events`
(
  event_id    STRING    NOT NULL OPTIONS (description = 'アウトボックスevent_id(UUID)。BigQuery insertAllのinsertIdとしても使用され、重複排除の一意キーとなる(Req 5.3)。'),
  table_name  STRING    NOT NULL OPTIONS (description = 'ソーステーブル名(attempts/quizzes/questions/quiz_questions/quiz_tags/difficulty_votes/quiz_reviews)。'),
  event_type  STRING    NOT NULL OPTIONS (description = 'INSERT / UPDATE / DELETE のいずれか。DELETEは削除直前のスナップショットをpayloadに保持する(Req 5.4)。'),
  occurred_at TIMESTAMP NOT NULL OPTIONS (description = 'イベント発生時刻(Req 2.5)。日次パーティションのキー。'),
  payload     JSON               OPTIONS (description = '許可カラムのみを含むサニタイズ済みイベント内容。PII(users全体・author_name・author_avatar等)は構造的に含まれない。')
)
PARTITION BY DATE(occurred_at)
CLUSTER BY table_name
OPTIONS (
  description = '追記専用の全イベントログ。UPDATE/DELETE禁止(運用規約)。7つの同期対象テーブルすべてのイベントをtable_name discriminatorで区別して収容する単一テーブル(Req 2.5, 3.1, 5.3)。',
  require_partition_filter = false
);
