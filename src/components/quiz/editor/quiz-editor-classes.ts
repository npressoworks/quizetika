/** Tailwind class map replacing create.module.css (E2E: choiceRow substring preserved). */
export const editorClasses = {
  container: 'mx-auto max-w-[1000px] px-5 pb-[100px] pt-10',
  title: 'mb-2 text-4xl font-extrabold tracking-tight text-foreground',
  subtitle: 'mb-10 text-muted-foreground',
  editorCard:
    'mb-8 rounded-xl border border-border bg-card p-6 shadow-sm md:p-10',
  sectionTitle:
    'mb-6 flex items-center gap-2.5 border-b border-border pb-3 text-2xl font-bold',
  formGroup: 'flex flex-col gap-2',
  label: 'text-xs font-semibold uppercase tracking-wide text-muted-foreground',
  input:
    'w-full rounded-md border border-input bg-background px-4 py-3.5 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  textarea:
    'min-h-[120px] w-full resize-y rounded-md border border-input bg-background px-4 py-3.5 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  select:
    'w-full rounded-md border border-input bg-background px-4 py-3.5 text-base text-foreground transition-colors outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50',
  inputError: 'border-destructive! ring-3 ring-destructive/25',
  metaGrid: 'grid items-start gap-6 sm:grid-cols-[220px_1fr]',
  thumbnailUpload:
    'flex min-h-40 cursor-pointer items-center justify-center rounded-md border-2 border-dashed border-border p-5 text-center transition-colors hover:border-primary hover:bg-muted/30',
  thumbnailPreview: 'max-h-[200px] w-full rounded-sm object-cover',
  genreContainer: 'flex flex-col gap-1.5',
  genreLink: 'mt-1 self-start text-sm text-primary underline-offset-4 hover:underline',
  tagInputWrapper: 'flex gap-2.5',
  tagList: 'mt-2 flex flex-wrap gap-2',
  tagBadge:
    'flex items-center gap-2 rounded-sm border border-border bg-muted px-3 py-1.5 text-sm text-foreground',
  removeTagBtn:
    'flex cursor-pointer items-center justify-center border-none bg-transparent p-0 text-base text-muted-foreground hover:text-destructive',
  tagWarning:
    'mt-2 flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-sm text-amber-700 dark:text-amber-400',
  tagLimitInfo: 'self-end text-xs text-muted-foreground',
  questionHeader: 'mb-5 flex items-center justify-between',
  addQuestionBtn:
    'inline-flex items-center gap-2 cursor-pointer rounded-md bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90',
  questionList: 'flex flex-col gap-6',
  questionCard:
    'relative rounded-md border border-border bg-muted/20 p-6 transition-shadow hover:border-primary/30 hover:shadow-md',
  questionCardHeader: 'mb-4 flex items-center justify-between',
  questionNumber: 'text-lg font-bold text-foreground',
  removeQuestionBtn:
    'cursor-pointer rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive',
  typeToggle:
    'mb-4 flex w-fit gap-1 rounded-sm border border-input bg-muted/50 p-1',
  toggleGroup:
    'mb-3 flex w-fit gap-1 rounded-sm border border-input bg-muted/50 p-1',
  toggleBtn:
    'cursor-pointer rounded px-3 py-1.5 text-sm font-medium text-muted-foreground transition-colors',
  toggleBtnActive: 'bg-primary text-primary-foreground shadow-sm',
  choicesList: 'mt-4 flex flex-col gap-3',
  choiceRow: 'choiceRow flex items-center gap-3',
  choiceCheckbox:
    'flex h-[22px] w-[22px] shrink-0 cursor-pointer appearance-none items-center justify-center rounded-sm border-2 border-input transition-colors checked:border-primary checked:bg-primary checked:text-primary-foreground checked:before:content-["✔"] checked:before:text-xs checked:before:font-extrabold',
  textAnswersContainer: 'mt-4',
  textAnswerRow: 'mb-2 flex gap-2',
  addTextAnswerBtn:
    'mt-1.5 inline-flex cursor-pointer items-center gap-1.5 text-sm font-medium text-primary hover:text-primary/80',
  errorBox:
    'mb-6 max-h-[250px] overflow-y-auto rounded-md border border-destructive/30 bg-destructive/10 p-5 text-destructive',
  errorTitle: 'mb-2.5 flex items-center gap-2 font-bold',
  errorList: 'list-inside list-disc text-sm',
  fieldError: 'mt-1.5 text-[0.82rem] leading-snug text-destructive [&_p]:mb-1 [&_p:last-child]:mb-0',
  actionsBar:
    'fixed right-0 bottom-0 left-0 z-100 flex justify-end gap-4 border-t border-border bg-background p-5 md:left-[70px] lg:left-[275px]',
} as const;
