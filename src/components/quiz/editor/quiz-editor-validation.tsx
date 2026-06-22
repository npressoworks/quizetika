'use client';

import React from 'react';
import { WarningAmberOutlined } from '@mui/icons-material';
import {
  filterValidationErrors,
  formatValidationErrorSummary,
  type QuizPublishValidationError,
  type QuizValidationQuestionField,
} from '@/services/quiz-validation';
import type { Question } from '@/types';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';

export function scrollToFirstValidationError(errors: QuizPublishValidationError[]) {
  const first = errors[0];
  if (!first) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    return;
  }
  const targetId =
    first.field === 'title'
      ? 'field-title'
      : first.field === 'difficulty'
        ? 'field-difficulty'
        : first.field === 'genre'
          ? 'field-genre'
          : first.questionIndex != null
            ? `question-card-${first.questionIndex}`
            : first.field === 'questions'
              ? 'questions-section'
              : null;
  if (targetId) {
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

export const FieldValidationMessages: React.FC<{
  errors: QuizPublishValidationError[];
  field: QuizPublishValidationError['field'];
  questionIndex?: number;
  questionField?: QuizValidationQuestionField;
  answerIndex?: number;
  unscopedOnly?: boolean;
}> = ({ errors, field, questionIndex, questionField, answerIndex, unscopedOnly }) => {
  const matched = filterValidationErrors(errors, {
    field,
    questionIndex,
    questionField,
    answerIndex,
    unscopedOnly,
  });
  if (matched.length === 0) return null;
  return (
    <div className={editorClasses.fieldError} role="alert">
      {matched.map((err, i) => (
        <p key={i}>{err.message}</p>
      ))}
    </div>
  );
};

export const QuizEditorErrorSummary: React.FC<{
  errorText: string | null;
  validationErrors: QuizPublishValidationError[];
  questions: Question[];
}> = ({ errorText, validationErrors, questions }) => {
  if (!errorText && validationErrors.length === 0) return null;

  return (
    <Alert variant="destructive" className="mb-6">
      <WarningAmberOutlined />
      <AlertTitle>保存できませんでした。以下の項目をご確認ください：</AlertTitle>
      <AlertDescription>
        {errorText && <p className="mb-2.5 text-sm">{errorText}</p>}
        {validationErrors.length > 0 && (
          <ul className={editorClasses.errorList}>
            {validationErrors.map((err, i) => (
              <li key={i}>{formatValidationErrorSummary(err, { questions })}</li>
            ))}
          </ul>
        )}
      </AlertDescription>
    </Alert>
  );
};
