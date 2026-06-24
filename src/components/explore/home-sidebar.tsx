'use client';

import React from 'react';
import Link from 'next/link';
import {
  DescriptionOutlined,
  PrivacyTipOutlined,
  ContactSupportOutlined,
  OpenInNewOutlined
} from '@mui/icons-material';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';

export function resolveContactUrl(): string {
  return process.env.NEXT_PUBLIC_CONTACT_FORM_URL || 'https://docs.google.com/forms/d/e/1FAIpQLSfP1E1_dummy_form/viewform';
}

export function HomeSidebar() {
  const contactUrl = resolveContactUrl();

  return (
    <Card className="h-fit bg-card/80 border border-border shadow-sm backdrop-blur-sm max-lg:w-full" data-testid="home-sidebar">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-foreground">サポート & 規約</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3.5 text-sm">
        <Link
          href="/terms"
          className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors no-underline"
          data-testid="sidebar-terms-link"
        >
          <DescriptionOutlined sx={{ fontSize: 18 }} />
          <span>利用規約</span>
        </Link>
        <Separator />
        <Link
          href="/privacy"
          className="flex items-center gap-3 text-muted-foreground hover:text-foreground transition-colors no-underline"
          data-testid="sidebar-privacy-link"
        >
          <PrivacyTipOutlined sx={{ fontSize: 18 }} />
          <span>プライバシーポリシー</span>
        </Link>
        <Separator />
        <a
          href={contactUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between text-muted-foreground hover:text-foreground transition-colors no-underline"
          data-testid="sidebar-contact-link"
        >
          <div className="flex items-center gap-3">
            <ContactSupportOutlined sx={{ fontSize: 18 }} />
            <span>お問い合わせ</span>
          </div>
          <OpenInNewOutlined sx={{ fontSize: 14 }} />
        </a>
        <Separator className="mt-1" />
        <div className="text-xs text-muted-foreground/60 text-center pt-1" data-testid="sidebar-copyright">
          © {new Date().getFullYear()} quizeum. All rights reserved.
        </div>
      </CardContent>
    </Card>
  );
}
