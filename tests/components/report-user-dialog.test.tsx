/**
 * @jest-environment jsdom
 */

// jsdom は PointerEvent および要素の pointer capture 関連 API を実装していないため、
// base-ui の Select コンポーネントが内部で使用するイベント生成・API 呼び出しに失敗する。
// テスト用に軽量ポリフィルを注入する（tier-downgrade-control.test.tsx と同一パターン）。
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

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { ReportUserDialog } from '@/components/profile/report-user-dialog';
import { submitUserReport } from '@/services/user-report';

// submitUserReport のモック
jest.mock('@/services/user-report', () => ({
  submitUserReport: jest.fn(),
}));

describe('ReportUserDialog Component', () => {
  const mockOnClose = jest.fn();
  const targetUid = 'target-user-789';
  const reporterId = 'reporter-user-123';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('isOpen が false の時はレンダリングされないこと', () => {
    const { container } = render(
      <ReportUserDialog
        isOpen={false}
        onClose={mockOnClose}
        targetUid={targetUid}
        reporterId={reporterId}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  test('isOpen が true の時にカテゴリ選択と自由記述欄が表示されること', () => {
    render(
      <ReportUserDialog
        isOpen={true}
        onClose={mockOnClose}
        targetUid={targetUid}
        reporterId={reporterId}
      />
    );

    expect(screen.getByTestId('report-user-category-select')).toBeInTheDocument();
    expect(screen.getByTestId('report-user-detail-input')).toBeInTheDocument();
    expect(screen.getByTestId('report-user-submit-btn')).toBeInTheDocument();
  });

  test('カテゴリ未選択または自由記述欄が空欄のまま送信すると、インラインエラーが表示されブロックされること', async () => {
    render(
      <ReportUserDialog
        isOpen={true}
        onClose={mockOnClose}
        targetUid={targetUid}
        reporterId={reporterId}
      />
    );

    const submitBtn = screen.getByTestId('report-user-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByTestId('report-user-validation-error')).toBeInTheDocument();
    });
    expect(submitUserReport).not.toHaveBeenCalled();
  });

  test('カテゴリと理由を入力して送信すると submitUserReport が呼び出され、成功メッセージが表示されること', async () => {
    (submitUserReport as jest.Mock).mockResolvedValue(undefined);

    render(
      <ReportUserDialog
        isOpen={true}
        onClose={mockOnClose}
        targetUid={targetUid}
        reporterId={reporterId}
      />
    );

    // カテゴリ選択（base-ui Select はネイティブselectではないため、combobox roleでの操作をシミュレート）
    const trigger = screen.getByTestId('report-user-category-select');
    fireEvent.click(trigger);
    const option = await screen.findByTestId('report-user-category-option-harassment');
    fireEvent.click(option);

    const textarea = screen.getByTestId('report-user-detail-input');
    fireEvent.change(textarea, { target: { value: '迷惑行為を繰り返しています。' } });

    const submitBtn = screen.getByTestId('report-user-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(submitUserReport).toHaveBeenCalledWith(
        reporterId,
        targetUid,
        'harassment',
        '迷惑行為を繰り返しています。'
      );
    });

    await waitFor(() => {
      expect(screen.getByTestId('report-user-success-message')).toBeInTheDocument();
    });
  });

  test('submitUserReport が失敗した際、エラーメッセージが表示されること（自己通報409相当）', async () => {
    const errorMessage = '自分自身を通報することはできません';
    (submitUserReport as jest.Mock).mockRejectedValue(new Error(errorMessage));

    render(
      <ReportUserDialog
        isOpen={true}
        onClose={mockOnClose}
        targetUid={targetUid}
        reporterId={reporterId}
      />
    );

    const trigger = screen.getByTestId('report-user-category-select');
    fireEvent.click(trigger);
    const option = await screen.findByTestId('report-user-category-option-harassment');
    fireEvent.click(option);

    const textarea = screen.getByTestId('report-user-detail-input');
    fireEvent.change(textarea, { target: { value: '自分自身への通報テスト。' } });

    const submitBtn = screen.getByTestId('report-user-submit-btn');
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(errorMessage)).toBeInTheDocument();
    });
  });

  test('閉じるボタンまたはキャンセルボタンで onClose が呼ばれること', () => {
    render(
      <ReportUserDialog
        isOpen={true}
        onClose={mockOnClose}
        targetUid={targetUid}
        reporterId={reporterId}
      />
    );

    const closeBtn = screen.getByLabelText('閉じる');
    fireEvent.click(closeBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(1);

    const cancelBtn = screen.getByText('キャンセル');
    fireEvent.click(cancelBtn);
    expect(mockOnClose).toHaveBeenCalledTimes(2);
  });
});
