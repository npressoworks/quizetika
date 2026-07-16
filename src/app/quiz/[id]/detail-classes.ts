/** Tailwind class map replacing page.module.css */
export const detailClasses = {
  container: 'mx-auto flex max-w-[1000px] animate-in fade-in flex-col gap-8 px-5 py-10 duration-500',
  backBtn:
    'inline-flex items-center gap-2 self-start font-medium text-muted-foreground transition-colors hover:-translate-x-1 hover:text-foreground',
  layout: 'grid grid-cols-1 gap-8 md:grid-cols-[1fr_340px] md:items-start',
  detailCard:
    'flex flex-col gap-6 rounded-xl border border-border bg-card p-8',
  header: 'flex items-start justify-between gap-4',
  headerActions: 'flex items-center gap-2',
  titleArea: 'flex flex-col gap-2',
  genre:
    'inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-primary',
  genreIconMini: 'size-[18px] object-contain',
  genreIconMiniFallback: 'text-base',
  title: 'text-2xl font-bold leading-tight text-foreground md:text-3xl',
  bookmarkBtn:
    'rounded-full border border-border bg-muted/30 p-2.5 transition-colors hover:bg-muted',
  bookmarked: 'border-emerald-500/50 text-emerald-500',
  badgesSection: 'flex flex-wrap gap-2',
  badgeGlow:
    'inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-sm font-semibold text-primary',
  badgeMasked:
    'inline-flex items-center rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground',
  difficultyBadge:
    'inline-flex items-center gap-1 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-foreground',
  playStatusBadge:
    'inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm font-semibold',
  playStatusPlayed:
    'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  playStatusUnplayed: 'border-border bg-muted text-muted-foreground',
  thumbnailWrapper:
    'relative aspect-video w-full overflow-hidden rounded-lg bg-muted',
  description: 'text-base leading-relaxed text-muted-foreground',
  tags: 'flex flex-wrap gap-2',
  tag: 'rounded-full border border-border bg-muted/50 px-3 py-1 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-primary',
  playSection: 'flex flex-col gap-4 border-t border-border pt-6',
  modeLeaderboardWarning:
    'flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200',
  altModeSection:
    'flex flex-col gap-3 rounded-lg border border-border bg-muted/30 p-4',
  altModeLabel: 'text-sm font-semibold text-foreground',
  altModeButtons: 'flex flex-col gap-2 sm:flex-row',
  modeOption:
    'cursor-pointer rounded-lg border border-border p-4 transition-colors hover:border-primary/50 hover:bg-muted/50',
  modeSelected: 'border-primary bg-primary/5',
  modeHeader: 'mb-2 flex items-center gap-2 font-semibold text-foreground',
  modeDesc: 'text-sm leading-relaxed text-muted-foreground',
  playBtn: '',
  authorSection: 'border-t border-border pt-4',
  authorLink:
    'inline-flex items-center gap-3 transition-opacity hover:opacity-80',
  authorAvatar: 'size-12 rounded-full border border-border object-cover',
  authorInfo: 'flex flex-col',
  authorLabel: 'text-xs text-muted-foreground',
  authorName: 'font-semibold text-foreground',
} as const;
