/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render } from '@testing-library/react';
import { AutoGrowTextarea } from '@/components/ui/auto-grow-textarea';

describe('AutoGrowTextarea', () => {
  it('複数行 value で scrollHeight に応じた高さを設定する', () => {
    const longValue = '行1\n行2\n行3\n行4';
    const { container, rerender } = render(
      <AutoGrowTextarea value="" onChange={() => {}} data-testid="auto-grow" minRows={2} />
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get() {
        return 120;
      },
    });
    rerender(
      <AutoGrowTextarea
        value={longValue}
        onChange={() => {}}
        data-testid="auto-grow"
        minRows={2}
      />
    );
    expect(textarea.style.height).toBe('120px');
  });

  it('minRows 未満の内容でも最小高さを維持する', () => {
    const { container, rerender } = render(
      <AutoGrowTextarea value="" onChange={() => {}} minRows={3} />
    );
    const textarea = container.querySelector('textarea') as HTMLTextAreaElement;
    Object.defineProperty(textarea, 'scrollHeight', {
      configurable: true,
      get() {
        return 10;
      },
    });
    rerender(<AutoGrowTextarea value="短い" onChange={() => {}} minRows={3} />);
    expect(textarea.style.height).toBe('72px');
  });
});
