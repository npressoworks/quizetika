-- ==========================================
-- BigQuery Export Pipeline: 配送トリガーとpg_cronジョブ(再送・パージ)の実装
-- Requirements: 1.4 (手動操作なしのイベント駆動同期), 5.1 (一時失敗時の自動再送)
-- Design: DeliveryTrigger / CronJobs component（design.md「DB / Capture」節）
--
-- 方針:
-- - 配送トリガーは「起床通知」のみを行う。ペイロードは空('{}')固定であり、
--   outbox行の内容そのものは運ばない(Edge Function側がpending行を自律的に取得する。
--   Edge Function本体はtask 3.x以降で実装されるため、本マイグレーションはDB側の
--   「誰に通知するか」の配線のみを担う)。
-- - Supabaseダッシュボードが生成する標準の supabase_functions.http_request() トリガーは
--   ヘッダーがCREATE TRIGGER時点のTG_ARGV静的値に固定され、ペイロードも
--   {old_record, record, type, table, schema}に固定されるため、
--   「ヘッダーをVaultから動的取得」「ペイロードは空」という設計要件を満たせない。
--   そのため本マイグレーションでは net.http_post を直接呼ぶ専用トリガー関数を自前実装する。
-- - Webhookシークレットと配送先Function URLは、いずれもSupabase Vault
--   (vault.secrets / vault.decrypted_secrets)に保持する。Vaultは「シークレット保持」の
--   責務を持つプラットフォーム機能であり、URLも「環境ごとに異なり、後から書き換える値」
--   という性質がシークレットと同じであるため同じ保管場所に寄せた(設計判断。design.mdは
--   URLの保管方式までは規定していない)。
--   ローカル開発のプレースホルダ値は本物のシークレットではなく、Edge Function
--   (task 3.1以降)がデプロイされ次第、環境ごとに vault.update_secret で実値に
--   置き換える運用とする(scripts/bigquery/README.md 側で手順化予定 = task 5.1)。
-- - トリガー関数・cronジョブ関数はいずれもSECURITY DEFINERとする。Vaultの
--   decrypted_secretsビューはpgsodiumの鍵アクセスを要するため、キャプチャトリガー群
--   (20260714000000/20260715000000)と同様にDEFINER権限で実行し、呼び出し元ロールに
--   Vault直接アクセス権を要求しない一貫した方針とする。
-- ==========================================

-- ==========================================
-- Vault: Webhook共有シークレットと配送先Function URLのプレースホルダ登録
-- 実値は環境ごとに vault.update_secret(...) で上書きすること(ローカル開発は
-- プレースホルダのままで動作確認可能。本物のシークレットではないためコミット許容)。
-- ==========================================
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'analytics_webhook_secret') THEN
        PERFORM vault.create_secret(
            'local-dev-placeholder-CHANGE-ME',
            'analytics_webhook_secret',
            'BigQuery Exportパイプライン: outbox配送トリガー/再送ジョブがX-Analytics-Webhook-Secretヘッダーに設定する共有シークレット。デプロイ環境では実値に更新し、Edge Function側のsupabase secrets(ANALYTICS_WEBHOOK_SECRET)と一致させること。'
        );
    END IF;

    IF NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'analytics_webhook_url') THEN
        PERFORM vault.create_secret(
            'http://host.docker.internal:54321/functions/v1/bigquery-export',
            'analytics_webhook_url',
            'BigQuery Exportパイプライン: outbox配送トリガー/再送ジョブの起床通知先Function URL。bigquery-export Edge Function(task 3.1以降)のデプロイ後、実際のプロジェクトURL(https://<project-ref>.supabase.co/functions/v1/bigquery-export等)に更新すること。'
        );
    END IF;
END;
$$;

-- ==========================================
-- 起床通知の共通ロジック: Vaultからシークレット/URLを取得し、
-- 空ペイロードのPOSTをpg_net経由でタイムアウト5000msで発行する。
-- Vault未設定(値がNULL)の場合は例外にせずWARNINGを出して黙って戻る
-- (ソーストランザクション/cronジョブを配送トラブルで失敗させないため)。
-- ==========================================
CREATE OR REPLACE FUNCTION notify_analytics_export()
RETURNS void AS $$
DECLARE
    v_url text;
    v_secret text;
BEGIN
    SELECT decrypted_secret INTO v_url
    FROM vault.decrypted_secrets WHERE name = 'analytics_webhook_url';

    SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name = 'analytics_webhook_secret';

    IF v_url IS NULL OR v_secret IS NULL THEN
        RAISE WARNING 'analytics export: webhook secret/url not configured in Vault; skipping notification';
        RETURN;
    END IF;

    PERFORM net.http_post(
        url := v_url,
        body := '{}'::jsonb,
        headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'X-Analytics-Webhook-Secret', v_secret
        ),
        timeout_milliseconds := 5000
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net;

COMMENT ON FUNCTION notify_analytics_export() IS 'analytics_outboxの配送先Functionへ空ペイロードの起床通知をpg_net経由で送る共通処理。配送トリガーと再送cronジョブの双方から呼ばれる。';

-- ==========================================
-- 配送トリガー: analytics_outboxへのINSERT直後に起床通知を発行する。
-- ==========================================
CREATE OR REPLACE FUNCTION tr_notify_analytics_export()
RETURNS TRIGGER AS $$
BEGIN
    PERFORM notify_analytics_export();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net;

CREATE OR REPLACE TRIGGER tr_analytics_outbox_notify
AFTER INSERT ON analytics_outbox
FOR EACH ROW
EXECUTE FUNCTION tr_notify_analytics_export();

-- ==========================================
-- 再送ジョブ(毎分): pendingかつ2分以上滞留している行が存在する場合のみ
-- 同じ起床通知を送る。retry_countの加算はEdge Function側の責務(design.md参照)。
-- ==========================================
CREATE OR REPLACE FUNCTION analytics_export_retry_notify()
RETURNS void AS $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM analytics_outbox
        WHERE status = 'pending'
          AND occurred_at < now() - interval '2 minutes'
    ) THEN
        PERFORM notify_analytics_export();
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, vault, net;

COMMENT ON FUNCTION analytics_export_retry_notify() IS 'pg_cron再送ジョブ本体。pendingが2分以上残留している場合のみFunctionへ再通知する。';

-- ==========================================
-- パージジョブ(毎日): sentかつ30日超の行を削除。failedはパージ対象外(5.2)。
-- ==========================================
CREATE OR REPLACE FUNCTION analytics_export_purge_sent()
RETURNS void AS $$
BEGIN
    DELETE FROM analytics_outbox
    WHERE status = 'sent'
      AND sent_at < now() - interval '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION analytics_export_purge_sent() IS 'pg_cronパージジョブ本体。sent行の30日超保持分のみ削除し、failed行は運用者が確認できるよう残す。';

-- ==========================================
-- pg_cronジョブ登録
-- ==========================================
SELECT cron.schedule(
    'analytics-outbox-retry-notify',
    '* * * * *',
    'SELECT analytics_export_retry_notify();'
);

SELECT cron.schedule(
    'analytics-outbox-purge-sent',
    '0 4 * * *',
    'SELECT analytics_export_purge_sent();'
);
