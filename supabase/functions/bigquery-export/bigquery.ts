// bigquery.ts
// OutboxEvent配列を BigQuery tabledata.insertAll REST API のリクエストに変換して送信し、
// レスポンス(insertErrors)を成功行/リトライ対象行に分類する。
//
// - insertId は必ず event_id を設定する(BigQuery側のbest-effort重複排除。design.md 5.3)。
// - バッチ分割(events配列を500行単位に切る等)はこのモジュールの責務外。
//   呼び出し側(index.ts / task 3.5)が渡されたeventsをそのまま1回のinsertAllで送信する。
// - fetchFn引数によりDenoグローバルに依存しない(Jestテスト可能。google-auth.tsと同様のパターン)。
//
// BigQueryInserter インターフェース(types.ts)を満たす。

import type { BigQueryInserter, ExportResult, OutboxEvent } from "./types.ts";

interface InsertAllRow {
  insertId: string;
  json: {
    event_id: string;
    table_name: string;
    event_type: OutboxEvent["event_type"];
    occurred_at: string;
    // BigQuery tabledata.insertAll (streaming insert) は JSON型カラムの値を
    // ネストしたオブジェクトとしてではなく、JSON文字列として受け取る必要がある。
    // ネストしたオブジェクトを渡すと `"payload is not a record"` エラーになる
    // (実BigQueryへのE2E検証で判明。tabledata.insertAll特有の制約で、
    // クエリ実行時のJSON型パラメータとは異なる)。
    payload: string;
  };
}

interface InsertAllRequestBody {
  rows: InsertAllRow[];
}

interface InsertAllErrorEntry {
  index: number;
  errors: Array<{ reason?: string; message?: string; location?: string }>;
}

interface InsertAllResponseBody {
  kind?: string;
  insertErrors?: InsertAllErrorEntry[];
}

function buildInsertAllUrl(config: {
  projectId: string;
  datasetId: string;
  tableId: string;
}): string {
  return `https://bigquery.googleapis.com/bigquery/v2/projects/${config.projectId}/datasets/${config.datasetId}/tables/${config.tableId}/insertAll`;
}

function buildRequestBody(events: OutboxEvent[]): InsertAllRequestBody {
  return {
    rows: events.map((event) => ({
      // insertId=event_id は非交渉の要件(タスク3.3の完了条件・design.md 5.3)。
      insertId: event.event_id,
      json: {
        event_id: event.event_id,
        table_name: event.table_name,
        event_type: event.event_type,
        // OutboxEvent.occurred_at は Postgres 由来の ISO 8601 文字列であることが前提。
        // BigQuery の TIMESTAMP 型はISO 8601文字列をそのままパースできるため変換しない。
        occurred_at: event.occurred_at,
        // payload は BigQuery 側で JSON 型のカラムだが、streaming insert
        // (tabledata.insertAll) はJSON型の値をJSON文字列として要求するため、
        // ここで明示的に文字列化する(上記InsertAllRow.json.payloadの型注記を参照)。
        payload: JSON.stringify(event.payload),
      },
    })),
  };
}

async function insertEvents(
  token: string,
  config: { projectId: string; datasetId: string; tableId: string },
  events: OutboxEvent[],
  fetchFn: typeof fetch = fetch
): Promise<ExportResult> {
  const allEventIds = events.map((event) => event.event_id);

  if (events.length === 0) {
    return { ok: true, sentEventIds: [] };
  }

  const url = buildInsertAllUrl(config);
  const requestBody = buildRequestBody(events);

  let response: Response;
  try {
    response = await fetchFn(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  } catch (error) {
    // ネットワークエラー等、リクエスト自体が失敗した場合は全行が未挿入とみなし、全件リトライ対象とする。
    const message = error instanceof Error ? error.message : String(error);
    return {
      ok: false,
      error: `BigQuery insertAll request failed: ${message}`,
      retryableEventIds: allEventIds,
    };
  }

  if (!response.ok) {
    // HTTPレベルの失敗(401認証エラー・5xx等)は何も挿入されていないとみなし、全件リトライ対象とする。
    const errorText = await response.text();
    return {
      ok: false,
      error: `BigQuery insertAll HTTP error: ${response.status} ${errorText}`,
      retryableEventIds: allEventIds,
    };
  }

  const responseBody = (await response.json()) as InsertAllResponseBody;
  const insertErrors = responseBody.insertErrors ?? [];

  if (insertErrors.length === 0) {
    // insertErrorsが存在しない/空 = 全行成功。
    return { ok: true, sentEventIds: allEventIds };
  }

  // 部分失敗: insertErrors[].index はリクエストのrows配列中の位置(0-based)。
  // 元のevents配列と同順序であるため、そのままevent_idへマッピングできる。
  const failedIndexes = new Set(insertErrors.map((entry) => entry.index));
  const retryableEventIds = events
    .filter((_event, index) => failedIndexes.has(index))
    .map((event) => event.event_id);

  return {
    ok: false,
    error: `BigQuery insertAll partial failure: ${retryableEventIds.length} of ${events.length} rows failed`,
    retryableEventIds,
  };
}

export { insertEvents };

// BigQueryInserter インターフェースを満たすオブジェクト実装(index.ts等からの利用を想定)。
export const bigQueryInserter: BigQueryInserter = {
  insertEvents,
};
