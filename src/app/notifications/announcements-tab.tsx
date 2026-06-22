'use client';

import React, { useState, useEffect } from 'react';
import { getAnnouncements, Announcement } from '@/services/announcement';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { InfoOutlined, WarningAmberOutlined, RefreshOutlined, BugReportOutlined, CheckOutlined, ReportOutlined } from '@mui/icons-material';
import { QueryDocumentSnapshot } from 'firebase/firestore';
import { cn } from '@/lib/utils';

// HTMLタグおよび実体参照を除去してプレーンテキストにするヘルパー
function stripHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, '') // タグの除去
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ') // 連続する空白や改行をスペース1つに統合
    .trim();
}

interface AnnouncementsTabProps {
  lastReadAt: Date | null;
  onMarkAllRead: () => void;
  unreadCount: number;
  readAnnouncementIds: string[];
  onMarkAsRead: (id: string) => void;
}

export function AnnouncementsTab({ 
  lastReadAt, 
  onMarkAllRead, 
  unreadCount,
  readAnnouncementIds,
  onMarkAsRead 
}: AnnouncementsTabProps) {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Record<string, boolean>>({});
  const [lastVisible, setLastVisible] = useState<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const res = await getAnnouncements(10, null);
        setAnnouncements(res.items);
        setLastVisible(res.lastVisible);
        setHasMore(res.items.length === 10);
      } catch (err) {
        console.error('[AnnouncementsTab] Failed to load announcements:', err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const loadMore = async () => {
    if (loadingMore || !lastVisible) return;
    try {
      setLoadingMore(true);
      const res = await getAnnouncements(10, lastVisible);
      setAnnouncements(prev => [...prev, ...res.items]);
      setLastVisible(res.lastVisible);
      setHasMore(res.items.length === 10);
    } catch (err) {
      console.error('[AnnouncementsTab] Failed to load more:', err);
    } finally {
      setLoadingMore(false);
    }
  };

  // お知らせが既読であるかを判定
  const isAnnouncementRead = (ann: Announcement) => {
    if (readAnnouncementIds.includes(ann.id)) {
      return true;
    }
    if (ann.publishedAt && lastReadAt) {
      return new Date(ann.publishedAt) <= new Date(lastReadAt);
    }
    return false;
  };

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => ({
      ...prev,
      [id]: !prev[id],
    }));
    // 展開する際、未読の場合は既読にする
    const ann = announcements.find((a) => a.id === id);
    if (ann && !isAnnouncementRead(ann)) {
      onMarkAsRead(id);
    }
  };

  const getTruncatedContent = (content: string) => {
    const html = parseMarkdownToHtml(content);
    const plainText = stripHtml(html);
    if (plainText.length <= 100) return plainText;
    return plainText.slice(0, 100) + '...';
  };

  const getCategoryIcon = (category: Announcement['category']) => {
    switch (category) {
      case 'important':
        return <ReportOutlined sx={{ fontSize: 16 }} className="text-rose-500 mr-1 shrink-0" />;
      case 'maintenance':
        return <WarningAmberOutlined sx={{ fontSize: 16 }} className="text-amber-500 mr-1 shrink-0" />;
      case 'update':
        return <RefreshOutlined sx={{ fontSize: 16 }} className="text-blue-500 mr-1 shrink-0" />;
      case 'bug':
        return <BugReportOutlined sx={{ fontSize: 16 }} className="text-rose-500 mr-1 shrink-0" />;
      case 'info':
      default:
        return <InfoOutlined sx={{ fontSize: 16 }} className="text-muted-foreground mr-1 shrink-0" />;
    }
  };

  const getCategoryLabel = (category: Announcement['category']) => {
    switch (category) {
      case 'important':
        return '重要';
      case 'maintenance':
        return 'メンテナンス';
      case 'update':
        return 'アップデート';
      case 'bug':
        return '不具合';
      case 'info':
      default:
        return '案内';
    }
  };

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
        <InfoOutlined sx={{ fontSize: 40 }} className="mx-auto mb-3 opacity-40" />
        <p>掲載中のお知らせはありません。</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {unreadCount > 0 && (
        <div className="flex justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onMarkAllRead} data-testid="announcements-mark-all-read-btn">
            <CheckOutlined sx={{ fontSize: 16 }} className="mr-1" />
            <span>すべて既読にする</span>
          </Button>
        </div>
      )}

      {announcements.map((ann) => {
        const isImportant = ann.category === 'important';
        const isRead = isAnnouncementRead(ann);
        return (
          <Card 
            key={ann.id} 
            className={cn(
              "relative overflow-hidden border cursor-pointer transition-colors",
              isImportant
                ? (isRead 
                    ? "border-rose-500 bg-rose-50/30 dark:bg-rose-950/10 hover:bg-rose-50/50 dark:hover:bg-rose-950/20"
                    : "border-rose-500 bg-rose-100/50 dark:bg-rose-950/30 hover:bg-rose-100/70 dark:hover:bg-rose-950/40")
                : (isRead
                    ? "border-border bg-card hover:bg-accent/5"
                    : "border-primary/30 bg-primary/5 hover:bg-primary/10")
            )}
            onClick={() => toggleExpand(ann.id)}
            data-testid="announcement-card"
          >
            {!isRead && (
              <span className="absolute top-4 right-4 size-2 rounded-full bg-primary" data-testid="announcement-unread-badge" />
            )}
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge 
                  variant={isImportant ? "destructive" : "outline"} 
                  className="flex items-center"
                >
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
              {expandedIds[ann.id] ? (
                <div
                  data-testid={`announcement-content-${ann.id}`}
                  className="text-sm leading-relaxed text-muted-foreground prose prose-sm max-w-none dark:prose-invert announcement-content"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(ann.content) }}
                />
              ) : (
                <div
                  data-testid={`announcement-content-${ann.id}`}
                  className="text-sm leading-relaxed text-muted-foreground announcement-content"
                >
                  {getTruncatedContent(ann.content)}
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {hasMore && (
        <div className="mt-4 flex justify-center">
          <Button 
            variant="outline" 
            onClick={loadMore} 
            disabled={loadingMore}
            data-testid="load-more-announcements-btn"
          >
            {loadingMore ? '読み込み中...' : 'もっと見る'}
          </Button>
        </div>
      )}
    </div>
  );
}
