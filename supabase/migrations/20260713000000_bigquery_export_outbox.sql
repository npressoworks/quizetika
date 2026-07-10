-- ==========================================
-- BigQuery Export Pipeline: 拡張機能の有効化とanalytics_outboxテーブルの作成
-- Requirements: 5.1 (一時失敗時の自動再送), 5.2 (恒久失敗の運用者検知)
-- Design: OutboxTable component（design.md「DB / Capture」節）
-- ==========================================

-- 拡張機能の有効化(pg_net: outbox配送のHTTPリクエスト送信, pg_cron: 再送/パージの定期実行)
CREATE EXTENSION IF NOT EXISTS "pg_net";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- ==========================================
-- analytics_outbox テーブル
-- 全同期イベントの一次記録と配送ライフサイクル管理
-- ==========================================
CREATE TABLE analytics_outbox (
    event_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    table_name TEXT NOT NULL,
    event_type TEXT NOT NULL CHECK (event_type IN ('INSERT', 'UPDATE', 'DELETE')),
    payload JSONB NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed')),
    retry_count INT NOT NULL DEFAULT 0,
    last_error TEXT,
    sent_at TIMESTAMPTZ
);

COMMENT ON TABLE analytics_outbox IS 'BigQuery連携パイプラインのトランザクショナルアウトボックス。対象テーブルの変更イベントを一次記録し、Edge Function経由でのBigQuery配送状態を管理する。';

-- pending行の高速走査用の部分インデックス(配送トリガー・再送ジョブが参照)
CREATE INDEX idx_analytics_outbox_pending ON analytics_outbox (status, occurred_at) WHERE status = 'pending';

-- RLSの有効化(ポリシーは定義しない = service roleのみがアクセス可能。anon/authenticatedからは不可視)
ALTER TABLE analytics_outbox ENABLE ROW LEVEL SECURITY;
