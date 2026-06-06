/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { FormatCarousel } from '@/components/explore/format-carousel';
import { EXPLORE_FORMAT_OPTIONS } from '@/lib/explore-formats';

describe('FormatCarousel', () => {
  it('7種の形式カードを表示する', () => {
    render(<FormatCarousel selectedFormat="" onSelect={jest.fn()} />);
    expect(screen.getByTestId('format-carousel')).toBeInTheDocument();
    expect(EXPLORE_FORMAT_OPTIONS).toHaveLength(7);
    for (const option of EXPLORE_FORMAT_OPTIONS) {
      expect(screen.getByTestId(`format-carousel-card-${option.id}`)).toBeInTheDocument();
    }
  });

  it('形式選択で onSelect が呼ばれる', () => {
    const onSelect = jest.fn();
    render(<FormatCarousel selectedFormat="" onSelect={onSelect} />);

    fireEvent.click(screen.getByTestId('format-carousel-card-multiple-choice'));
    expect(onSelect).toHaveBeenCalledWith('multiple-choice');
  });

  it('選択済み形式を再クリックすると解除される', () => {
    const onSelect = jest.fn();
    render(
      <FormatCarousel selectedFormat="multiple-choice" onSelect={onSelect} />
    );
    fireEvent.click(screen.getByTestId('format-carousel-card-multiple-choice'));
    expect(onSelect).toHaveBeenCalledWith('');
  });
});
