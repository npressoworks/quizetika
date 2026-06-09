/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ThemeToggle } from '@/components/settings/theme-toggle';

const mockSetTheme = jest.fn();

jest.mock('@/context/theme-context', () => ({
  useTheme: () => ({ theme: 'dark', setTheme: mockSetTheme }),
}));

describe('ThemeToggle', () => {
  beforeEach(() => {
    mockSetTheme.mockClear();
  });

  test('ライト選択で setTheme が呼ばれる', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByRole('button', { name: 'ライト' }));
    expect(mockSetTheme).toHaveBeenCalledWith('light');
  });
});
