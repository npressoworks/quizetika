import {
  AI_QUIZ_QUESTION_COUNT,
  PRO_DAILY_QUESTION_GENERATION_LIMIT,
  checkDailyAuthoringLimit,
  mapAiJsonToQuestions,
  readDailyAuthoringCount,
  readDailyAuthoringUsage,
  getJstTodayString,
  MIXED_ALLOWED_QUESTION_TYPES,
} from '@/services/ai-authoring-utils';

describe('readDailyAuthoringCount', () => {
  const today = getJstTodayString();

  test('日付不一致時は 0 を返す', () => {
    expect(readDailyAuthoringCount({ count: 5, lastUpdatedDate: '2000-01-01' }, today)).toBe(0);
  });

  test('同日の count を返す', () => {
    expect(readDailyAuthoringCount({ count: 12, lastUpdatedDate: today }, today)).toBe(12);
  });
});

describe('checkDailyAuthoringLimit', () => {
  test('免除時は exceeded false で無制限表示', () => {
    const result = checkDailyAuthoringLimit(50, PRO_DAILY_QUESTION_GENERATION_LIMIT, true);
    expect(result.exceeded).toBe(false);
    expect(result.usage.limit).toBeNull();
    expect(result.usage.remainingToday).toBeNull();
  });

  test('上限到達時は exceeded true', () => {
    const result = checkDailyAuthoringLimit(
      PRO_DAILY_QUESTION_GENERATION_LIMIT,
      PRO_DAILY_QUESTION_GENERATION_LIMIT,
      false
    );
    expect(result.exceeded).toBe(true);
    expect(result.usage.remainingToday).toBe(0);
  });
});

describe('readDailyAuthoringUsage', () => {
  test('作問・サムネの usage を返す', () => {
    const usage = readDailyAuthoringUsage(3, 1, false);
    expect(usage.questions.usedToday).toBe(3);
    expect(usage.thumbnail.usedToday).toBe(1);
    expect(usage.questions.remainingToday).toBe(97);
    expect(usage.thumbnail.remainingToday).toBe(19);
  });
});

