import React from 'react';
import type { Metadata } from 'next';
import fs from 'fs/promises';
import path from 'path';
import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';
import { Card, CardContent } from '@/components/ui/card';
import { ErrorOutlined } from '@mui/icons-material';

export const metadata: Metadata = {
  title: '利用規約 - quizetika',
  description: 'quizetika（クイズ投稿・管理SNS）の利用規約です。本サービスをご利用になる際の合意事項について記載しています。',
};



async function getTermsContent(): Promise<string> {
  const filePath = path.join(process.cwd(), 'src', 'data', 'terms.md');
  try {
    const fileContent = await fs.readFile(filePath, 'utf-8');
    const rawHtml = await marked.parse(fileContent);
    return DOMPurify.sanitize(rawHtml);
  } catch (error) {
    console.error('Failed to load terms.md', error);
    throw new Error('利用規約の読み込み中にエラーが発生しました');
  }
}

export default async function TermsPage() {
  let contentHtml = '';
  let loadError = false;

  try {
    contentHtml = await getTermsContent();
  } catch (e) {
    loadError = true;
  }

  return (
    <div className="mx-auto max-w-[800px] py-10 px-4 max-md:py-6 max-md:px-2">
      <Card className="border border-border bg-card/90 shadow-lg backdrop-blur-sm">
        <CardContent className="pt-8 px-8 pb-10 max-md:pt-6 max-md:px-4 max-md:pb-6">
          {loadError ? (
            <div className="flex flex-col items-center gap-4 text-center py-10" data-testid="terms-load-error">
              <ErrorOutlined className="h-12 w-12 text-destructive animate-pulse" />
              <h1 className="text-xl font-bold text-foreground">エラーが発生しました</h1>
              <p className="text-sm text-muted-foreground">
                ただいま利用規約ドキュメントを読み込むことができません。
                しばらく時間をおいてから、再度アクセスしてください。
              </p>
            </div>
          ) : (
            <article
              className="prose prose-neutral dark:prose-invert max-w-none text-foreground leading-relaxed
                [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:mb-6 [&>h1]:text-foreground
                [&>h2]:text-lg [&>h2]:font-semibold [&>h2]:mt-8 [&>h2]:mb-4 [&>h2]:pb-2 [&>h2]:border-b [&>h2]:text-foreground
                [&>p]:text-sm [&>p]:text-muted-foreground [&>p]:mb-4
                [&>ul]:list-disc [&>ul]:pl-5 [&>ul]:mb-6 [&>ul]:text-sm [&>ul]:text-muted-foreground
                [&>ul>li]:mb-1.5
                [&>hr]:my-8 [&>hr]:border-border"
              dangerouslySetInnerHTML={{ __html: contentHtml }}
              data-testid="terms-content"
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
