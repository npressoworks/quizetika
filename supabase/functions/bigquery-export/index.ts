// index.ts
// bigquery-export Edge Function の HTTP ハンドラ本実装(タスク3.5)。
// design.md「Edge / Export > ExportFunction」の API Contract / Implementation Notes、
// および tasks.md「Implementation Notes」の3.4/3.3注記(computeSentEventIdsアルゴリズム、
// retry上限(10)の判断はこのモジュールの責務)に従う。
//
// オーケストレーションロジックは `handleExportRequest` として切り出し、依存(deps)を注入
// できる形にしている(google-auth.ts/bigquery.ts/outbox.tsと同じfetch注入パターンに倣う)。
// これによりDenoグローバル(Deno.serve/Deno.env)に依存せずJestでユニットテストできる。
// `Deno.serve(...)` は本ファイル末尾の薄いラッパーのみ。

import type { ExportResult, OutboxEvent } from "./types.ts";
import { getAccessToken as defaultGetAccessToken } from "./google-auth.ts";
import { insertEvents as defaultInsertEvents } from "./bigquery.ts";
import {
  fetchPendingBatch as defaultFetchPendingBatch,
  markSent as defaultMarkSent,
  incrementRetryCount as defaultIncrementRetryCount,
  markFailed as defaultMarkFailed,
  computeSentEventIds as defaultComputeSentEventIds,
  type OutboxConfig,
} from "./outbox.ts";

/**
 * 1回のinsertAllで送信するイベント数の上限。design.md「1回の呼び出しで最大500行×複数バッチ」。
 */
export const BATCH_SIZE = 500;

/**
 * retry_countの上限。design.md「retry_countが上限(10回)を超えた行はfailedへ更新」。
 * outbox.tsはこの閾値を一切知らない(tasks.md 3.4注記)ため、ここで定義する。
 */
export const RETRY_LIMIT = 10;

/**
 * このFunction呼び出し1回でpendingバッチを取得し続けてよいwall-clock予算(ミリ秒)。
 *
 * 判断根拠(CONCERNS参照): Supabase Edge Functionsのリクエストタイムアウトはプランにより
 * 150秒(Free/Pro既定)〜400秒(Pro上限設定時)。本パイプラインはFree/Pro既定の150秒を
 * 前提とし、そこから「最後のバッチのinsertAll往復+消込PATCH+レスポンス組み立て」に必要な
 * 余白として30秒を差し引いた120秒を安全閾値とする。この閾値を超えた時点で新規バッチの
 * claim(fetchPendingBatch)を行わずループを打ち切り、残りは次回の起床通知またはcron再送
 * (再送ジョブは`pending`かつ2分以上滞留で起床通知)に委ねる。
 */
export const WALL_CLOCK_BUDGET_MS = 120_000;

const WEBHOOK_SECRET_HEADER = "X-Analytics-Webhook-Secret";

export interface ExportHandlerConfig {
  /** Vault/`supabase secrets`で管理される共有シークレット(ANALYTICS_WEBHOOK_SECRET)。 */
  webhookSecret: string;
  /** GCPサービスアカウント鍵(JSON文字列)。GCP_SERVICE_ACCOUNT_JSON。 */
  gcpServiceAccountJson: string;
  bqProjectId: string;
  bqDatasetId: string;
  /** raw_eventsテーブル固定(design.md「RawEventsSchema」)。env化していない。 */
  bqTableId: string;
  /** Supabaseプラットフォームが自動注入するSUPABASE_URL。 */
  supabaseUrl: string;
  /** Supabaseプラットフォームが自動注入するSUPABASE_SERVICE_ROLE_KEY。 */
  supabaseServiceRoleKey: string;
}

/**
 * オーケストレーションが利用する外部I/Oの注入ポイント。
 * デフォルト値は実モジュール(google-auth.ts/bigquery.ts/outbox.ts)の実装で、
 * テストからはモック関数に差し替える。
 */
