import React from 'react';
import { cn } from '@/lib/utils';

type Tone = 'default' | 'accent' | 'danger' | 'warning' | 'muted';

const tones: Record<Tone, string> = {
  default: 'bg-surface-2 text-text-secondary border-border',
  accent: 'bg-accent/12 text-accent border-accent/20',
  danger: 'bg-danger/12 text-danger border-danger/20',
  warning: 'bg-warning/12 text-warning border-warning/20',
  muted: 'bg-[#1f2327] text-text-muted border-border',
};

export function Badge({ className, tone = 'default', children }: { className?: string; tone?: Tone; children: React.ReactNode }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium border', tones[tone], className)}>
      {children}
    </span>
  );
}
