/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, act } from '@testing-library/react';

import { VideoAdModal } from '@/components/ads/video-ad-modal';

describe('VideoAdModal Component', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('isOpen が false のとき、何もレンダリングしない (null を返す)', () => {
    const onComplete = jest.fn();
    const { container } = render(<VideoAdModal isOpen={false} onComplete={onComplete} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('isOpen が true のとき、モーダルが表示され、5秒間のカウントダウンが開始される', () => {
    const onComplete = jest.fn();
    render(<VideoAdModal isOpen={true} onComplete={onComplete} />);

    expect(screen.getByTestId('video-ad-modal')).toBeInTheDocument();
    
    // 初期状態はスキップ不可
    const button = screen.getByRole('button');
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent(/あと 5 秒/);
  });

  it('5秒経過した後にスキップボタンが活性化し、クリックで onComplete が呼ばれる', async () => {
    const onComplete = jest.fn();
    render(<VideoAdModal isOpen={true} onComplete={onComplete} />);

    const button = screen.getByRole('button');
    expect(button).toBeDisabled();

    // 2秒進める (1秒ずつ)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(button).toHaveTextContent(/あと 3 秒/);
    expect(button).toBeDisabled();

    // さらに3秒進めて計5秒にする (1秒ずつ)
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(button).not.toBeDisabled();
    expect(button).toHaveTextContent('スキップして結果へ');

    // クリックイベントのシミュレーション
    // fakeTimers の下では userEvent ではなく fireEvent または直接 click の方が安全
    act(() => {
      button.click();
    });

    expect(onComplete).toHaveBeenCalled();
  });
});
