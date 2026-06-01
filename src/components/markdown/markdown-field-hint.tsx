import markdownStyles from './markdown.module.css';

export function MarkdownFieldHint() {
  return (
    <p className={markdownStyles.hint}>
      マークダウン: **太字**、*斜体*、[表示名](URL)、改行
    </p>
  );
}
