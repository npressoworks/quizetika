/**
 * Task 2.1 単体テスト: ユーザープロフィールと称号バッジアトミック管理
 *
 * テスト対象:
 * - validateProfileData: プロフィール入力バリデーション
 * - BADGE_DEFINITIONS:   バッジ条件の判定ロジック (純粋関数)
 *
 * Firestore へのアクセスは発生しないため、モックなしで実行可能。
 */

import { validateProfileData, BADGE_DEFINITIONS, UpdateProfileData } from '../../src/services/user';
import { User } from '../../src/types';

/* ============================================================
   ヘルパー: テスト用のベースユーザーオブジェクトを生成
   ============================================================ */
function makeUser(overrides: Partial<User> = {}): User {
  return {
    id: 'test-uid',
    email: 'test@example.com',
    displayName: 'テストユーザー',
    avatarUrl: '',
    bio: '',
    followedGenres: [],
    badges: [],
    createdQuizzesCount: 0,
    totalPlayCount: 0,
    followersCount: 0,
    followingCount: 0,
    reputationScore: 0,
    moderationTier: 'newcomer',
    reputationHistory: [],
    lastReputationCalculatedAt: null,
    totalFailedQuestionsCount: 0,
    deleteStatus: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

/* ============================================================
   validateProfileData のテスト
   ============================================================ */
describe('validateProfileData', () => {
  // ── 正常系 ─────────────────────────────────────────────
  describe('正常系', () => {
    test('有効なdisplayNameとbioはエラーなし', () => {
      const data: UpdateProfileData = { displayName: '山田太郎', bio: '好きなことを書く' };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('bioが空文字列でもエラーなし', () => {
      const data: UpdateProfileData = { displayName: 'A', bio: '' };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('displayNameがちょうど30文字でエラーなし', () => {
      const data: UpdateProfileData = { displayName: 'あ'.repeat(30), bio: '' };
      expect(validateProfileData(data)).toHaveLength(0);
    });

    test('bioがちょうど200文字でエラーなし', () => {
      const data: UpdateProfileData = { displayName: '有効ユーザー', bio: 'あ'.repeat(200) };
      expect(validateProfileData(data)).toHaveLength(0);
    });
  });

  // ── 異常系: displayName ────────────────────────────────
  describe('異常系: displayName', () => {
    test('displayNameが空文字列はエラー', () => {
      const data: UpdateProfileData = { displayName: '', bio: '' };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('displayName');
    });

    test('displayNameがスペースのみはエラー', () => {
      const data: UpdateProfileData = { displayName: '   ', bio: '' };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('displayName');
    });

    test('displayNameが31文字はエラー', () => {
      const data: UpdateProfileData = { displayName: 'あ'.repeat(31), bio: '' };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('displayName');
    });
  });

  // ── 異常系: bio ────────────────────────────────────────
  describe('異常系: bio', () => {
    test('bioが201文字はエラー', () => {
      const data: UpdateProfileData = { displayName: '有効ユーザー', bio: 'あ'.repeat(201) };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(1);
      expect(errors[0].field).toBe('bio');
    });
  });

  // ── 複数エラー ─────────────────────────────────────────
  describe('複数エラー', () => {
    test('displayNameとbioの両方が無効な場合、2件のエラーを返す', () => {
      const data: UpdateProfileData = { displayName: '', bio: 'あ'.repeat(201) };
      const errors = validateProfileData(data);
      expect(errors).toHaveLength(2);
      expect(errors.map((e) => e.field)).toContain('displayName');
      expect(errors.map((e) => e.field)).toContain('bio');
    });
  });
});

/* ============================================================
   BADGE_DEFINITIONS のバッジ条件ロジックテスト
   ============================================================ */

/** バッジIDから定義を取得するユーティリティ */
function getBadgeDef(id: string) {
  const def = BADGE_DEFINITIONS.find((d) => d.id === id);
  if (!def) throw new Error(`バッジ定義が見つかりません: ${id}`);
  return def;
}

describe('BADGE_DEFINITIONS - プレイ回数バッジ', () => {
  test.each([
    ['play_10', 10],
    ['play_50', 50],
    ['play_100', 100],
    ['play_500', 500],
    ['play_1000', 1000],
  ])('%s はtotalPlayCount >= %i で付与される', (id, threshold) => {
    const def = getBadgeDef(id);
    expect(def.condition(makeUser({ totalPlayCount: threshold - 1 }))).toBe(false);
    expect(def.condition(makeUser({ totalPlayCount: threshold }))).toBe(true);
    expect(def.condition(makeUser({ totalPlayCount: threshold + 1 }))).toBe(true);
  });
});

describe('BADGE_DEFINITIONS - 作成数バッジ', () => {
  test.each([
    ['create_1', 1],
    ['create_10', 10],
    ['create_50', 50],
  ])('%s はcreatedQuizzesCount >= %i で付与される', (id, threshold) => {
    const def = getBadgeDef(id);
    expect(def.condition(makeUser({ createdQuizzesCount: threshold - 1 }))).toBe(false);
    expect(def.condition(makeUser({ createdQuizzesCount: threshold }))).toBe(true);
  });
});

describe('BADGE_DEFINITIONS - フォロワー数バッジ', () => {
  test.each([
    ['followers_10', 10],
    ['followers_100', 100],
    ['followers_1000', 1000],
  ])('%s はfollowersCount >= %i で付与される', (id, threshold) => {
    const def = getBadgeDef(id);
    expect(def.condition(makeUser({ followersCount: threshold - 1 }))).toBe(false);
    expect(def.condition(makeUser({ followersCount: threshold }))).toBe(true);
  });
});

describe('BADGE_DEFINITIONS - 全バッジIDがユニークであること', () => {
  test('バッジIDの重複がない', () => {
    const ids = BADGE_DEFINITIONS.map((d) => d.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(ids.length);
  });
});
