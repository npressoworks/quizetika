'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { getFormatDescription, getFormatIcon, getFormatLabel } from '@/lib/quiz-format-labels';
import styles from './format-label.module.css';

interface FormatLabelProps {
  format: string;
  className?: string;
  testId?: string;
}

export function FormatLabel({ format, className, testId }: FormatLabelProps) {
  const label = getFormatLabel(format);
  const icon = getFormatIcon(format);
  const description = getFormatDescription(format);
  const rootRef = useRef<HTMLSpanElement>(null);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });

  const syncPosition = useCallback(() => {
    const el = rootRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPosition({
      top: rect.top,
      left: rect.left + rect.width / 2,
    });
  }, []);

  const showTooltip = () => {
    syncPosition();
    setOpen(true);
  };

  const hideTooltip = () => {
    setOpen(false);
  };

  useEffect(() => {
    if (!open) return;
    syncPosition();
    window.addEventListener('scroll', syncPosition, true);
    window.addEventListener('resize', syncPosition);
    return () => {
      window.removeEventListener('scroll', syncPosition, true);
      window.removeEventListener('resize', syncPosition);
    };
  }, [open, syncPosition]);

  return (
    <>
      <span
        ref={rootRef}
        className={`${styles.root} ${className ?? ''}`}
        data-testid={testId}
        tabIndex={0}
        aria-label={`${label}: ${description}`}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        onFocus={showTooltip}
        onBlur={hideTooltip}
      >
        {icon} {label}
      </span>
      {open &&
        createPortal(
          <span
            role="tooltip"
            className={styles.tooltip}
            style={{ top: position.top, left: position.left }}
          >
            {description}
          </span>,
          document.body
        )}
    </>
  );
}
