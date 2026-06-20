'use client';

import React, { useState, useEffect } from 'react';
import { getAnnouncements, Announcement } from '@/services/announcement';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Info, AlertTriangle, RefreshCw } from 'lucide-react';

export function AnnouncementsTab() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAnnouncements();
        setAnnouncements(data);
      } catch (err) {
        console.error('[AnnouncementsTab] Failed to load announcements:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="space-y-4" data-testid="announcements-loading">
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
        <div className="h-24 w-full animate-pulse rounded-lg bg-muted" />
      </div>
    );
  }

  if (announcements.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Info size={40} className="mx-auto mb-3 opacity-40" />
        <p>掲載中のお知らせはありません。</p>
      </div>
    );
  }

  const getCategoryIcon = (category: Announcement['category']) => {
    switch (category) {
      case 'maintenance':
        return <AlertTriangle size={16} className="text-amber-500 mr-1 shrink-0" />;
      case 'update':
        return <RefreshCw size={16} className="text-blue-500 mr-1 shrink-0" />;
      case 'info':
      default:
        return <Info size={16} className="text-muted-foreground mr-1 shrink-0" />;
    }
  };

  const getCategoryLabel = (category: Announcement['category']) => {
    switch (category) {
      case 'maintenance':
        return 'メンテナンス';
      case 'update':
        return 'アップデート';
      case 'info':
      default:
        return '案内';
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {announcements.map((ann) => (
        <Card key={ann.id} className="overflow-hidden border border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="flex items-center">
                {getCategoryIcon(ann.category)}
                {getCategoryLabel(ann.category)}
              </Badge>
              {ann.publishedAt && (
                <span className="text-xs text-muted-foreground">
                  {new Date(ann.publishedAt).toLocaleDateString('ja-JP', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  })}
                </span>
              )}
            </div>
            <CardTitle className="text-lg font-bold mt-2">{ann.title}</CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div
              data-testid={`announcement-content-${ann.id}`}
              className="text-sm leading-relaxed text-muted-foreground prose prose-sm max-w-none dark:prose-invert"
              dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(ann.content) }}
            />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