describe('mapAiJsonToQuestions', () => {
  function makeMcItem(index: number) {
    return {
      type: 'multiple-choice',
      questionText: `問題文テスト${index}です`,
      explanation: `解説文テスト${index}です`,
      choices: [
        { choiceText: '正解選択肢', isCorrect: true },
        { choiceText: '不正解選択肢', isCorrect: false },
      ],
    };
  }

  test('10件の multiple-choice をマッピングする', () => {
    const raw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => makeMcItem(i));
    const questions = mapAiJsonToQuestions(raw, 'multiple-choice');
    expect(questions.length).toBe(AI_QUIZ_QUESTION_COUNT);
    questions.forEach((q) => {
      expect(q.type).toBe('multiple-choice');
      expect(q.correctCount).toBe(0);
      expect(q.incorrectCount).toBe(0);
    });
  });

  test('10件未満は reject する', () => {
    expect(() => mapAiJsonToQuestions([makeMcItem(0)], 'multiple-choice')).toThrow('invalid-count');
  });

  test('mixed に quick-press を混入すると reject する', () => {
    const raw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => {
      if (i === 0) {
        return {
          type: 'quick-press',
          questionText: '問題文テストです',
          explanation: '解説文テストです',
          correctTextAnswerList: ['答え'],
        };
      }
      return makeMcItem(i);
    });
    expect(() => mapAiJsonToQuestions(raw, 'mixed')).toThrow('invalid-type');
  });

  test('mixed allowlist の4種のみ許可する', () => {
    const raw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => {
      const type = MIXED_ALLOWED_QUESTION_TYPES[i % MIXED_ALLOWED_QUESTION_TYPES.length];
      if (type === 'sorting') {
        return {
          type,
          questionText: `並べ替え問題${i}`,
          explanation: `解説${i}`,
          sortingItems: [
            { text: '要素A', correctOrder: 0 },
            { text: '要素B', correctOrder: 1 },
          ],
        };
      }
      if (type === 'text-input') {
        return {
          type,
          questionText: `記述問題${i}`,
          explanation: `解説${i}`,
          correctTextAnswerList: ['正解'],
        };
      }
      return makeMcItem(i);
    });
    const questions = mapAiJsonToQuestions(raw, 'mixed');
    expect(questions.length).toBe(AI_QUIZ_QUESTION_COUNT);
  });

  test('各形式別の最小構成JSON（不要プロパティなし）を正しくマッピングする', () => {
    // 1. text-input形式
    const textInputRaw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => ({
      type: 'text-input',
      questionText: `問題${i}`,
      explanation: `解説${i}`,
      correctTextAnswerList: [`正解${i}`],
    }));
    const textInputQuestions = mapAiJsonToQuestions(textInputRaw, 'text-input');
    expect(textInputQuestions[0].choices).toBeUndefined();
    expect(textInputQuestions[0].sortingItems).toBeUndefined();
    expect(textInputQuestions[0].correctTextAnswerList).toEqual(['正解0']);

    // 2. sorting形式
    const sortingRaw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => ({
      type: 'sorting',
      questionText: `問題${i}`,
      explanation: `解説${i}`,
      sortingItems: [
        { text: '要素1', correctOrder: 0 },
        { text: '要素2', correctOrder: 1 },
      ],
    }));
    const sortingQuestions = mapAiJsonToQuestions(sortingRaw, 'sorting');
    expect(sortingQuestions[0].choices).toBeUndefined();
    expect(sortingQuestions[0].correctTextAnswerList).toBeUndefined();
    expect(sortingQuestions[0].sortingItems).toHaveLength(2);

    // 3. association形式
    const associationRaw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => ({
      type: 'association',
      questionText: `問題${i}`,
      explanation: `解説${i}`,
      correctTextAnswerList: [`正解${i}`],
      associationHints: [`ヒント1`, `ヒント2`],
    }));
    const associationQuestions = mapAiJsonToQuestions(associationRaw, 'association');
    expect(associationQuestions[0].choices).toBeUndefined();
    expect(associationQuestions[0].sortingItems).toBeUndefined();
    expect(associationQuestions[0].associationHints).toHaveLength(2);
    expect(associationQuestions[0].correctTextAnswerList).toEqual(['正解0']);
  });

  test('sorting 形式の correctOrder が1始まりや重複している場合でも正しく 0始まりの連番に補正する', () => {
    const raw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => ({
      type: 'sorting',
      questionText: `問題${i}`,
      explanation: `解説${i}`,
      sortingItems: [
        { text: '要素C', correctOrder: 3 },
        { text: '要素A', correctOrder: 1 },
        { text: '要素B', correctOrder: 2 },
      ],
    }));
    const questions = mapAiJsonToQuestions(raw, 'sorting');
    const firstQ = questions[0];
    expect(firstQ.sortingItems).toHaveLength(3);

    // correctOrder の値が昇順でソートされ、0, 1, 2 に再割り当てされていることを検証
    const itemA = firstQ.sortingItems?.find((item) => item.text === '要素A');
    const itemB = firstQ.sortingItems?.find((item) => item.text === '要素B');
    const itemC = firstQ.sortingItems?.find((item) => item.text === '要素C');

    expect(itemA?.correctOrder).toBe(0); // 元の 1 は 0 に
    expect(itemB?.correctOrder).toBe(1); // 元の 2 は 1 に
    expect(itemC?.correctOrder).toBe(2); // 元の 3 は 2 に
  });

  test('true-false 形式で「✕」や「偽」などの異なる否定表現が正しく batsu としてマッピングされる', () => {
    const batsuRepresentations = ['✕', '×', '偽', '誤り', '間違い', 'false'];
    
    batsuRepresentations.forEach((text) => {
      const raw = Array.from({ length: AI_QUIZ_QUESTION_COUNT }, (_, i) => ({
        type: 'true-false',
        questionText: `問題${i}`,
        explanation: `解説${i}`,
        choices: [
          { choiceText: '〇', isCorrect: false },
          { choiceText: text, isCorrect: true },
        ],
      }));
      
      const questions = mapAiJsonToQuestions(raw, 'true-false');
      const q = questions[0];
      
      // ✕（batsu）側の choice の isCorrect が true になっているか検証
      const batsuChoice = q.choices?.find((c) => c.choiceText === '✕');
      expect(batsuChoice?.isCorrect).toBe(true);
    });
  });
});
