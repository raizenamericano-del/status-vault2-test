import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
}

export function Modal({ open, onClose, title, children, className, wide }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cn(
        'relative w-full bg-surface border border-border rounded-xl shadow-panel animate-fade-in',
        wide ? 'max-w-5xl' : 'max-w-lg',
        className
      )}>
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
            <button onClick={onClose} className="p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors">
              <X size={16} />
            </button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} className="absolute top-3 right-3 z-10 p-1.5 rounded-md text-text-secondary hover:text-text-primary hover:bg-surface-2/80 transition-colors">
            <X size={16} />
          </button>
        )}
        <div className={cn(!title && 'pt-2')}>{children}</div>
      </div>
    </div>
  );
}
