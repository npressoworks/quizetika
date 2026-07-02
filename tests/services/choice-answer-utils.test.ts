import {
  getCorrectChoiceIds,
  isChoiceAnswerCorrect,
  isMultiCorrectChoiceQuestion,
  parseChoiceAnswerIds,
  serializeChoiceAnswerIds,
} from '../../src/services/choice-answer-utils';
import { Question } from '../../src/types';

function choiceQuestion(correctIds: string[]): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: 'test',
    explanation: 'exp',
    imageUrl: null,
    hint: null,
    limitTime: null,
    choices: [
      { id: 'a', choiceText: 'A', isCorrect: correctIds.includes('a'), selectedCount: 0 },
      { id: 'b', choiceText: 'B', isCorrect: correctIds.includes('b'), selectedCount: 0 },
      { id: 'c', choiceText: 'C', isCorrect: correctIds.includes('c'), selectedCount: 0 },
    ],
    correctCount: 0,
    incorrectCount: 0,
  };
}

describe('choice-answer-utils', () => {
  it('serializes and parses comma-separated ids', () => {
    expect(serializeChoiceAnswerIds(['b', 'a'])).toBe('b,a');
    expect(parseChoiceAnswerIds('b,a')).toEqual(['b', 'a']);
    expect(parseChoiceAnswerIds('single')).toEqual(['single']);
  });

  it('detects multi-correct questions', () => {
    expect(isMultiCorrectChoiceQuestion(choiceQuestion(['a']))).toBe(false);
    expect(isMultiCorrectChoiceQuestion(choiceQuestion(['a', 'b']))).toBe(true);
  });

  it('judges single and multiple correct answers', () => {
    const single = choiceQuestion(['a']);
    expect(isChoiceAnswerCorrect('a', single)).toBe(true);
    expect(isChoiceAnswerCorrect('b', single)).toBe(false);

    const multi = choiceQuestion(['a', 'c']);
    expect(isChoiceAnswerCorrect('a,c', multi)).toBe(true);
    expect(isChoiceAnswerCorrect('c,a', multi)).toBe(true);
    expect(isChoiceAnswerCorrect('a', multi)).toBe(false);
    expect(isChoiceAnswerCorrect('a,b', multi)).toBe(false);
  });

  it('returns correct choice ids', () => {
    expect(getCorrectChoiceIds(choiceQuestion(['b', 'c']))).toEqual(['b', 'c']);
  });
});
