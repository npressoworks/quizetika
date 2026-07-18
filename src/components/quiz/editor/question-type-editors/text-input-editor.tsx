'use client';

import React from 'react';
import { AddOutlined, DeleteOutlineOutlined } from '@mui/icons-material';
import { getTextInputFieldProps, normalizeTextAnswer } from '@/services/text-answer-utils';
import { filterValidationErrors } from '@/services/quiz-validation';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import type { QuestionTypeEditorProps } from '@/components/quiz/editor/question-editor-types';

export function TextInputEditor({ qIdx, question, validationErrors, handlers }: QuestionTypeEditorProps) {
  if (!question.correctTextAnswerList) return null;

  const textInputMode = question.textInputMode ?? 'text';

  return (
    <div className={editorClasses.textAnswersContainer}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3 items-start">
        <div>
          <label className={editorClasses.label}>入力文字種</label>
          <div className={`${editorClasses.toggleGroup} mt-1 mb-0`}>
            {(
              [
                { id: 'free' as const, label: 'フリー' },
                { id: 'kanji' as const, label: '漢字' },
                { id: 'katakana' as const, label: 'カタカナ' },
                { id: 'alphabet' as const, label: 'アルファベット' },
                { id: 'numeric' as const, label: '数字' },
              ] as const
            ).map(({ id, label }) => (
              <button
                key={id}
                type="button"
                className={`${editorClasses.toggleBtn} ${textInputMode === id ? editorClasses.toggleBtnActive : ''}`}
                onClick={() => handlers.onTextInputModeChange(qIdx, id)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className={editorClasses.label}>要求文字数（1〜100文字・空欄で無制限）</label>
          <div className="mt-1 flex gap-2 items-stretch">
            <input
              type="number"
              className={`${editorClasses.input} ${
                filterValidationErrors(validationErrors, {
                  field: 'questions',
                  questionIndex: qIdx,
                  questionField: 'textInputCharCount',
                }).length > 0
                  ? editorClasses.inputError
                  : ''
              }`}
              min={1}
              max={100}
              value={question.textInputCharCount ?? ''}
              onChange={(e) => handlers.onTextInputCharCountChange(qIdx, e.target.value)}
              placeholder="例: 4 (空欄で制限なし)"
            />
            <button
              type="button"
              className="cursor-pointer rounded-md border border-input bg-background px-4 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed transition-colors whitespace-nowrap"
              onClick={() => handlers.onTextInputCharCountChange(qIdx, '')}
              disabled={question.textInputCharCount === undefined || question.textInputCharCount === null}
              title="文字数制限をクリア"
            >
              クリア
            </button>
          </div>
          <FieldValidationMessages
            errors={validationErrors}
            field="questions"
            questionIndex={qIdx}
            questionField="textInputCharCount"
          />
        </div>
      </div>

      <label className={editorClasses.label}>
        {textInputMode === 'numeric'
          ? '正解数値候補（複数設定可能）'
          : '正解テキスト候補（大文字・小文字表記揺れなど複数設定可能）'}
      </label>
      {question.correctTextAnswerList.map((ans, aIdx) => {
        const answerFieldProps = getTextInputFieldProps(question);
        const answerHasError =
          filterValidationErrors(validationErrors, {
            field: 'questions',
            questionIndex: qIdx,
            questionField: 'correctTextAnswer',
            answerIndex: aIdx,
          }).length > 0;

        return (
          <div key={aIdx}>
            <div className={editorClasses.textAnswerRow}>
              <input
                type={answerFieldProps.type}
                className={`${editorClasses.input} ${answerHasError ? editorClasses.inputError : ''}`}
                placeholder={answerFieldProps.placeholder}
                inputMode={answerFieldProps.inputMode}
                maxLength={answerFieldProps.maxLength}
                minLength={answerFieldProps.minLength}
                value={ans}
                onChange={(e) => handlers.onTextAnswerChange(qIdx, aIdx, e.target.value)}
                onBlur={(e) => handlers.onTextAnswerChange(qIdx, aIdx, normalizeTextAnswer(e.target.value))}
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
        );
      })}
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
