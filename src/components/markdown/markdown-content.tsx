import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { cn } from '@/lib/utils';

type MarkdownContentProps = {
  markdown: string;
  className?: string;
  /** ラッパー要素。見出し表示には h2 を指定 */
  as?: 'div' | 'p' | 'h2' | 'span';
  /** trueの場合、リンク記法・ベアURLをリンク化せずプレーンテキストとして表示する（作問の問題文でのURL埋め込み廃止用） */
  disableLinks?: boolean;
};

export function MarkdownContent({
  markdown,
  className,
  as: Tag = 'div',
  disableLinks = false,
}: MarkdownContentProps) {
  if (!markdown) {
    return <Tag className={className} />;
  }

  return (
    <Tag
      className={cn(
        'prose max-w-none dark:prose-invert [&_a]:text-primary [&_a]:underline [&_strong]:font-bold',
        className
      )}
      dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(markdown, { disableLinks }) }}
    />
  );
}
