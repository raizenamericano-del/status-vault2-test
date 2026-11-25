import { useEffect, useMemo, useState } from 'react';
import { X, ChevronLeft, ChevronRight, Download, ZoomIn, ZoomOut, Info } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import type { StatusMedia } from '@/types';
import { formatDate, formatBytes } from '@/lib/utils';

interface Props {
  items: StatusMedia[];
  index: number;
  onClose: () => void;
  onIndexChange: (i: number) => void;
  onDownload: (item: StatusMedia) => void;
}

export function MediaViewer({ items, index, onClose, onIndexChange, onDownload }: Props) {
  const item = items[index];
  const [zoom, setZoom] = useState(1);
  const [showInfo, setShowInfo] = useState(false);

  useEffect(() => { setZoom(1); setShowInfo(false); }, [index]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') onIndexChange(Math.min(items.length - 1, index + 1));
      if (e.key === 'ArrowLeft') onIndexChange(Math.max(0, index - 1));
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [index, items.length, onClose, onIndexChange]);

  const hasPrev = index > 0;
  const hasNext = index < items.length - 1;

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col">
      {/* Top bar */}
      <div className="h-14 px-4 flex items-center justify-between border-b border-white/10 bg-black/40 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-medium text-white/90 truncate">{item.contactName || 'Unknown'}</span>
          <Badge tone={item.mediaType === 'image' ? 'default' : 'accent'} className="bg-white/10 border-white/10 text-white/80">
            {item.mediaType}
          </Badge>
        </div>
        <div className="flex items-center gap-1">
          {item.mediaType === 'image' && (
            <>
              <button onClick={() => setZoom((z) => Math.max(1, z - 0.25))} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md"><ZoomOut size={16} /></button>
              <button onClick={() => setZoom((z) => Math.min(3, z + 0.25))} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md"><ZoomIn size={16} /></button>
            </>
          )}
          <button onClick={() => setShowInfo((v) => !v)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md"><Info size={16} /></button>
          <button onClick={() => onDownload(item)} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md"><Download size={16} /></button>
          <button onClick={onClose} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-md ml-1"><X size={18} /></button>
        </div>
      </div>

      <div className="flex-1 flex min-h-0 relative">
        {/* Prev/Next */}
        {hasPrev && (
          <button onClick={() => onIndexChange(index - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 border border-white/10">
            <ChevronLeft size={20} />
          </button>
        )}
        {hasNext && (
          <button onClick={() => onIndexChange(index + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 text-white/80 hover:bg-black/60 border border-white/10">
            <ChevronRight size={20} />
          </button>
        )}

        {/* Media */}
        <div className="flex-1 flex items-center justify-center p-4 overflow-auto" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
          {item.mediaType === 'image' ? (
            item.mediaUrl ? (
              <img
                src={item.mediaUrl}
                alt={item.caption || 'Status image'}
                className="max-h-full max-w-full object-contain transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
                draggable={false}
              />
            ) : (
              <div className="text-white/50 text-sm">Image not available</div>
            )
          ) : (
            item.mediaUrl ? (
              <video
                src={item.mediaUrl}
                controls
                autoPlay
                className="max-h-full max-w-full rounded-lg"
              />
            ) : (
              <div className="text-white/50 text-sm">Video not available</div>
            )
          )}
        </div>

        {/* Info panel */}
        {showInfo && (
          <div className="w-72 shrink-0 border-l border-white/10 bg-[#111315] p-4 overflow-y-auto hidden md:block">
            <h4 className="text-xs uppercase tracking-wider text-white/50 mb-3">Information</h4>
            <dl className="space-y-3 text-sm">
              <div><dt className="text-white/40 text-xs">Contact</dt><dd className="text-white/90">{item.contactName || 'Unknown'}</dd></div>
              <div><dt className="text-white/40 text-xs">Type</dt><dd className="text-white/90 capitalize">{item.mediaType}</dd></div>
              <div><dt className="text-white/40 text-xs">Published</dt><dd className="text-white/90">{formatDate(item.timestamp)}</dd></div>
              <div><dt className="text-white/40 text-xs">Size</dt><dd className="text-white/90">{formatBytes(item.fileSize)}</dd></div>
              <div><dt className="text-white/40 text-xs">Format</dt><dd className="text-white/90">{item.mimetype || '—'}</dd></div>
              {item.caption && <div><dt className="text-white/40 text-xs">Caption</dt><dd className="text-white/90 whitespace-pre-wrap break-words">{item.caption}</dd></div>}
            </dl>
          </div>
        )}
      </div>

      {/* Caption bar */}
      {item.caption && !showInfo && (
        <div className="px-4 py-3 border-t border-white/10 bg-black/40 text-sm text-white/80 text-center truncate shrink-0">
          {item.caption}
        </div>
      )}
    </div>
  );
}
