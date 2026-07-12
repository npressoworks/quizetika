/**
 * @jest-environment jsdom
 */

// jsdom は PointerEvent および要素の pointer capture 関連 API を実装していないため、
// base-ui の Select コンポーネントが内部で使用するイベント生成・API 呼び出しに失敗する。
// テスト用に軽量ポリフィルを注入する（tests/components/admin/delete-genre-dialog.test.tsx と同じパターン）。
if (typeof window !== 'undefined' && typeof window.PointerEvent === 'undefined') {
  class PointerEventPolyfill extends MouseEvent {
    constructor(type: string, params: PointerEventInit = {}) {
      super(type, params);
    }
  }
  // @ts-expect-error jsdom 環境向けの簡易ポリフィルのため型は緩めに扱う
  window.PointerEvent = PointerEventPolyfill;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.hasPointerCapture) {
  window.HTMLElement.prototype.hasPointerCapture = () => false;
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.setPointerCapture) {
  window.HTMLElement.prototype.setPointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.releasePointerCapture) {
  window.HTMLElement.prototype.releasePointerCapture = () => {};
}
if (typeof window !== 'undefined' && !window.HTMLElement.prototype.scrollIntoView) {
  window.HTMLElement.prototype.scrollIntoView = () => {};
}

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CreatorQuizVisibilityToggle } from '@/app/creator/quizzes/creator-quiz-visibility-toggle';
import { ProRequiredForVisibilityError } from '@/lib/quiz-access';
import { updateQuiz } from '@/services/quiz';
import type { Quiz } from '@/types';
import type { UserEntitlements } from '@/types/subscription';

jest.mock('@/services/quiz', () => ({
  updateQuiz: jest.fn(),
}));

const mockUpdateQuiz = updateQuiz as jest.MockedFunction<typeof updateQuiz>;

function makeQuiz(overrides: Partial<Pick<Quiz, 'id' | 'status' | 'visibility'>> = {}): Pick<
  Quiz,
  'id' | 'status' | 'visibility'
> {
  return {
    id: 'quiz-1',
    status: 'published',
    visibility: 'public',
    ...overrides,
  };
}

function freeEntitlements(): Pick<UserEntitlements, 'hasPaidEntitlements'> {
  return { hasPaidEntitlements: false };
}

function paidEntitlements(): Pick<UserEntitlements, 'hasPaidEntitlements'> {
  return { hasPaidEntitlements: true };
}

function openSelect() {
  fireEvent.click(screen.getByTestId('creator-quiz-visibility-toggle'));
}

function selectOption(value: string) {
  fireEvent.keyDown(
    screen.getByTestId(`creator-quiz-visibility-toggle-option-${value}`),
    { key: 'Enter' }
  );
}

beforeEach(() => {
  mockUpdateQuiz.mockReset();
});

