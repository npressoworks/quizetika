/**
 * Task 2.2 単体テスト: クイズ管理および公開時バリデーション
 *
 * テスト対象（純粋関数のみ）:
 * - normalizeTag: タグの正規化（小文字化・トリム・記号除去）
 * - validateQuizForPublish: 公開時バリデーション（問題数・正解設定・NGワード）
 * - containsNgWord: NGワード検出
 *
 * Firestore 依存の関数（saveQuiz, getSimilarTagSuggest, exportQuizzes）は
 * 統合テストの対象のため、本ファイルでは純粋ロジックのみをカバーする。
 */

import {
  normalizeTag,
  validateQuizForPublish,
  containsNgWord,
  QuizPublishValidationError,
} from '../../src/services/quiz-validation';
import { Quiz, Question, Choice } from '../../src/types';

/* ============================================================
   ヘルパー: テスト用のベースクイズ・問題オブジェクトを生成
   ============================================================ */

function makeChoice(overrides: Partial<Choice> = {}): Choice {
  return {
    id: 'c1',
    choiceText: '選択肢A',
    isCorrect: false,
    selectedCount: 0,
    ...overrides,
  };
}

function makeQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q1',
    type: 'multiple-choice',
    questionText: 'テスト問題',
    explanation: '解説テキスト',
    imageUrl: null,
    hint: null,
    limitTime: null,
    choices: [
      makeChoice({ id: 'c1', isCorrect: true }),
      makeChoice({ id: 'c2', isCorrect: false }),
    ],
    correctCount: 0,
    incorrectCount: 0,
    ...overrides,
  };
}

function makeQuiz(overrides: Partial<Quiz> = {}): Quiz {
  return {
    id: 'quiz1',
    authorId: 'user1',
    authorName: '作成者',
    authorAvatar: '',
    title: 'テストクイズ',
    description: '説明',
    thumbnailUrl: null,
    difficulty: 3,
    genre: 'プログラミング',
    tags: ['javascript'],
    originalTags: ['JavaScript'],
    questions: [makeQuestion()],
    questionCount: 1,
    status: 'draft',
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
    ...overrides,
  };
}

/* ============================================================
   normalizeTag のテスト
   ============================================================ */
describe('normalizeTag', () => {
  describe('正常系', () => {
    test('英字を小文字化する', () => {
      expect(normalizeTag('JavaScript')).toBe('javascript');
    });

    test('前後のスペースをトリムする', () => {
      expect(normalizeTag('  react  ')).toBe('react');
    });

    test('中間のスペースを除去する', () => {
      expect(normalizeTag('hello world')).toBe('helloworld');
    });

    test('記号（ハイフン・アンダースコア除く）を除去する', () => {
      expect(normalizeTag('C++')).toBe('c');
      expect(normalizeTag('React.js')).toBe('reactjs');
      expect(normalizeTag('vue!')).toBe('vue');
    });

    test('ハイフンとアンダースコアは保持する', () => {
      expect(normalizeTag('next-js')).toBe('next-js');
      expect(normalizeTag('my_tag')).toBe('my_tag');
    });

    test('全角スペースも除去する', () => {
      expect(normalizeTag('　タグ　')).toBe('タグ');
    });

    test('大文字・スペース・記号の複合ケース', () => {
      expect(normalizeTag('  TypeScript 4.0!  ')).toBe('typescript40');
    });
  });

  describe('エッジケース', () => {
    test('空文字列を入力すると空文字列を返す', () => {
      expect(normalizeTag('')).toBe('');
    });

    test('スペースのみの入力は空文字列を返す', () => {
      expect(normalizeTag('   ')).toBe('');
    });
  });
});

/* ============================================================
   containsNgWord のテスト
   ============================================================ */
describe('containsNgWord', () => {
  test('NGワードを含むテキストはtrueを返す', () => {
    expect(containsNgWord('このテキストにspamが含まれる')).toBe(true);
  });

  test('NGワードを含まないテキストはfalseを返す', () => {
    expect(containsNgWord('通常のクイズタイトルです')).toBe(false);
  });

  test('大文字・小文字の差異を無視する（ケースインセンシティブ）', () => {
    expect(containsNgWord('SPAM content')).toBe(true);
  });

  test('空文字列はfalseを返す', () => {
    expect(containsNgWord('')).toBe(false);
  });
});

