import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import markdownStyles from './markdown.module.css';

type MarkdownContentProps = {
  markdown: string;
  className?: string;
  /** ラッパー要素。見出し表示には h2 を指定 */
  as?: 'div' | 'p' | 'h2' | 'span';
};

export function MarkdownContent({
  markdown,
  className,
  as: Tag = 'div',
}: MarkdownContentProps) {
  if (!markdown) {
    return <Tag className={className} />;
  }

  return (
    <Tag
      className={[className, markdownStyles.content].filter(Boolean).join(' ')}
      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(markdown) }}
    />
  );
}
