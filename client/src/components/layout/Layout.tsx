import React, { useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Images, Download, Wifi, Settings, Info, Menu, X, Shield, Circle
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useSocket } from '@/lib/socket';
import type { WAConnectionStatus } from '@/types';

const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/gallery', label: 'Status Gallery', icon: Images },
  { to: '/downloads', label: 'Downloads', icon: Download },
  { to: '/connection', label: 'WhatsApp Connection', icon: Wifi },
  { to: '/settings', label: 'Settings', icon: Settings },
  { to: '/about', label: 'About', icon: Info },
];

function statusColor(status: WAConnectionStatus) {
  switch (status) {
    case 'connected': return 'text-accent';
    case 'connecting': case 'reconnecting': return 'text-warning';
    case 'error': return 'text-danger';
    default: return 'text-text-muted';
  }
}

function statusLabel(status: WAConnectionStatus) {
  switch (status) {
    case 'connected': return 'Connected';
    case 'connecting': return 'Connecting';
    case 'reconnecting': return 'Reconnecting';
    case 'error': return 'Error';
    default: return 'Disconnected';
  }
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { waState } = useSocket();
  const location = useLocation();

  const current = navItems.find((n) => n.to === location.pathname) || navItems[0];

  return (
    <div className="h-full min-h-screen bg-background text-text-primary flex">
      {/* Mobile overlay */}
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 lg:hidden" onClick={() => setMobileOpen(false)} />}

      {/* Sidebar */}
      <aside className={cn(
        'fixed lg:static inset-y-0 left-0 z-50 w-[260px] bg-[#101214] border-r border-border flex flex-col transition-transform duration-200',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="h-16 px-5 flex items-center justify-between border-b border-border">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-accent/15 border border-accent/20 flex items-center justify-center">
              <Shield size={16} className="text-accent" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-[0.08em] text-text-primary">STATUSVAULT</div>
              <div className="text-[10px] text-text-muted tracking-wide">WhatsApp Status Manager</div>
            </div>
          </div>
          <button className="lg:hidden p-1.5 text-text-secondary hover:text-text-primary" onClick={() => setMobileOpen(false)}>
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMobileOpen(false)}
                className={({ isActive }) => cn(
                  'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors duration-150',
                  isActive
                    ? 'bg-accent/10 text-accent border border-accent/15'
                    : 'text-text-secondary hover:text-text-primary hover:bg-surface-2 border border-transparent'
                )}
              >
                <Icon size={17} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}
        </nav>

        <div className="p-4 border-t border-border">
          <div className="panel p-3 bg-surface/50">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-text-muted uppercase tracking-wider">Connection</span>
              <Circle size={8} className={cn('fill-current', statusColor(waState.status), (waState.status === 'connecting' || waState.status === 'reconnecting') && 'animate-pulse-soft')} />
            </div>
            <div className={cn('text-sm font-medium', statusColor(waState.status))}>{statusLabel(waState.status)}</div>
            {waState.phoneNumber && (
              <div className="text-[11px] text-text-muted mt-0.5">+{waState.phoneNumber}</div>
            )}
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 lg:px-6 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button className="lg:hidden p-2 -ml-2 text-text-secondary hover:text-text-primary" onClick={() => setMobileOpen(true)}>
              <Menu size={20} />
            </button>
            <div>
              <h1 className="text-base font-semibold text-text-primary">{current.label}</h1>
              <p className="text-[11px] text-text-muted hidden sm:block">STATUSVAULT</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className={cn('hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs',
              waState.status === 'connected' ? 'border-accent/20 bg-accent/5 text-accent' :
              waState.status === 'error' ? 'border-danger/20 bg-danger/5 text-danger' :
              'border-border bg-surface text-text-secondary'
            )}>
              <Circle size={7} className={cn('fill-current', statusColor(waState.status), (waState.status === 'connecting' || waState.status === 'reconnecting') && 'animate-pulse-soft')} />
              {statusLabel(waState.status)}
            </div>
          </div>
        </header>

        <main className="flex-1 p-4 lg:p-6 overflow-auto">
          <div className="max-w-[1400px] mx-auto animate-fade-in">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
