// index.ts
// bigquery-export Edge Function の HTTP ハンドラ。
// これは最小スタブ(タスク3.1)であり、固定で200を返すのみ。
// シークレット検証・outboxバッチ取得・BigQuery送信・消込の本実装はタスク3.5で置き換える。

Deno.serve(() => new Response("ok", { status: 200 }));
