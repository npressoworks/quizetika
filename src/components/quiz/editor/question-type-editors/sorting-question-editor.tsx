'use client';

import React from 'react';
import { AddOutlined, DeleteOutlineOutlined } from '@mui/icons-material';
import { SortableSortingList } from '@/components/sorting/sortable-sorting-list';
import { FieldValidationMessages } from '@/components/quiz/editor/quiz-editor-validation';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';
import type { QuestionTypeEditorProps } from '@/components/quiz/editor/question-editor-types';

export function SortingQuestionEditor({ qIdx, question, validationErrors, handlers }: QuestionTypeEditorProps) {
  if (!question.sortingItems) return null;

  return (
    <div className={editorClasses.choicesList}>
      <label className={editorClasses.label}>
        並び替え要素（ドラッグで上から正しい順序に並べてください。2〜6要素）
      </label>
      <SortableSortingList
        items={question.sortingItems}
        showIndex={false}
        onReorder={(reordered) => handlers.onSortingItemsReorder(qIdx, reordered)}
        renderItemContent={(item) => {
          const itemIdx = question.sortingItems!.findIndex((s) => s.id === item.id);
          return (
            <div className={editorClasses.choiceRow}>
              <input
                type="text"
                className={editorClasses.input}
                placeholder={
                  itemIdx === 0
                    ? '例: 本能寺の変 (古い順の例)'
                    : itemIdx === 1
                      ? '例: 関ヶ原の戦い'
                      : itemIdx === 2
                        ? '例: 大坂の陣'
                        : '例: 要素を入力'
                }
                value={item.text}
                onChange={(e) => {
                  if (itemIdx >= 0) handlers.onSortingItemTextChange(qIdx, itemIdx, e.target.value);
                }}
              />
              <button
                type="button"
                className={editorClasses.removeQuestionBtn}
                onClick={() => {
                  if (itemIdx >= 0) handlers.onRemoveSortingItem(qIdx, itemIdx);
                }}
                title="この要素を削除"
              >
                <DeleteOutlineOutlined sx={{ fontSize: 18 }} />
              </button>
            </div>
          );
        }}
      />
      <button
        type="button"
        className={`${editorClasses.addTextAnswerBtn} mt-2`}
        onClick={() => handlers.onAddSortingItem(qIdx)}
      >
        <AddOutlined sx={{ fontSize: 14 }} /> 要素を追加する
      </button>
      <FieldValidationMessages
        errors={validationErrors}
        field="questions"
        questionIndex={qIdx}
        questionField="sortingItems"
      />
    </div>
  );
}
