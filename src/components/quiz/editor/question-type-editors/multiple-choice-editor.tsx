'use client';

import React from 'react';
import { AddOutlined, DeleteOutlineOutlined } from '@mui/icons-material';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import {
  MAX_MULTIPLE_CHOICE_COUNT,
  MIN_MULTIPLE_CHOICE_COUNT,
} from '@/services/quiz-choice-utils';
import type { QuestionTypeEditorProps } from '@/components/quiz/editor/question-editor-types';

export function MultipleChoiceEditor({ qIdx, question, validationErrors, handlers }: QuestionTypeEditorProps) {
  if (!question.choices) return null;

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
            className={editorClasses.choiceCheckbox}
            checked={choice.isCorrect}
            onChange={() => handlers.onChoiceCorrectToggle(qIdx, cIdx)}
          />
          <input
            type="text"
            className={editorClasses.input}
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
        className={editorClasses.addTextAnswerBtn}
        onClick={() => handlers.onAddChoice(qIdx)}
        disabled={question.choices.length >= MAX_MULTIPLE_CHOICE_COUNT}
      >
        <AddOutlined sx={{ fontSize: 14 }} /> 選択肢を追加する
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
