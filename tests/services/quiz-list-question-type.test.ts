import {
  reorderQuestionIds,
  buildQuestionListExportPackage,
} from '../../src/services/quiz-list-utils';
import type { QuizList } from '../../src/types';

describe('quiz-list question type utils', () => {
  test('reorderQuestionIds: 有効 ID のみ順序を反映', () => {
    expect(reorderQuestionIds(['a', 'b', 'c'], ['c', 'a'])).toEqual(['c', 'a']);
    expect(reorderQuestionIds(['a', 'b'], ['x', 'a'])).toEqual(['a']);
  });

  test('buildQuestionListExportPackage: 設問リスト export 形状', () => {
    const list = {
      id: 'list-1',
      listType: 'question',
      questionIds: ['q1'],
    } as QuizList;
    const pkg = buildQuestionListExportPackage(list, [], [
      { questionId: 'q1', parentQuizId: 'quiz-1' },
    ]);
    expect(pkg.list.id).toBe('list-1');
    expect(pkg.externalQuestionRefs).toHaveLength(1);
    expect(pkg.exportedAt).toBeTruthy();
  });
});
