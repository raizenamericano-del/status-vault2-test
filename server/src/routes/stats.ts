import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { whatsappService } from '../services/whatsapp.js';

export const statsRouter = Router();

statsRouter.get('/', async (_req, res, next) => {
  try {
    const [totalStatuses, imageStatuses, videoStatuses, totalDownloaded, recentStatuses, recentDownloads] = await Promise.all([
      prisma.statusMedia.count(),
      prisma.statusMedia.count({ where: { mediaType: 'image' } }),
      prisma.statusMedia.count({ where: { mediaType: 'video' } }),
      prisma.downloadHistory.count(),
      prisma.statusMedia.findMany({ orderBy: { createdAt: 'desc' }, take: 8 }),
      prisma.downloadHistory.findMany({ orderBy: { downloadedAt: 'desc' }, take: 5, include: { statusMedia: { select: { contactName: true, mediaType: true } } } }),
    ]);

    const wa = await whatsappService.getConnectionHealth();

    const recentActivity = [
      ...recentStatuses.map((s) => ({
        id: `status-${s.id}`,
        type: 'status_synced' as const,
        message: `${s.mediaType === 'image' ? 'Image' : 'Video'} status synced${s.contactName ? ` from ${s.contactName}` : ''}`,
        timestamp: s.createdAt.toISOString(),
      })),
      ...recentDownloads.map((d) => ({
        id: `dl-${d.id}`,
        type: 'download' as const,
        message: `Downloaded ${d.fileName}`,
        timestamp: d.downloadedAt.toISOString(),
      })),
    ]
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, 10);

    res.json({
      connection: wa,
      totals: {
        statuses: totalStatuses,
        images: imageStatuses,
        videos: videoStatuses,
        downloaded: totalDownloaded,
      },
      recentActivity,
    });
  } catch (e) { next(e); }
});
