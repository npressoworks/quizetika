'use client';

import React from 'react';
import { HelpOutlineOutlined } from '@mui/icons-material';
import { cn } from '@/lib/utils';
import { getFormatDescription } from '@/lib/quiz-format-labels';
import type { QuizFormat } from '@/lib/quiz-format';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';

const FORMAT_OPTIONS: { id: QuizFormat; label: string; icon: string }[] = [
  { id: 'mixed', label: '複合', icon: '🌀' },
  { id: 'multiple-choice', label: '選択式', icon: '☑️' },
  { id: 'true-false', label: '〇✕問題', icon: '⭕' },
  { id: 'text-input', label: '記述式', icon: '✍️' },
  { id: 'quick-press', label: '早押し', icon: '⚡' },
  { id: 'sorting', label: '並び替え', icon: '↕️' },
  { id: 'association', label: '連想', icon: '💡' },
  { id: 'lateral-thinking', label: 'ウミガメのスープ', icon: '🐢' },
];

export interface QuizFormatSelectorProps {
  format: QuizFormat;
  onFormatChange: (format: QuizFormat) => void;
}

export function QuizFormatSelector({ format, onFormatChange }: QuizFormatSelectorProps) {
  return (
    <div className={editorClasses.editorCard}>
      <h2 className={editorClasses.sectionTitle}>
        <HelpOutlineOutlined sx={{ fontSize: 20 }} />
        クイズ全体の出題形式 <span className="text-destructive">*</span>
      </h2>
      <p className="mb-4 text-sm text-muted-foreground">
        クイズ全体のルールと問題タイプを決定します。単一形式を選ぶと、全ての問題がそのタイプに固定されます。「複合」を選ぶと問題ごとに形式を選択できます。
      </p>

      <div className="mt-2 grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3">
        {FORMAT_OPTIONS.map((item) => {
          const isActive = format === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onFormatChange(item.id)}
              className={cn(
                'flex cursor-pointer flex-col gap-2 rounded-lg border p-4 text-left transition-all',
                isActive
                  ? 'border-2 border-primary bg-primary/10 shadow-sm'
                  : 'border border-border bg-card hover:border-border/80 hover:bg-muted/30'
              )}
            >
              <div className="flex items-center gap-2">
                <span className="text-2xl">{item.icon}</span>
                <span
                  className={cn(
                    'text-base font-bold',
                    isActive ? 'text-primary' : 'text-foreground'
                  )}
                >
                  {item.label}
                </span>
              </div>
              <p className="m-0 text-xs leading-snug text-muted-foreground">
                {getFormatDescription(item.id)}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
