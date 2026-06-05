'use client';

import React from 'react';
import type { QuizListType } from '@/types';

export interface ListTypeSelectorProps {
  value: QuizListType;
  onChange: (value: QuizListType) => void;
  disabled?: boolean;
}

export function ListTypeSelector({ value, onChange, disabled = false }: ListTypeSelectorProps) {
  return (
    <div data-testid="list-type-selector" role="radiogroup" aria-label="リスト種別">
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, cursor: disabled ? 'default' : 'pointer' }}>
        <input
          type="radio"
          name="list-type"
          data-testid="list-type-quiz"
          value="quiz"
          checked={value === 'quiz'}
          onChange={() => onChange('quiz')}
          disabled={disabled}
        />
        <span>クイズリスト（収録単位: クイズ）</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: disabled ? 'default' : 'pointer' }}>
        <input
          type="radio"
          name="list-type"
          data-testid="list-type-question"
          value="question"
          checked={value === 'question'}
          onChange={() => onChange('question')}
          disabled={disabled}
        />
        <span>設問リスト（収録単位: 設問）</span>
      </label>
      {disabled && (
        <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: 8 }}>
          作成後のリスト種別は変更できません。
        </p>
      )}
    </div>
  );
}
