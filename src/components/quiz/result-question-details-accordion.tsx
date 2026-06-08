'use client';

import React, { useId, useState } from 'react';
import styles from './result-question-details-accordion.module.css';

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
  const panelId = useId();

  return (
    <div className={styles.accordion}>
      <button
        type="button"
        className={styles.accordionHeader}
        data-testid={`result-question-accordion-${questionId}`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((prev) => !prev)}
      >
        <span>{open ? '回答と解説を隠す' : '回答と解説を表示'}</span>
        <span className={styles.accordionChevron} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && (
        <div id={panelId} className={styles.accordionPanel}>
          {children}
        </div>
      )}
    </div>
  );
}
