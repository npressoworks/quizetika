/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StatsSkeleton } from '@/components/charts/stats-skeleton';
import { ChartsSkeleton } from '@/components/charts/charts-skeleton';
import { QuizListSkeleton } from '@/components/quiz/quiz-list-skeleton';
import { FeedbackSkeleton } from '@/components/quiz/feedback-skeleton';
import { EditorFormSkeleton } from '@/components/quiz/editor-skeleton';

describe('Creator dashboard skeleton components', () => {
  it('StatsSkeleton は既定 testid を付与する', () => {
    render(<StatsSkeleton />);
    expect(screen.getByTestId('stats-skeleton')).toBeInTheDocument();
  });

  it('ChartsSkeleton は既定 testid を付与する', () => {
    render(<ChartsSkeleton />);
    expect(screen.getByTestId('charts-skeleton')).toBeInTheDocument();
  });

  it('QuizListSkeleton は既定 testid を付与する', () => {
    render(<QuizListSkeleton />);
    expect(screen.getByTestId('quiz-list-skeleton')).toBeInTheDocument();
  });

  it('FeedbackSkeleton は既定 testid を付与する', () => {
    render(<FeedbackSkeleton />);
    expect(screen.getByTestId('feedback-list-skeleton')).toBeInTheDocument();
  });

  it('EditorFormSkeleton は既定 testid を付与する', () => {
    render(<EditorFormSkeleton />);
    expect(screen.getByTestId('quiz-editor-skeleton')).toBeInTheDocument();
  });
});
