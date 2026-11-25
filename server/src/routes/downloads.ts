import { Router } from 'express';
import { z } from 'zod';
import fsp from 'fs/promises';
import path from 'path';
import { prisma } from '../lib/prisma.js';
import { resolveDataPath, fileExistsSafe } from '../lib/paths.js';

export const downloadsRouter = Router();

downloadsRouter.get('/', async (req, res, next) => {
  try {
    const schema = z.object({
      page: z.coerce.number().int().min(1).optional().default(1),
      limit: z.coerce.number().int().min(1).max(100).optional().default(50),
    });
    const { page, limit } = schema.parse(req.query);
    const skip = (page - 1) * limit;
    const [total, items] = await Promise.all([
      prisma.downloadHistory.count(),
      prisma.downloadHistory.findMany({
        orderBy: { downloadedAt: 'desc' },
        skip,
        take: limit,
        include: { statusMedia: { select: { contactName: true, mediaType: true, caption: true } } },
      }),
    ]);

    res.json({
      items: items.map((d) => ({
        ...d,
        downloadedAt: d.downloadedAt.toISOString(),
        downloadUrl: d.filePath.startsWith('/data/downloads/')
          ? `/api/files/downloads/${encodeURIComponent(path.basename(d.filePath))}`
          : null,
      })),
      total,
      page,
      limit,
      hasMore: skip + items.length < total,
    });
  } catch (e) { next(e); }
});

downloadsRouter.delete('/:id', async (req, res, next) => {
  try {
    const item = await prisma.downloadHistory.findUnique({ where: { id: req.params.id } });
    if (!item) return res.status(404).json({ error: 'Download record not found' });
    const abs = resolveDataPath(item.filePath);
    if (fileExistsSafe(abs)) await fsp.unlink(abs).catch(() => {});
    await prisma.downloadHistory.delete({ where: { id: item.id } });
    res.json({ ok: true });
  } catch (e) { next(e); }
});

downloadsRouter.delete('/', async (_req, res, next) => {
  try {
    const items = await prisma.downloadHistory.findMany();
    for (const item of items) {
      const abs = resolveDataPath(item.filePath);
      if (fileExistsSafe(abs)) await fsp.unlink(abs).catch(() => {});
    }
    await prisma.downloadHistory.deleteMany({});
    res.json({ ok: true });
  } catch (e) { next(e); }
});
