/**
 * @jest-environment jsdom
 */
import { renderHook, act, waitFor } from '@testing-library/react';

const sleepMock = jest.fn();

jest.mock('@/lib/quick-press-stream-config', () => ({
  QUICK_PRESS_LABEL: '問題：',
  QUICK_PRESS_LABEL_CHAR_MS: 0,
  QUICK_PRESS_BODY_PAUSE_MS: 0,
  QUICK_PRESS_BODY_CHAR_MS: 0,
  QUICK_PRESS_WIPE_CHAR_MS: 0,
  sleep: () => sleepMock(),
}));

import { useQuickPressStream } from '@/hooks/useQuickPressStream';

describe('useQuickPressStream onReadingComplete', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sleepMock.mockResolvedValue(undefined);
  });

  test('local モード正常完了で onReadingComplete が 1 回呼ばれる', async () => {
    const onReadingComplete = jest.fn();

    const { result } = renderHook(() =>
      useQuickPressStream({
        enabled: true,
        mode: 'local',
        quizId: 'quiz1',
        questionId: 'q1',
        localBodyMarkdown: 'AB',
        onReadingComplete,
      })
    );

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(onReadingComplete).toHaveBeenCalledTimes(1);
    expect(result.current.isReadingComplete).toBe(true);
    expect(result.current.displayTokens.map((t) => t.char).join('')).toContain('AB');
    expect(result.current.reservedTokens.length).toBeGreaterThan(0);
  });

  test('cancelStream では onReadingComplete が呼ばれない', async () => {
    sleepMock.mockImplementation(() => new Promise(() => {}));
    const onReadingComplete = jest.fn();

    const { result } = renderHook(() =>
      useQuickPressStream({
        enabled: true,
        mode: 'local',
        quizId: 'quiz1',
        questionId: 'q1',
        localBodyMarkdown: '長い本文',
        onReadingComplete,
      })
    );

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(true);
    });

    act(() => {
      result.current.cancelStream();
    });

    await waitFor(() => {
      expect(result.current.isStreaming).toBe(false);
    });

    expect(onReadingComplete).not.toHaveBeenCalled();
    expect(result.current.isReadingComplete).toBe(false);
  });
});
