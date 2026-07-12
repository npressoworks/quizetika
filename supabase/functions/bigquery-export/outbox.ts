// outbox.ts
// analytics_outbox に対する取得(pending行のバッチ取得)・消込(sent/retry/failed遷移)の
// アクセスモジュール。
//
// - design.md「Edge / Export > ExportFunction」の Invariants「any不使用。fetch注入により
//   Denoグローバル非依存でJestテスト可能」、および Dependencies「External: なし(npm依存ゼロ。
//   Web Crypto APIとfetchのみ)」は google-auth.ts / bigquery.ts に限定されたものではなく
//   ExportFunctionコンポーネント全体の方針であるため、本モジュールも @supabase/supabase-js 等の
//   npmパッケージを追加せず、Supabase REST(PostgREST)エンドポイントへ生の fetch で直接アクセスする
//   (google-auth.ts / bigquery.ts と同一の fetchFn 注入パターン)。
// - pending行のバッチ取得は「FOR UPDATE SKIP LOCKED」意味論が必要(design.md「OutboxTable >
//   Concurrency strategy」「3.4タスク説明」)だが、PostgRESTのクエリビルダではこれを表現できないため、
//   ロジックをPostgres関数(RPC)側に実装し(マイグレーション
//   20260717000000_bigquery_export_outbox_claim_rpc.sql の claim_pending_analytics_events)、
//   本モジュールは `.rpc()` 相当(POST /rest/v1/rpc/...)で呼び出すのみとする。
// - retry_countの加算も「読み取り→+1→書き込み」ではレースコンディションで加算漏れが起こり得るため、
//   同マイグレーションのincrement_analytics_outbox_retry RPCでDB側に原子的なUPDATE
//   (`retry_count = retry_count + 1`)として実装し、本モジュールはRPC呼び出しのみを行う。
//
// SKIP LOCKEDの実効性に関する設計判断(タスク3.4の既知の制約。詳細はCONCERNS参照):
//   claim_pending_analytics_events は PL/pgSQL関数内で `FOR UPDATE SKIP LOCKED` を用いて行ロックを
//   取得するが、PostgRESTの1回のRPC呼び出しは単一トランザクションとして実行され、関数がRETURNした
//   時点(=HTTPレスポンスが返る時点)でそのトランザクションはコミットされ、行ロックは解放される。
//   つまりロックは「他の同時claim呼び出しとの取り合いを防ぐ」効果はあるが、「claimしてからBigQueryへの
//   送信が完了するまでの間、他の呼び出しが同じ行を再度claimしない」ことまでは保証しない
//   (Edge Functionの2重起動が、片方がclaimしてBigQuery送信中に、もう片方が同じpending行を
//   再claimする余地は残る)。
//   既存スキーマ(analytics_outboxのstatus CHECK制約はpending/sent/failedのみ)には
//   claim中を表す中間状態がなく、これを追加するにはタスク1.1が確定させたテーブル定義への
//   変更が必要になるため、本タスクの境界を越える。したがってこの残存リスクは受容し、
//   BigQuery側のinsertId重複排除+v_dedup_eventsビュー(design.md 5.3)による多層防御に委ねる
//   (このspec全体で既に採用されている「at-least-once配送+下流重複排除」パターンと整合)。

import type { OutboxEvent } from "./types.ts";

/** Supabase REST(PostgREST)への接続情報。index.ts(task 3.5)がDeno.envから組み立てて渡す。 */
export interface OutboxConfig {
  /** 例: "http://127.0.0.1:54321" または "https://<project-ref>.supabase.co" (末尾スラッシュ不要) */
  supabaseUrl: string;
  /** service_role キー。RLS(ポリシーなし)を越えてanalytics_outboxへアクセスするために必須。 */
  serviceRoleKey: string;
}

/** claim_pending_analytics_events RPCが返す1行の形状。 */
interface ClaimedEventRow {
  event_id: string;
  table_name: string;
  event_type: OutboxEvent["event_type"];
  payload: Record<string, unknown>;
  occurred_at: string;
  retry_count: number;
}

const DEFAULT_BATCH_SIZE = 500;

function trimTrailingSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

function restUrl(config: OutboxConfig, path: string): string {
  return `${trimTrailingSlash(config.supabaseUrl)}/rest/v1${path}`;
}

function requestHeaders(
  config: OutboxConfig,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    apikey: config.serviceRoleKey,
    Authorization: `Bearer ${config.serviceRoleKey}`,
    "Content-Type": "application/json",
    ...extra,
  };
}

async function readErrorText(response: Response): Promise<string> {
  try {
    return await response.text();
  } catch {
    return "";
  }
}

/**
 * event_idのリストを PostgREST の `in.(...)` フィルタ値へ変換する。
 * event_idはDB側でUUID型(gen_random_uuid()由来)であることが保証されているため、
 * カンマ区切りでの単純結合で安全(任意文字列の混入経路はない)。
 */
function toInFilterValue(eventIds: string[]): string {
  return `in.(${eventIds.join(",")})`;
}

