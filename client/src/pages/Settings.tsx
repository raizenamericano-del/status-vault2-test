import { useEffect, useState } from 'react';
import { Save, SlidersHorizontal, Database, FolderOpen, Shield } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Skeleton } from '@/components/ui/Skeleton';
import { useToast } from '@/components/ui/Toast';
import { api } from '@/lib/api';

export default function Settings() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<Record<string, string> | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.settings.get().then(setSettings).catch((e) => toast(e.message, 'error'));
  }, [toast]);

  const update = (key: string, value: string) => {
    setSettings((prev) => ({ ...(prev || {}), [key]: value }));
  };

  const save = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      const saved = await api.settings.update(settings);
      setSettings(saved);
      toast('Settings saved', 'success');
    } catch (e: any) {
      toast(e.message || 'Failed to save settings', 'error');
    } finally {
      setSaving(false);
    }
  };

  if (!settings) {
    return <div className="space-y-4 max-w-3xl"><Skeleton className="h-64 rounded-xl" /><Skeleton className="h-48 rounded-xl" /></div>;
  }

  return (
    <div className="space-y-6 max-w-3xl">
      <p className="text-sm text-text-secondary">Configure STATUSVAULT behavior for this instance.</p>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">General</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-text-primary">Default gallery sort</div>
              <div className="text-xs text-text-muted mt-0.5">Default ordering when opening the Status Gallery.</div>
            </div>
            <select
              value={settings.gallerySort || 'recent'}
              onChange={(e) => update('gallerySort', e.target.value)}
              className="h-9 rounded-lg border border-border bg-surface-2 px-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent/30 w-full sm:w-44"
            >
              <option value="recent">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
            <div>
              <div className="text-sm font-medium text-text-primary">Auto-download synced media</div>
              <div className="text-xs text-text-muted mt-0.5">Automatically save newly synced status media to the downloads folder.</div>
            </div>
            <Toggle
              checked={settings.autoDownload === 'true'}
              onChange={(v) => update('autoDownload', v ? 'true' : 'false')}
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-border">
            <div>
              <div className="text-sm font-medium text-text-primary">Generate thumbnails</div>
              <div className="text-xs text-text-muted mt-0.5">Create thumbnails for faster gallery loading.</div>
            </div>
            <Toggle
              checked={settings.saveThumbnails !== 'false'}
              onChange={(v) => update('saveThumbnails', v ? 'true' : 'false')}
            />
          </div>

          <div className="pt-4 border-t border-border">
            <Button onClick={save} loading={saving}><Save size={15} /> Save Settings</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Database size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Storage</h2>
          </div>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <InfoRow icon={FolderOpen} label="Data directory" value="/data" />
          <InfoRow icon={Database} label="Database" value="/data/statusvault.db" />
          <InfoRow icon={FolderOpen} label="WhatsApp auth" value="/data/auth/" />
          <InfoRow icon={FolderOpen} label="Downloads" value="/data/downloads/" />
          <InfoRow icon={FolderOpen} label="Media cache" value="/data/media/" />
          <div className="pt-3 border-t border-border text-[11px] text-text-muted leading-relaxed">
            All persistent data is stored under the <span className="font-mono text-text-secondary">/data</span> volume. Mount a Railway Persistent Volume to <span className="font-mono text-text-secondary">/data</span> to preserve data across deployments.
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Shield size={16} className="text-accent" />
            <h2 className="text-sm font-semibold">Security Note</h2>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-text-secondary leading-relaxed space-y-2">
          <p>STATUSVAULT has no login system by design. It is intended for private, self-hosted use by the server owner.</p>
          <p>Do not expose the instance publicly without network-level protection. Pairing and session management endpoints should only be reachable by trusted users.</p>
        </CardContent>
      </Card>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors border ${checked ? 'bg-accent/80 border-accent/40' : 'bg-surface-2 border-border'}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
    </button>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="flex items-center gap-2 text-text-secondary"><Icon size={14} className="text-text-muted" /> {label}</div>
      <span className="font-mono text-xs text-text-primary bg-surface-2 border border-border px-2 py-1 rounded">{value}</span>
    </div>
  );
}
