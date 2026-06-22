'use client';

import React, { useState } from 'react';
import { ExpandMoreOutlined, ChevronRightOutlined } from '@mui/icons-material';
import { cn } from '@/lib/utils';

export interface ResultQuestionDetailsAccordionProps {
  questionId: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}

export function ResultQuestionDetailsAccordion({
  questionId,
  defaultOpen = false,
  children,
}: ResultQuestionDetailsAccordionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="w-full rounded-lg border border-border">
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between px-3 py-3 text-left text-sm font-medium hover:bg-muted/50',
        )}
        data-testid={`result-question-accordion-${questionId}`}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? '回答と解説を隠す' : '回答と解説を表示'}
        <span className="text-muted-foreground" aria-hidden>
          {open ? <ExpandMoreOutlined className="size-4" /> : <ChevronRightOutlined className="size-4" />}
        </span>
      </button>
      {open && <div className="border-t px-3 pb-4 pt-2">{children}</div>}
    </div>
  );
}
