import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * global-setup.ts が Supabase 上に生成した実行時 ID（UUID）を読み取るヘルパー。
 * Firestore時代の固定文字列ID（e2e-test-uid-123456 等）はSupabaseのUUID列に
 * 直接書き込めないため、global-setup.ts が実行時に払い出したUUIDをここで共有する。
 */

export const FIXTURE_IDS_PATH = join(__dirname, '.e2e-fixture-ids.json');

export interface E2eFixtureIds {
  userId: string;
  quizIds: string[];
  questionIds: string[];
}

export function readE2eFixtureIds(): E2eFixtureIds {
  const raw = readFileSync(FIXTURE_IDS_PATH, 'utf8');
  return JSON.parse(raw) as E2eFixtureIds;
}