/**
 * pending行を FOR UPDATE SKIP LOCKED でバッチ取得する(claim_pending_analytics_events RPC経由)。
 * 取得しただけでは行のstatusは変化しない(pendingのまま)。呼び出し側がmarkSent/
 * incrementRetryCount/markFailedのいずれかで消込むまでpendingであり続ける。
 */
export async function fetchPendingBatch(
  config: OutboxConfig,
  batchSize: number = DEFAULT_BATCH_SIZE,
  fetchFn: typeof fetch = fetch
): Promise<OutboxEvent[]> {
  const response = await fetchFn(
    restUrl(config, "/rpc/claim_pending_analytics_events"),
    {
      method: "POST",
      headers: requestHeaders(config),
      body: JSON.stringify({ p_batch_size: batchSize }),
    }
  );

  if (!response.ok) {
    const errorText = await readErrorText(response);
    throw new Error(
      `outbox: failed to claim pending events: ${response.status} ${errorText}`
    );
  }

  const rows = (await response.json()) as ClaimedEventRow[];
  return rows.map((row) => ({
    event_id: row.event_id,
    table_name: row.table_name,
    event_type: row.event_type,
    payload: row.payload,
    occurred_at: row.occurred_at,
    retry_count: row.retry_count,
  }));
}

/**
 * 送信成功したイベントを sent へ消込む(status='sent', sent_at=now)。
 * eventIdsが空配列の場合は何もしない(不要なHTTPリクエストを発行しない)。
 */
export async function markSent(
  config: OutboxConfig,
  eventIds: string[],
  fetchFn: typeof fetch = fetch
): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  const response = await fetchFn(
    restUrl(config, `/analytics_outbox?event_id=${toInFilterValue(eventIds)}`),
    {
      method: "PATCH",
      headers: requestHeaders(config, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        status: "sent",
        sent_at: new Date().toISOString(),
      }),
    }
  );

  if (!response.ok) {
    const errorText = await readErrorText(response);
    throw new Error(
      `outbox: failed to mark events as sent: ${response.status} ${errorText}`
    );
  }
}

/**
 * 送信失敗イベントの retry_count を原子的に+1し、last_errorを記録する
 * (increment_analytics_outbox_retry RPC経由。読み取り→書き込みのレースを避けるためDB側UPDATE式で加算)。
 * statusはpendingのまま(次回の起床通知/cron再送で再度対象になる)。
 * retry_countが上限を超えた場合に failed へ遷移させるかどうかの判断はこのモジュールの責務外
 * (index.ts / task 3.5 が、返ってきた新しいretry_countを見て markFailed を呼ぶかどうかを決定する。
 * design.mdのExportFunction Responsibilities「retry_countが上限(10回)を超えた行はfailedへ更新」は
 * HTTPハンドラ(task 3.5)の記述であり、本モジュールは"10"という閾値を一切知らない)。
 */
export async function incrementRetryCount(
  config: OutboxConfig,
  eventIds: string[],
  errorMessage: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  const response = await fetchFn(
    restUrl(config, "/rpc/increment_analytics_outbox_retry"),
    {
      method: "POST",
      headers: requestHeaders(config),
      body: JSON.stringify({
        p_event_ids: eventIds,
        p_error: errorMessage,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await readErrorText(response);
    throw new Error(
      `outbox: failed to increment retry_count: ${response.status} ${errorText}`
    );
  }
}

/**
 * retry_count上限超過など、恒久失敗と判断されたイベントを failed へ遷移させる(status='failed',
 * last_error=errorMessage)。「上限を超えたかどうか」の判定はこの関数の呼び出し側(task 3.5)が行う
 * (design.md 5.2「恒久失敗の運用者検知」)。
 */
export async function markFailed(
  config: OutboxConfig,
  eventIds: string[],
  errorMessage: string,
  fetchFn: typeof fetch = fetch
): Promise<void> {
  if (eventIds.length === 0) {
    return;
  }

  const response = await fetchFn(
    restUrl(config, `/analytics_outbox?event_id=${toInFilterValue(eventIds)}`),
    {
      method: "PATCH",
      headers: requestHeaders(config, { Prefer: "return=minimal" }),
      body: JSON.stringify({
        status: "failed",
        last_error: errorMessage,
      }),
    }
  );

  if (!response.ok) {
    const errorText = await readErrorText(response);
    throw new Error(
      `outbox: failed to mark events as failed: ${response.status} ${errorText}`
    );
  }
}

/**
 * bigquery.tsのExportResult(ok:false時はretryableEventIdsしか持たない)から、成功したevent_idの
 * 集合を「送信したバッチ全体 - リトライ対象」の集合差分として求める純粋関数。
 * tasks.mdの Implementation Notes(タスク3.3の注記)が定義するアルゴリズムをそのまま実装したもので、
 * 呼び出し側(task 3.5)がこれを使ってmarkSent/incrementRetryCountへ振り分ける。
 * ネットワークI/Oを一切行わないため、Jestで完全にユニットテスト可能。
 */
export function computeSentEventIds(
  batchEventIds: string[],
  retryableEventIds: string[]
): string[] {
  const retryable = new Set(retryableEventIds);
  return batchEventIds.filter((eventId) => !retryable.has(eventId));
}
