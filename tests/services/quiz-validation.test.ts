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
  normalizeQuizQuestionsForSave,
  QuizPublishValidationError,
} from '../../src/services/quiz-validation';
import { Quiz, Question, Choice } from '../../src/types';

/* ============================================================
   テスト用NGワード一覧（旧 quiz-validation.ts の NG_WORD_LIST 相当）
   ============================================================ */

const TEST_NG_WORDS: readonly string[] = [
  'spam',
  'scam',
  'hentai',
  'adult',
  'porn',
  'xxx',
];

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
    questionIds: ['q1'], // 問題IDの配列
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
    leaderboardFirstPlay: [],
    leaderboardReplay: [],
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
  const ngWords = ['spam', 'scam', 'hentai', 'adult', 'porn', 'xxx'];

  test('渡されたNGワード一覧に含まれる語句を含むテキストはtrueを返す', () => {
    expect(containsNgWord('このテキストにspamが含まれる', ngWords)).toBe(true);
  });

  test('渡されたNGワード一覧に含まれない語句はfalseを返す', () => {
    expect(containsNgWord('通常のクイズタイトルです', ngWords)).toBe(false);
  });

  test('大文字・小文字の差異を無視する（ケースインセンシティブ）', () => {
    expect(containsNgWord('SPAM content', ngWords)).toBe(true);
  });

  test('空文字列はfalseを返す', () => {
    expect(containsNgWord('', ngWords)).toBe(false);
  });

  test('NGワード一覧が空の場合は何も検出しない', () => {
    expect(containsNgWord('spamを含むテキスト', [])).toBe(false);
  });

  test('NGワード一覧に含まれる語句のみが検出され、一覧にない語句は検出されない', () => {
    expect(containsNgWord('bannedを含むテキスト', ['spam'])).toBe(false);
    expect(containsNgWord('bannedを含むテキスト', ['banned'])).toBe(true);
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
      expect(validateQuizForPublish(quiz, TEST_NG_WORDS)).toHaveLength(0);
    });

    test('難易度が境界値1でも通過する', () => {
      expect(validateQuizForPublish(makeQuiz({ difficulty: 1 }), TEST_NG_WORDS)).toHaveLength(0);
    });

    test('難易度が境界値5でも通過する', () => {
      expect(validateQuizForPublish(makeQuiz({ difficulty: 5 }), TEST_NG_WORDS)).toHaveLength(0);
    });
  });

  // ── 問題数バリデーション ────────────────────────────────
  describe('問題数バリデーション', () => {
    test('問題が0件の場合エラーを返す', () => {
      const quiz = makeQuiz({ questions: [], questionCount: 0 });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });
  });

  // ── タイトルバリデーション ─────────────────────────────
  describe('タイトルバリデーション', () => {
    test('タイトルが空の場合エラーを返す', () => {
      const quiz = makeQuiz({ title: '' });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'title')).toBe(true);
    });

    test('タイトルが100文字を超えた場合エラーを返す', () => {
      const quiz = makeQuiz({ title: 'あ'.repeat(101) });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'title')).toBe(true);
    });
  });

  // ── 難易度バリデーション ───────────────────────────────
  describe('難易度バリデーション', () => {
    test('難易度が0の場合エラーを返す', () => {
      const quiz = makeQuiz({ difficulty: 0 });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'difficulty')).toBe(true);
    });

    test('難易度が6の場合エラーを返す', () => {
      const quiz = makeQuiz({ difficulty: 6 });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'difficulty')).toBe(true);
    });
  });

  // ── ジャンルバリデーション ─────────────────────────────
  describe('ジャンルバリデーション', () => {
    test('ジャンルが未選択の場合エラーを返す', () => {
      const quiz = makeQuiz({ genre: '' });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'genre' && e.message === 'ジャンルを選択してください')).toBe(true);
    });

    test('ジャンルが設定されている場合エラーを返さない', () => {
      const quiz = makeQuiz({ genre: 'programming' });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'genre')).toBe(false);
    });
  });

  // ── 問題文バリデーション ─────────────────────────────
  describe('問題文バリデーション', () => {
    test('問題文が空の場合エラーを返す', () => {
      const quiz = makeQuiz({ questions: [makeQuestion({ questionText: '' })] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(
        errors.some((e) => e.questionField === 'questionText' && e.message === '問題文を入力してください')
      ).toBe(true);
    });

    test('問題文が空白のみの場合エラーを返す', () => {
      const quiz = makeQuiz({ questions: [makeQuestion({ questionText: '   ' })] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.questionField === 'questionText')).toBe(true);
    });

    test('問題文が5文字未満の場合エラーを返す', () => {
      const quiz = makeQuiz({ questions: [makeQuestion({ questionText: 'あいう' })] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.questionField === 'questionText' && e.message.includes('5文字以上'))).toBe(
        true
      );
    });

    test('問題文が500文字を超える場合エラーを返す', () => {
      const quiz = makeQuiz({ questions: [makeQuestion({ questionText: 'あ'.repeat(501) })] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.questionField === 'questionText' && e.message.includes('500文字以内'))).toBe(
        true
      );
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
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('選択肢問題で選択肢が1個のみの場合エラーを返す', () => {
      const questionWithOneChoice = makeQuestion({
        choices: [makeChoice({ id: 'c1', isCorrect: true })],
      });
      const quiz = makeQuiz({ questions: [questionWithOneChoice] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('選択肢問題で選択肢が11個以上の場合エラーを返す', () => {
      const questionWithTooManyChoices = makeQuestion({
        choices: Array.from({ length: 11 }, (_, i) =>
          makeChoice({ id: `c${i + 1}`, isCorrect: i === 0 })
        ),
      });
      const quiz = makeQuiz({ questions: [questionWithTooManyChoices] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('選択肢問題で2〜10個の選択肢と正解が設定されている場合エラーを返さない', () => {
      const questionWithTenChoices = makeQuestion({
        choices: Array.from({ length: 10 }, (_, i) =>
          makeChoice({ id: `c${i + 1}`, isCorrect: i === 0 })
        ),
      });
      const quiz = makeQuiz({ questions: [questionWithTenChoices] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('text-input問題でcorrectTextAnswerListが空の場合エラーを返す', () => {
      const questionWithNoAnswer = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: [],
      });
      const quiz = makeQuiz({ questions: [questionWithNoAnswer] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('text-input問題で要求文字数が範囲外（0以下）の場合エラーを返す', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['abcd'],
        textInputMode: 'free',
        textInputCharCount: 0,
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions' && e.questionField === 'textInputCharCount')).toBe(true);
    });

    test('text-input問題で文字数指定モードかつ正解候補の文字数が一致しない場合エラーを返す', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['abc', 'abcd'],
        textInputMode: 'char-count',
        textInputCharCount: 4,
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) =>
        e.field === 'questions' &&
        e.questionField === 'correctTextAnswer' &&
        e.answerIndex === 0 &&
        e.message.includes('要求文字数（4文字）と一致していません')
      )).toBe(true);
    });

    test('text-input問題で文字数指定モードかつ正解候補の文字数が一致する場合エラーを返さない', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['abcd', 'ＡＢＣＤ'],
        textInputMode: 'char-count',
        textInputCharCount: 4,
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('text-input問題で数値モードかつ正解が数値でない場合エラーを返す', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['not-a-number'],
        textInputMode: 'numeric',
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('text-input問題で数値モードかつ正解が数値の場合エラーを返さない', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['42'],
        textInputMode: 'numeric',
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('text-input問題で数値モードかつ正解が小数の場合エラーを返さない', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['3.14', '-2.5'],
        textInputMode: 'numeric',
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('text-input問題で漢字モードかつ正解に漢字以外が含まれる場合エラーを返す', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['富士山A'],
        textInputMode: 'kanji',
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions' && e.questionField === 'correctTextAnswer')).toBe(true);
    });

    test('text-input問題でカタカナモードかつ正解にカタカナ以外が含まれる場合エラーを返す', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['ひらがな'],
        textInputMode: 'katakana',
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions' && e.questionField === 'correctTextAnswer')).toBe(true);
    });

    test('text-input問題でアルファベットモードかつ正解にアルファベット以外が含まれる場合エラーを返す', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['Apple1'],
        textInputMode: 'alphabet',
      });
      const quiz = makeQuiz({ questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions' && e.questionField === 'correctTextAnswer')).toBe(true);
    });

    test('quick-press問題でcorrectTextAnswerListが空の場合エラーを返す', () => {
      const questionWithNoAnswer = makeQuestion({
        type: 'quick-press',
        choices: undefined,
        correctTextAnswerList: [],
      });
      const quiz = makeQuiz({ questions: [questionWithNoAnswer] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('quick-press問題でcorrectTextAnswerListが設定されている場合エラーを返さない', () => {
      const questionWithAnswer = makeQuestion({
        type: 'quick-press',
        choices: undefined,
        correctTextAnswerList: ['正解'],
      });
      const quiz = makeQuiz({ questions: [questionWithAnswer] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('lateral-thinking問題でaiContextDetailsとtruthKeywordsが設定されている場合はエラーを返さない', () => {
      const validLateralQuestion = makeQuestion({
        type: 'lateral-thinking',
        choices: undefined,
        aiContextDetails: 'これはウミガメのスープの真相です。',
        truthKeywords: ['ウミガメ', 'スープ'],
      });
      const quiz = makeQuiz({ questions: [validLateralQuestion] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
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
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
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
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('クイズ形式と問題タイプが不一致の場合エラーを返す（単一形式）', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['正解'],
      });
      const quiz = makeQuiz({
        format: 'multiple-choice',
        questions: [question],
      });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(true);
    });

    test('クイズ形式と問題タイプが一致している場合エラーを返さない（単一形式）', () => {
      const question = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['正解'],
      });
      const quiz = makeQuiz({
        format: 'text-input',
        questions: [question],
      });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('複合形式(mixed)で許可されていない問題形式（ウミガメ・早押し）が含まれる場合エラーを返す', () => {
      const lateralQuestion = makeQuestion({
        type: 'lateral-thinking',
        choices: undefined,
        aiContextDetails: '真相',
        truthKeywords: ['エッセンス'],
      });
      const quickPressQuestion = makeQuestion({
        type: 'quick-press',
        choices: undefined,
        correctTextAnswerList: ['正解'],
      });

      const quiz1 = makeQuiz({
        format: 'mixed',
        questions: [lateralQuestion],
      });
      const quiz2 = makeQuiz({
        format: 'mixed',
        questions: [quickPressQuestion],
      });

      expect(validateQuizForPublish(quiz1, TEST_NG_WORDS).some((e) => e.field === 'questions')).toBe(true);
      expect(validateQuizForPublish(quiz2, TEST_NG_WORDS).some((e) => e.field === 'questions')).toBe(true);
    });

    test('複合形式(mixed)で許可された問題形式（選択・〇✕・記述・並べ替え・連想）が含まれる場合エラーを返さない', () => {
      const mcQuestion = makeQuestion({ type: 'multiple-choice' });
      const tfQuestion = makeQuestion({
        type: 'true-false',
        choices: [
          makeChoice({ id: 't1', choiceText: '〇', isCorrect: true }),
          makeChoice({ id: 't2', choiceText: '✕', isCorrect: false }),
        ],
      });
      const tiQuestion = makeQuestion({
        type: 'text-input',
        choices: undefined,
        correctTextAnswerList: ['正解'],
      });
      const stQuestion = makeQuestion({
        type: 'sorting',
        choices: undefined,
        sortingItems: [
          { id: 's1', text: 'A', correctOrder: 0 },
          { id: 's2', text: 'B', correctOrder: 1 },
        ],
      });
      const asQuestion = makeQuestion({
        type: 'association',
        choices: undefined,
        correctTextAnswerList: ['正解'],
        associationHints: ['ヒントA', 'ヒントB'],
      });

      const quiz = makeQuiz({
        format: 'mixed',
        questions: [mcQuestion, tfQuestion, tiQuestion, stQuestion, asQuestion],
      });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });

    test('true-false形式で正解が2件の場合エラーを返す', () => {
      const question = makeQuestion({
        type: 'true-false',
        choices: [
          makeChoice({ id: 't1', choiceText: '〇', isCorrect: true }),
          makeChoice({ id: 't2', choiceText: '✕', isCorrect: true }),
        ],
      });
      const quiz = makeQuiz({ format: 'true-false', questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.message.includes('正解を1つだけ'))).toBe(true);
    });

    test('true-false形式クイズで問題タイプが一致している場合エラーを返さない', () => {
      const question = makeQuestion({
        type: 'true-false',
        choices: [
          makeChoice({ id: 't1', choiceText: '〇', isCorrect: true }),
          makeChoice({ id: 't2', choiceText: '✕', isCorrect: false }),
        ],
      });
      const quiz = makeQuiz({ format: 'true-false', questions: [question] });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'questions')).toBe(false);
    });
  });

  describe('normalizeQuizQuestionsForSave', () => {
    test('true-false問題の選択肢ラベルを正規化する', () => {
      const normalized = normalizeQuizQuestionsForSave([
        makeQuestion({
          type: 'true-false',
          choices: [
            makeChoice({ id: 'legacy-true', choiceText: '○', isCorrect: true }),
            makeChoice({ id: 'legacy-false', choiceText: '×', isCorrect: false }),
          ],
        }),
      ]);
      expect(normalized[0].choices?.[0].choiceText).toBe('〇');
      expect(normalized[0].choices?.[1].choiceText).toBe('✕');
      expect(normalized[0].choices?.[0].id).toBe('legacy-true');
    });
  });

  // ── NGワードバリデーション ─────────────────────────────
  describe('NGワードバリデーション', () => {
    test('タイトルにNGワードが含まれる場合エラーを返す', () => {
      const quiz = makeQuiz({ title: 'spam quiz' });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'ngWord')).toBe(true);
    });

    test('説明文にNGワードが含まれる場合エラーを返す', () => {
      const quiz = makeQuiz({ description: 'This is spam content' });
      const errors = validateQuizForPublish(quiz, TEST_NG_WORDS);
      expect(errors.some((e) => e.field === 'ngWord')).toBe(true);
    });
  });
});
