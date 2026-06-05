import {
  getProfileListItemCount,
  getProfileListTypeLabel,
} from '../../src/lib/profile-list-display';

describe('profile-list-display', () => {
  test('getProfileListTypeLabel', () => {
    expect(getProfileListTypeLabel('quiz')).toBe('クイズリスト');
    expect(getProfileListTypeLabel('question')).toBe('設問リスト');
  });

  test('getProfileListItemCount: listType 未設定は quizIds 件数', () => {
    const result = getProfileListItemCount({
      quizIds: ['q1', 'q2'],
      questionIds: ['x1'],
    });
    expect(result.count).toBe(2);
    expect(result.countLabel).toBe('収録クイズ: 2 件');
  });

  test('getProfileListItemCount: question は questionIds のみ', () => {
    const result = getProfileListItemCount({
      listType: 'question',
      quizIds: ['ignored'],
      questionIds: ['a', 'b', 'c'],
    });
    expect(result.count).toBe(3);
    expect(result.countLabel).toBe('収録設問: 3 件');
  });
});
