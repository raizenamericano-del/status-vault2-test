import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { StatusMedia, WAState } from '@/types';
import { api } from './api';

interface SocketContextValue {
  waState: WAState;
  setWaState: React.Dispatch<React.SetStateAction<WAState>>;
  lastStatusEvent: StatusMedia | null;
  connected: boolean;
  loaded: boolean;
}

const defaultWA: WAState = {
  status: 'disconnected',
  phoneNumber: null,
  pairingCode: null,
  lastConnectedAt: null,
  lastError: null,
};

const SocketContext = createContext<SocketContextValue | null>(null);

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const [waState, setWaState] = useState<WAState>(defaultWA);
  const [lastStatusEvent, setLastStatusEvent] = useState<StatusMedia | null>(null);
  const [connected, setConnected] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const sockRef = useRef<Socket | null>(null);

  useEffect(() => {
    // Initial fetch
    api.wa.status().then((s) => { setWaState(s); setLoaded(true); }).catch(() => setLoaded(true));

    const socket = io({
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });
    sockRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));
    socket.on('wa:state', (state: WAState) => { setWaState(state); setLoaded(true); });
    socket.on('status:new', (status: StatusMedia) => setLastStatusEvent(status));

    return () => {
      socket.close();
      sockRef.current = null;
    };
  }, []);

  const value = useMemo(() => ({ waState, setWaState, lastStatusEvent, connected, loaded }), [waState, lastStatusEvent, connected, loaded]);
  return <SocketContext.Provider value={value}>{children}</SocketContext.Provider>;
}

export function useSocket() {
  const ctx = useContext(SocketContext);
  if (!ctx) throw new Error('useSocket must be used within SocketProvider');
  return ctx;
}
