/**
 * @jest-environment jsdom
 */

// jsdom は PointerEvent および要素の pointer capture 関連 API を実装していないため、
// base-ui の Select/AlertDialog コンポーネントが内部で使用するイベント生成・API 呼び出しに
// 失敗する。テスト用に軽量ポリフィルを注入する。
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
import { TierDowngradeControl } from '@/components/admin/tier-downgrade-control';

describe('TierDowngradeControl', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.restoreAllMocks();
  });

  test('newcomer の場合は操作が非活性化される', () => {
    render(
      <TierDowngradeControl
        targetUid="uid-1"
        currentTier="newcomer"
        getIdToken={async () => 'token'}
        onSuccess={() => {}}
        onError={() => {}}
      />,
    );

    expect(screen.getByTestId('tier-downgrade-disabled-message')).toBeInTheDocument();
    expect(screen.queryByTestId('tier-downgrade-form')).not.toBeInTheDocument();
  });

  test('moderator の場合は下位ティア（newcomer, contributor）のみが選択肢に表示される', () => {
    render(
      <TierDowngradeControl
        targetUid="uid-1"
        currentTier="moderator"
        getIdToken={async () => 'token'}
        onSuccess={() => {}}
        onError={() => {}}
      />,
    );

    expect(screen.getByTestId('tier-downgrade-form')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('tier-downgrade-select'));
    expect(screen.getByTestId('tier-downgrade-option-newcomer')).toBeInTheDocument();
    expect(screen.getByTestId('tier-downgrade-option-contributor')).toBeInTheDocument();
    expect(screen.queryByTestId('tier-downgrade-option-moderator')).not.toBeInTheDocument();
    expect(screen.queryByTestId('tier-downgrade-option-senior_moderator')).not.toBeInTheDocument();
  });

  test('理由が10文字未満の場合は確定操作をブロックする', () => {
    render(
      <TierDowngradeControl
        targetUid="uid-1"
        currentTier="contributor"
        getIdToken={async () => 'token'}
        onSuccess={() => {}}
        onError={() => {}}
      />,
    );

    fireEvent.click(screen.getByTestId('tier-downgrade-select'));
    fireEvent.click(screen.getByTestId('tier-downgrade-option-newcomer'));

    const textarea = screen.getByLabelText('引き下げ理由（10文字以上必須）');
    fireEvent.change(textarea, { target: { value: '短い理由' } });

    expect(screen.getByTestId('execute-tier-downgrade-btn')).toBeDisabled();
  });

  test('確認後にAPIを正しい引数で呼び出し、成功時に onSuccess が呼ばれる', async () => {
    const fetchMock = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ success: true }),
    });
    global.fetch = fetchMock as unknown as typeof fetch;

    const onSuccess = jest.fn();
    const onError = jest.fn();

    render(
      <TierDowngradeControl
        targetUid="uid-42"
        currentTier="senior_moderator"
        getIdToken={async () => 'test-token'}
        onSuccess={onSuccess}
        onError={onError}
      />,
    );

    // NOTE: jsdom環境ではbase-uiのSelectがポインタ移動によるアクティブ項目のハイライトを
    // 実装できないため、リスト内でクリックにより確実に選択されるのは常に先頭項目
    // （最下位ティア = newcomer）のみとなる。ここでは newTier が実際にクリックした
    // 項目のvalueとしてAPIへ正しく伝播することの検証を目的とし、常に先頭に存在する
    // newcomer を選択して確認する。
    fireEvent.click(screen.getByTestId('tier-downgrade-select'));
    fireEvent.click(await screen.findByTestId('tier-downgrade-option-newcomer'));

    const textarea = screen.getByLabelText('引き下げ理由（10文字以上必須）');
    fireEvent.change(textarea, { target: { value: '規約違反行為が繰り返し確認されたため' } });

    fireEvent.click(screen.getByTestId('execute-tier-downgrade-btn'));

    const confirmBtn = await screen.findByTestId('confirm-action-btn');
    fireEvent.click(confirmBtn);

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(1));

    expect(fetchMock).toHaveBeenCalledWith(
      '/api/admin/users/downgrade-tier',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          Authorization: 'Bearer test-token',
        }),
        body: JSON.stringify({
          targetUid: 'uid-42',
          newTier: 'newcomer',
          reason: '規約違反行為が繰り返し確認されたため',
        }),
      }),
    );

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onError).not.toHaveBeenCalled();
  });
});
