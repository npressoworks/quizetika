import { MarkdownContent } from './markdown-content';
import markdownStyles from './markdown.module.css';

type MarkdownPreviewProps = {
  markdown: string;
};

export function MarkdownPreview({ markdown }: MarkdownPreviewProps) {
  if (!markdown.trim()) {
    return null;
  }

  return (
    <div className={markdownStyles.preview} aria-live="polite">
      <p className={markdownStyles.previewLabel}>プレビュー</p>
      <MarkdownContent markdown={markdown} />
    </div>
  );
}
