import { createBrowserClient } from '@supabase/ssr';
import { Database } from './database.types';

/**
 * クライアントサイド (Client Components) 用の Supabase クライアントを取得する
 */
export function createClient() {
  let url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (process.env.NODE_ENV === 'test') {
    url = url || 'http://127.0.0.1:54321';
    anonKey = anonKey || 'dummy-anon-key';
  }

  if (!url || !anonKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL または NEXT_PUBLIC_SUPABASE_ANON_KEY が設定されていません。'
    );
  }

  return createBrowserClient<Database>(url, anonKey);
}
