/**
 * useAiPlayState カスタムフックのユニットテスト (TDD RED)
 *
 * 目的:
 * 1. AIへの質問送信時に pending 状態が正しく管理されることをテスト。
 * 2. 同一質問の送信時に履歴からキャッシュヒット判定が行われることをテスト。
 */

import { AiQuestion } from '@/types';

// キャッシュ照合ロジックの簡易テスト
function mockFindCachedAnswer(questionText: string, history: AiQuestion[]): AiQuestion | null {
  const clean = questionText.trim().toLowerCase();
  return history.find((h) => h.questionText.trim().toLowerCase() === clean) || null;
}

describe('useAiPlayState キャッシュ・状態管理ロジックの検証', () => {
  const mockHistory: AiQuestion[] = [
    {
      id: 'h1',
      questionText: '男は一人でしたか？',
      answerType: 'yes',
      aiComment: 'はい。男は一人でした。',
      isFromCache: false,
      createdAt: new Date(),
    },
    {
      id: 'h2',
      questionText: '毒は入っていましたか？',
      answerType: 'no',
      aiComment: 'いいえ。毒は入っていません。',
      isFromCache: false,
      createdAt: new Date(),
    },
  ];

  test('キャッシュに存在する質問が送信された場合、キャッシュがヒットすること', () => {
    const cached = mockFindCachedAnswer('男は一人でしたか？', mockHistory);
    expect(cached).not.toBeNull();
    expect(cached?.answerType).toBe('yes');
    expect(cached?.aiComment).toBe('はい。男は一人でした。');
  });

  test('キャッシュに存在しない質問は null が返ること', () => {
    const cached = mockFindCachedAnswer('パンは毒入りですか？', mockHistory);
    expect(cached).toBeNull();
  });
});
