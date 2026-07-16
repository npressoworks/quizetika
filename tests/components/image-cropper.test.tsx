/**
 * @jest-environment jsdom
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';
import { calculateTargetDimensions, ImageCropper } from '@/components/ui/image-cropper';

// react-easy-crop はブラウザ実測（ResizeObserver 等）に依存するため、
// ImageCropper 自身のロジック検証に必要な最小限のスタブに差し替える。
// mockCapturedCropperProps は Cropper へ実際に渡された Props を検証するために記録する
// （jest.mock ファクトリ内から参照するため babel-plugin-jest-hoist の制約上 "mock" 接頭辞が必要）。
let mockCapturedCropperProps: any = null;

jest.mock('react-easy-crop', () => {
  const ReactActual = jest.requireActual('react');
  return {
    __esModule: true,
    default: function MockCropper(props: any) {
      mockCapturedCropperProps = props;
      ReactActual.useEffect(() => {
        props.onMediaLoaded?.({ width: 400, height: 400 });
        props.onCropComplete?.(
          { x: 0, y: 0, width: 100, height: 100 },
          { x: 0, y: 0, width: 100, height: 100 }
        );
      }, []);
      return null;
    },
  };
});

describe('calculateTargetDimensions', () => {
  test('解像度が制限範囲内（FHD以下）の場合はサイズを変更しないこと', () => {
    const size = { width: 800, height: 419 }; // 1.91:1 (800 / 1.91 = 418.8...)
    const result = calculateTargetDimensions(size.width, size.height);
    expect(result.width).toBe(800);
    expect(result.height).toBe(419);
  });

  test('幅が1920を超える場合、1.91:1のアスペクト比を維持して幅1920に縮小されること', () => {
    const size = { width: 3000, height: 1571 }; // 3000 / 1.91 = 1570.6...
    const result = calculateTargetDimensions(size.width, size.height);
    expect(result.width).toBe(1920);
    expect(result.height).toBe(1005); // 1920 / 1.91 = 1005.2...
  });

  test('高さが1005を超える場合、1.91:1のアスペクト比を維持して高さ1005に縮小されること', () => {
    const size = { width: 2100, height: 1100 }; // 2100 / 1100 = 1.909...
    const result = calculateTargetDimensions(size.width, size.height);
    // 高さが1005に制限され、幅はアスペクト比を保って1920に変換される
    expect(result.height).toBe(1005);
    expect(result.width).toBe(1920); // 1005 * 1.91 = 1919.55 -> 1920
  });

  test('aspect引数に1（正方形）とmaxWidth/maxHeight=512を指定した場合、512px上限で正方形に縮小されること', () => {
    const size = { width: 1000, height: 1000 };
    const result = calculateTargetDimensions(size.width, size.height, 1, 512, 512);
    expect(result.width).toBe(512);
    expect(result.height).toBe(512);
  });
});

describe('ImageCropper Component', () => {
  const baseProps = {
    imageSrc: 'data:image/png;base64,dummy',
    isOpen: true,
    onClose: jest.fn(),
    onCropComplete: jest.fn(),
  };

  let toBlobMock: jest.Mock;
  let toBlobShouldFail: boolean;
  let capturedQuality: number | undefined;
  let originalImage: typeof Image;
  let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;
  let originalToBlob: typeof HTMLCanvasElement.prototype.toBlob;

  beforeAll(() => {
    originalImage = global.Image;
    originalGetContext = HTMLCanvasElement.prototype.getContext;
    originalToBlob = HTMLCanvasElement.prototype.toBlob;

    // jsdom は実際の画像デコードを行わないため、src 設定後に load を即発火させるスタブに差し替える
    class MockImage {
      private listeners: Record<string, Array<() => void>> = {};
      addEventListener(event: string, cb: () => void) {
        this.listeners[event] = this.listeners[event] || [];
        this.listeners[event].push(cb);
      }
      removeEventListener() {}
      setAttribute() {}
      set src(_value: string) {
        setTimeout(() => {
          (this.listeners['load'] || []).forEach((cb) => cb());
        }, 0);
      }
    }
    // @ts-expect-error テスト用に Image をスタブに差し替える
    global.Image = MockImage;

    // jsdom は canvas 描画を実装していないため、Canvas 2D コンテキストをスタブ化する
    HTMLCanvasElement.prototype.getContext = jest.fn(() => {
      return { drawImage: jest.fn() } as unknown as CanvasRenderingContext2D;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;
  });

  afterAll(() => {
    global.Image = originalImage;
    HTMLCanvasElement.prototype.getContext = originalGetContext;
    HTMLCanvasElement.prototype.toBlob = originalToBlob;
  });

  beforeEach(() => {
    toBlobShouldFail = false;
    capturedQuality = undefined;
    mockCapturedCropperProps = null;
    toBlobMock = jest.fn(function (
      this: HTMLCanvasElement,
      callback: (blob: Blob | null) => void,
      type?: string,
      quality?: number
    ) {
      capturedQuality = quality;
      if (toBlobShouldFail) {
        callback(null);
      } else {
        callback(new Blob(['dummy'], { type }));
      }
    });
    HTMLCanvasElement.prototype.toBlob = toBlobMock as unknown as typeof HTMLCanvasElement.prototype.toBlob;
    jest.spyOn(window, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  test('confirmTestId/cancelTestId 未指定時は既定の data-testid が使われること', () => {
    render(<ImageCropper {...baseProps} onCropComplete={jest.fn()} onClose={jest.fn()} />);
    expect(screen.getByTestId('image-cropper-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('image-cropper-cancel')).toBeInTheDocument();
  });

  test('confirmTestId/cancelTestId を指定した場合、その値が data-testid に反映されること', () => {
    render(
      <ImageCropper
        {...baseProps}
        onCropComplete={jest.fn()}
        onClose={jest.fn()}
        confirmTestId="custom-confirm"
        cancelTestId="custom-cancel"
      />
    );
    expect(screen.getByTestId('custom-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('custom-cancel')).toBeInTheDocument();
    expect(screen.queryByTestId('image-cropper-confirm')).not.toBeInTheDocument();
    expect(screen.queryByTestId('image-cropper-cancel')).not.toBeInTheDocument();
  });

  test('aspect={1} cropShape="round" を指定した場合、react-easy-crop の Cropper へ実際に aspect=1 cropShape="round" が渡り、指定した data-testid が反映されること', () => {
    render(
      <ImageCropper
        {...baseProps}
        onCropComplete={jest.fn()}
        onClose={jest.fn()}
        aspect={1}
        cropShape="round"
        confirmTestId="profile-avatar-crop-confirm"
        cancelTestId="profile-avatar-crop-cancel"
      />
    );

    expect(mockCapturedCropperProps).not.toBeNull();
    expect(mockCapturedCropperProps.aspect).toBe(1);
    expect(mockCapturedCropperProps.cropShape).toBe('round');
    expect(screen.getByTestId('profile-avatar-crop-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('profile-avatar-crop-cancel')).toBeInTheDocument();
  });

  test('aspect/cropShape 未指定時（クイズ用途）は Cropper へ既定値 aspect=1.91 cropShape="rect" が渡ること', () => {
    render(<ImageCropper {...baseProps} onCropComplete={jest.fn()} onClose={jest.fn()} />);

    expect(mockCapturedCropperProps).not.toBeNull();
    expect(mockCapturedCropperProps.aspect).toBe(1.91);
    expect(mockCapturedCropperProps.cropShape).toBe('rect');
    expect(screen.getByTestId('image-cropper-confirm')).toBeInTheDocument();
    expect(screen.getByTestId('image-cropper-cancel')).toBeInTheDocument();
  });

  test('quality Prop が canvas.toBlob の第3引数に反映されること', async () => {
    render(
      <ImageCropper {...baseProps} onCropComplete={jest.fn()} onClose={jest.fn()} quality={0.5} />
    );
    fireEvent.click(screen.getByTestId('image-cropper-confirm'));

    await waitFor(() => expect(toBlobMock).toHaveBeenCalled());
    expect(capturedQuality).toBe(0.5);
  });

  test('onError 未指定時、切り抜き失敗時に alert() が呼ばれること', async () => {
    toBlobShouldFail = true;
    render(<ImageCropper {...baseProps} onCropComplete={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByTestId('image-cropper-confirm'));

    await waitFor(() => expect(window.alert).toHaveBeenCalled());
    expect(window.alert).toHaveBeenCalledWith(
      '画像のトリミングに失敗しました。ファイル破損などの可能性があります。'
    );
  });

  test('onError 指定時、切り抜き失敗時は alert() が呼ばれずコールバックにメッセージが渡ること', async () => {
    toBlobShouldFail = true;
    const onError = jest.fn();
    const onClose = jest.fn();
    render(
      <ImageCropper {...baseProps} onCropComplete={jest.fn()} onClose={onClose} onError={onError} />
    );
    fireEvent.click(screen.getByTestId('image-cropper-confirm'));

    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onError).toHaveBeenCalledWith(
      '画像のトリミングに失敗しました。ファイル破損などの可能性があります。'
    );
    expect(window.alert).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });
});
