import { validateQuizForPublish } from '../../src/services/quiz-validation';
import type { Quiz, Question } from '../../src/types';

function baseQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: '十分な長さの問題文です',
    explanation: '',
    imageUrl: null,
    hint: null,
    limitTime: null,
    correctCount: 0,
    incorrectCount: 0,
    choices: [
      { id: 'c1', choiceText: 'A', isCorrect: true, selectedCount: 0 },
      { id: 'c2', choiceText: 'B', isCorrect: false, selectedCount: 0 },
    ],
    ...overrides,
  };
}

function baseQuiz(questions: Question[]): Quiz {
  return {
    id: 'quiz-1',
    authorId: 'a1',
    authorName: 'Author',
    authorAvatar: '',
    title: 'タイトル',
    description: '',
    thumbnailUrl: null,
    difficulty: 5,
    genre: 'programming',
    tags: [],
    originalTags: [],
    questionIds: [],
    questions,
    questionCount: questions.length,
    status: 'published',
    format: 'mixed',
    playCount: 0,
    bookmarksCount: 0,
    flagsCount: 0,
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
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('validateQuizForPublish reference skip', () => {
  it('参照リンク設問は正解未設定でも公開検証をスキップする', () => {
    const refQ = baseQuestion({
      id: 'ref-1',
      linkKind: 'reference',
      choices: [
        { id: 'c1', choiceText: 'A', isCorrect: false, selectedCount: 0 },
        { id: 'c2', choiceText: 'B', isCorrect: false, selectedCount: 0 },
      ],
    });
    const owned = baseQuestion({ id: 'owned-1' });
    const errors = validateQuizForPublish(baseQuiz([refQ, owned]));
    const answerErrors = errors.filter((e) => e.questionField === 'answers');
    expect(answerErrors).toHaveLength(0);
  });
});
