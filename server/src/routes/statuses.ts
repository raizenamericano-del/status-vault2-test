import { Router } from 'express';
import { z } from 'zod';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import mime from 'mime-types';
import { prisma } from '../lib/prisma.js';
import { DOWNLOADS_DIR } from '../lib/config.js';
import { resolveDataPath, fileExistsSafe } from '../lib/paths.js';

export const statusesRouter = Router();

const listSchema = z.object({
  category: z.enum(['all', 'images', 'videos', 'recent', 'saved']).optional().default('all'),
  q: z.string().optional().default(''),
  sort: z.enum(['recent', 'oldest']).optional().default('recent'),
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(60).optional().default(24),
});

function toPublicFileUrl(storedPath: string | null): string | null {
  if (!storedPath) return null;
  // stored as /data/media/xxx -> /api/files/media/xxx
  const m = storedPath.match(/^\/data\/(media|thumbs|downloads)\/(.+)$/);
  if (m) return `/api/files/${m[1]}/${encodeURIComponent(m[2])}`;
  return null;
}

function serializeStatus(s: any) {
  return {
    ...s,
    timestamp: s.timestamp?.toISOString() ?? null,
    createdAt: s.createdAt?.toISOString?.() ?? s.createdAt,
    updatedAt: s.updatedAt?.toISOString?.() ?? s.updatedAt,
    mediaUrl: toPublicFileUrl(s.mediaPath),
    thumbnailUrl: toPublicFileUrl(s.thumbnailPath),
  };
}

statusesRouter.get('/', async (req, res, next) => {
  try {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid query', details: parsed.error.flatten() });
    const { category, q, sort, page, limit } = parsed.data;

    const where: any = {};
    if (category === 'images') where.mediaType = 'image';
    if (category === 'videos') where.mediaType = 'video';
    if (category === 'saved') where.isSaved = true;
    if (category === 'recent') {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
      where.timestamp = { gte: since };
    }
    if (q && q.trim()) {
      const query = q.trim();
      where.OR = [
        { caption: { contains: query } },
        { contactName: { contains: query } },
        { contactJid: { contains: query } },
      ];
    }

    const orderBy = sort === 'oldest' ? { timestamp: 'asc' as const } : { timestamp: 'desc' as const };
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.statusMedia.count({ where }),
      prisma.statusMedia.findMany({ where, orderBy, skip, take: limit }),
    ]);

    res.json({
      items: items.map(serializeStatus),
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    });
  } catch (e) { next(e); }
});

statusesRouter.get('/:id', async (req, res, next) => {
  try {
    const item = await prisma.statusMedia.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Status not found' });
    res.json(serializeStatus(item));
  } catch (e) { next(e); }
});

statusesRouter.post('/:id/save', async (req, res, next) => {
  try {
    const item = await prisma.statusMedia.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Status not found' });
    const saved = typeof req.body?.saved === 'boolean' ? req.body.saved : !item.isSaved;
    const updated = await prisma.statusMedia.update({ where: { id: item.id }, data: { isSaved: saved } });
    res.json(serializeStatus(updated));
  } catch (e) { next(e); }
});

statusesRouter.post('/:id/download', async (req, res, next) => {
  try {
    const item = await prisma.statusMedia.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Status not found' });
    if (!item.mediaPath) return res.status(404).json({ error: 'Media file not available' });

    const absMedia = resolveDataPath(item.mediaPath);
    if (!fileExistsSafe(absMedia)) return res.status(404).json({ error: 'Media file missing on disk' });

    const ext = path.extname(absMedia) || (item.mediaType === 'image' ? '.jpg' : '.mp4');
    const safeBase = (item.contactName || 'status').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'status';
    const ts = item.timestamp ? item.timestamp.toISOString().replace(/[:.]/g, '-') : Date.now().toString();
    const fileName = `${safeBase}_${ts}${ext}`;
    const destAbs = path.join(DOWNLOADS_DIR, fileName);

    // Copy to downloads dir (don't move original)
    await fsp.copyFile(absMedia, destAbs);
    const stat = await fsp.stat(destAbs);
    const fileFormat = (mime.extension(item.mimetype || '') || ext.replace('.', '')).toString().toLowerCase();

    const record = await prisma.downloadHistory.create({
      data: {
        statusMediaId: item.id,
        fileName,
        filePath: `/data/downloads/${fileName}`,
        fileSize: stat.size,
        fileFormat,
      },
    });

    res.json({
      ok: true,
      download: {
        ...record,
        downloadedAt: record.downloadedAt.toISOString(),
        downloadUrl: `/api/files/downloads/${encodeURIComponent(fileName)}`,
      },
    });
  } catch (e) { next(e); }
});
