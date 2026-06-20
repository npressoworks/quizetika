'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { isAdminUser } from '@/lib/middleware-auth-cookies';
import { 
  adminGetAnnouncements, 
  createAnnouncement, 
  updateAnnouncement, 
  deleteAnnouncement,
  Announcement
} from '@/services/announcement';
import { parseMarkdownToHtml } from '@/lib/security/sanitize';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';

export default function AdminAnnouncementsClient() {
  const { user, loading } = useAuth();
  const router = useRouter();

  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loadingList, setLoadingList] = useState(true);

  // Form State
  const [isOpenForm, setIsOpenForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [category, setCategory] = useState<'info' | 'maintenance' | 'update'>('info');
  const [status, setStatus] = useState<'draft' | 'published'>('draft');
  const [isPreview, setIsPreview] = useState(false);

  // 認証チェック
  const isAdmin = Boolean(user && isAdminUser(user));

  useEffect(() => {
    if (!loading && !isAdmin) {
      router.push('/not-found');
    }
  }, [user, loading, isAdmin, router]);

  const loadAnnouncements = async () => {
    try {
      setLoadingList(true);
      const list = await adminGetAnnouncements();
      setAnnouncements(list);
    } catch (err) {
      console.error('[AdminAnnouncementsClient] Failed to load:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isAdmin) {
      loadAnnouncements();
    }
  }, [isAdmin]);

  if (loading || !isAdmin) return null;

  const handleOpenCreate = () => {
    setEditingId(null);
    setTitle('');
    setContent('');
    setCategory('info');
    setStatus('draft');
    setIsPreview(false);
    setIsOpenForm(true);
  };

  const handleOpenEdit = (ann: Announcement) => {
    setEditingId(ann.id);
    setTitle(ann.title);
    setContent(ann.content);
    setCategory(ann.category);
    setStatus(ann.status);
    setIsPreview(false);
    setIsOpenForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !content.trim()) return;

    try {
      if (editingId) {
        await updateAnnouncement(editingId, {
          title,
          content,
          category,
          status,
        });
      } else {
        await createAnnouncement({
          title,
          content,
          category,
          status,
          publishedAt: status === 'published' ? new Date() : null,
          authorId: user?.id || 'admin',
        });
      }
      setIsOpenForm(false);
      loadAnnouncements();
    } catch (err) {
      console.error('[AdminAnnouncementsClient] Save error:', err);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('このお知らせを削除しますか？')) return;
    try {
      await deleteAnnouncement(id);
      loadAnnouncements();
    } catch (err) {
      console.error('[AdminAnnouncementsClient] Delete error:', err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">お知らせ一覧</h2>
        <Button 
          onClick={handleOpenCreate}
          data-testid="open-create-announcement-btn"
        >
          新規お知らせ作成
        </Button>
      </div>

      {loadingList ? (
        <p className="text-sm text-muted-foreground">読み込み中...</p>
      ) : announcements.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            投稿されたお知らせはありません。
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {announcements.map((ann) => (
            <Card key={ann.id} className="relative">
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <Badge variant={ann.status === 'published' ? 'default' : 'secondary'}>
                    {ann.status === 'published' ? '公開中' : '下書き'}
                  </Badge>
                  <Badge variant="outline">
                    {ann.category === 'info' ? '案内' : ann.category === 'maintenance' ? 'メンテナンス' : 'アップデート'}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(ann.createdAt).toLocaleDateString('ja-JP')}
                  </span>
                </div>
                <CardTitle className="text-lg mt-1">{ann.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex justify-between items-start gap-4">
                <p className="text-sm text-muted-foreground truncate max-w-lg">
                  {ann.content.slice(0, 100)}
                </p>
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => handleOpenEdit(ann)}
                  >
                    編集
                  </Button>
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    onClick={() => handleDelete(ann.id)}
                  >
                    削除
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* お知らせフォームダイアログ */}
      <Dialog open={isOpenForm} onOpenChange={setIsOpenForm}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingId ? 'お知らせを編集' : '新規お知らせ作成'}
            </DialogTitle>
            <DialogDescription>
              運営からのお知らせ内容を編集し、下書きまたは公開ステータスで保存します。
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">タイトル</label>
              <Input
                placeholder="お知らせのタイトルを入力"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">カテゴリ</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={category}
                  onChange={(e) => setCategory(e.target.value as any)}
                >
                  <option value="info">一般案内 (info)</option>
                  <option value="maintenance">メンテナンス (maintenance)</option>
                  <option value="update">アップデート (update)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">ステータス</label>
                <select
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                >
                  <option value="draft">下書き (draft)</option>
                  <option value="published">公開 (published)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-sm font-medium">本文 (Markdown対応)</label>
                <Button 
                  type="button" 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setIsPreview(!isPreview)}
                >
                  {isPreview ? 'エディタを表示' : 'プレビューを表示'}
                </Button>
              </div>

              {isPreview ? (
                <div 
                  className="border rounded-md p-3 min-h-[150px] bg-muted/40 prose prose-sm max-w-none"
                  dangerouslySetInnerHTML={{ __html: parseMarkdownToHtml(content) }}
                />
              ) : (
                <Textarea
                  placeholder="お知らせの本文を入力 (Markdown対応)"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={6}
                  required
                />
              )}
            </div>

            <DialogFooter className="pt-4 border-t">
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => setIsOpenForm(false)}
              >
                キャンセル
              </Button>
              <Button 
                type="submit"
                data-testid="submit-announcement-btn"
                disabled={!title.trim() || !content.trim()}
              >
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
