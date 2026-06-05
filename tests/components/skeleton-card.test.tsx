/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SkeletonCard } from '@/components/ui/skeleton-card';

describe('SkeletonCard', () => {
  it('スケルトンカードが正常にレンダリングされ、data-testid を持つこと', () => {
    render(<SkeletonCard />);
    expect(screen.getByTestId('skeleton-card')).toBeInTheDocument();
  });
});
