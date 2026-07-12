import { MarkdownContent } from './markdown-content';

type MarkdownPreviewProps = {
  markdown: string;
  disableLinks?: boolean;
};

export function MarkdownPreview({ markdown, disableLinks = false }: MarkdownPreviewProps) {
  if (!markdown.trim()) {
    return null;
  }

  return (
    <div
      className="mt-2.5 rounded-md border border-border bg-muted/50 px-3.5 py-3"
      aria-live="polite"
    >
      <p className="mb-2 text-[0.7rem] font-semibold tracking-wide text-muted-foreground uppercase">
        プレビュー
      </p>
      <MarkdownContent markdown={markdown} disableLinks={disableLinks} />
    </div>
  );
}
