import {
  filterQuestionsMatchingKeyword,
  getQuestionAnswerSearchTexts,
  getQuestionSearchableTexts,
  questionMatchesKeyword,
  questionTextMatchesKeyword,
  quizHasQuestionTextMatch,
  sortQuestionsForKeywordDisplay,
} from '@/lib/question-search-text';
import type { Question } from '@/types';

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: '問題文です',
    explanation: '',
    imageUrl: null,
    hint: null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
    ...overrides,
  };
}

describe('question-search-text', () => {
  test('選択式: 正解選択肢のみ抽出する', () => {
    const q = makeQuestion({
      choices: [
        { id: '1', choiceText: '誤答', isCorrect: false, selectedCount: 0 },
        { id: '2', choiceText: '正解テキスト', isCorrect: true, selectedCount: 0 },
      ],
    });
    expect(getQuestionAnswerSearchTexts(q)).toEqual(['正解テキスト']);
  });

  test('記述式: correctTextAnswerList を抽出する', () => {
    const q = makeQuestion({
      type: 'text-input',
      correctTextAnswerList: ['東京', 'とうきょう'],
    });
    expect(getQuestionAnswerSearchTexts(q)).toEqual(['東京', 'とうきょう']);
  });

  test('ウミガメ: truthKeywords のみ抽出し aiContextDetails は含めない', () => {
    const q = makeQuestion({
      type: 'lateral-thinking',
      truthKeywords: ['スープ'],
      aiContextDetails: '長い裏設定テキスト',
    });
    expect(getQuestionAnswerSearchTexts(q)).toEqual(['スープ']);
    expect(getQuestionSearchableTexts(q)).not.toContain('長い裏設定テキスト');
  });

  test('questionMatchesKeyword: 問題文一致', () => {
    const q = makeQuestion({ questionText: 'React Hooks とは' });
    expect(questionMatchesKeyword(q, 'hooks')).toBe(true);
    expect(questionMatchesKeyword(q, 'vue')).toBe(false);
  });

  test('questionMatchesKeyword: 正解テキスト一致', () => {
    const q = makeQuestion({
      questionText: '無関係な問題',
      choices: [{ id: '1', choiceText: 'useState', isCorrect: true, selectedCount: 0 }],
    });
    expect(questionMatchesKeyword(q, 'usestate')).toBe(true);
  });

  test('questionTextMatchesKeyword: 問題文のみ判定', () => {
    const q = makeQuestion({
      questionText: 'React Hooks',
      choices: [{ id: '1', choiceText: 'useState', isCorrect: true, selectedCount: 0 }],
    });
    expect(questionTextMatchesKeyword(q, 'hooks')).toBe(true);
    expect(questionTextMatchesKeyword(q, 'usestate')).toBe(false);
  });

  test('sortQuestionsForKeywordDisplay: 問題文ヒットを先頭に並べる', () => {
    const questions = [
      makeQuestion({
        id: 'a',
        questionText: '無関係',
        choices: [{ id: '1', choiceText: 'キーワード正解', isCorrect: true, selectedCount: 0 }],
      }),
      makeQuestion({ id: 'b', questionText: 'キーワードを含む問題' }),
    ];
    const sorted = sortQuestionsForKeywordDisplay(questions, 'キーワード');
    expect(sorted.map((q) => q.id)).toEqual(['b', 'a']);
  });

  test('quizHasQuestionTextMatch', () => {
    const questions = [
      makeQuestion({ questionText: 'ヒットする問題文' }),
      makeQuestion({ questionText: '別問題', choices: [{ id: '1', choiceText: '答えのみ', isCorrect: true, selectedCount: 0 }] }),
    ];
    expect(quizHasQuestionTextMatch(questions, '問題文')).toBe(true);
    expect(quizHasQuestionTextMatch(questions, '答えのみ')).toBe(false);
    expect(filterQuestionsMatchingKeyword(questions, '答えのみ')).toHaveLength(1);
  });
});
