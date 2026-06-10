/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { HorizontalScrollCarousel } from '@/components/explore/horizontal-scroll-carousel';

describe('HorizontalScrollCarousel', () => {
  it('data-testid を転送し scroll-snap クラスを適用する', () => {
    render(
      <HorizontalScrollCarousel data-testid="test-carousel">
        <div>item</div>
      </HorizontalScrollCarousel>
    );

    const carousel = screen.getByTestId('test-carousel');
    expect(carousel).toBeInTheDocument();
    expect(carousel).toHaveClass('snap-x');
    expect(carousel).toHaveClass('snap-mandatory');
    expect(carousel).toHaveClass('overflow-x-auto');
    expect(carousel).toHaveClass('horizontal-scroll-carousel');
  });
});
