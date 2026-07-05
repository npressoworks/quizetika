import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const envExample = readFileSync(join(process.cwd(), '.env.local.example'), 'utf8');

describe('.env.local.example の Firebase エントリ除去', () => {
  it('Firebase 関連の変数名を含まない', () => {
    expect(envExample).not.toMatch(/FIREBASE/);
  });

  it('Supabase に必要な環境変数を含む', () => {
    expect(envExample).toMatch(/NEXT_PUBLIC_SUPABASE_URL/);
    expect(envExample).toMatch(/NEXT_PUBLIC_SUPABASE_ANON_KEY/);
    expect(envExample).toMatch(/SUPABASE_SERVICE_ROLE_KEY/);
  });
});
