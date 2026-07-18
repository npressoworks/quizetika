/** @jest-environment jsdom */
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { useDashboardFilters } from '../../src/app/creator/dashboard/use-dashboard-filters';
import { DashboardFilterBar } from '../../src/app/creator/dashboard/dashboard-filter-bar';

// useActiveGenres のモック
jest.mock('@/hooks/useActiveGenres', () => ({
  useActiveGenres: () => ({
    genres: [
      { id: 'genre-1', displayName: 'ジャンル1' },
      { id: 'genre-2', displayName: 'ジャンル2' },
    ],
    loading: false,
    error: null,
  }),
}));

// shadcn Select のモック
jest.mock('@/components/ui/select', () => {
  return {
    Select: ({ children, value, onValueChange }: any) => (
      <select data-testid="mock-select" value={value} onChange={(e) => onValueChange(e.target.value)}>
        {children}
      </select>
    ),
    SelectTrigger: ({ children }: any) => <>{children}</>,
    SelectValue: ({ placeholder }: any) => <>{placeholder}</>,
    SelectContent: ({ children }: any) => <>{children}</>,
    SelectItem: ({ children, value }: any) => <option value={value}>{children}</option>,
  };
});

describe('useDashboardFilters Hook', () => {
  function TestComponent({ initialPeriod }: { initialPeriod?: any }) {
    const { filters, setPeriod, setGenreId, reset } = useDashboardFilters(initialPeriod);
    return (
      <div>
        <span data-testid="period">{filters.period}</span>
        <span data-testid="genreId">{filters.genreId || 'none'}</span>
        <button data-testid="btn-period" onClick={() => setPeriod('7d')}>Set 7d</button>
        <button data-testid="btn-genre" onClick={() => setGenreId('genre-1')}>Set Genre</button>
        <button data-testid="btn-reset" onClick={reset}>Reset</button>
      </div>
    );
  }

  test('初期値が 30d であり、Setterが正しく動くこと', () => {
    render(<TestComponent />);
    expect(screen.getByTestId('period').textContent).toBe('30d');
    expect(screen.getByTestId('genreId').textContent).toBe('none');

    fireEvent.click(screen.getByTestId('btn-period'));
    expect(screen.getByTestId('period').textContent).toBe('7d');

    fireEvent.click(screen.getByTestId('btn-genre'));
    expect(screen.getByTestId('genreId').textContent).toBe('genre-1');

    fireEvent.click(screen.getByTestId('btn-reset'));
    expect(screen.getByTestId('period').textContent).toBe('30d');
    expect(screen.getByTestId('genreId').textContent).toBe('none');
  });
});

describe('DashboardFilterBar Component', () => {
  test('プレイヤー向けフィルタが正しく表示され、セレクト値変更で onChange が呼ばれること', () => {
    const onChange = jest.fn();
    const onReset = jest.fn();
    const filters = { period: '30d' as const };

    render(
      <DashboardFilterBar
        filters={filters}
        onChange={onChange}
        onReset={onReset}
        type="player"
      />
    );

    const selects = screen.getAllByTestId('mock-select');
    // Select の1番目は period (期間)
    fireEvent.change(selects[0], {
      target: { value: '7d' },
    });
    expect(onChange).toHaveBeenCalledWith({ period: '7d' });
  });

  test('タグ入力欄に文字を入力した際、300msデバウンスの後に onChange が呼ばれること', async () => {
    jest.useFakeTimers();
    const onChange = jest.fn();
    const onReset = jest.fn();
    const filters = { period: '30d' as const };

    render(
      <DashboardFilterBar
        filters={filters}
        onChange={onChange}
        onReset={onReset}
        type="player"
      />
    );

    const input = screen.getByTestId('filter-tag-input');
    fireEvent.change(input, { target: { value: 'typescript' } });

    expect(onChange).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(300);
    });

    expect(onChange).toHaveBeenCalledWith({ period: '30d', tag: 'typescript' });
    jest.useRealTimers();
  });
});
