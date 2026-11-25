import { Shield, Server, Database, Lock, Info, Layers, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';

export default function About() {
  return (
    <div className="space-y-6 max-w-4xl">
      <div className="panel p-6 sm:p-8">
        <div className="flex items-center gap-4 mb-4">
          <div className="h-12 w-12 rounded-xl bg-accent/10 border border-accent/20 flex items-center justify-center">
            <Shield size={22} className="text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-[0.06em] text-text-primary">STATUSVAULT</h2>
            <p className="text-sm text-text-secondary">Premium Self-Hosted WhatsApp Status Manager</p>
          </div>
        </div>
        <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
          STATUSVAULT is a private, self-hosted application for connecting your own WhatsApp account via Baileys pairing code, syncing available statuses, previewing media, and managing downloads. It is designed for single-owner use with local SQLite storage and a simple deployment model.
        </p>
        <div className="flex flex-wrap gap-2 mt-4">
          <Badge tone="accent">Self-hosted</Badge>
          <Badge tone="default">No login</Badge>
          <Badge tone="default">SQLite</Badge>
          <Badge tone="default">Single instance</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Layers size={16} className="text-accent" /><h3 className="text-sm font-semibold">Technology</h3></div>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary space-y-2">
            <Row label="Frontend" value="React + Vite + TypeScript" />
            <Row label="UI" value="Tailwind CSS + Lucide + Framer Motion" />
            <Row label="Backend" value="Node.js + Express + TypeScript" />
            <Row label="Realtime" value="Socket.IO" />
            <Row label="WhatsApp" value="@whiskeysockets/baileys" />
            <Row label="Database" value="SQLite + Prisma ORM" />
            <Row label="Media" value="Sharp + FFmpeg" />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2"><Lock size={16} className="text-accent" /><h3 className="text-sm font-semibold">Privacy & Security</h3></div>
          </CardHeader>
          <CardContent className="text-sm text-text-secondary space-y-3 leading-relaxed">
            <p>STATUSVAULT is intended for private use by the server owner. There is no user registration or multi-user system.</p>
            <p>WhatsApp credentials are stored locally under the persistent data volume and are never sent to the frontend. Do not expose this instance publicly without network-level access control.</p>
            <p>Only connect WhatsApp accounts you own or have explicit permission to manage.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2"><AlertTriangle size={16} className="text-warning" /><h3 className="text-sm font-semibold">Baileys / WhatsApp Limitations</h3></div>
        </CardHeader>
        <CardContent className="text-sm text-text-secondary space-y-3 leading-relaxed">
          <p>STATUSVAULT relies on <span className="text-text-primary">@whiskeysockets/baileys</span>, an unofficial WhatsApp Web API library. WhatsApp may change protocols at any time, which can affect connectivity or status synchronization.</p>
          <p>Status availability depends on WhatsApp privacy settings, account permissions, and what Baileys receives. Not all statuses may be available immediately after connection; STATUSVAULT syncs statuses that are received by the connected session.</p>
          <p>This application does not bypass WhatsApp privacy controls and does not access statuses that are not available to the connected account.</p>
        </CardContent>
      </Card>

      <div className="text-[11px] text-text-muted flex items-center gap-2 px-1">
        <Info size={12} />
        <span>STATUSVAULT v1.0.0 · Built for private self-hosted deployment</span>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-1 border-b border-border/50 last:border-0">
      <span className="text-text-muted">{label}</span>
      <span className="text-text-primary text-right">{value}</span>
    </div>
  );
}
