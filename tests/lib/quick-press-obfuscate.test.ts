import {
  obfuscateQuickPressQuestions,
  obfuscateQuickPressQuiz,
} from '@/lib/quick-press-obfuscate';
import { Question, Quiz } from '@/types';

describe('obfuscateQuickPressQuestions', () => {
  it('quick-press 以外は変更しない', () => {
    const q: Question = {
      id: 'q1',
      type: 'text-input',
      questionText: 'hello',
      correctTextAnswerList: ['a'],
      explanation: '',
      imageUrl: null,
      hint: null,
      limitTime: null,
      correctCount: 0,
      incorrectCount: 0,
    };
    expect(obfuscateQuickPressQuestions([q])[0]).toEqual(q);
  });

  it('quick-press は questionText を空にし正解を Base64 化する', () => {
    const q: Question = {
      id: 'q2',
      type: 'quick-press',
      questionText: '早押し問題',
      correctTextAnswerList: ['正解'],
      explanation: '',
      imageUrl: null,
      hint: null,
      limitTime: null,
      correctCount: 0,
      incorrectCount: 0,
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
    const quiz: Quiz = {
      id: 'quiz-1',
      authorId: 'author-1',
      authorName: 'Author',
      authorAvatar: '',
      title: 'Title',
      description: 'Desc',
      thumbnailUrl: null,
      difficulty: 5,
      genre: 'general',
      tags: [],
      originalTags: [],
      questionIds: ['q1'],
      questions: [
        {
          id: 'q1',
          type: 'quick-press' as const,
          questionText: 'x',
          correctTextAnswerList: ['y'],
          explanation: '',
          imageUrl: null,
          hint: null,
          limitTime: null,
          correctCount: 0,
          incorrectCount: 0,
        },
      ],
      questionCount: 1,
      status: 'published',
      visibility: 'public',
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
      canonicalGenreId: 'general',
      canonicalTagIds: [],
      leaderboardFirstPlay: [],
      leaderboardReplay: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    const out = obfuscateQuickPressQuiz(quiz);
    expect(out.questions?.[0]?.questionText).toBe('');
  });
});
