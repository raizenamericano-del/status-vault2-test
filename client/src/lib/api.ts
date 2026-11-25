import type { DownloadRecord, Paginated, StatsResponse, StatusMedia, WAState } from '@/types';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      msg = body.error || body.message || msg;
    } catch {}
    throw new Error(msg);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => request<{ ok: boolean }>('/health'),

  wa: {
    status: () => request<WAState>('/api/whatsapp/status'),
    connect: (phoneNumber: string) =>
      request<{ ok: boolean; pairingCode: string | null; state: WAState }>('/api/whatsapp/connect', {
        method: 'POST',
        body: JSON.stringify({ phoneNumber }),
      }),
    reconnect: () =>
      request<{ ok: boolean; pairingCode: string | null; state: WAState }>('/api/whatsapp/reconnect', { method: 'POST' }),
    disconnect: () =>
      request<{ ok: boolean; state: WAState }>('/api/whatsapp/disconnect', { method: 'POST' }),
    deleteSession: () =>
      request<{ ok: boolean; state: WAState }>('/api/whatsapp/session', { method: 'DELETE' }),
  },

  statuses: {
    list: (params: { category?: string; q?: string; sort?: string; page?: number; limit?: number }) => {
      const sp = new URLSearchParams();
      if (params.category) sp.set('category', params.category);
      if (params.q) sp.set('q', params.q);
      if (params.sort) sp.set('sort', params.sort);
      if (params.page) sp.set('page', String(params.page));
      if (params.limit) sp.set('limit', String(params.limit));
      return request<Paginated<StatusMedia>>(`/api/statuses?${sp.toString()}`);
    },
    get: (id: string) => request<StatusMedia>(`/api/statuses/${id}`),
    toggleSave: (id: string, saved?: boolean) =>
      request<StatusMedia>(`/api/statuses/${id}/save`, { method: 'POST', body: JSON.stringify({ saved }) }),
    download: (id: string) =>
      request<{ ok: boolean; download: DownloadRecord }>(`/api/statuses/${id}/download`, { method: 'POST' }),
  },

  downloads: {
    list: (page = 1, limit = 50) => request<Paginated<DownloadRecord>>(`/api/downloads?page=${page}&limit=${limit}`),
    delete: (id: string) => request<{ ok: true }>(`/api/downloads/${id}`, { method: 'DELETE' }),
    clear: () => request<{ ok: true }>('/api/downloads', { method: 'DELETE' }),
  },

  settings: {
    get: () => request<Record<string, string>>('/api/settings'),
    update: (data: Record<string, string>) => request<Record<string, string>>('/api/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },

  stats: () => request<StatsResponse>('/api/stats'),
};
