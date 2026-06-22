'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { CheckOutlined } from '@mui/icons-material';
import { Question } from '@/types';
import {
  isMultiCorrectChoiceQuestion,
  parseChoiceAnswerIds,
  serializeChoiceAnswerIds,
} from '@/services/choice-answer-utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type ChoiceAnswerPanelProps = {
  question: Question;
  onConfirm: (answer: string) => void;
  initialAnswer?: string;
  disabled?: boolean;
  onChoiceClick?: (choiceId: string) => void;
  onChoicesOrderResolved?: (order: string[]) => void;
};

const choiceCardClass =
  'flex cursor-pointer items-center gap-4 rounded-lg border border-border bg-card px-5 py-4 transition-colors hover:border-primary/50 hover:bg-muted/50 has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50';

export function ChoiceAnswerPanel({
  question,
  onConfirm,
  initialAnswer = '',
  disabled = false,
  onChoiceClick,
  onChoicesOrderResolved,
}: ChoiceAnswerPanelProps) {
  const choices = question.choices ?? [];
  const multiSelect = isMultiCorrectChoiceQuestion(question);

  const [selectedIds, setSelectedIds] = useState<string[]>(() =>
    parseChoiceAnswerIds(initialAnswer)
  );

  useEffect(() => {
    setSelectedIds(parseChoiceAnswerIds(initialAnswer));
  }, [question.id, initialAnswer]);

  useEffect(() => {
    if (onChoicesOrderResolved) {
      onChoicesOrderResolved(choices.map((c) => c.id));
    }
  }, [question.id, choices, onChoicesOrderResolved]);

  const name = useMemo(() => `choice-${question.id}`, [question.id]);

  const toggleChoice = (choiceId: string) => {
    if (disabled) return;
    if (onChoiceClick) {
      onChoiceClick(choiceId);
    }
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
    <div className="mt-4">
      {multiSelect && (
        <p className="mb-3.5 text-sm leading-relaxed text-muted-foreground">
          正解は複数あります。該当する選択肢をすべて選んでから確定してください。
        </p>
      )}

      {multiSelect ? (
        <div className="flex flex-col gap-3" role="group">
          {choices.map((choice) => {
            const isSelected = selectedIds.includes(choice.id);
            const inputId = `${name}-${choice.id}`;
            return (
              <Label
                key={choice.id}
                htmlFor={inputId}
                className={cn(
                  choiceCardClass,
                  isSelected && 'border-primary bg-primary/5',
                  disabled && 'pointer-events-none opacity-55'
                )}
              >
                <input
                  type="checkbox"
                  id={inputId}
                  className="sr-only"
                  name={name}
                  value={choice.id}
                  checked={isSelected}
                  disabled={disabled}
                  onChange={() => toggleChoice(choice.id)}
                />
                <span
                  className={cn(
                    'flex size-[22px] shrink-0 items-center justify-center rounded-md border-2 border-input transition-colors',
                    isSelected && 'border-primary bg-primary text-primary-foreground'
                  )}
                  aria-hidden
                >
                  <CheckOutlined
                    className={cn('size-3.5 transition-transform', isSelected ? 'scale-100 opacity-100' : 'scale-75 opacity-0')}
                  />
                </span>
                <span className="flex-1 text-base font-medium leading-snug text-foreground">
                  {choice.choiceText}
                </span>
              </Label>
            );
          })}
        </div>
      ) : (
        <RadioGroup
          value={selectedIds[0] ?? ''}
          onValueChange={(value) => {
            if (!disabled && value) {
              if (onChoiceClick) {
                onChoiceClick(value);
              }
              setSelectedIds([value]);
            }
          }}
          disabled={disabled}
          className="flex flex-col gap-3"
        >
          {choices.map((choice) => {
            const isSelected = selectedIds.includes(choice.id);
            const inputId = `${name}-${choice.id}`;
            return (
              <Label
                key={choice.id}
                htmlFor={inputId}
                className={cn(
                  choiceCardClass,
                  isSelected && 'border-primary bg-primary/5',
                  disabled && 'pointer-events-none opacity-55'
                )}
              >
                <RadioGroupItem value={choice.id} id={inputId} disabled={disabled} />
                <span className="flex-1 text-base font-medium leading-snug text-foreground">
                  {choice.choiceText}
                </span>
              </Label>
            );
          })}
        </RadioGroup>
      )}

      <Button
        type="button"
        className="mt-5 h-11 w-full"
        disabled={disabled || selectedIds.length === 0}
        onClick={handleConfirm}
        data-analytics="quiz-answer-confirm"
      >
        解答を確定する
      </Button>
    </div>
  );
}
