import { useEffect, useState, useCallback } from 'react';
import { Download, Trash2, FileDown, Clock, HardDrive, FileType, Image as ImageIcon, Video } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import type { DownloadRecord } from '@/types';
import { formatBytes, formatDate } from '@/lib/utils';

export default function Downloads() {
  const { toast } = useToast();
  const [items, setItems] = useState<DownloadRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.downloads.list(1, 100);
      setItems(res.items);
    } catch (e: any) {
      toast(e.message || 'Failed to load downloads', 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const handleDelete = async (id: string) => {
    try {
      await api.downloads.delete(id);
      setItems((prev) => prev.filter((i) => i.id !== id));
      toast('Download record removed', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to delete', 'error');
    }
  };

  const handleClear = async () => {
    if (!confirm('Clear all download history and downloaded files?')) return;
    setClearing(true);
    try {
      await api.downloads.clear();
      setItems([]);
      toast('Download history cleared', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to clear', 'error');
    } finally {
      setClearing(false);
    }
  };

  const handleRedownload = (item: DownloadRecord) => {
    if (!item.downloadUrl) return;
    const a = document.createElement('a');
    a.href = `${item.downloadUrl}?download=1`;
    a.download = item.fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <p className="text-sm text-text-secondary">Files you've downloaded from STATUSVAULT. Stored in <span className="text-text-primary font-mono text-xs">/data/downloads/</span>.</p>
        {items.length > 0 && (
          <Button variant="danger" size="sm" onClick={handleClear} loading={clearing}>
            <Trash2 size={14} /> Clear History
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <FileDown size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Download History</h2>
          </div>
          <span className="text-xs text-text-muted">{items.length} file{items.length !== 1 ? 's' : ''}</span>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
            </div>
          ) : items.length === 0 ? (
            <div className="px-5 py-16 text-center">
              <div className="h-14 w-14 rounded-2xl bg-surface-2 border border-border flex items-center justify-center mx-auto mb-4">
                <Download size={24} className="text-text-muted" />
              </div>
              <h3 className="text-base font-semibold text-text-primary">No downloads yet</h3>
              <p className="text-sm text-text-secondary mt-2">Downloaded statuses will appear here.</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {items.map((item) => (
                <div key={item.id} className="px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-10 w-10 rounded-lg bg-surface-2 border border-border flex items-center justify-center shrink-0 text-text-muted">
                      {item.statusMedia?.mediaType === 'video' ? <Video size={16} /> : <ImageIcon size={16} />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-text-primary font-medium truncate">{item.fileName}</p>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-text-muted mt-0.5">
                        <span className="inline-flex items-center gap-1"><HardDrive size={11} /> {formatBytes(item.fileSize)}</span>
                        <span className="inline-flex items-center gap-1"><FileType size={11} /> {(item.fileFormat || '—').toUpper()}</span>
                        <span className="inline-flex items-center gap-1"><Clock size={11} /> {formatDate(item.downloadedAt)}</span>
                        {item.statusMedia?.contactName && <span>from {item.statusMedia.contactName}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {item.downloadUrl && (
                      <Button variant="secondary" size="sm" onClick={() => handleRedownload(item)}>
                        <Download size={14} /> Download
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(item.id)} className="text-text-muted hover:text-danger">
                      <Trash2 size={15} />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
