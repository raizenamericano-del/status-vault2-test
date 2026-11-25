export type WAConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface WAState {
  status: WAConnectionStatus;
  phoneNumber: string | null;
  pairingCode: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
  hasAuth?: boolean;
  socketActive?: boolean;
}

export interface StatusMedia {
  id: string;
  whatsappId: string;
  mediaType: 'image' | 'video';
  contactName: string | null;
  contactJid: string | null;
  caption: string | null;
  mediaPath: string | null;
  thumbnailPath: string | null;
  mimetype: string | null;
  fileSize: number | null;
  timestamp: string | null;
  isSaved: boolean;
  createdAt: string;
  updatedAt: string;
  mediaUrl: string | null;
  thumbnailUrl: string | null;
}

export interface DownloadRecord {
  id: string;
  statusMediaId: string;
  fileName: string;
  filePath: string;
  fileSize: number | null;
  fileFormat: string | null;
  downloadedAt: string;
  downloadUrl: string | null;
  statusMedia?: {
    contactName: string | null;
    mediaType: string;
    caption: string | null;
  };
}

export interface StatsResponse {
  connection: WAState;
  totals: {
    statuses: number;
    images: number;
    videos: number;
    downloaded: number;
  };
  recentActivity: Array<{
    id: string;
    type: 'status_synced' | 'download';
    message: string;
    timestamp: string;
  }>;
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}
