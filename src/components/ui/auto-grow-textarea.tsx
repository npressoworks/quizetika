'use client';

import React, { useCallback, useLayoutEffect, useRef } from 'react';

export interface AutoGrowTextareaProps
  extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'rows'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  minRows?: number;
}

const LINE_HEIGHT_PX = 24;

export function AutoGrowTextarea({
  value,
  onChange,
  minRows = 3,
  className,
  style,
  ...rest
}: AutoGrowTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const syncHeight = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    const minHeight = minRows * LINE_HEIGHT_PX;
    el.style.height = `${Math.max(el.scrollHeight, minHeight)}px`;
  }, [minRows]);

  useLayoutEffect(() => {
    syncHeight();
  }, [value, syncHeight]);

  return (
    <textarea
      ref={ref}
      value={value}
      onChange={onChange}
      className={className}
      style={style}
      rows={minRows}
      {...rest}
    />
  );
}
