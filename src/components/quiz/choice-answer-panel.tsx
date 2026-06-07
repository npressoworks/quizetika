'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { Question } from '@/types';
import {
  isMultiCorrectChoiceQuestion,
  parseChoiceAnswerIds,
  serializeChoiceAnswerIds,
} from '@/services/choice-answer-utils';
import styles from './choice-answer-panel.module.css';

type ChoiceAnswerPanelProps = {
  question: Question;
  onConfirm: (answer: string) => void;
  initialAnswer?: string;
  disabled?: boolean;
};

export function ChoiceAnswerPanel({
  question,
  onConfirm,
  initialAnswer = '',
  disabled = false,
}: ChoiceAnswerPanelProps) {
  const choices = question.choices ?? [];
  const multiSelect = isMultiCorrectChoiceQuestion(question);
  const inputType = multiSelect ? 'checkbox' : 'radio';

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    parseChoiceAnswerIds(initialAnswer)
  );

  useEffect(() => {
    setSelectedIds(parseChoiceAnswerIds(initialAnswer));
  }, [question.id, initialAnswer]);

  const name = useMemo(() => `choice-${question.id}`, [question.id]);

  const toggleChoice = (choiceId: string) => {
    if (disabled) return;
    if (multiSelect) {
      setSelectedIds((prev) =>
        prev.includes(choiceId) ? prev.filter((id) => id !== choiceId) : [...prev, choiceId]
      );
    } else {
      setSelectedIds([choiceId]);
    }
  };

  const handleConfirm = () => {
    if (disabled || selectedIds.length === 0) return;
    onConfirm(serializeChoiceAnswerIds(selectedIds));
  };

  return (
    <div className={styles.panel}>
      {multiSelect && (
        <p className={styles.hint}>
          正解は複数あります。該当する選択肢をすべて選んでから確定してください。
        </p>
      )}
      <div className={styles.optionsList} role={multiSelect ? 'group' : 'radiogroup'}>
        {choices.map((choice) => {
          const isSelected = selectedIds.includes(choice.id);
          return (
            <label
              key={choice.id}
              className={`${styles.optionCard} ${isSelected ? styles.optionSelected : ''} ${disabled ? styles.optionDisabled : ''}`}
            >
              <input
                type={inputType}
                className={styles.srOnly}
                name={name}
                value={choice.id}
                checked={isSelected}
                disabled={disabled}
                onChange={() => toggleChoice(choice.id)}
              />
              <span className={styles.control} aria-hidden>
                {multiSelect ? (
                  <span
                    className={`${styles.checkbox} ${isSelected ? styles.checkboxChecked : ''}`}
                  >
                    <Check className={styles.checkboxIcon} strokeWidth={3} />
                  </span>
                ) : (
                  <span className={`${styles.radio} ${isSelected ? styles.radioChecked : ''}`}>
                    <span className={styles.radioDot} />
                  </span>
                )}
              </span>
              <span className={styles.optionText}>{choice.choiceText}</span>
            </label>
          );
        })}
      </div>
      <button
        type="button"
        className={`btn btn-primary ${styles.confirmBtn}`}
        disabled={disabled || selectedIds.length === 0}
        onClick={handleConfirm}
        data-analytics="quiz-answer-confirm"
      >
        解答を確定する
      </button>
    </div>
  );
}
