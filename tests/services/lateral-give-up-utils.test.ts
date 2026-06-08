import { getLateralRevealText } from '@/services/lateral-give-up-utils';
import { Question } from '@/types';

function makeLateralQuestion(overrides: Partial<Question> = {}): Question {
  return {
    id: 'q-1',
    type: 'lateral-thinking',
    questionText: '不思議な話',
    aiContextDetails: '裏設定の真相テキスト',
    truthKeywords: ['真相'],
    ...overrides,
  };
}

describe('getLateralRevealText', () => {
  it('explanation が設定されていればそれを返す', () => {
    const text = getLateralRevealText(
      makeLateralQuestion({ explanation: 'プレイヤー向け解説です' })
    );
    expect(text).toBe('プレイヤー向け解説です');
  });

  it('explanation が空なら aiContextDetails にフォールバックする', () => {
    const text = getLateralRevealText(
      makeLateralQuestion({ explanation: '   ' })
    );
    expect(text).toBe('裏設定の真相テキスト');
  });

  it('どちらも未設定ならフォールバックメッセージを返す', () => {
    const text = getLateralRevealText(
      makeLateralQuestion({ explanation: '', aiContextDetails: '' })
    );
    expect(text).toBe('作成者が解説を設定していません。');
  });
});
