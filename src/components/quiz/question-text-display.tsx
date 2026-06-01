'use client';

import { MarkdownContent } from '@/components/markdown/markdown-content';
import { QuickPressQuestionText } from '@/components/quiz/quick-press-question-text';
import type { Question } from '@/types';

type QuestionTextDisplayProps = {
  question: Question | undefined;
  className?: string;
  /** quick-press: ストリーム／ローカル演出で組み立て済みの表示用マークダウン */
  quickPressDisplayMarkdown?: string;
  isQuickPressReading?: boolean;
};

export function QuestionTextDisplay({
  question,
  className,
  quickPressDisplayMarkdown = '',
  isQuickPressReading = false,
}: QuestionTextDisplayProps) {
  if (!question) {
    return <h2 className={className} />;
  }

  if (question.type === 'quick-press') {
    if (!isQuickPressReading) {
      return <h2 className={className} />;
    }
    return (
      <QuickPressQuestionText
        markdown={quickPressDisplayMarkdown}
        className={className}
      />
    );
  }

  return (
    <MarkdownContent
      markdown={question.questionText}
      className={className}
      as="h2"
    />
  );
}
