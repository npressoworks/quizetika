// outbox.test.ts
//
// outbox.ts の検証。
//
// 注記(このテストの性質): 当初のタスクブリーフは「REAL Supabase Postgresに対する統合テスト
// (@supabase/supabase-js + npx supabase start)」を想定していたが、以下の2つの理由により
// google-auth.test.ts / bigquery.test.ts と同じ「fetch注入によるユニットテスト」方式を採用する。
//
// 1. design.md「Edge / Export > ExportFunction」の Invariants「any不使用。fetch注入により
//    Denoグローバル非依存でJestテスト可能」および Dependencies「External: なし(npm依存ゼロ。
//    Web Crypto APIとfetchのみ)」は google-auth.ts / bigquery.ts に限定されたものではなく
//    ExportFunctionコンポーネント全体の設計方針であるため、outbox.ts も
//    @supabase/supabase-js を追加せず PostgREST へ生の fetch でアクセスする実装とした
//    (詳細は outbox.ts 冒頭のコメントを参照)。この実装であればfetchFn注入で完全にモック可能であり、
//    そもそも実DBへの接続を必要としない。
// 2. このサンドボックス環境ではホストからDockerコンテナへのポートフォワーディング(54321/54322等)が
//    機能せず(tasks.md「Implementation Notes」のタスク3.1の注記と同一の既知の環境制約)、
//    Jestプロセス(ホスト上で実行)から実際のローカルSupabaseへ到達できない。
//
// そのため「outbox行のstatusが期待通り遷移すること」自体の実DB検証は、本タスクの実装中に
// `docker exec supabase_db_quizetika psql -f ...` で claim_pending_analytics_events /
// increment_analytics_outbox_retry の両RPCと markSent/markFailed 相当のUPDATE文を直接実行し、
// pending→sent / pending→pending(retry_count+1) / pending→failed の各遷移とSKIP LOCKEDの
// 排他動作を実際のPostgresで確認済み(担当実装者の作業ログ・ステータスレポート参照)。
// 本ファイルはその上で、outbox.ts が「正しいHTTPリクエストを組み立て、レスポンスを正しく解釈するか」
// (=TypeScript側のロジック)をfetchFn注入によりJestで検証する。

import {
  fetchPendingBatch,
  markSent,
  incrementRetryCount,
  markFailed,
  computeSentEventIds,
  type OutboxConfig,
} from "../../../supabase/functions/bigquery-export/outbox";

const CONFIG: OutboxConfig = {
  supabaseUrl: "http://127.0.0.1:54321",
  serviceRoleKey: "fake-service-role-key",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

describe("outbox fetchPendingBatch", () => {
  it("calls the claim RPC with the given batch size and maps rows to OutboxEvent[]", async () => {
    const rpcRows = [
      {
        event_id: "event-1",
        table_name: "attempts",
        event_type: "INSERT",
        payload: { foo: "bar" },
        occurred_at: "2026-07-11T00:00:00.000Z",
        retry_count: 0,
      },
      {
        event_id: "event-2",
        table_name: "quizzes",
        event_type: "UPDATE",
        payload: { baz: 1 },
        occurred_at: "2026-07-11T00:01:00.000Z",
        retry_count: 2,
      },
    ];
    const mockFetch = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        jsonResponse(rpcRows)
    );

    const result = await fetchPendingBatch(
      CONFIG,
      50,
      mockFetch as unknown as typeof fetch
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:54321/rest/v1/rpc/claim_pending_analytics_events"
    );
    const initTyped = init as RequestInit;
    expect(initTyped.method).toBe("POST");
    const headers = initTyped.headers as Record<string, string>;
    expect(headers.apikey).toBe("fake-service-role-key");
    expect(headers.Authorization).toBe("Bearer fake-service-role-key");
    expect(JSON.parse(String(initTyped.body))).toEqual({ p_batch_size: 50 });

    expect(result).toEqual(rpcRows);
  });

  it("uses a default batch size of 500 when none is given", async () => {
    const mockFetch = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) => jsonResponse([])
    );

    await fetchPendingBatch(CONFIG, undefined, mockFetch as unknown as typeof fetch);

    const [, init] = mockFetch.mock.calls[0];
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({
      p_batch_size: 500,
    });
  });

  it("throws when the RPC responds with a non-OK status (does not silently return an empty batch)", async () => {
    const mockFetch = jest.fn(
      async () => new Response("permission denied", { status: 401 })
    );

    await expect(
      fetchPendingBatch(CONFIG, 10, mockFetch as unknown as typeof fetch)
    ).rejects.toThrow(/401/);
  });
});

