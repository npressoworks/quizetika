/**
 * @jest-environment jsdom
 */
import { renderHook, act } from '@testing-library/react';
import { usePlayState, isSegmentTicking } from '@/hooks/usePlayState';
import type { Question } from '@/types';

const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: jest.fn((key: string) => store[key] || null),
    setItem: jest.fn((key: string, value: string) => {
      store[key] = value.toString();
    }),
    removeItem: jest.fn((key: string) => {
      delete store[key];
    }),
    clear: jest.fn(() => {
      store = {};
    }),
  };
})();

Object.defineProperty(global, 'localStorage', {
  value: localStorageMock,
});

const baseQuestion: Question = {
  id: 'q1',
  type: 'text-input',
  questionText: 'テスト問題',
  explanation: '',
  imageUrl: null,
  hint: null,
  correctTextAnswerList: ['answer'],
  choices: undefined,
  sortingItems: undefined,
  limitTime: null,
  textInputMode: 'text',
  textInputCharCount: undefined,
  truthKeywords: undefined,
  aiContextDetails: undefined,
  correctCount: 0,
  incorrectCount: 0,
};

const quickPressQuestion: Question = {
  ...baseQuestion,
  id: 'qp1',
  type: 'quick-press',
  correctTextAnswerList: [btoa(unescape(encodeURIComponent('tokyo')))],
  limitTime: 30,
};

describe('isSegmentTicking', () => {
  test('早押し pre_reading では tick しない', () => {
    expect(
      isSegmentTicking({ kind: 'quick-press', phase: 'pre_reading' }, false)
    ).toBe(false);
  });

  test('早押し reading では tick する', () => {
    expect(
      isSegmentTicking({ kind: 'quick-press', phase: 'reading' }, false)
    ).toBe(true);
  });

  test('feedback 中は tick しない', () => {
    expect(isSegmentTicking({ kind: 'standard' }, true)).toBe(false);
  });
});

