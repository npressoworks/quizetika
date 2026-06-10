import React from 'react';
import { cn } from '@/lib/utils';

export interface HorizontalScrollCarouselProps {
  children: React.ReactNode;
  className?: string;
  'data-testid'?: string;
}

export function HorizontalScrollCarousel({
  children,
  className,
  'data-testid': testId,
}: HorizontalScrollCarouselProps) {
  return (
    <div
      className={cn(
        'horizontal-scroll-carousel flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-0.5 pb-4 [-webkit-overflow-scrolling:touch]',
        className
      )}
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** Carousel item wrapper — apply snap-start + shrink-0 on children */
export const carouselItemClass = 'shrink-0 snap-start';

export const genreFormatCardClass = (selected: boolean) =>
  cn(
    carouselItemClass,
    'min-w-[120px] max-w-[140px] cursor-pointer rounded-xl border border-border bg-card p-3 text-center text-card-foreground transition-colors',
    'hover:border-primary/50',
    selected && 'border-primary ring-2 ring-primary/25'
  );

export const quizCarouselSlotClass = cn(
  carouselItemClass,
  'w-[280px] hover:relative hover:z-[1]'
);

export const carouselStatusClass = 'px-1 py-2 text-sm text-muted-foreground';
export const carouselErrorClass = 'text-destructive';
