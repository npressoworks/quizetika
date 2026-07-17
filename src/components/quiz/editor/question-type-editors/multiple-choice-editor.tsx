'use client';

import React from 'react';
import { AddOutlined, DeleteOutlineOutlined } from '@mui/icons-material';
import { filterValidationErrors } from '@/services/quiz-validation';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import {
  MAX_MULTIPLE_CHOICE_COUNT,
  MIN_MULTIPLE_CHOICE_COUNT,
} from '@/services/quiz-choice-utils';
import type { QuestionTypeEditorProps } from '@/components/quiz/editor/question-editor-types';

export function MultipleChoiceEditor({ qIdx, question, validationErrors, handlers }: QuestionTypeEditorProps) {
  if (!question.choices) return null;

  const hasAnswersError =
    filterValidationErrors(validationErrors, {
      field: 'questions',
      questionIndex: qIdx,
      questionField: 'answers',
    }).length > 0;

  return (
    <div className={editorClasses.choicesList}>
      <label className={editorClasses.label}>
        選択肢と正解設定（正解となる選択肢にすべてチェック。{MIN_MULTIPLE_CHOICE_COUNT}〜
        {MAX_MULTIPLE_CHOICE_COUNT}択・複数正解可）
      </label>
      {question.choices.map((choice, cIdx) => (
        <div key={choice.id || cIdx} className={editorClasses.choiceRow}>
          <input
            type="checkbox"
            className={`${editorClasses.choiceCheckbox} ${hasAnswersError ? editorClasses.inputError : ''}`}
            checked={choice.isCorrect}
            onChange={() => handlers.onChoiceCorrectToggle(qIdx, cIdx)}
          />
          <input
            type="text"
            className={editorClasses.input}
            placeholder={
              cIdx === 0
                ? '例: 富士山 (正解の例)'
                : cIdx === 1
                  ? '例: 北岳'
                  : cIdx === 2
                    ? '例: 奥穂高岳'
                    : '例: 選択肢を入力'
            }
            value={choice.choiceText}
            onChange={(e) => handlers.onChoiceTextChange(qIdx, cIdx, e.target.value)}
          />
          <button
            type="button"
            className={editorClasses.removeQuestionBtn}
            onClick={() => handlers.onRemoveChoice(qIdx, cIdx)}
            title="この選択肢を削除"
          >
            <DeleteOutlineOutlined sx={{ fontSize: 16 }} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`mt-1.5 inline-flex items-center gap-1.5 text-sm font-medium transition-colors ${
          question.choices.length >= MAX_MULTIPLE_CHOICE_COUNT
            ? 'text-muted-foreground opacity-50 cursor-not-allowed'
            : 'text-primary hover:text-primary/80 cursor-pointer'
        }`}
        onClick={() => handlers.onAddChoice(qIdx)}
        disabled={question.choices.length >= MAX_MULTIPLE_CHOICE_COUNT}
      >
        <AddOutlined sx={{ fontSize: 14 }} />{' '}
        {question.choices.length >= MAX_MULTIPLE_CHOICE_COUNT
          ? `選択肢は${MAX_MULTIPLE_CHOICE_COUNT}個が上限です`
          : '選択肢を追加する'}
      </button>
      <FieldValidationMessages
        errors={validationErrors}
        field="questions"
        questionIndex={qIdx}
        questionField="answers"
      />
    </div>
  );
}
