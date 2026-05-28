/**
 * Task 2.4 単体テスト: AI対話エンジン（ウミガメのスープ）
 *
 * テスト対象（純粋関数）:
 * - findCachedAnswer: セッションキャッシュから完全一致する質問を検索
 * - isAiTurnLimitExceeded: 1日ターン制限の超過チェック
 * - buildAiPrompt: ステートレスAIプロンプト構築
 *
 * API Route（/api/attempt/ask-ai）の実装は統合テスト対象のため除外。
 */

import {
  findCachedAnswer,
  isAiTurnLimitExceeded,
  buildAiPrompt,
  AiAnswerType,
} from '../../src/services/ask-ai-utils';
import { AiQuestion } from '../../src/types';

/* ============================================================
   ヘルパー
   ============================================================ */

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

/* ============================================================
   findCachedAnswer のテスト
   ============================================================ */
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

  test('一部一致（前方一致）はキャッシュヒットとならない', () => {
    expect(findCachedAnswer('海の上', history)).toBeNull();
  });

  test('大文字・小文字が異なる場合はキャッシュヒットしない（厳格一致）', () => {
    // 日本語では関係ないが、英語テキストケースの確認
    const englishHistory: AiQuestion[] = [
      makeAiQuestion({ questionText: 'Is it on the sea?', answerType: 'yes' }),
    ];
    expect(findCachedAnswer('is it on the sea?', englishHistory)).toBeNull();
  });

  test('履歴が空の場合はnullを返す', () => {
    expect(findCachedAnswer('何か質問', [])).toBeNull();
  });

  test('一致する質問がない場合はnullを返す', () => {
    expect(findCachedAnswer('存在しない質問ですか？', history)).toBeNull();
  });

  test('キャッシュヒット時は isFromCache が true になる', () => {
    const result = findCachedAnswer('事故ですか？', history);
    expect(result?.isFromCache).toBe(true);
  });
});

/* ============================================================
   isAiTurnLimitExceeded のテスト
   ============================================================ */
describe('isAiTurnLimitExceeded', () => {
  test('無料ユーザー: 19回は制限内', () => {
    expect(isAiTurnLimitExceeded(19, false)).toBe(false);
  });

  test('無料ユーザー: 20回は制限超過', () => {
    expect(isAiTurnLimitExceeded(20, false)).toBe(true);
  });

  test('無料ユーザー: 21回は制限超過', () => {
    expect(isAiTurnLimitExceeded(21, false)).toBe(true);
  });

  test('プレミアムユーザー: 20回以上でも制限超過しない', () => {
    expect(isAiTurnLimitExceeded(20, true)).toBe(false);
    expect(isAiTurnLimitExceeded(100, true)).toBe(false);
  });

  test('無料ユーザー: 0回は制限内', () => {
    expect(isAiTurnLimitExceeded(0, false)).toBe(false);
  });
});

/* ============================================================
   buildAiPrompt のテスト
   ============================================================ */
describe('buildAiPrompt', () => {
  const soupContext = '被害者は、ある特定の音を聞いてスープを飲むのをやめ、命を落とした。';
  const question = '被害者は自殺しましたか？';
  const correctAnswer: AiAnswerType = 'no';

  test('プロンプトに裏設定（aiContextDetails）が含まれる', () => {
    const prompt = buildAiPrompt(soupContext, question);
    expect(prompt).toContain(soupContext);
  });

  test('プロンプトに質問文が含まれる', () => {
    const prompt = buildAiPrompt(soupContext, question);
    expect(prompt).toContain(question);
  });

  test('プロンプトに有効な回答形式（YES/NO/IRRELEVANT/UNKNOWN）の指示が含まれる', () => {
    const prompt = buildAiPrompt(soupContext, question);
    expect(prompt).toMatch(/YES|NO|IRRELEVANT|UNKNOWN/i);
  });

  test('プロンプトが空文字列にならない', () => {
    const prompt = buildAiPrompt('設定', '質問');
    expect(prompt.length).toBeGreaterThan(0);
  });
});
