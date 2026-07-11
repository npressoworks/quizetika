// index.test.ts
// index.ts の handleExportRequest (HTTPハンドラのオーケストレーションロジック) を検証する。
// google-auth.ts/bigquery.ts/outbox.tsの全ての依存はdeps注入によりモックし、
// Denoグローバル(Deno.serve/Deno.env)には一切依存しない。

import {
  handleExportRequest,
  BATCH_SIZE,
  RETRY_LIMIT,
  WALL_CLOCK_BUDGET_MS,
  type ExportHandlerConfig,
  type ExportHandlerDeps,
} from "../../../supabase/functions/bigquery-export/index";
import type { OutboxEvent, ExportResult } from "../../../supabase/functions/bigquery-export/types";
import { computeSentEventIds } from "../../../supabase/functions/bigquery-export/outbox";

const CONFIG: ExportHandlerConfig = {
  webhookSecret: "test-secret",
  gcpServiceAccountJson: '{"client_email":"sa@example.com","private_key":"fake"}',
  bqProjectId: "quizeum-77bc6",
  bqDatasetId: "quizetika_analytics",
  bqTableId: "raw_events",
  supabaseUrl: "http://127.0.0.1:54321",
  supabaseServiceRoleKey: "fake-service-role-key",
};

function buildEvent(overrides: Partial<OutboxEvent> = {}): OutboxEvent {
  return {
    event_id: "event-1",
    table_name: "attempts",
    event_type: "INSERT",
    payload: { foo: "bar" },
    occurred_at: "2026-07-11T00:00:00.000Z",
    retry_count: 0,
    ...overrides,
  };
}

function makeRequest(headers: Record<string, string> = {}): Request {
  return new Request("http://localhost/functions/v1/bigquery-export", {
    method: "POST",
    headers,
  });
}

/** テストごとに未指定のdepsを「呼ばれたら即失敗させるスタブ」で埋めたベースdepsを作る。 */
function baseDeps(overrides: Partial<ExportHandlerDeps> = {}): ExportHandlerDeps {
  const notImplemented = (name: string) => () => {
    throw new Error(`unexpected call: ${name}`);
  };

  return {
    fetchFn: jest.fn() as unknown as typeof fetch,
    getAccessToken: jest.fn(notImplemented("getAccessToken")),
    insertEvents: jest.fn(notImplemented("insertEvents")),
    fetchPendingBatch: jest.fn(notImplemented("fetchPendingBatch")),
    markSent: jest.fn(notImplemented("markSent")),
    incrementRetryCount: jest.fn(notImplemented("incrementRetryCount")),
    markFailed: jest.fn(notImplemented("markFailed")),
    computeSentEventIds,
    now: () => 0,
    ...overrides,
  };
}

describe("handleExportRequest: secret verification", () => {
  it("returns 401 and never touches the outbox when the header is missing", async () => {
    const deps = baseDeps();

    const response = await handleExportRequest(makeRequest(), CONFIG, deps);

    expect(response.status).toBe(401);
    expect(deps.fetchPendingBatch).not.toHaveBeenCalled();
  });

  it("returns 401 and never touches the outbox when the secret does not match", async () => {
    const deps = baseDeps();

    const response = await handleExportRequest(
      makeRequest({ "X-Analytics-Webhook-Secret": "wrong-secret" }),
      CONFIG,
      deps
    );

    expect(response.status).toBe(401);
    expect(deps.fetchPendingBatch).not.toHaveBeenCalled();
    const body = await response.json();
    expect(body).toEqual({ error: "unauthorized" });
  });
});

describe("handleExportRequest: empty outbox", () => {
  it("stops immediately and returns processed:0, failed:0 when the batch is empty", async () => {
    const fetchPendingBatch = jest.fn(async () => []);
    const deps = baseDeps({ fetchPendingBatch });

    const response = await handleExportRequest(
      makeRequest({ "X-Analytics-Webhook-Secret": "test-secret" }),
      CONFIG,
      deps
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ processed: 0, failed: 0 });
    expect(fetchPendingBatch).toHaveBeenCalledTimes(1);
    expect(fetchPendingBatch).toHaveBeenCalledWith(
      { supabaseUrl: CONFIG.supabaseUrl, serviceRoleKey: CONFIG.supabaseServiceRoleKey },
      BATCH_SIZE,
      deps.fetchFn
    );
  });
});

