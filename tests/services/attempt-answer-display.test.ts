import { Question } from '../../src/types';
import {
  formatCorrectAnswer,
  formatUserAnswer,
  getUserAnswerRaw,
  toQuestionAnswerRecords,
} from '../../src/services/attempt-answer-display';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: 'Reactの状態管理フックは？',
    explanation: '解説',
    imageUrl: null,
    hint: null,
    limitTime: null,
    choices: [
      { id: 'c1', choiceText: 'useState', isCorrect: true, selectedCount: 0 },
      { id: 'c2', choiceText: 'useEffect', isCorrect: false, selectedCount: 0 },
    ],
    correctCount: 0,
    incorrectCount: 0,
    ...overrides,
  };
}

describe('attempt-answer-display', () => {
  it('formats multiple-choice user and correct answers', () => {
    const question = makeQuestion();
    const records = toQuestionAnswerRecords({ q1: 'c2' });

    expect(getUserAnswerRaw(records, 'q1')).toBe('c2');
    expect(formatUserAnswer(question, getUserAnswerRaw(records, 'q1'))).toBe('useEffect');
    expect(formatCorrectAnswer(question)).toBe('useState');
  });

  it('formats sorting answers as ordered text', () => {
    const question = makeQuestion({
      type: 'sorting',
      choices: undefined,
      sortingItems: [
        { id: 's1', text: '第一', correctOrder: 0 },
        { id: 's2', text: '第二', correctOrder: 1 },
      ],
    });

    expect(formatUserAnswer(question, 's2,s1')).toBe('第二 → 第一');
    expect(formatCorrectAnswer(question)).toBe('第一 → 第二');
  });

  it('returns 記録なし when legacy attempts have no stored answers', () => {
    expect(formatUserAnswer(makeQuestion(), undefined, 'normal', false)).toBe('（記録なし）');
  });

  it('returns 未回答 when stored answers exist but question was skipped', () => {
    expect(formatUserAnswer(makeQuestion(), undefined, 'normal', true)).toBe('未回答');
  });

  it('formats flashcard answers', () => {
    expect(formatUserAnswer(makeQuestion(), 'correct', 'flashcard')).toBe('覚えていた');
    expect(formatUserAnswer(makeQuestion(), 'incorrect', 'flashcard')).toBe('覚えていなかった');
  });
});
