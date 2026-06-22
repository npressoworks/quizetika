'use client';

import React from 'react';
import { ExpandMoreOutlined, ChevronRightOutlined } from '@mui/icons-material';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-card px-4">
      <button
        type="button"
        className={cn(
          'flex w-full items-center justify-between py-3 text-left text-sm font-semibold text-card-foreground',
        )}
        data-testid={testId}
        aria-expanded={open}
        onClick={onToggle}
      >
        {title}
        <span className="text-muted-foreground" aria-hidden>
          {open ? <ExpandMoreOutlined className="size-4" /> : <ChevronRightOutlined className="size-4" />}
        </span>
      </button>
      {open && <div className="pb-4">{children}</div>}
    </div>
  );
}
