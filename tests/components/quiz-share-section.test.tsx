/**
 * @jest-environment jsdom
 */
import '@testing-library/jest-dom';
import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
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

  const openMenu = () => {
    fireEvent.click(screen.getByTestId('quiz-detail-share-trigger'));
  };

  it('renders the trigger with the E2E identification attribute and menu hidden initially', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    expect(screen.getByTestId('quiz-detail-share-trigger')).toBeInTheDocument();
    expect(screen.queryByTestId('quiz-detail-share-menu')).not.toBeInTheDocument();
  });

  it('opens the menu when the trigger is clicked', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);

    openMenu();

    expect(screen.getByTestId('quiz-detail-share-menu')).toBeInTheDocument();
  });

  it('renders X share link with correct href, target and rel', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    openMenu();

    const link = screen.getByTestId('quiz-detail-share-x');
    expect(link).toHaveAttribute('href', expect.stringContaining('twitter.com/intent/tweet'));
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders LINE share link with correct href, target and rel', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    openMenu();

    const link = screen.getByTestId('quiz-detail-share-line');
    expect(link).toHaveAttribute(
      'href',
      expect.stringContaining('social-plugins.line.me/lineit/share')
    );
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('copies the share URL to the clipboard, keeps the menu open with feedback, and closes it after 3 seconds', async () => {
    const writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
      writable: true,
    });

    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    openMenu();

    const copyItem = screen.getByTestId('quiz-detail-share-copy');
    await act(async () => {
      fireEvent.click(copyItem);
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalledWith(expect.stringContaining('/quiz/quiz-1'));
    expect(screen.getByText(/コピーしました/)).toBeInTheDocument();
    // メニューは開いたまま
    expect(screen.getByTestId('quiz-detail-share-menu')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(2999);
    });

    expect(screen.getByTestId('quiz-detail-share-menu')).toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });

    expect(screen.queryByTestId('quiz-detail-share-menu')).not.toBeInTheDocument();
  });

  it('does not call clipboard.writeText and never shows feedback when navigator.clipboard is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      value: undefined,
      configurable: true,
      writable: true,
    });

    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    openMenu();

    const copyItem = screen.getByTestId('quiz-detail-share-copy');
    await act(async () => {
      fireEvent.click(copyItem);
      await Promise.resolve();
    });

    expect(screen.queryByText(/コピーしました/)).not.toBeInTheDocument();

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.queryByText(/コピーしました/)).not.toBeInTheDocument();
  });

  it('closes the menu when clicking outside of it', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    openMenu();

    expect(screen.getByTestId('quiz-detail-share-menu')).toBeInTheDocument();

    act(() => {
      fireEvent.mouseDown(document.body);
    });

    expect(screen.queryByTestId('quiz-detail-share-menu')).not.toBeInTheDocument();
  });

  it('closes the menu when the Escape key is pressed', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    openMenu();

    expect(screen.getByTestId('quiz-detail-share-menu')).toBeInTheDocument();

    act(() => {
      fireEvent.keyDown(document, { key: 'Escape', code: 'Escape' });
    });

    expect(screen.queryByTestId('quiz-detail-share-menu')).not.toBeInTheDocument();
  });

  it('closes the menu when the trigger is clicked again while open', () => {
    render(<QuizShareSection quizId="quiz-1" quizTitle="テストクイズ" />);
    openMenu();

    expect(screen.getByTestId('quiz-detail-share-menu')).toBeInTheDocument();

    openMenu();

    expect(screen.queryByTestId('quiz-detail-share-menu')).not.toBeInTheDocument();
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
    openMenu();

    const copyItem = screen.getByTestId('quiz-detail-share-copy');
    await act(async () => {
      fireEvent.click(copyItem);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(writeText).toHaveBeenCalled();
    expect(screen.queryByText(/コピーしました/)).not.toBeInTheDocument();
  });
});
