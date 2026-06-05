/**
 * Phase 8 統合スモーク: 純関数・型の横断検証（Firestore 非依存）
 */
import { resolveListType, satisfiesQuestionListAttemptContract } from '../../src/types';
import { assertListTypeOperation } from '../../src/lib/question-list-validation';
import { partitionQuestionsForSave } from '../../src/lib/linked-question';
import { filterAuthorQuizzes } from '../../src/lib/author-quiz-search';
import type { Question, Quiz } from '../../src/types';

describe('Phase 8 integration smoke', () => {
  test('listType 未設定は quiz、設問リスト操作は question のみ', () => {
    expect(resolveListType({} as never)).toBe('quiz');
    expect(() => assertListTypeOperation({ listType: 'question' }, 'question')).not.toThrow();
  });

  test('question-list attempt 契約', () => {
    expect(
      satisfiesQuestionListAttemptContract({
        mode: 'question-list',
        listId: 'l1',
        quizId: 'q1',
        totalQuestions: 1,
      })
    ).toBe(true);
  });

  test('参照リンクのみの partition', () => {
    const stored: Question = {
      id: 'ref-1',
      type: 'multiple-choice',
      questionText: 'Q',
      explanation: 'E',
      imageUrl: null,
      hint: null,
      limitTime: null,
      correctCount: 0,
      incorrectCount: 0,
      authorId: 'a1',
    };
    const incoming: Question = { ...stored, linkKind: 'reference' };
    const result = partitionQuestionsForSave(
      [incoming],
      [],
      new Map([['ref-1', stored]])
    );
    expect(result.referenceOnlyIds).toEqual(['ref-1']);
    expect(result.ownedToWrite).toHaveLength(0);
  });

  test('自作クイズ検索フィルタ', () => {
    const quiz = {
      title: 'Draft Quiz',
      description: 'memo',
      tags: ['alpha'],
    } as Quiz;
    expect(filterAuthorQuizzes([quiz], { keyword: 'draft' })).toHaveLength(1);
    expect(filterAuthorQuizzes([quiz], { tag: 'beta' })).toHaveLength(0);
  });
});
