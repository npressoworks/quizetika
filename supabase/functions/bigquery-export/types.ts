// types.ts
// bigquery-export Edge Function の型定義。
// design.md「Edge / Export > ExportFunction > Service Interface」に定義された型を
// そのまま採用する。google-auth.ts / bigquery.ts / outbox.ts / index.ts の各実装
// (タスク3.2〜3.5) はここからインポートする。

export interface OutboxEvent {
  event_id: string;
  table_name: string;
  event_type: "INSERT" | "UPDATE" | "DELETE";
  payload: Record<string, unknown>;
  occurred_at: string;
  retry_count: number;
}

export type ExportResult =
  | { ok: true; sentEventIds: string[] }
  | { ok: false; error: string; retryableEventIds: string[] };

// google-auth.ts — トークンはモジュールスコープで有効期限までキャッシュする
export interface GoogleTokenProvider {
  getAccessToken(saKeyJson: string, fetchFn?: typeof fetch): Promise<string>;
}

// bigquery.ts — insertId = event_id を必ず設定する
export interface BigQueryInserter {
  insertEvents(
    token: string,
    config: { projectId: string; datasetId: string; tableId: string },
    events: OutboxEvent[],
    fetchFn?: typeof fetch
  ): Promise<ExportResult>;
}