describe("handleExportRequest: full success", () => {
  it("marks every event in the batch as sent and reports processed = batch size", async () => {
    const events = [buildEvent({ event_id: "e1" }), buildEvent({ event_id: "e2" })];
    const fetchPendingBatch = jest
      .fn()
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce([]);
    const getAccessToken = jest.fn(async () => "fake-token");
    const insertEvents = jest.fn(
      async (): Promise<ExportResult> => ({
        ok: true,
        sentEventIds: ["e1", "e2"],
      })
    );
    const markSent = jest.fn(async () => {});

    const deps = baseDeps({
      fetchPendingBatch,
      getAccessToken,
      insertEvents,
      markSent,
    });

    const response = await handleExportRequest(
      makeRequest({ "X-Analytics-Webhook-Secret": "test-secret" }),
      CONFIG,
      deps
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ processed: 2, failed: 0 });
    expect(markSent).toHaveBeenCalledWith(
      { supabaseUrl: CONFIG.supabaseUrl, serviceRoleKey: CONFIG.supabaseServiceRoleKey },
      ["e1", "e2"],
      deps.fetchFn
    );
    expect(insertEvents).toHaveBeenCalledWith(
      "fake-token",
      { projectId: CONFIG.bqProjectId, datasetId: CONFIG.bqDatasetId, tableId: CONFIG.bqTableId },
      events,
      deps.fetchFn
    );
  });
});

describe("handleExportRequest: partial failure", () => {
  it("marks succeeded events sent, retries under-threshold failures, and fails over-threshold ones", async () => {
    const events = [
      buildEvent({ event_id: "ok-1", retry_count: 0 }),
      buildEvent({ event_id: "retry-me", retry_count: 3 }),
      buildEvent({ event_id: "over-limit", retry_count: 10 }), // 10 + 1 > 10 -> failed
    ];
    const fetchPendingBatch = jest
      .fn()
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce([]);
    const getAccessToken = jest.fn(async () => "fake-token");
    const insertEvents = jest.fn(
      async (): Promise<ExportResult> => ({
        ok: false,
        error: "BigQuery insertAll partial failure: 2 of 3 rows failed",
        retryableEventIds: ["retry-me", "over-limit"],
      })
    );
    const markSent = jest.fn(async () => {});
    const incrementRetryCount = jest.fn(async () => {});
    const markFailed = jest.fn(async () => {});

    const deps = baseDeps({
      fetchPendingBatch,
      getAccessToken,
      insertEvents,
      markSent,
      incrementRetryCount,
      markFailed,
    });

    const response = await handleExportRequest(
      makeRequest({ "X-Analytics-Webhook-Secret": "test-secret" }),
      CONFIG,
      deps
    );

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ processed: 1, failed: 1 });

    // succeeded (batch - retryable) marked sent
    expect(markSent).toHaveBeenCalledWith(
      { supabaseUrl: CONFIG.supabaseUrl, serviceRoleKey: CONFIG.supabaseServiceRoleKey },
      ["ok-1"],
      deps.fetchFn
    );
    // under-threshold retryable event incremented, not failed
    expect(incrementRetryCount).toHaveBeenCalledWith(
      { supabaseUrl: CONFIG.supabaseUrl, serviceRoleKey: CONFIG.supabaseServiceRoleKey },
      ["retry-me"],
      "BigQuery insertAll partial failure: 2 of 3 rows failed",
      deps.fetchFn
    );
    // over-threshold retryable event goes straight to failed, not incremented
    expect(markFailed).toHaveBeenCalledWith(
      { supabaseUrl: CONFIG.supabaseUrl, serviceRoleKey: CONFIG.supabaseServiceRoleKey },
      ["over-limit"],
      "BigQuery insertAll partial failure: 2 of 3 rows failed",
      deps.fetchFn
    );
  });

  it("does not call incrementRetryCount for events routed to failed (RETRY_LIMIT boundary)", async () => {
    expect(RETRY_LIMIT).toBe(10);
    const events = [buildEvent({ event_id: "at-limit", retry_count: 9 })]; // 9+1=10, not > 10 -> retry
    const fetchPendingBatch = jest
      .fn()
      .mockResolvedValueOnce(events)
      .mockResolvedValueOnce([]);
    const insertEvents = jest.fn(
      async (): Promise<ExportResult> => ({
        ok: false,
        error: "err",
        retryableEventIds: ["at-limit"],
      })
    );
    const incrementRetryCount = jest.fn(async () => {});
    const markFailed = jest.fn(async () => {});
    const markSent = jest.fn(async () => {});
    const getAccessToken = jest.fn(async () => "fake-token");

    const deps = baseDeps({
      fetchPendingBatch,
      getAccessToken,
      insertEvents,
      markSent,
      incrementRetryCount,
      markFailed,
    });

    await handleExportRequest(
      makeRequest({ "X-Analytics-Webhook-Secret": "test-secret" }),
      CONFIG,
      deps
    );

    expect(incrementRetryCount).toHaveBeenCalledWith(
      expect.anything(),
      ["at-limit"],
      "err",
      deps.fetchFn
    );
    expect(markFailed).not.toHaveBeenCalled();
  });
});