describe('CreatorQuizVisibilityToggle', () => {
  it('無料プランのユーザーも限定公開・非公開を選択操作でき、選択すると updateQuiz を呼ばずに Pro プラン誘導ポップアップを表示すること', async () => {
    const onVisibilityChange = jest.fn();
    render(
      <CreatorQuizVisibilityToggle
        quiz={makeQuiz()}
        entitlements={freeEntitlements()}
        onVisibilityChange={onVisibilityChange}
      />
    );
    openSelect();

    const followersOption = screen.getByTestId(
      'creator-quiz-visibility-toggle-option-followers'
    );
    const privateOption = screen.getByTestId(
      'creator-quiz-visibility-toggle-option-private'
    );
    expect(followersOption).not.toHaveAttribute('aria-disabled', 'true');
    expect(privateOption).not.toHaveAttribute('aria-disabled', 'true');

    selectOption('private');

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-visibility-pro-modal')).toBeInTheDocument();
    });
    expect(mockUpdateQuiz).not.toHaveBeenCalled();
    expect(onVisibilityChange).not.toHaveBeenCalled();
    // 実際の切り替えは行われないため、表示は元の値のままであること
    expect(screen.getByTestId('creator-quiz-visibility-toggle')).toHaveTextContent('公開');
  });

  it('Pro プラン誘導ポップアップに /pricing へのリンクが含まれること', async () => {
    render(
      <CreatorQuizVisibilityToggle
        quiz={makeQuiz()}
        entitlements={freeEntitlements()}
        onVisibilityChange={jest.fn()}
      />
    );
    openSelect();
    selectOption('followers');

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-visibility-pro-modal')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Pro/ })).toHaveAttribute('href', '/pricing');
  });

  it('有料プランのユーザーは3値すべてを選択でき、選択すると updateQuiz が呼ばれること', async () => {
    mockUpdateQuiz.mockResolvedValueOnce(undefined);
    const onVisibilityChange = jest.fn();
    render(
      <CreatorQuizVisibilityToggle
        quiz={makeQuiz({ visibility: 'public' })}
        entitlements={paidEntitlements()}
        onVisibilityChange={onVisibilityChange}
      />
    );
    openSelect();
    selectOption('private');

    await waitFor(() => {
      expect(mockUpdateQuiz).toHaveBeenCalledWith('quiz-1', { visibility: 'private' });
    });
  });

  it('切り替えが成功すると onVisibilityChange(quizId, next) が呼ばれること', async () => {
    mockUpdateQuiz.mockResolvedValueOnce(undefined);
    const onVisibilityChange = jest.fn();
    render(
      <CreatorQuizVisibilityToggle
        quiz={makeQuiz({ visibility: 'public' })}
        entitlements={paidEntitlements()}
        onVisibilityChange={onVisibilityChange}
      />
    );
    openSelect();
    selectOption('followers');

    await waitFor(() => {
      expect(onVisibilityChange).toHaveBeenCalledWith('quiz-1', 'followers');
    });
  });

  it('有料プランでも updateQuiz が ProRequiredForVisibilityError で失敗した場合（プラン状態の競合等）、Pro プラン誘導ポップアップを表示し表示値を元に戻すこと', async () => {
    mockUpdateQuiz.mockRejectedValueOnce(new ProRequiredForVisibilityError());
    const onVisibilityChange = jest.fn();
    render(
      <CreatorQuizVisibilityToggle
        quiz={makeQuiz({ visibility: 'public' })}
        entitlements={paidEntitlements()}
        onVisibilityChange={onVisibilityChange}
      />
    );
    openSelect();
    selectOption('private');

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-visibility-pro-modal')).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /Pro/ })).toHaveAttribute('href', '/pricing');
    expect(onVisibilityChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('creator-quiz-visibility-toggle')).toHaveTextContent('公開');
  });

  it('updateQuiz が一般的なエラーで失敗した場合、汎用エラーメッセージを表示し表示値を元に戻すこと', async () => {
    mockUpdateQuiz.mockRejectedValueOnce(new Error('network error'));
    const onVisibilityChange = jest.fn();
    render(
      <CreatorQuizVisibilityToggle
        quiz={makeQuiz({ visibility: 'public' })}
        entitlements={paidEntitlements()}
        onVisibilityChange={onVisibilityChange}
      />
    );
    openSelect();
    selectOption('followers');

    await waitFor(() => {
      expect(
        screen.getByTestId('creator-quiz-visibility-toggle-error')
      ).toBeInTheDocument();
    });
    expect(onVisibilityChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('creator-quiz-visibility-toggle')).toHaveTextContent('公開');
  });

  it('更新処理の実行中は Select が disabled になり二重送信を防止すること', async () => {
    let resolveUpdate!: () => void;
    mockUpdateQuiz.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveUpdate = () => resolve(undefined);
        })
    );
    render(
      <CreatorQuizVisibilityToggle
        quiz={makeQuiz({ visibility: 'public' })}
        entitlements={paidEntitlements()}
        onVisibilityChange={jest.fn()}
      />
    );
    openSelect();
    selectOption('followers');

    await waitFor(() => {
      expect(screen.getByTestId('creator-quiz-visibility-toggle')).toHaveAttribute(
        'data-disabled'
      );
    });

    resolveUpdate();
    await waitFor(() => {
      expect(
        screen.getByTestId('creator-quiz-visibility-toggle')
      ).not.toHaveAttribute('data-disabled');
    });
  });
});
