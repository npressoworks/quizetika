/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { HorizontalScrollCarousel } from '@/components/explore/horizontal-scroll-carousel';

describe('HorizontalScrollCarousel', () => {
  it('forwards data-testid to the scroll container', () => {
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

  it('merges custom className with scroll classes', () => {
    render(
      <HorizontalScrollCarousel data-testid="custom-carousel" className="pt-3">
        <div>item</div>
      </HorizontalScrollCarousel>
    );

    const carousel = screen.getByTestId('custom-carousel');
    expect(carousel).toHaveClass('pt-3');
    expect(carousel).toHaveClass('flex');
  });
});
