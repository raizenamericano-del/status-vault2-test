import { useEffect, useState, useCallback } from 'react';
import { Navigate } from 'react-router-dom';
import { Images, Video, Download, Database, Activity, RefreshCw, Wifi, WifiOff, Clock } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Skeleton } from '@/components/ui/Skeleton';
import { useSocket } from '@/lib/socket';
import { api } from '@/lib/api';
import type { StatsResponse } from '@/types';
import { cn, formatDate, timeAgo } from '@/lib/utils';

function StatCard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number | string; sub?: string }) {
  return (
    <Card className="panel-hover">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-text-muted uppercase tracking-wider">{label}</p>
            <p className="text-2xl font-semibold text-text-primary mt-2">{value}</p>
            {sub && <p className="text-[11px] text-text-muted mt-1">{sub}</p>}
          </div>
          <div className="h-9 w-9 rounded-lg bg-accent/10 border border-accent/15 flex items-center justify-center">
            <Icon size={16} className="text-accent" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ConnectionBadge({ status }: { status: string }) {
  const map: Record<string, { tone: 'accent' | 'warning' | 'danger' | 'muted'; label: string }> = {
    connected: { tone: 'accent', label: 'Connected' },
    connecting: { tone: 'warning', label: 'Connecting' },
    reconnecting: { tone: 'warning', label: 'Reconnecting' },
    error: { tone: 'danger', label: 'Error' },
    disconnected: { tone: 'muted', label: 'Disconnected' },
  };
  const s = map[status] || map.disconnected;
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export default function Dashboard() {
  const { waState, loaded, lastStatusEvent } = useSocket();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async (silent = false) => {
    if (!silent) setLoading(true); else setRefreshing(true);
    try {
      const data = await api.stats();
      setStats(data);
    } catch {
      // keep old stats on error
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  useEffect(() => {
    if (lastStatusEvent) fetchStats(true);
  }, [lastStatusEvent, fetchStats]);

  // Spec: if WhatsApp not connected, show Connect WhatsApp page
  if (loaded && waState.status === 'disconnected' && !waState.hasAuth) {
    return <Navigate to="/connection" replace />;
  }

  if (loading && !stats) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <Skeleton className="h-64 rounded-xl lg:col-span-2" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  const totals = stats?.totals;
  const conn = stats?.connection || waState;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm text-text-secondary">Overview of your WhatsApp status vault.</p>
        </div>
        <Button variant="secondary" size="sm" onClick={() => fetchStats(true)} loading={refreshing}>
          <RefreshCw size={14} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard icon={Database} label="Total Statuses" value={totals?.statuses ?? 0} sub="Synced to vault" />
        <StatCard icon={Images} label="Image Statuses" value={totals?.images ?? 0} sub="Photos available" />
        <StatCard icon={Video} label="Video Statuses" value={totals?.videos ?? 0} sub="Videos available" />
        <StatCard icon={Download} label="Downloaded" value={totals?.downloaded ?? 0} sub="Saved to downloads" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity size={16} className="text-accent" />
              <h2 className="text-sm font-semibold">Recent Activity</h2>
            </div>
            <span className="text-[11px] text-text-muted">Latest events</span>
          </CardHeader>
          <CardContent className="p-0">
            {stats?.recentActivity?.length ? (
              <div className="divide-y divide-border">
                {stats.recentActivity.map((a) => (
                  <div key={a.id} className="px-5 py-3.5 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={cn(
                        'h-8 w-8 rounded-lg flex items-center justify-center border shrink-0',
                        a.type === 'download' ? 'bg-accent/10 border-accent/15 text-accent' : 'bg-surface-2 border-border text-text-secondary'
                      )}>
                        {a.type === 'download' ? <Download size={14} /> : <Images size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-text-primary truncate">{a.message}</p>
                        <p className="text-[11px] text-text-muted">{timeAgo(a.timestamp)}</p>
                      </div>
                    </div>
                    <span className="text-[11px] text-text-muted whitespace-nowrap hidden sm:block">{formatDate(a.timestamp)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="px-5 py-12 text-center">
                <Activity size={28} className="mx-auto text-text-muted/40 mb-3" />
                <p className="text-sm text-text-secondary">No activity yet</p>
                <p className="text-xs text-text-muted mt-1">Status syncs and downloads will appear here.</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {conn.status === 'connected' ? <Wifi size={16} className="text-accent" /> : <WifiOff size={16} className="text-text-muted" />}
              <h2 className="text-sm font-semibold">Connection</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Status</span>
              <ConnectionBadge status={conn.status} />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Number</span>
              <span className="text-sm text-text-primary font-medium">{conn.phoneNumber ? `+${conn.phoneNumber}` : '—'}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-text-secondary">Last connected</span>
              <span className="text-sm text-text-primary">{conn.lastConnectedAt ? timeAgo(conn.lastConnectedAt) : '—'}</span>
            </div>
            {conn.lastError && (
              <div className="text-xs text-danger bg-danger/5 border border-danger/15 rounded-lg p-3">{conn.lastError}</div>
            )}
            <div className="pt-2 border-t border-border">
              <div className="flex items-center gap-2 text-[11px] text-text-muted">
                <Clock size={12} />
                <span>Realtime updates via WebSocket</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
