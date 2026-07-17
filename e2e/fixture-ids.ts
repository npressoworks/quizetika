import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * global-setup.ts が Supabase 上に生成した実行時 ID（UUID）を読み取るヘルパー。
 * Firestore時代の固定文字列ID（e2e-test-uid-123456 等）はSupabaseのUUID列に
 * 直接書き込めないため、global-setup.ts が実行時に払い出したUUIDをここで共有する。
 */

export const FIXTURE_IDS_PATH = join(__dirname, '.e2e-fixture-ids.json');

export interface VisibilityTestAccount {
  email: string;
  password: string;
  userId: string;
}

export interface VisibilityTestFixtures {
  /** Pro プラン。限定公開・非公開への切り替え自体を検証するクイズの作成者 */
  author: VisibilityTestAccount;
  /** author をフォローしている無料プランアカウント。限定公開クイズの閲覧可否検証用 */
  follower: VisibilityTestAccount;
  /** author をフォローしていない無料プランアカウント。非公開/限定公開クイズの閲覧拒否、および
   *  自分のクイズを Pro 未加入のまま非公開/限定公開に切り替えようとした際の拒否の両方を検証する */
  stranger: VisibilityTestAccount;
  /** author が所有する公開済みクイズ（テスト開始時点は visibility: 'public'） */
  authorQuizId: string;
  /** stranger が所有する公開済みクイズ（Pro 未加入切り替え拒否の検証用） */
  strangerQuizId: string;
}

export interface E2eFixtureIds {
  userId: string;
  quizIds: string[];
  questionIds: string[];
  visibilityTest: VisibilityTestFixtures;
  moderator: {
    email: string;
    password: string;
    userId: string;
  };
  governanceFreeze: {
    pendingMergeRequestId: string;
    pendingGenreRequestId: string;
  };
}

export function readE2eFixtureIds(): E2eFixtureIds {
  const raw = readFileSync(FIXTURE_IDS_PATH, 'utf8');
  return JSON.parse(raw) as E2eFixtureIds;
}
