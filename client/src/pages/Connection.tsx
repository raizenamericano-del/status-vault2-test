import { useEffect, useMemo, useState } from 'react';
import { Smartphone, Link2, Unplug, Trash2, RefreshCw, ShieldCheck, AlertCircle, CheckCircle2, Loader2, KeyRound } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { useSocket } from '@/lib/socket';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';
import { cn, formatDate } from '@/lib/utils';
import type { WAConnectionStatus } from '@/types';

function statusBadge(status: WAConnectionStatus) {
  const map: Record<WAConnectionStatus, { tone: 'accent' | 'warning' | 'danger' | 'muted'; label: string }> = {
    connected: { tone: 'accent', label: 'Connected' },
    connecting: { tone: 'warning', label: 'Connecting' },
    reconnecting: { tone: 'warning', label: 'Reconnecting' },
    error: { tone: 'danger', label: 'Error' },
    disconnected: { tone: 'muted', label: 'Disconnected' },
  };
  const s = map[status];
  return <Badge tone={s.tone}>{s.label}</Badge>;
}

export default function Connection() {
  const { waState, setWaState } = useSocket();
  const { toast } = useToast();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    if (waState.phoneNumber && !phone) setPhone(waState.phoneNumber);
  }, [waState.phoneNumber]); // eslint-disable-line

  const canConnect = useMemo(() => phone.replace(/[^0-9]/g, '').length >= 8, [phone]);

  const handleConnect = async () => {
    if (!canConnect) {
      toast('Enter a valid phone number with country code.', 'error');
      return;
    }
    setLoading(true);
    try {
      const res = await api.wa.connect(phone);
      setWaState(res.state);
      if (res.pairingCode) {
        toast('Pairing code generated. Enter it in WhatsApp on your phone.', 'success');
      } else if (res.state.status === 'connected') {
        toast('WhatsApp is connected.', 'success');
      } else {
        toast('Connection initiated. Waiting for pairing...', 'info');
      }
    } catch (e: any) {
      toast(e.message || 'Failed to connect', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleReconnect = async () => {
    setActionLoading('reconnect');
    try {
      const res = await api.wa.reconnect();
      setWaState(res.state);
      toast('Reconnect initiated.', 'info');
    } catch (e: any) {
      toast(e.message || 'Reconnect failed', 'error');
    } finally { setActionLoading(null); }
  };

  const handleDisconnect = async () => {
    setActionLoading('disconnect');
    try {
      const res = await api.wa.disconnect();
      setWaState(res.state);
      toast('Disconnected from WhatsApp.', 'success');
    } catch (e: any) {
      toast(e.message || 'Disconnect failed', 'error');
    } finally { setActionLoading(null); }
  };

  const handleDelete = async () => {
    if (!confirm('Delete WhatsApp session and clear synced status data? This cannot be undone.')) return;
    setActionLoading('delete');
    try {
      const res = await api.wa.deleteSession();
      setWaState(res.state);
      setPhone('');
      toast('Session deleted.', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to delete session', 'error');
    } finally { setActionLoading(null); }
  };

  const pairingDisplay = waState.pairingCode ? waState.pairingCode.replace(/(.{4})/g, '$1-').replace(/-$/, '') : null;

  return (
    <div className="space-y-6 max-w-4xl">
      <div className="flex flex-col gap-2">
        <p className="text-text-secondary text-sm">
          Connect your WhatsApp account using a pairing code. STATUSVAULT uses Baileys to link with your own WhatsApp account and sync available statuses.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <Card className="lg:col-span-3">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Smartphone size={16} className="text-accent" />
                <h2 className="text-sm font-semibold">Connect WhatsApp</h2>
              </div>
              {statusBadge(waState.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {waState.status !== 'connected' ? (
              <>
                <div className="space-y-2">
                  <label className="text-xs text-text-secondary font-medium">WhatsApp Phone Number</label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="e.g. 6281234567890"
                    inputMode="tel"
                  />
                  <p className="text-[11px] text-text-muted">Include country code. Digits only, no spaces or + required.</p>
                </div>

                <Button onClick={handleConnect} loading={loading} disabled={!canConnect} className="w-full sm:w-auto">
                  <KeyRound size={16} />
                  {waState.pairingCode ? 'Regenerate Pairing Code' : 'Generate Pairing Code'}
                </Button>

                {waState.pairingCode && (
                  <div className="rounded-xl border border-accent/20 bg-accent/5 p-5">
                    <div className="text-xs text-accent font-medium mb-2 uppercase tracking-wider">Your Pairing Code</div>
                    <div className="text-3xl sm:text-4xl font-semibold tracking-[0.2em] text-text-primary font-mono">
                      {pairingDisplay}
                    </div>
                    <div className="mt-4 text-sm text-text-secondary space-y-1">
                      <p>1. Open WhatsApp on your phone.</p>
                      <p>2. Go to <span className="text-text-primary">Linked Devices</span> &rarr; <span className="text-text-primary">Link a device</span>.</p>
                      <p>3. Tap <span className="text-text-primary">Link with phone number instead</span>.</p>
                      <p>4. Enter this pairing code.</p>
                    </div>
                  </div>
                )}

                {(waState.status === 'connecting' || waState.status === 'reconnecting') && !waState.pairingCode && (
                  <div className="flex items-center gap-3 text-sm text-text-secondary p-4 rounded-lg bg-surface-2 border border-border">
                    <Loader2 size={16} className="animate-spin text-accent" />
                    Waiting for WhatsApp connection...
                  </div>
                )}

                {waState.lastError && (
                  <div className="flex items-start gap-3 text-sm text-danger p-4 rounded-lg bg-danger/5 border border-danger/15">
                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                    <div>
                      <div className="font-medium">Connection issue</div>
                      <div className="text-danger/80 mt-0.5">{waState.lastError}</div>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 rounded-xl bg-accent/5 border border-accent/15">
                  <CheckCircle2 size={20} className="text-accent" />
                  <div>
                    <div className="text-sm font-medium text-text-primary">WhatsApp Connected</div>
                    <div className="text-xs text-text-secondary mt-0.5">
                      {waState.phoneNumber ? `+${waState.phoneNumber}` : 'Account linked'}
                      {waState.lastConnectedAt ? ` · connected ${formatDate(waState.lastConnectedAt)}` : ''}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-text-secondary">
                  STATUSVAULT is listening for available WhatsApp status updates. Statuses that are visible to this account and received by Baileys will appear in the Gallery.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-accent" />
              <h2 className="text-sm font-semibold">Session Controls</h2>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="text-xs text-text-muted mb-2">
              Manage the WhatsApp session for this STATUSVAULT instance.
            </div>
            <Button variant="secondary" className="w-full justify-start" onClick={handleReconnect} loading={actionLoading === 'reconnect'}>
              <RefreshCw size={15} /> Reconnect
            </Button>
            <Button variant="secondary" className="w-full justify-start" onClick={handleDisconnect} loading={actionLoading === 'disconnect'}>
              <Unplug size={15} /> Disconnect
            </Button>
            <Button variant="danger" className="w-full justify-start" onClick={handleDelete} loading={actionLoading === 'delete'}>
              <Trash2 size={15} /> Delete Session
            </Button>

            <div className="pt-3 border-t border-border mt-4 space-y-2 text-[11px] text-text-muted leading-relaxed">
              <p><span className="text-text-secondary">Private instance.</span> STATUSVAULT stores credentials locally in your persistent data volume.</p>
              <p>Credentials are never sent to the frontend. Do not expose this instance publicly without network protection.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