describe('usePlayState 区間累計経過時間', () => {
  const questions = [quickPressQuestion];
  const preReadingPolicy = { kind: 'quick-press' as const, phase: 'pre_reading' as const };
  const readingPolicy = { kind: 'quick-press' as const, phase: 'reading' as const };
  const postReadingPolicy = { kind: 'quick-press' as const, phase: 'post_reading' as const };
  const feedbackPolicy = { kind: 'quick-press' as const, phase: 'feedback' as const };

  beforeEach(() => {
    jest.useFakeTimers({ legacyFakeTimers: false });
    localStorageMock.clear();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  test('早押し pre_reading 中は経過時間が加算されない', () => {
    const { result } = renderHook(() =>
      usePlayState({
        quizId: 'quiz1',
        userId: 'user1',
        mode: 'normal',
        questions,
        persistSession: false,
        manualAdvance: true,
        elapsedPolicy: preReadingPolicy,
      })
    );

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.elapsedSeconds).toBe(0);
  });

  test('早押し reading 中は経過時間が加算される', () => {
    const { result, rerender } = renderHook(
      ({ policy }) =>
        usePlayState({
          quizId: 'quiz1',
          userId: 'user1',
          mode: 'normal',
          questions,
          persistSession: false,
          manualAdvance: true,
          elapsedPolicy: policy,
        }),
      {
        initialProps: {
          policy: readingPolicy as any,
        },
      }
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(result.current.elapsedSeconds).toBe(3);

    rerender({
      policy: feedbackPolicy,
    });

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.elapsedSeconds).toBe(3);
  });

  test('早押し問題表示直後は limitTime カウントダウンが始まらない', () => {
    const { result } = renderHook(() =>
      usePlayState({
        quizId: 'quiz1',
        userId: 'user1',
        mode: 'normal',
        questions,
        persistSession: false,
        manualAdvance: true,
        elapsedPolicy: preReadingPolicy,
      })
    );

    expect(result.current.timeLeft).toBeNull();
  });

  test('beginLimitCountdown で limitTime がセットされる', () => {
    const { result } = renderHook(() =>
      usePlayState({
        quizId: 'quiz1',
        userId: 'user1',
        mode: 'normal',
        questions,
        persistSession: false,
        manualAdvance: true,
        elapsedPolicy: postReadingPolicy,
      })
    );

    act(() => {
      result.current.beginLimitCountdown();
    });

    expect(result.current.timeLeft).toBe(30);
  });

  test('回答確定後は残り時間カウントが止まる', () => {
    const { result } = renderHook(() =>
      usePlayState({
        quizId: 'quiz1',
        userId: 'user1',
        mode: 'normal',
        questions,
        persistSession: false,
        manualAdvance: true,
        elapsedPolicy: postReadingPolicy,
      })
    );

    act(() => {
      result.current.beginLimitCountdown();
    });

    expect(result.current.timeLeft).toBe(30);

    act(() => {
      result.current.recordAnswer('');
    });

    expect(result.current.feedbackPending).toBe(true);
    expect(result.current.timeLeft).toBeNull();

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(result.current.timeLeft).toBeNull();
  });

  describe('解答詳細トラッキング', () => {
    const trackingQuestions: Question[] = [
      {
        ...baseQuestion,
        id: 'q_choice',
        type: 'multiple-choice',
        choices: [
          { id: 'c1', choiceText: '選択肢1', isCorrect: true, selectedCount: 0 },
          { id: 'c2', choiceText: '選択肢2', isCorrect: false, selectedCount: 0 },
        ],
        correctTextAnswerList: ['c1'],
      },
      {
        ...baseQuestion,
        id: 'q_sort',
        type: 'sorting',
        sortingItems: [
          { id: 'i1', text: 'アイテム1', correctOrder: 0 },
          { id: 'i2', text: 'アイテム2', correctOrder: 1 },
        ],
        correctTextAnswerList: ['i1,i2'],
      }
    ];

    test('多肢選択問題での詳細トラッキングが機能すること', () => {
      const { result } = renderHook(() =>
        usePlayState({
          quizId: 'quiz1',
          userId: 'user1',
          mode: 'normal',
          questions: [trackingQuestions[0]],
          persistSession: false,
          manualAdvance: true,
        })
      );

      // ヒント使用、選択肢選択
      act(() => {
        result.current.registerChoicesOrder('q_choice', ['c1', 'c2']);
        result.current.incrementHintsUsed('q_choice');
        result.current.incrementHintsUsed('q_choice');
        result.current.trackChoiceClick('q_choice', 'c2');
        result.current.trackChoiceClick('q_choice', 'c1');
      });

      // 回答を記録
      act(() => {
        result.current.recordAnswer('c1');
      });

      const details = result.current.questionAnswerDetails;
      expect(details).toHaveLength(1);
      expect(details[0]).toEqual(expect.objectContaining({
        questionId: 'q_choice',
        questionType: 'multiple-choice',
        isCorrect: true,
        hintsUsedCount: 2,
        selectedChoiceId: 'c1',
        choicesOrder: ['c1', 'c2'],
        choicesInteractionsCount: 2,
        answerChanged: true,
      }));
    });

    test('並べ替え問題での詳細トラッキングが機能すること', () => {
      const { result } = renderHook(() =>
        usePlayState({
          quizId: 'quiz1',
          userId: 'user1',
          mode: 'normal',
          questions: [trackingQuestions[1]],
          persistSession: false,
          manualAdvance: true,
        })
      );

      act(() => {
        result.current.registerInitialItemOrder('q_sort', ['i2', 'i1']);
      });

      act(() => {
        result.current.recordAnswer('i1,i2');
      });

      const details = result.current.questionAnswerDetails;
      expect(details).toHaveLength(1);
      expect(details[0]).toEqual(expect.objectContaining({
        questionId: 'q_sort',
        questionType: 'sorting',
        initialItemOrder: ['i2', 'i1'],
        finalItemOrder: ['i1', 'i2'],
      }));
    });
  });
});
