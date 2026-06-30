/** Tailwind class map replacing success.module.css */
export const successClasses = {
  container: 'mx-auto flex min-h-[70vh] max-w-[720px] items-center justify-center px-5 py-10',
  successCard:
    'relative w-full overflow-hidden rounded-2xl border border-border bg-card shadow-lg',
  cardContent: 'relative flex flex-col items-center gap-6 p-8 text-center md:p-12',
  badgeWrapper: 'relative flex items-center justify-center',
  badge:
    'relative z-10 flex size-20 items-center justify-center rounded-full bg-primary text-primary-foreground',
  badgeGlow:
    'absolute size-24 animate-pulse rounded-full bg-primary/20',
  title: 'text-2xl font-extrabold text-foreground md:text-3xl',
  subtitle: 'max-w-lg text-sm leading-relaxed text-muted-foreground',
  quizPreview:
    'flex w-full max-w-md overflow-hidden rounded-xl border border-border bg-muted/30 transition-shadow hover:shadow-md',
  thumbnailPlaceholder:
    'flex size-24 shrink-0 items-center justify-center bg-muted text-xs text-muted-foreground',
  thumbnailImage: 'size-24 shrink-0 object-cover',
  quizMeta: 'flex flex-1 flex-col gap-2 p-4 text-left',
  quizTitle: 'line-clamp-2 font-bold text-foreground',
  metaRow: 'flex flex-wrap items-center gap-2',
  genreBadge:
    'rounded-full border border-border bg-muted px-2.5 py-0.5 text-xs text-muted-foreground',
  difficultyText: 'text-xs text-muted-foreground',
  shareSection: 'w-full max-w-md rounded-xl border border-border bg-muted/20 p-5',
  shareTitle: 'mb-4 text-base font-bold text-foreground',
  shareButtons: 'flex flex-col gap-2 sm:flex-row sm:flex-wrap',
  btnShare:
    'relative inline-flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors',
  btnX: 'bg-foreground text-background hover:opacity-90',
  btnLine: 'bg-[#06C755] text-white hover:opacity-90',
  btnCopy: 'border border-border bg-background text-foreground hover:bg-muted',
  copyToast:
    'absolute -top-10 left-1/2 -translate-x-1/2 rounded bg-foreground px-3 py-1 text-xs text-background',
  actionSection: 'flex w-full max-w-md flex-col gap-3',
  actionRow: 'flex flex-col gap-3 sm:flex-row',
} as const;
