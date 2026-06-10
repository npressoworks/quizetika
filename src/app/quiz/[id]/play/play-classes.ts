/** Tailwind class map replacing play.module.css */
export const playClasses = {
  container: 'mx-auto flex w-full max-w-[900px] flex-col gap-6 px-5 py-8',
  containerWithQuickPressDock: 'pb-[220px]',
  lateralContainer:
    'mx-auto grid h-[calc(100vh-120px)] max-w-[1400px] grid-cols-1 gap-8 p-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] lg:h-[calc(100vh-120px)]',
  header:
    'flex items-center justify-between rounded-lg border border-border bg-card/80 px-6 py-4 backdrop-blur-sm',
  backBtn:
    'inline-flex items-center gap-2 font-medium text-muted-foreground transition-colors hover:text-foreground hover:-translate-x-1',
  statusIndicator: 'flex items-center gap-2 text-sm font-semibold',
  online: 'text-primary',
  offline: 'text-pink-500',
  progressSection: 'flex flex-col gap-2',
  progressBar: 'h-2 w-full overflow-hidden rounded bg-muted',
  progressFill: 'h-full bg-primary transition-[width] duration-300',
  progressText: 'flex justify-between text-sm text-muted-foreground',
  quizCard:
    'relative flex min-h-[380px] w-full min-w-0 flex-col gap-6 rounded-xl border border-border bg-card p-10',
  questionMeta: 'flex items-center justify-between border-b border-border pb-4',
  questionType: 'text-xs font-bold uppercase text-primary',
  timer: 'flex items-center gap-1.5 font-mono text-lg font-bold text-primary',
  timerWarning: 'animate-pulse text-pink-500',
  questionText:
    'w-full max-w-full text-2xl leading-normal text-foreground wrap-break-word [&_a]:text-primary [&_a]:underline [&_em]:italic [&_strong]:font-extrabold [&_strong]:text-primary',
  optionsGrid: 'mt-4 grid grid-cols-1 gap-4',
  optionBtn:
    'flex cursor-pointer items-center justify-between rounded-lg border border-border bg-muted/30 px-6 py-4.5 text-left text-base text-foreground transition-colors hover:border-primary hover:bg-primary/5 hover:translate-x-1',
  optionBtnSelected: 'border-primary bg-primary/15',
  inputForm: 'mt-4 flex gap-3',
  textInput:
    'flex-1 rounded-lg border border-input bg-background px-4 py-4 text-lg text-foreground outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  flashcardArea: 'flex flex-col items-center justify-center gap-8 py-10 text-center',
  cardBack:
    'w-full animate-in fade-in rounded-lg border border-primary bg-muted/30 p-6 text-left duration-300',
  correctAnswer: 'mb-2 text-xl font-bold text-primary',
  explanation: 'text-sm leading-relaxed text-muted-foreground',
  flashcardActionGrid: 'flex w-full gap-4',
  actionsBar: 'mt-6 flex items-center justify-between',
  examNavGrid: 'mt-4 flex flex-wrap gap-2 border-t border-border pt-4',
  examNavBtn:
    'flex size-9 cursor-pointer items-center justify-center rounded border border-border bg-muted/20 font-semibold transition-colors',
  examNavBtnActive: 'border-primary bg-primary text-primary-foreground',
  examNavBtnAnswered: 'border-primary bg-primary/5',
  modalOverlay:
    'fixed inset-0 z-1000 flex items-center justify-center bg-black/70 backdrop-blur-sm',
  modalContent:
    'relative flex w-[90%] max-w-[480px] animate-in zoom-in-95 flex-col gap-5 rounded-xl border border-border bg-card p-8 shadow-2xl duration-300',
  modalTitle: 'flex items-center gap-2 text-xl font-bold text-foreground',
  modalText: 'leading-relaxed text-foreground',
  chatColumn:
    'flex h-full flex-col overflow-hidden rounded-xl border border-border bg-card/80 backdrop-blur-sm',
  chatHeader: 'flex items-center justify-between border-b border-border p-5',
  chatTitle: 'font-bold text-foreground',
  chatHeaderMeta: 'flex flex-col items-end gap-1',
  turnCounter: 'text-sm font-semibold text-muted-foreground',
  elapsedCounter: 'inline-flex items-center gap-1.5 font-mono text-sm font-semibold text-primary',
  chatHistory: 'flex flex-1 flex-col gap-4 overflow-y-auto p-5',
  chatBubble: 'max-w-[80%] rounded-lg px-4.5 py-3.5 text-sm leading-normal',
  bubbleUser: 'self-end rounded-br-sm bg-primary text-primary-foreground',
  bubbleAi: 'self-start rounded-bl-sm border border-border bg-muted/50 text-foreground',
  bubbleSystem:
    'self-center border border-pink-500/20 bg-pink-500/10 text-center text-sm text-foreground',
  aiResponseMeta: 'mt-2 flex items-center gap-2 text-xs font-bold',
  responseYes: 'text-teal-400',
  responseNo: 'text-pink-500',
  responseIrrelevant: 'text-amber-400',
  responseUnknown: 'text-muted-foreground',
  cacheBadge: 'rounded bg-teal-400/15 px-1.5 py-0.5 text-[0.7rem] text-teal-400',
  chatPending:
    'flex animate-pulse items-center gap-2 self-start pl-2 text-sm italic text-muted-foreground',
  chatInputArea: 'flex flex-col gap-3 border-t border-border p-5',
  chatInputError: 'text-sm text-pink-500',
  truthAdviceBanner:
    'rounded border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-400',
  chatModeToggle: 'flex gap-2',
  chatModeBtn:
    'flex-1 cursor-pointer rounded-lg border border-border bg-transparent px-3.5 py-2.5 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-50',
  chatModeBtnActive: 'border-primary bg-primary/15 text-foreground',
  chatInputForm: 'flex w-full gap-2.5 has-[.chatTruthForm]:flex-col',
  chatInput:
    'flex-1 rounded-lg border border-input bg-background px-4 py-3 text-foreground outline-none focus-visible:border-ring',
  chatTruthForm: 'flex w-full flex-col gap-2.5',
  chatTruthTextarea:
    'min-h-[110px] w-full resize-y rounded-lg border border-input bg-background px-4 py-3 text-sm leading-normal text-foreground outline-none',
  chatTruthSubmitBtn: 'w-full',
  truthSubmitLabel: 'mb-1 block text-xs font-bold opacity-85',
  infoColumn: 'flex h-full flex-col gap-6 overflow-y-auto',
  infoCard: 'rounded-xl border border-border bg-card/80 p-6 backdrop-blur-sm',
  infoCardTitle:
    'mb-3 border-b border-border pb-2 text-lg font-bold text-foreground',
  lateralRules: 'flex flex-col gap-3.5 text-sm leading-relaxed text-foreground',
  lateralRulesLead: 'm-0',
  lateralRulesList: 'm-0 flex list-disc flex-col gap-2 pl-5 marker:text-muted-foreground',
  lateralLockedBtn: 'disabled:cursor-not-allowed disabled:opacity-70',
  giveUpBtn: 'mt-2 w-full border-border text-muted-foreground hover:border-pink-500 hover:text-pink-500',
  lateralGiveUpNav: 'mt-3 flex flex-wrap gap-2',
  limitProLink: 'font-semibold text-primary underline',
  sortingArea: 'mt-6 flex w-full flex-col gap-4',
  sortingHint: 'm-0 text-sm text-muted-foreground',
  sortingList: 'w-full',
  sortingItemText: 'text-base font-medium leading-snug',
  associationArea: 'mt-6 flex w-full flex-col gap-4',
  associationHintsList: 'flex flex-col gap-3',
  associationHintItem: 'rounded-lg border border-border bg-muted/30 p-3',
  associationHintLabel: 'mr-2 text-sm font-bold text-primary',
  associationHintText: 'text-sm text-foreground',
  quickPressDock:
    'fixed inset-x-0 bottom-0 z-100 border-t border-border bg-background px-5 py-4 shadow-[0_-8px_24px_rgba(0,0,0,0.25)] max-md:bottom-[60px] pb-[max(16px,env(safe-area-inset-bottom,0px))]',
  quickPressDockInner: 'mx-auto flex w-full max-w-[900px] flex-col justify-end gap-3',
  quickPressDockSkipSlot: 'w-full shrink-0',
  quickPressDockActionSlot: 'w-full shrink-0',
  quickPressDockForm: 'flex w-full gap-3',
  quickPressBtn:
    'btn w-full animate-pulse cursor-pointer rounded-xl border-none bg-linear-to-br from-blue-500 to-blue-700 px-6 py-6 text-2xl font-bold tracking-wider text-white shadow-lg',
  startReadingBtn:
    'btn w-full animate-pulse cursor-pointer rounded-xl border-none bg-linear-to-br from-teal-400 to-sky-500 px-6 py-6 text-2xl font-bold tracking-wider text-gray-900 shadow-lg',
  quickPressSkipBtn: 'w-full',
} as const;
