import {
  obfuscateQuickPressQuestions,
  obfuscateQuickPressQuiz,
} from '@/lib/quick-press-obfuscate';
import { Question } from '@/types';

describe('obfuscateQuickPressQuestions', () => {
  it('quick-press 以外は変更しない', () => {
    const q: Question = {
      id: 'q1',
      type: 'text-input',
      questionText: 'hello',
      correctTextAnswerList: ['a'],
    };
    expect(obfuscateQuickPressQuestions([q])[0]).toEqual(q);
  });

  it('quick-press は questionText を空にし正解を Base64 化する', () => {
    const q: Question = {
      id: 'q2',
      type: 'quick-press',
      questionText: '早押し問題',
      correctTextAnswerList: ['正解'],
    };
    const [result] = obfuscateQuickPressQuestions([q]);
    expect(result.questionText).toBe('');
    expect(result.correctTextAnswerList?.[0]).toBe(
      btoa(unescape(encodeURIComponent('正解')))
    );
  });
});

describe('obfuscateQuickPressQuiz', () => {
  it('questions 配列に難読化を適用する', () => {
    const quiz = {
      id: 'quiz-1',
      questions: [
        {
          id: 'q1',
          type: 'quick-press' as const,
          questionText: 'x',
          correctTextAnswerList: ['y'],
        },
      ],
    };
    const out = obfuscateQuickPressQuiz(quiz);
    expect(out.questions[0].questionText).toBe('');
  });
});