describe("outbox markSent", () => {
  it("PATCHes matching event_ids to status=sent with a sent_at timestamp", async () => {
    const mockFetch = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 204 })
    );

    await markSent(
      CONFIG,
      ["event-a", "event-b"],
      mockFetch as unknown as typeof fetch
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:54321/rest/v1/analytics_outbox?event_id=in.(event-a,event-b)"
    );
    const initTyped = init as RequestInit;
    expect(initTyped.method).toBe("PATCH");
    const body = JSON.parse(String(initTyped.body));
    expect(body.status).toBe("sent");
    expect(typeof body.sent_at).toBe("string");
  });

  it("does nothing (no fetch call) when given an empty event_id list", async () => {
    const mockFetch = jest.fn();

    await markSent(CONFIG, [], mockFetch as unknown as typeof fetch);

    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when the PATCH fails", async () => {
    const mockFetch = jest.fn(
      async () => new Response("db error", { status: 500 })
    );

    await expect(
      markSent(CONFIG, ["event-a"], mockFetch as unknown as typeof fetch)
    ).rejects.toThrow(/500/);
  });
});

describe("outbox incrementRetryCount", () => {
  it("calls the increment RPC with event_ids and the error message (status stays pending; threshold decision is not made here)", async () => {
    const mockFetch = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 204 })
    );

    await incrementRetryCount(
      CONFIG,
      ["event-a", "event-b"],
      "BigQuery insertAll HTTP error: 500",
      mockFetch as unknown as typeof fetch
    );

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:54321/rest/v1/rpc/increment_analytics_outbox_retry"
    );
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({
      p_event_ids: ["event-a", "event-b"],
      p_error: "BigQuery insertAll HTTP error: 500",
    });
  });

  it("does nothing when given an empty event_id list", async () => {
    const mockFetch = jest.fn();

    await incrementRetryCount(
      CONFIG,
      [],
      "should not be sent",
      mockFetch as unknown as typeof fetch
    );

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("outbox markFailed", () => {
  it("PATCHes matching event_ids to status=failed with last_error", async () => {
    const mockFetch = jest.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(null, { status: 204 })
    );

    await markFailed(
      CONFIG,
      ["event-c"],
      "retry limit exceeded",
      mockFetch as unknown as typeof fetch
    );

    const [url, init] = mockFetch.mock.calls[0];
    expect(String(url)).toBe(
      "http://127.0.0.1:54321/rest/v1/analytics_outbox?event_id=in.(event-c)"
    );
    const body = JSON.parse(String((init as RequestInit).body));
    expect(body).toEqual({ status: "failed", last_error: "retry limit exceeded" });
  });

  it("does nothing when given an empty event_id list", async () => {
    const mockFetch = jest.fn();

    await markFailed(CONFIG, [], "unused", mockFetch as unknown as typeof fetch);

    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe("outbox computeSentEventIds", () => {
  it("returns the full batch when there are no retryable ids (full success)", () => {
    const result = computeSentEventIds(["a", "b", "c"], []);
    expect(result).toEqual(["a", "b", "c"]);
  });

  it("returns the set complement of retryableEventIds against the batch (partial failure, per tasks.md's task 3.3 Implementation Note)", () => {
    const result = computeSentEventIds(["a", "b", "c"], ["b"]);
    expect(result).toEqual(["a", "c"]);
  });

  it("returns an empty array when every event in the batch is retryable (total failure)", () => {
    const result = computeSentEventIds(["a", "b"], ["a", "b"]);
    expect(result).toEqual([]);
  });
});
