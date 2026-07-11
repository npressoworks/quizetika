// bigquery.test.ts
// bigquery.ts の insertEvents (tabledata.insertAll リクエスト構築・レスポンス解釈) を検証する。
// fetch注入(fetchFn)によりDenoグローバルに依存せずNode/Jestで実行できる。

import { insertEvents } from "../../../supabase/functions/bigquery-export/bigquery";
import type { OutboxEvent } from "../../../supabase/functions/bigquery-export/types";

const CONFIG = {
  projectId: "quizeum-77bc6",
  datasetId: "quizetika_analytics",
  tableId: "raw_events",
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

describe("bigquery insertEvents", () => {
  it("sends a well-formed insertAll request: correct URL, Bearer token, and insertId=event_id per row", async () => {
    const events = [
      buildEvent({ event_id: "event-1" }),
      buildEvent({ event_id: "event-2", table_name: "quizzes" }),
    ];

    const mockFetch = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => {
        return new Response(
          JSON.stringify({ kind: "bigquery#tableDataInsertAllResponse" }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    );

    await insertEvents(
      "fake-token",
      CONFIG,
      events,
      mockFetch as unknown as typeof fetch
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(
      "https://bigquery.googleapis.com/bigquery/v2/projects/quizeum-77bc6/datasets/quizetika_analytics/tables/raw_events/insertAll"
    );

    const headers = (init as RequestInit).headers as Record<string, string>;
    expect(headers.Authorization).toBe("Bearer fake-token");

    const body = JSON.parse(String((init as RequestInit).body));
    expect(body.rows).toHaveLength(2);
    expect(body.rows[0].insertId).toBe("event-1");
    expect(body.rows[0].json.event_id).toBe("event-1");
    expect(body.rows[1].insertId).toBe("event-2");
    expect(body.rows[1].json.event_id).toBe("event-2");
  });

  it("returns ok:true with all event_ids in sentEventIds when the response has no insertErrors", async () => {
    const events = [
      buildEvent({ event_id: "event-a" }),
      buildEvent({ event_id: "event-b" }),
      buildEvent({ event_id: "event-c" }),
    ];

    const mockFetch = jest.fn(async () => {
      return new Response(
        JSON.stringify({ kind: "bigquery#tableDataInsertAllResponse" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const result = await insertEvents("fake-token", CONFIG, events, mockFetch);

    expect(result).toEqual({
      ok: true,
      sentEventIds: ["event-a", "event-b", "event-c"],
    });
  });

  it("separates succeeded and retryable event_ids on a partial-failure response (task's primary acceptance criterion)", async () => {
    const events = [
      buildEvent({ event_id: "event-a" }),
      buildEvent({ event_id: "event-b" }),
      buildEvent({ event_id: "event-c" }),
    ];

    const mockFetch = jest.fn(async () => {
      return new Response(
        JSON.stringify({
          kind: "bigquery#tableDataInsertAllResponse",
          insertErrors: [
            {
              index: 1,
              errors: [
                {
                  reason: "invalid",
                  message: "invalid row",
                  location: "payload",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }) as unknown as typeof fetch;

    const result = await insertEvents("fake-token", CONFIG, events, mockFetch);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected ok:false");
    }
    expect(result.retryableEventIds).toEqual(["event-b"]);
    expect(result.retryableEventIds).not.toContain("event-a");
    expect(result.retryableEventIds).not.toContain("event-c");
    expect(result.error).toContain("1");
    expect(result.error).toContain("3");
  });

  it("treats a total request failure (non-OK HTTP response) as ok:false with all event_ids retryable", async () => {
    const events = [
      buildEvent({ event_id: "event-a" }),
      buildEvent({ event_id: "event-b" }),
    ];

    const mockFetch = jest.fn(async () => {
      return new Response("unauthorized", { status: 401 });
    }) as unknown as typeof fetch;

    const result = await insertEvents("bad-token", CONFIG, events, mockFetch);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected ok:false");
    }
    expect(result.retryableEventIds).toEqual(["event-a", "event-b"]);
  });

  it("treats a thrown network error as ok:false with all event_ids retryable", async () => {
    const events = [buildEvent({ event_id: "event-a" })];

    const mockFetch = jest.fn(async () => {
      throw new Error("network down");
    }) as unknown as typeof fetch;

    const result = await insertEvents("fake-token", CONFIG, events, mockFetch);

    expect(result.ok).toBe(false);
    if (result.ok) {
      throw new Error("expected ok:false");
    }
    expect(result.retryableEventIds).toEqual(["event-a"]);
  });

  it("returns ok:true with an empty sentEventIds array when given an empty events array (no request sent)", async () => {
    const mockFetch = jest.fn();

    const result = await insertEvents(
      "fake-token",
      CONFIG,
      [],
      mockFetch as unknown as typeof fetch
    );

    expect(result).toEqual({ ok: true, sentEventIds: [] });
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