export interface ExportHandlerDeps {
  fetchFn?: typeof fetch;
  getAccessToken: typeof defaultGetAccessToken;
  insertEvents: typeof defaultInsertEvents;
  fetchPendingBatch: typeof defaultFetchPendingBatch;
  markSent: typeof defaultMarkSent;
  incrementRetryCount: typeof defaultIncrementRetryCount;
  markFailed: typeof defaultMarkFailed;
  computeSentEventIds: typeof defaultComputeSentEventIds;
  /** wall-clock計測用の現在時刻取得(epoch ms)。テストで打ち切り挙動を決定的に検証するために注入可能。 */
  now?: () => number;
}

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/**
 * 1バッチ分のExportResultを、成功(sent)/リトライ継続(pending維持)/恒久失敗(failed)の
 * 3グループに振り分ける。
 *
 * 判断根拠(CONCERNS参照 — tasks.mdの3.5タスクブリーフに明記されたアルゴリズムをそのまま採用):
 * 失敗行はクレーム時点の(=未加算の)`event.retry_count`を用いて判定する。
 * `event.retry_count + 1 > RETRY_LIMIT` (= 現在のretry_countが既に10以上) の行は、
 * これ以上incrementRetryCountを呼ばずに直接failedへ遷移させる。design.mdの状態遷移図は
 * 「pending --pending(retry_count加算)を繰り返し、上限超過でfailedへ」という遷移を示すが、
 * 上限に達した最後の1回についてretry_countをさらに加算してから即failedにする実質的な意味は
 * ない(failedになった行はretry_countを参照されなくなるため)。そのため「上限を超える回はまず
 * 加算し、その結果を見てfailedにする」のではなく「加算前の時点で上限超過が確定しているなら
 * 加算自体をスキップしてfailedにする」実装とし、不要なRPC呼び出しを1回減らす。
 */
function classifyRetryableEvents(
  retryableEvents: OutboxEvent[]
): { toFail: string[]; toRetry: string[] } {
  const toFail: string[] = [];
  const toRetry: string[] = [];

  for (const event of retryableEvents) {
    if (event.retry_count + 1 > RETRY_LIMIT) {
      toFail.push(event.event_id);
    } else {
      toRetry.push(event.event_id);
    }
  }

  return { toFail, toRetry };
}

/**
 * bigquery-export Edge Functionのオーケストレーションロジック本体。
 *
 * フロー(design.md System Flowsのシーケンス図に対応):
 * 1. X-Analytics-Webhook-Secretヘッダーを検証。不一致/欠落は401を返しoutboxには一切触れない。
 * 2. pendingバッチをwall-clock予算内で繰り返しclaimし、都度Google認証→insertAll→消込を行う。
 * 3. `{ processed, failed }` をJSONで返す。
 *
 * processed/failedフィールドの意味(CONCERNS参照 — API Contractに定義がないため明示的に採用した解釈):
 * - processed: この呼び出し中に実際にBigQueryへ書き込まれ`sent`へ消込まれたイベント行数の合計
 *   (複数バッチにまたがる場合は合算)。
 * - failed: この呼び出し中にretry上限超過により新たに`failed`へ遷移したイベント行数の合計。
 *   (呼び出し前から既に`failed`だった行や、今回`pending`のまま残った行はカウントしない)
 */