/* ============================================================
   validateQuizForPublish のテスト
   ============================================================ */
describe('validateQuizForPublish', () => {
  // ── 正常系 ─────────────────────────────────────────────
  describe('正常系', () => {
    test('有効なクイズはエラーなしで通過する', () => {
      const quiz = makeQuiz();
      expect(validateQuizForPublish(quiz)).toHaveLength(0);
    });

    test('難易度が境界値1でも通過する', () => {
      expect(validateQuizForPublish(makeQuiz({ difficulty: 1 }))).toHaveLength(0);
    });

    test('難易度が境界値10でも通過する', () => {
      expect(validateQuizForPublish(makeQuiz({ difficulty: 10 }))).toHaveLength(0);
    });
  });

  // ── 問題数バリデーション ────────────────────────────────
  describe('問題数バリデーション', () => {
    test('問題が0件の場合エラーを返す', () => {
      const quiz = makeQuiz({ questions: [], questionCount: 0 });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });
  });

  // ── タイトルバリデーション ─────────────────────────────
  describe('タイトルバリデーション', () => {
    test('タイトルが空の場合エラーを返す', () => {
      const quiz = makeQuiz({ title: '' });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'title')).toBe(true);
    });

    test('タイトルが100文字を超えた場合エラーを返す', () => {
      const quiz = makeQuiz({ title: 'あ'.repeat(101) });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'title')).toBe(true);
    });
  });

  // ── 難易度バリデーション ───────────────────────────────
  describe('難易度バリデーション', () => {
    test('難易度が0の場合エラーを返す', () => {
      const quiz = makeQuiz({ difficulty: 0 });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'difficulty')).toBe(true);
    });

    test('難易度が11の場合エラーを返す', () => {
      const quiz = makeQuiz({ difficulty: 11 });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'difficulty')).toBe(true);
    });
  });

  // ── 正解指定バリデーション ─────────────────────────────
  describe('正解指定バリデーション', () => {
    test('選択肢問題で正解が1つも設定されていない場合エラーを返す', () => {
      const questionWithNoAnswer = makeQuestion({
        choices: [
          makeChoice({ id: 'c1', isCorrect: false }),
          makeChoice({ id: 'c2', isCorrect: false }),
        ],
      });
      const quiz = makeQuiz({ questions: [questionWithNoAnswer] });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('text-input問題でcorrectTextAnswerListが空の場合エラーを返す', () => {
      const questionWithNoAnswer = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: [],
      });
      const quiz = makeQuiz({ questions: [questionWithNoAnswer] });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('lateral-thinking問題でaiContextDetailsとtruthKeywordsが設定されている場合はエラーを返さない', () => {
      const validLateralQuestion = makeQuestion({
        type: 'lateral-thinking',
        choices: undefined,
        aiContextDetails: 'これはウミガメのスープの真相です。',
        truthKeywords: ['ウミガメ', 'スープ'],
      });
      const quiz = makeQuiz({ questions: [validLateralQuestion] });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('lateral-thinking問題でaiContextDetailsが空の場合エラーを返す', () => {
      const invalidQuestion = makeQuestion({
        type: 'lateral-thinking',
        choices: undefined,
        aiContextDetails: '  ',
        truthKeywords: ['ウミガメ'],
      });
      const quiz = makeQuiz({ questions: [invalidQuestion] });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('lateral-thinking問題でtruthKeywordsが空の場合エラーを返す', () => {
      const invalidQuestion = makeQuestion({
        type: 'lateral-thinking',
        choices: undefined,
        aiContextDetails: 'これはウミガメのスープの真相です。',
        truthKeywords: [],
      });
      const quiz = makeQuiz({ questions: [invalidQuestion] });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });
  });

  // ── NGワードバリデーション ─────────────────────────────
  describe('NGワードバリデーション', () => {
    test('タイトルにNGワードが含まれる場合エラーを返す', () => {
      const quiz = makeQuiz({ title: 'spam quiz' });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'ngWord')).toBe(true);
    });

    test('説明文にNGワードが含まれる場合エラーを返す', () => {
      const quiz = makeQuiz({ description: 'This is spam content' });
      const errors = validateQuizForPublish(quiz);
      expect(errors.some((e) => e.field === 'ngWord')).toBe(true);
    });
  });
});
