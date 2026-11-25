import { useEffect, useRef, useState, useCallback } from 'react';
import { Search, Image as ImageIcon, Video, Clock, Bookmark, Download, Eye, RefreshCw, Filter, Play } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import type { StatusMedia } from '@/types';
import { cn, formatDate, timeAgo } from '@/lib/utils';
import { MediaViewer } from '@/components/status/MediaViewer';

const categories = [
  { id: 'all', label: 'All Status', icon: Filter },
  { id: 'images', label: 'Images', icon: ImageIcon },
  { id: 'videos', label: 'Videos', icon: Video },
  { id: 'recent', label: 'Recent', icon: Clock },
  { id: 'saved', label: 'Saved', icon: Bookmark },
] as const;

type Category = typeof categories[number]['id'];

export default function Gallery() {
  const { toast } = useToast();
  const { lastStatusEvent } = useSocket();
  const [category, setCategory] = useState<Category>('all');
  const [q, setQ] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [sort, setSort] = useState<'recent' | 'oldest'>('recent');
  const [items, setItems] = useState<StatusMedia[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const requestIdRef = useRef(0);
  const initializedSort = useRef(false);

  useEffect(() => {
    if (initializedSort.current) return;
    initializedSort.current = true;
    api.settings.get().then((s) => {
      if (s.gallerySort === 'oldest' || s.gallerySort === 'recent') setSort(s.gallerySort);
    }).catch(() => {});
  }, []);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => setQ(searchInput.trim()), 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  const fetchPage = useCallback(async (p: number, append: boolean) => {
    const reqId = ++requestIdRef.current;
    if (append) setLoadingMore(true); else setLoading(true);
    try {
      const res = await api.statuses.list({ category, q, sort, page: p, limit: 24 });
      if (reqId !== requestIdRef.current) return;
      setItems((prev) => append ? [...prev, ...res.items] : res.items);
      setHasMore(res.hasMore);
      setTotal(res.total);
      setPage(p);
    } catch (e: any) {
      if (reqId !== requestIdRef.current) return;
      toast(e.message || 'Failed to load statuses', 'error');
    } finally {
      if (reqId === requestIdRef.current) { setLoading(false); setLoadingMore(false); }
    }
  }, [category, q, sort, toast]);

  useEffect(() => {
    fetchPage(1, false);
  }, [fetchPage]);

  // Infinite scroll
  useEffect(() => {
    if (!sentinelRef.current) return;
    const el = sentinelRef.current;
    const obs = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && hasMore && !loading && !loadingMore) {
        fetchPage(page + 1, true);
      }
    }, { rootMargin: '400px' });
    obs.observe(el);
    return () => obs.disconnect();
  }, [hasMore, loading, loadingMore, page, fetchPage]);

  // Realtime new status
  useEffect(() => {
    if (!lastStatusEvent) return;
    // If it matches current filter roughly, prepend (simple approach: refetch page 1 silently)
    fetchPage(1, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lastStatusEvent]);

  const handleDownload = async (item: StatusMedia) => {
    try {
      const res = await api.statuses.download(item.id);
      toast('Download saved to history', 'success');
      if (res.download.downloadUrl) {
        const a = document.createElement('a');
        a.href = `${res.download.downloadUrl}?download=1`;
        a.download = res.download.fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
    } catch (e: any) {
      toast(e.message || 'Download failed', 'error');
    }
  };

  const handleToggleSave = async (item: StatusMedia) => {
    try {
      const updated = await api.statuses.toggleSave(item.id);
      setItems((prev) => prev.map((p) => p.id === item.id ? updated : p));
      toast(updated.isSaved ? 'Saved to collection' : 'Removed from saved', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to update', 'error');
    }
  };

  const openViewer = (item: StatusMedia) => {
    const idx = items.findIndex((i) => i.id === item.id);
    if (idx >= 0) setViewerIndex(idx);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
          <p className="text-sm text-text-secondary">{total} status{total !== 1 ? 'es' : ''} in vault</p>
          <div className="flex items-center gap-2">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as 'recent' | 'oldest')}
              className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <Button variant="secondary" size="sm" onClick={() => fetchPage(1, false)} loading={loading && items.length > 0}>
              <RefreshCw size={14} />
            </Button>
          </div>
        </div>

        <div className="flex flex-col lg:flex-row gap-3">
          <div className="relative flex-1">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Search by contact or caption..." className="pl-9" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {categories.map((c) => {
              const Icon = c.icon;
              const active = category === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setCategory(c.id)}
                  className={cn(
                    'inline-flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap border transition-colors',
                    active ? 'bg-accent/10 text-accent border-accent/20' : 'bg-surface text-text-secondary border-border hover:text-text-primary hover:bg-surface-2'
                  )}
                >
                  <Icon size={14} /> {c.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => <Skeleton key={i} className="h-72 rounded-xl" />)}
        </div>
      ) : items.length === 0 ? (
        <div className="panel py-20 text-center px-6">
          <div className="h-14 w-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-4">
            <ImageIcon size={24} className="text-text-muted" />
          </div>
          <h3 className="text-base font-semibold text-text-primary">No statuses found</h3>
          <p className="text-sm text-text-secondary mt-2 max-w-md mx-auto">
            {q ? 'Try a different search or filter.' : 'Connect WhatsApp and wait for available statuses to sync. STATUSVAULT only shows statuses that are available to the connected account.'}
          </p>
        </div>
      ) : (
        <>
          <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-4 [column-fill:_balance]">
            {items.map((item) => (
              <div key={item.id} className="break-inside-avoid mb-4">
                <Card className="overflow-hidden panel-hover group">
                  <div className="relative bg-[#111315] cursor-pointer" onClick={() => openViewer(item)}>
                    {item.thumbnailUrl || item.mediaUrl ? (
                      item.mediaType === 'image' ? (
                        <img src={item.thumbnailUrl || item.mediaUrl!} alt={item.caption || 'Status'} className="w-full h-auto block" loading="lazy" />
                      ) : (
                        <div className="relative">
                          {item.thumbnailUrl ? (
                            <img src={item.thumbnailUrl} alt={item.caption || 'Video status'} className="w-full h-auto block" loading="lazy" />
                          ) : (
                            <div className="aspect-video flex items-center justify-center bg-surface-2"><Video size={28} className="text-text-muted" /></div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="h-11 w-11 rounded-full bg-black/50 border border-white/15 flex items-center justify-center">
                              <Play size={18} className="text-white ml-0.5" />
                            </div>
                          </div>
                        </div>
                      )
                    ) : (
                      <div className="aspect-[4/5] flex items-center justify-center bg-surface-2">
                        {item.mediaType === 'image' ? <ImageIcon size={28} className="text-text-muted" /> : <Video size={28} className="text-text-muted" />}
                      </div>
                    )}
                    <div className="absolute top-2 left-2">
                      <Badge tone={item.mediaType === 'video' ? 'accent' : 'default'} className="bg-black/45 border-white/10 text-white/90 backdrop-blur-sm">
                        {item.mediaType}
                      </Badge>
                    </div>
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-text-primary truncate">{item.contactName || 'Unknown'}</p>
                        <p className="text-[11px] text-text-muted">{item.timestamp ? timeAgo(item.timestamp) : '—'}</p>
                      </div>
                      <button
                        onClick={() => handleToggleSave(item)}
                        className={cn('p-1.5 rounded-md transition-colors shrink-0', item.isSaved ? 'text-accent bg-accent/10' : 'text-text-muted hover:text-text-primary hover:bg-surface-2')}
                        title={item.isSaved ? 'Remove from saved' : 'Save'}
                      >
                        <Bookmark size={14} className={item.isSaved ? 'fill-current' : ''} />
                      </button>
                    </div>
                    {item.caption && <p className="text-xs text-text-secondary line-clamp-2 whitespace-pre-wrap break-words">{item.caption}</p>}
                    <div className="flex items-center gap-2 pt-1">
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => openViewer(item)}>
                        <Eye size={14} /> Preview
                      </Button>
                      <Button variant="secondary" size="sm" className="flex-1" onClick={() => handleDownload(item)}>
                        <Download size={14} /> Download
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ))}
          </div>
          <div ref={sentinelRef} className="h-8" />
          {loadingMore && (
            <div className="flex justify-center py-4">
              <div className="flex items-center gap-2 text-sm text-text-muted">
                <div className="h-4 w-4 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
                Loading more...
              </div>
            </div>
          )}
        </>
      )}

      {viewerIndex !== null && (
        <MediaViewer
          items={items}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
          onDownload={handleDownload}
        />
      )}
    </div>
  );
}
