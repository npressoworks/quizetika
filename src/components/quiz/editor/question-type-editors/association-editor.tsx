'use client';

import React from 'react';
import { AddOutlined, DeleteOutlineOutlined } from '@mui/icons-material';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import type { QuestionTypeEditorProps } from '@/components/quiz/editor/question-editor-types';

export function AssociationEditor({ qIdx, question, validationErrors, handlers }: QuestionTypeEditorProps) {
  if (!question.associationHints) return null;

  return (
    <div className={editorClasses.choicesList}>
      <label className={editorClasses.label}>
        段階的連想ヒント（ヒント1から順にプレイヤーに開示されます。1〜5ヒント）
      </label>
      {question.associationHints.map((hint, hIdx) => (
        <div key={hIdx} className={editorClasses.choiceRow}>
          <span className="min-w-[60px] text-sm text-muted-foreground">ヒント {hIdx + 1}</span>
          <input
            type="text"
            className={editorClasses.input}
            placeholder={
              hIdx === 0
                ? '例: 日本の昔話の主人公です'
                : hIdx === 1
                  ? '例: 桃から生まれました'
                  : hIdx === 2
                    ? '例: きびだんごで動物をお供にします'
                    : `例: ヒント ${hIdx + 1} の内容`
            }
            value={hint}
            onChange={(e) => handlers.onAssociationHintTextChange(qIdx, hIdx, e.target.value)}
          />
          <button
            type="button"
            className={editorClasses.removeQuestionBtn}
            onClick={() => handlers.onRemoveAssociationHint(qIdx, hIdx)}
            title="このヒントを削除"
          >
            <DeleteOutlineOutlined sx={{ fontSize: 18 }} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className={`${editorClasses.addTextAnswerBtn} mt-2 mb-4`}
        onClick={() => handlers.onAddAssociationHint(qIdx)}
      >
        <AddOutlined sx={{ fontSize: 14 }} /> ヒントを追加する
      </button>
      <FieldValidationMessages
        errors={validationErrors}
        field="questions"
        questionIndex={qIdx}
        questionField="associationHints"
      />

      {question.correctTextAnswerList && (
        <div className={`${editorClasses.textAnswersContainer} mt-4 border-t border-dashed border-border pt-4`}>
          <label className={editorClasses.label}>
            正解テキスト候補（大文字・小文字表記揺れなど複数設定可能）
          </label>
          {question.correctTextAnswerList.map((ans, aIdx) => (
            <div key={aIdx} className={editorClasses.textAnswerRow}>
              <input
                type="text"
                className={editorClasses.input}
                placeholder="例: 桃太郎"
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
      )}
    </div>
  );
}
