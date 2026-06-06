'use client';

import React from 'react';
import styles from './explore-carousel.module.css';

export interface ExploreAccordionProps {
  testId: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function ExploreAccordion({
  testId,
  title,
  open,
  onToggle,
  children,
}: ExploreAccordionProps) {
  return (
    <div className={styles.accordion}>
      <button
        type="button"
        className={styles.accordionHeader}
        data-testid={testId}
        aria-expanded={open}
        onClick={onToggle}
      >
        {title}
        <span className={styles.accordionChevron} aria-hidden>
          {open ? '▾' : '▸'}
        </span>
      </button>
      {open && <div className={styles.accordionPanel}>{children}</div>}
    </div>
  );
}
