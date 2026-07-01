import { createBrowserClient } from '@supabase/ssr';
import { Database } from './database.types';

/**
 * クライアントサイド (Client Components) 用の Supabase クライアントを取得する
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。'
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