describe("handleExportRequest: wall-clock cutoff", () => {
  it("stops claiming new batches once the elapsed time exceeds the wall-clock budget", async () => {
    const events = [buildEvent({ event_id: "e1" })];
    // Simulate time: startedAt=0, first now() check inside loop = 0 (proceed),
    // after processing first batch, next loop iteration's now() call exceeds budget.
    let callCount = 0;
    const now = jest.fn(() => {
      callCount += 1;
      // 1st call: startedAt. 2nd call: first loop check (still within budget).
      // 3rd call: second loop check (budget exceeded).
      if (callCount <= 2) {
        return 0;
      }
      return WALL_CLOCK_BUDGET_MS + 1;
    });

    const fetchPendingBatch = jest.fn(async () => events);
    const getAccessToken = jest.fn(async () => "fake-token");
    const insertEvents = jest.fn(
      async (): Promise<ExportResult> => ({ ok: true, sentEventIds: ["e1"] })
    );
    const markSent = jest.fn(async () => {});

    const deps = baseDeps({
      fetchPendingBatch,
      getAccessToken,
      insertEvents,
      markSent,
      now,
    });

    const response = await handleExportRequest(
      makeRequest({ "X-Analytics-Webhook-Secret": "test-secret" }),
      CONFIG,
      deps
    );

    const body = await response.json();
    expect(body).toEqual({ processed: 1, failed: 0 });
    // Only one batch claimed before the budget cutoff stopped the loop.
    expect(fetchPendingBatch).toHaveBeenCalledTimes(1);
  });
});

describe("handleExportRequest: unexpected internal error", () => {
  it("returns 500 with partial processed/failed counts when an outbox call throws", async () => {
    const events = [buildEvent({ event_id: "e1" })];
    const fetchPendingBatch = jest.fn(async () => events);
    const getAccessToken = jest.fn(async () => "fake-token");
    const insertEvents = jest.fn(
      async (): Promise<ExportResult> => ({ ok: true, sentEventIds: ["e1"] })
    );
    const markSent = jest.fn(async () => {
      throw new Error("network exploded");
    });

    const deps = baseDeps({
      fetchPendingBatch,
      getAccessToken,
      insertEvents,
      markSent,
    });

    const response = await handleExportRequest(
      makeRequest({ "X-Analytics-Webhook-Secret": "test-secret" }),
      CONFIG,
      deps
    );

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.processed).toBe(0);
    expect(body.failed).toBe(0);
  });
});
