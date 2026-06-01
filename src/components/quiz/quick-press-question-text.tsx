'use client';

import { motion } from 'framer-motion';
import { MarkdownContent } from '@/components/markdown/markdown-content';

type QuickPressQuestionTextProps = {
  markdown: string;
  className?: string;
};

/**
 * 早押しタイプライター表示。framer-motion で逐次更新時にフェードインする。
 */
export function QuickPressQuestionText({
  markdown,
  className,
}: QuickPressQuestionTextProps) {
  return (
    <motion.div
      className={className}
      initial={false}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.08, ease: 'easeOut' }}
    >
      <MarkdownContent markdown={markdown} as="h2" />
    </motion.div>
  );
}
