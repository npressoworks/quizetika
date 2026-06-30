/** Tailwind class map replacing result.module.css */
export const resultClasses = {
  container: 'mx-auto flex max-w-[800px] animate-in fade-in flex-col gap-8 px-5 py-10 duration-500',
  backBtn:
    'inline-flex items-center gap-2 self-start font-medium text-muted-foreground transition-colors hover:-translate-x-1 hover:text-foreground',
  offlineAlert:
    'flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 px-5 py-4 text-foreground',
  offlineText: 'text-sm font-medium leading-relaxed',
  maskedAlert:
    'mb-2 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3.5',
  summaryCard:
    'relative flex flex-col items-center gap-6 rounded-xl border border-border bg-card p-8 text-center md:p-10',
  summaryDifficultyBadge:
    'absolute top-4 left-4 flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-sm',
  difficultyStars: 'font-mono',
  summaryBookmarkWrap: 'absolute top-4 right-4',
  summaryBookmarkBtn:
    'rounded-full border border-border bg-muted/30 p-2.5 transition-colors hover:bg-muted',
  summaryBookmarkBtnActive: 'border-emerald-500/50 text-emerald-500',
  scoreCircle:
    'flex size-40 flex-col items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg',
  scoreVal: 'text-5xl font-extrabold leading-none',
  scoreLabel: 'text-xs font-semibold tracking-wide uppercase opacity-80',
  resultTitle: 'text-2xl font-extrabold text-foreground md:text-3xl',
  metaStats:
    'flex w-full flex-wrap justify-center gap-8 border-t border-border pt-5 text-lg text-muted-foreground',
  feedbackPanel:
    'flex flex-col gap-5 rounded-xl border border-border bg-card p-6 md:p-8',
  panelTitle: 'text-xl font-bold text-foreground',
  voteRow: 'flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between',
  voteLabel: 'text-sm font-medium text-muted-foreground',
  btnGroup: 'flex gap-2',
  voteBtn:
    'inline-flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm font-semibold transition-colors hover:bg-muted disabled:opacity-50',
  voteActive: 'border-primary bg-primary/10 text-primary',
  // 良問評価ボタンを押した後に3秒間表示されるトースト通知（成功）
  voteToast:
    'animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700 dark:text-emerald-300',
  // 評価取り消し時のトースト通知（ニュートラル）
  voteToastNeutral:
    'animate-in fade-in slide-in-from-top-2 duration-300 flex items-center gap-2 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm font-semibold text-muted-foreground',
  difficultyVoteSection: 'flex flex-col gap-3 border-t border-border pt-4',
  actionBtnRow: 'flex flex-col gap-3 sm:flex-row',
  listNavigation: 'mt-4 flex flex-col gap-3',
  listClearMessage: 'text-sm',
  questionsList: 'flex flex-col gap-4',
  questionItem: 'rounded-xl border border-border bg-card p-5',
  itemHeader: 'mb-3 flex flex-wrap items-center justify-between gap-2',
  correctLabel:
    'inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300',
  incorrectLabel:
    'inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2.5 py-0.5 text-sm font-semibold text-destructive',
  questionTextResult: 'mb-4 text-base font-medium leading-relaxed text-foreground',
  answerSummary: 'flex flex-col gap-2 rounded-lg bg-muted/30 p-4',
  answerRow: 'flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-3',
  answerLabel: 'shrink-0 text-xs font-bold uppercase tracking-wide text-muted-foreground',
  answerValue: 'text-sm font-medium',
  answerValueCorrect: 'text-emerald-700 dark:text-emerald-300',
  answerValueIncorrect: 'text-destructive',
  explanationBox: 'mt-3 rounded-lg border border-border bg-muted/20 p-4',
  explanationTitle: 'mb-2 font-bold text-foreground',
  explanationText: 'text-sm leading-relaxed text-muted-foreground',
  recommendSection: 'flex flex-col gap-4',
  recommendGrid: 'grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3',
  hintHistoryBox: 'mt-3 rounded-lg border border-border bg-muted/20 p-4',
  hintHistoryTitle: 'mb-2 font-bold text-foreground',
  hintHistoryList: 'm-0 flex list-disc flex-col gap-1 pl-5 text-sm',
  hintHistoryItem: 'text-muted-foreground',
  hintHistoryEmpty: 'text-sm text-muted-foreground',
  modalOverlay:
    'fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm',
  modalContent:
    'flex w-[90%] max-w-lg flex-col gap-5 rounded-xl border border-border bg-card p-6 shadow-lg',
  modalTitle: 'flex items-center gap-2 text-lg font-bold text-foreground',
  form: 'flex flex-col gap-4',
  select:
    'rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  textarea:
    'min-h-[120px] w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
} as const;