export async function handleExportRequest(
  request: Request,
  config: ExportHandlerConfig,
  deps: ExportHandlerDeps
): Promise<Response> {
  const secretHeader = request.headers.get(WEBHOOK_SECRET_HEADER);
  if (!secretHeader || secretHeader !== config.webhookSecret) {
    // 「不一致は401でoutbox未接触」— fetchPendingBatch等を一切呼ばずここでreturnする。
    return jsonResponse({ error: "unauthorized" }, 401);
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const now = deps.now ?? (() => Date.now());
  const startedAt = now();

  const outboxConfig: OutboxConfig = {
    supabaseUrl: config.supabaseUrl,
    serviceRoleKey: config.supabaseServiceRoleKey,
  };
  const bqConfig = {
    projectId: config.bqProjectId,
    datasetId: config.bqDatasetId,
    tableId: config.bqTableId,
  };

  let processed = 0;
  let failed = 0;

  try {
    // deno-lint-ignore no-constant-condition
    while (true) {
      if (now() - startedAt > WALL_CLOCK_BUDGET_MS) {
        // wall-clock予算超過。新規バッチのclaimを行わず打ち切る(残りは次回起床通知/cronへ)。
        break;
      }

      const batch = await deps.fetchPendingBatch(outboxConfig, BATCH_SIZE, fetchFn);
      if (batch.length === 0) {
        break;
      }

      const batchEventIds = batch.map((event) => event.event_id);
      const token = await deps.getAccessToken(config.gcpServiceAccountJson, fetchFn);
      const result: ExportResult = await deps.insertEvents(
        token,
        bqConfig,
        batch,
        fetchFn
      );

      if (result.ok) {
        await deps.markSent(outboxConfig, result.sentEventIds, fetchFn);
        processed += result.sentEventIds.length;
        continue;
      }

      // 部分失敗(またはバッチ全体の送信失敗): 成功行は
      // batchEventIds - retryableEventIds の集合差分として求める(tasks.md 3.3注記のアルゴリズム)。
      const sentEventIds = deps.computeSentEventIds(
        batchEventIds,
        result.retryableEventIds
      );
      await deps.markSent(outboxConfig, sentEventIds, fetchFn);
      processed += sentEventIds.length;

      const retryableSet = new Set(result.retryableEventIds);
      const retryableEvents = batch.filter((event) =>
        retryableSet.has(event.event_id)
      );
      const { toFail, toRetry } = classifyRetryableEvents(retryableEvents);

      if (toFail.length > 0) {
        await deps.markFailed(outboxConfig, toFail, result.error, fetchFn);
        failed += toFail.length;
      }
      if (toRetry.length > 0) {
        await deps.incrementRetryCount(outboxConfig, toRetry, result.error, fetchFn);
      }
    }
  } catch (error) {
    // 想定外の内部エラー(outboxアクセス自体の失敗等)。design.mdの「500(内部エラー。outboxは
    // 未消込のまま)」に対応する。ただし複数バッチにまたがる呼び出しでは、エラー発生より前の
    // バッチは既にコミット済み(sent/failed)であるため、「outboxは完全に未消込」とは限らない
    // (CONCERNS参照)。可観測性のため、それまでの部分結果をレスポンスボディに含める。
    const message = error instanceof Error ? error.message : String(error);
    console.error(`bigquery-export: unhandled error during export: ${message}`);
    return jsonResponse({ error: "internal error", processed, failed }, 500);
  }

  return jsonResponse({ processed, failed }, 200);
}

function loadConfigFromEnv(): ExportHandlerConfig {
  return {
    webhookSecret: Deno.env.get("ANALYTICS_WEBHOOK_SECRET") ?? "",
    gcpServiceAccountJson: Deno.env.get("GCP_SERVICE_ACCOUNT_JSON") ?? "",
    bqProjectId: Deno.env.get("BQ_PROJECT_ID") ?? "",
    bqDatasetId: Deno.env.get("BQ_DATASET_ID") ?? "",
    bqTableId: "raw_events",
    // SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY はSupabaseプラットフォームがEdge Functionsに
    // 自動注入するため、.env.local.example/`supabase secrets set`での明示設定は不要
    // (https://supabase.com/docs/guides/functions/secrets 「Default secrets」)。
    supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
    supabaseServiceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  };
}

const defaultDeps: ExportHandlerDeps = {
  getAccessToken: defaultGetAccessToken,
  insertEvents: defaultInsertEvents,
  fetchPendingBatch: defaultFetchPendingBatch,
  markSent: defaultMarkSent,
  incrementRetryCount: defaultIncrementRetryCount,
  markFailed: defaultMarkFailed,
  computeSentEventIds: defaultComputeSentEventIds,
};

// `typeof Deno !== "undefined"` ガード: このファイルはJest(Node.js環境。Denoグローバルなし)からも
// `handleExportRequest`をユニットテストするためにimportされる(index.test.ts)。モジュール読み込み時に
// 無条件で`Deno.serve`を呼ぶとNode環境でのimport自体がReferenceErrorで失敗するため、Deno runtime上での
// 実行時のみサーバーを起動する。
if (typeof Deno !== "undefined") {
  Deno.serve((request) => handleExportRequest(request, loadConfigFromEnv(), defaultDeps));
}
