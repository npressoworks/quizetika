/**
 * Task 2.6 単体テスト: ソーシャル機能およびリスト管理
 *
 * テスト対象（純粋関数）:
 * - reorderQuizIds: クイズIDの並び替えロジック
 * - buildListExportPackage: エクスポートパッケージ構築
 */

import { reorderQuizIds, buildListExportPackage } from '../../src/services/quiz-list-utils';
import { Quiz, QuizList } from '../../src/types';

/* ============================================================
   ヘルパー
   ============================================================ */

function makeQuiz(id: string): Quiz {
  return {
    id,
    authorId: 'user1',
    authorName: '作成者',
    authorAvatar: '',
    title: `クイズ${id}`,
    description: '',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'テスト',
    tags: [],
    originalTags: [],
    questions: [],
    questionIds: [], // 設問IDの配列
    questionCount: 0,
    status: 'published',
    flagsCount: 0,
    playCount: 0,
    bookmarksCount: 0,
    positiveCount: 0,
    negativeCount: 0,
    tempPositiveCount: 0,
    tempNegativeCount: 0,
    reviewScore: null,
    reviewBadge: null,
    isReviewMasked: false,
    activeResetRequestId: null,
    canonicalGenreId: '',
    canonicalTagIds: [],
    leaderboard: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

function makeList(quizIds: string[]): QuizList {
  return {
    id: 'list1',
    authorId: 'user1',
    authorName: '作成者',
    authorAvatar: '',
    title: 'テストリスト',
    description: '',
    quizIds,
    questionIds: [], // 含まれる設問IDの配列
    isPublished: true,
    bookmarksCount: 0,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/* ============================================================
   reorderQuizIds のテスト
   ============================================================ */
describe('reorderQuizIds', () => {
  test('指定した順序で並び替えられる', () => {
    const original = ['q1', 'q2', 'q3'];
    const newOrder = ['q3', 'q1', 'q2'];
    expect(reorderQuizIds(original, newOrder)).toEqual(['q3', 'q1', 'q2']);
  });

  test('新しい順序の全IDが元のリストに含まれている場合は正常に動作する', () => {
    const result = reorderQuizIds(['a', 'b', 'c'], ['b', 'c', 'a']);
    expect(result).toEqual(['b', 'c', 'a']);
  });

  test('存在しないIDが新しい順序に含まれている場合は除外する', () => {
    const result = reorderQuizIds(['q1', 'q2'], ['q1', 'q3', 'q2']);
    // q3 は存在しないため除外される
    expect(result).not.toContain('q3');
    expect(result).toContain('q1');
    expect(result).toContain('q2');
  });

  test('空配列を渡すと空配列を返す', () => {
    expect(reorderQuizIds([], [])).toEqual([]);
  });
});

/* ============================================================
   buildListExportPackage のテスト
   ============================================================ */
describe('buildListExportPackage', () => {
  const list = makeList(['q1', 'q2', 'q3']);
  const ownedQuizzes: Quiz[] = [makeQuiz('q1'), makeQuiz('q2')];
  const externalQuizIds = ['q3'];

  test('エクスポートパッケージにリストメタデータが含まれる', () => {
    const pkg = buildListExportPackage(list, ownedQuizzes, externalQuizIds);
    expect(pkg.list.id).toBe('list1');
    expect(pkg.list.title).toBe('テストリスト');
  });

  test('作成者所有のクイズはフルデータで含まれる', () => {
    const pkg = buildListExportPackage(list, ownedQuizzes, externalQuizIds);
    expect(pkg.ownedQuizzes).toHaveLength(2);
    expect(pkg.ownedQuizzes[0].id).toBe('q1');
  });

  test('外部クイズはIDのみで参照される', () => {
    const pkg = buildListExportPackage(list, ownedQuizzes, externalQuizIds);
    expect(pkg.externalQuizIds).toContain('q3');
    expect(pkg.externalQuizIds).toHaveLength(1);
  });

  test('エクスポート日時が含まれる', () => {
    const pkg = buildListExportPackage(list, ownedQuizzes, externalQuizIds);
    expect(pkg.exportedAt).toBeDefined();
    expect(new Date(pkg.exportedAt).getTime()).not.toBeNaN();
  });
});
