'use client';

import Link from 'next/link';
import { AutoAwesomeOutlined } from '@mui/icons-material';
import { buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { editorClasses } from '@/components/quiz/editor/quiz-editor-classes';

interface AiQuizProUpsellProps {
  isLoggedIn: boolean;
  redirectPath: string;
}

export function AiQuizProUpsell({ isLoggedIn, redirectPath }: AiQuizProUpsellProps) {
  const loginHref = `/login?redirect=${encodeURIComponent(redirectPath)}`;

  return (
    <div className={editorClasses.editorCard} data-testid="ai-quiz-pro-upsell">
      <div className="flex flex-col gap-3">
        <h3 className="flex items-center gap-2 text-lg font-semibold">
          <AutoAwesomeOutlined sx={{ fontSize: 20 }} className="text-primary" />
          AI アシスタント（Pro 限定）
        </h3>
        <p className="text-sm text-muted-foreground">
          Pro プランでは、AI アシスタントがチャット形式での作問をサポートしたり、全問の整合性をチェックしたりできます。
        </p>
        {isLoggedIn ? (
          <Link href="/pricing" className={cn(buttonVariants(), 'w-fit')}>
            Pro プランを見る
          </Link>
        ) : (
          <Link href={loginHref} className={cn(buttonVariants(), 'w-fit')}>
            ログインして Pro を検討する
          </Link>
        )}
      </div>
    </div>
  );
}
