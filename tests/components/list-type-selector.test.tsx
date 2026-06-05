/**
 * @jest-environment jsdom
 */

import '@testing-library/jest-dom';
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { ListTypeSelector } from '@/components/quiz-list/list-type-selector';

describe('ListTypeSelector', () => {
  it('新規作成時に quiz / question を選択できる', () => {
    const onChange = jest.fn();
    render(<ListTypeSelector value="quiz" onChange={onChange} />);
    fireEvent.click(screen.getByTestId('list-type-question'));
    expect(onChange).toHaveBeenCalledWith('question');
  });

  it('disabled 時はラジオが無効', () => {
    const onChange = jest.fn();
    render(<ListTypeSelector value="question" onChange={onChange} disabled />);
    expect(screen.getByTestId('list-type-quiz')).toBeDisabled();
    expect(screen.getByTestId('list-type-question')).toBeDisabled();
    expect(screen.getByText(/作成後のリスト種別は変更できません/)).toBeInTheDocument();
  });
});
