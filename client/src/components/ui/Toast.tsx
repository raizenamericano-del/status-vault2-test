import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { X, CheckCircle2, AlertCircle, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem { id: string; message: string; tone: ToastTone; }

interface ToastContextValue {
  toast: (message: string, tone?: ToastTone) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const toast = useCallback((message: string, tone: ToastTone = 'info') => {
    const id = Math.random().toString(36).slice(2);
    setItems((prev) => [...prev, { id, message, tone }]);
    setTimeout(() => setItems((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);

  const remove = useCallback((id: string) => setItems((prev) => prev.filter((t) => t.id !== id)), []);
  const value = useMemo(() => ({ toast }), [toast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex flex-col gap-2 w-[min(360px,calc(100vw-2rem))]">
        {items.map((t) => {
          const Icon = t.tone === 'success' ? CheckCircle2 : t.tone === 'error' ? AlertCircle : Info;
          const toneClass = t.tone === 'success' ? 'text-accent' : t.tone === 'error' ? 'text-danger' : 'text-text-secondary';
          return (
            <div key={t.id} className="panel shadow-panel px-4 py-3 flex items-start gap-3 animate-fade-in">
              <Icon size={16} className={cn('mt-0.5 shrink-0', toneClass)} />
              <p className="text-sm text-text-primary flex-1">{t.message}</p>
              <button onClick={() => remove(t.id)} className="text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}
