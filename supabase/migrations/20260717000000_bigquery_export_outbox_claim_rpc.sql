-- ==========================================
-- BigQuery Export Pipeline: outbox取得/消込プリミティブ用RPC関数
-- Requirements: 5.1 (一時失敗時の自動再送), 5.2 (恒久失敗の運用者検知)
-- Design: OutboxTable component（design.md「DB / Capture」節）
--         ExportFunction(outbox.ts) の Dependencies（design.md「Edge / Export」節）
--
-- 背景: Supabase REST(PostgREST)のクエリビルダは `FOR UPDATE SKIP LOCKED` を表現できないため、
-- pending行のバッチ取得はPostgres関数(RPC)として実装し、outbox.ts(task 3.4)から
-- `POST /rest/v1/rpc/claim_pending_analytics_events` として呼び出す。
-- 同様にretry_countの原子的な加算(読み取り→+1→書き込みのレースを避ける)もRPC化する。
--
-- SKIP LOCKEDの実効性についての設計判断:
-- PostgRESTの1回のRPC呼び出しは単一トランザクションとして実行され、関数がRETURNした時点
-- (=HTTPレスポンスが返る時点)でそのトランザクションはコミットされ、行ロックは解放される。
-- そのためこの行ロックは「他の同時claim呼び出しとの取り合いを防ぐ」効果はあるが、
-- 「claimしてからBigQueryへの送信が完了するまでの間、他の呼び出しが同じ行を再度claimしない」
-- ことまでは保証しない。既存のanalytics_outbox.statusのCHECK制約(pending/sent/failedのみ、
-- task 1.1で確定済み)には claim中を表す中間状態がなく、これを追加するにはタスク1.1の境界を
-- 越える変更が必要になるため、本タスクでは行わない。この残存リスクは受容し、BigQuery側の
-- insertId重複排除+v_dedup_eventsビュー(design.md 5.3)による多層防御に委ねる
-- (このspec全体で既に採用されている「at-least-once配送+下流重複排除」パターンと整合)。
-- ==========================================

-- ==========================================
-- pending行のバッチ取得(FOR UPDATE SKIP LOCKED)。
-- 取得しただけではstatusを変更しない(pendingのまま)。呼び出し側が後続でsent/failedへ
-- 更新するまでpendingであり続ける(上記の設計判断を参照)。
-- ==========================================
CREATE OR REPLACE FUNCTION claim_pending_analytics_events(p_batch_size int DEFAULT 500)
RETURNS TABLE (
    event_id uuid,
    table_name text,
    event_type text,
    payload jsonb,
    occurred_at timestamptz,
    retry_count int
) AS $$
BEGIN
    RETURN QUERY
    SELECT o.event_id, o.table_name, o.event_type, o.payload, o.occurred_at, o.retry_count
    FROM analytics_outbox o
    WHERE o.status = 'pending'
    ORDER BY o.occurred_at
    FOR UPDATE SKIP LOCKED
    LIMIT p_batch_size;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION claim_pending_analytics_events(int) IS 'bigquery-export Edge Function(outbox.ts)がpending行をFOR UPDATE SKIP LOCKEDでバッチ取得するためのRPC。PostgRESTのクエリビルダでは表現できないSKIP LOCKED意味論をここに閉じ込める。';

-- service_roleのみが呼び出せればよい(Edge Functionはservice roleキーで接続する)。
REVOKE ALL ON FUNCTION claim_pending_analytics_events(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION claim_pending_analytics_events(int) TO service_role;

-- ==========================================
-- retry_countの原子的な加算(読み取り→+1→書き込みのレースを避けるため、
-- UPDATE ... SET retry_count = retry_count + 1 という単一のSQL文でDB側に加算させる)。
-- statusはpendingのまま変更しない(pending→failedの遷移判断はEdge Function側=task 3.5の責務。
-- design.md「ExportFunction Responsibilities: retry_countが上限(10回)を超えた行はfailedへ更新」)。
-- ==========================================
CREATE OR REPLACE FUNCTION increment_analytics_outbox_retry(
    p_event_ids uuid[],
    p_error text DEFAULT NULL
)
RETURNS void AS $$
BEGIN
    UPDATE analytics_outbox
    SET retry_count = retry_count + 1,
        last_error = COALESCE(p_error, last_error)
    WHERE event_id = ANY(p_event_ids)
      AND status = 'pending';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

COMMENT ON FUNCTION increment_analytics_outbox_retry(uuid[], text) IS 'bigquery-export Edge Function(outbox.ts)が送信失敗イベントのretry_countを原子的に+1し、last_errorを記録するためのRPC。failedへの遷移閾値(10回)はこの関数の責務外(呼び出し側=task 3.5が判断する)。';

REVOKE ALL ON FUNCTION increment_analytics_outbox_retry(uuid[], text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION increment_analytics_outbox_retry(uuid[], text) TO service_role;
