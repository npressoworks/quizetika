/**
 * Task 17.1 単体テスト: AI対話エンジン（ウミガメのスープ）
 */

import {
  findCachedAnswer,
  checkAiTurnLimits,
  normalizeQuestionText,
  buildAiPrompt,
  AiAnswerType,
  mapHistoryToGeminiContents,
  buildAiSystemInstruction,
  FREE_TIER_PER_QUIZ_LIMIT,
  FREE_TIER_GLOBAL_DAILY_LIMIT,
} from '../../src/services/ask-ai-utils';
import { AiQuestion } from '../../src/types';

function makeAiQuestion(overrides: Partial<AiQuestion> = {}): AiQuestion {
  return {
    id: 'aq1',
    questionText: 'この問題は海の上で起きましたか？',
    answerType: 'yes',
    aiComment: 'はい、海の上の出来事です。',
    isFromCache: false,
    createdAt: new Date(),
    ...overrides,
  };
}

describe('normalizeQuestionText', () => {
  test('前後空白・全角空白・大文字小文字を統一する', () => {
    expect(normalizeQuestionText('  Hello　World  ')).toBe('helloworld');
    expect(normalizeQuestionText('hello world')).toBe('helloworld');
  });
});

describe('findCachedAnswer', () => {
  const history: AiQuestion[] = [
    makeAiQuestion({ id: 'aq1', questionText: '海の上ですか？', answerType: 'yes' }),
    makeAiQuestion({ id: 'aq2', questionText: '事故ですか？', answerType: 'no' }),
    makeAiQuestion({ id: 'aq3', questionText: '関係ありますか？', answerType: 'irrelevant' }),
  ];

  test('完全一致する質問が存在する場合、そのエントリを返す', () => {
    const result = findCachedAnswer('海の上ですか？', history);
    expect(result).not.toBeNull();
    expect(result?.answerType).toBe('yes');
    expect(result?.isFromCache).toBe(true);
  });

  test('正規化一致（表記ゆれ）でもキャッシュヒットする', () => {
    const englishHistory: AiQuestion[] = [
      makeAiQuestion({ questionText: 'Is it on the sea?', answerType: 'yes' }),
    ];
    expect(findCachedAnswer('is it on the sea?', englishHistory)).not.toBeNull();
    expect(findCachedAnswer('  Is　it on  the sea?  ', englishHistory)).not.toBeNull();
  });

  test('一部一致（前方一致）はキャッシュヒットとならない', () => {
    expect(findCachedAnswer('海の上', history)).toBeNull();
  });

  test('履歴が空の場合はnullを返す', () => {
    expect(findCachedAnswer('何か質問', [])).toBeNull();
  });

  test('一致する質問がない場合はnullを返す', () => {
    expect(findCachedAnswer('存在しない質問ですか？', history)).toBeNull();
  });
});

describe('checkAiTurnLimits', () => {
  test('無料ユーザー: per-quiz 29回は制限内', () => {
    const result = checkAiTurnLimits({
      perQuizCount: 29,
      globalDailyCount: 0,
      hasUnlimitedAiQuestions: false,
    });
    expect(result.exceeded).toBe(false);
    expect(result.turnsRemaining.perQuiz).toBe(1);
  });

  test('無料ユーザー: per-quiz 30回で per-quiz 制限超過', () => {
    const result = checkAiTurnLimits({
      perQuizCount: 30,
      globalDailyCount: 10,
      hasUnlimitedAiQuestions: false,
    });
    expect(result.exceeded).toBe(true);
    expect(result.limitType).toBe('per-quiz');
    expect(result.turnsRemaining.perQuiz).toBe(0);
  });

  test('無料ユーザー: global 150回で global-daily 制限超過', () => {
    const result = checkAiTurnLimits({
      perQuizCount: 5,
      globalDailyCount: 150,
      hasUnlimitedAiQuestions: false,
    });
    expect(result.exceeded).toBe(true);
    expect(result.limitType).toBe('global-daily');
    expect(result.turnsRemaining.globalDaily).toBe(0);
  });

  test('Pro ユーザーは常に制限なし', () => {
    const result = checkAiTurnLimits({
      perQuizCount: FREE_TIER_PER_QUIZ_LIMIT,
      globalDailyCount: FREE_TIER_GLOBAL_DAILY_LIMIT,
      hasUnlimitedAiQuestions: true,
    });
    expect(result.exceeded).toBe(false);
    expect(result.turnsRemaining.perQuiz).toBeNull();
    expect(result.turnsRemaining.globalDaily).toBeNull();
  });
});

describe('buildAiPrompt', () => {
  const soupContext = '被害者は、ある特定の音を聞いてスープを飲むのをやめ、命を落とした。';
  const question = '被害者は自殺しましたか？';

  test('プロンプトに裏設定（aiContextDetails）が含まれる', () => {
    const prompt = buildAiPrompt(soupContext, question);
    expect(prompt).toContain(soupContext);
  });

  test('プロンプトに質問文が含まれる', () => {
    const prompt = buildAiPrompt(soupContext, question);
    expect(prompt).toContain(question);
  });

  test('プロンプトに有効な回答形式の指示が含まれる', () => {
    const prompt = buildAiPrompt(soupContext, question);
    expect(prompt).toMatch(/はい|いいえ|関係ありません|判断できません/);
  });
});

describe('mapHistoryToGeminiContents', () => {
  test('空の履歴を空の配列に変換する', () => {
    expect(mapHistoryToGeminiContents([])).toHaveLength(0);
  });

  test('過去履歴をGeminiのContent形式に正しくマッピングする', () => {
    const history = [
      { questionText: '海ですか？', answerType: 'yes' as const, aiComment: 'はい。' },
      { questionText: '自殺ですか？', answerType: 'no' as const, aiComment: 'いいえ。' },
    ];
    const result = mapHistoryToGeminiContents(history);
    expect(result).toHaveLength(4);
    expect(result[0].role).toBe('user');
    expect(result[0].parts![0].text).toBe('海ですか？');
  });

  test('直近最大20回分のみにスライスされる', () => {
    const history = Array.from({ length: 25 }, (_, i) => ({
      questionText: `質問${i}`,
      answerType: 'yes' as const,
      aiComment: `回答${i}`,
    }));
    const result = mapHistoryToGeminiContents(history);
    expect(result).toHaveLength(40);
    expect(result[0].parts![0].text).toBe('質問5');
  });
});

describe('buildAiSystemInstruction', () => {
  test('システムプロンプトに裏設定が含まれる', () => {
    const context = '裏設定の真相テキスト';
    const instruction = buildAiSystemInstruction(context);
    expect(instruction).toContain(context);
    expect(instruction).toContain('ゲームマスター');
  });
});
