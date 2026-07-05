import { Client } from 'pg';

/**
 * E2E フィクスチャ投入専用の Postgres 直接接続。
 * ローカル環境の `service_role` には public スキーマの直接 CRUD 権限が付与されておらず
 * PostgREST 経由 (`.from()`) は "permission denied" になるため、`postgres` ロールでの
 * 直接接続を使用する（本番の RLS/権限モデルには影響しない、テスト専用のシード経路）。
 */
export function createDbClient(): Client {
  const connectionString =
    process.env.SUPABASE_DB_URL ?? 'postgresql://postgres:postgres@127.0.0.1:54322/postgres';
  return new Client({ connectionString });
}
