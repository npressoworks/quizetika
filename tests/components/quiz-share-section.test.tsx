/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { QuizShareSection } from '@/components/quiz/quiz-share-section';

describe('QuizShareSection', () => {
  const originalClipboard = navigator.clipboard;

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    Object.defineProperty(navigator, 'clipboard', {
      value: originalClipboard,
      configurable: true,
      writable: true,
    });
    jest.restoreAllMocks();
  });

  it('renders the container with the E2E identification attribute', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    expect(screen.getByTestId('quiz-detail-share-section')).toBeInTheDocument();
  });

  it('renders X share link with correct href, target and rel', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    const link = screen.getByRole('link', { name: /X/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('twitter.com/intent/tweet'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders LINE share link with correct href, target and rel', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    const link = screen.getByRole('link', { name: /LINE/i });
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('social-plugins.line.me/lineit/share')
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('copies the share URL to the clipboard, shows feedback, and hides it after 3 seconds', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    const copyButton = screen.getByRole('button', { name: /コピー/ });

    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/quiz/quiz-1'));
    expect(screen.getByText(/コピーしました/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2999);
    });

    expect(screen.getByText(/コピーしました/)).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(screen.queryByText(/コピーしました/)).not.toBeInTheDocument();
  });

  it('does not call clipboard.writeText and never shows feedback when navigator.clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    const copyButton = screen.getByRole('button', { name: /コピー/ });

    await act(async () => {
      copyButton.click();
      await Promise.resolve();
    });

    expect(screen.queryByText(/コピーしました/)).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.queryByText(/コピーしました/)).not.toBeInTheDocument();
  });

  it('does not show the copy feedback when clipboard.writeText rejects', async () => {
    const writeText = jest.fn().mockRejectedValue(new Error('denied'));
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });
    jest.spyOn(console, 'error').mockImplementation(() => {});

    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    const copyButton = screen.getByRole('button', { name: /コピー/ });

    await act(async () => {
      copyButton.click();
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalled();
    expect(screen.queryByText(/コピーしました/)).not.toBeInTheDocument();
  });
});
