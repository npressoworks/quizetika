'use client';

import React from 'react';
import { AddOutlined, DeleteOutlineOutlined } from '@mui/icons-material';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import type { QuestionTypeEditorProps } from '@/components/quiz/editor/question-editor-types';

export function QuickPressEditor({ qIdx, question, validationErrors, handlers }: QuestionTypeEditorProps) {
  if (!question.correctTextAnswerList) return null;

  return (
    <div className={editorClasses.textAnswersContainer}>
      <label className={editorClasses.label}>
        正解テキスト候補（大文字・小文字表記揺れなど複数設定可能）
      </label>
      {question.correctTextAnswerList.map((ans, aIdx) => (
        <div key={aIdx}>
          <div className={editorClasses.textAnswerRow}>
            <input
              type="text"
              className={editorClasses.input}
              placeholder="例: 富士山"
              value={ans}
              onChange={(e) => handlers.onTextAnswerChange(qIdx, aIdx, e.target.value)}
            />
            <button
              type="button"
              className={editorClasses.removeQuestionBtn}
              onClick={() => handlers.onRemoveTextAnswer(qIdx, aIdx)}
              title="この正解を削除"
            >
              <DeleteOutlineOutlined sx={{ fontSize: 16 }} />
            </button>
          </div>
          <FieldValidationMessages
            errors={validationErrors}
            field="questions"
            questionIndex={qIdx}
            questionField="correctTextAnswer"
            answerIndex={aIdx}
          />
        </div>
      ))}
      <button type="button" className={editorClasses.addTextAnswerBtn} onClick={() => handlers.onAddTextAnswer(qIdx)}>
        <AddOutlined sx={{ fontSize: 14 }} /> 正解候補を追加する
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
