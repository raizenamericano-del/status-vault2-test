import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';

export const settingsRouter = Router();

const defaults: Record<string, string> = {
  autoDownload: 'false',
  saveThumbnails: 'true',
  gallerySort: 'recent',
};

settingsRouter.get('/', async (_req, res, next) => {
  try {
    const rows = await prisma.appSettings.findMany();
    const map: Record<string, string> = { ...defaults };
    for (const r of rows) map[r.key] = r.value;
    res.json(map);
  } catch (e) { next(e); }
});

const updateSchema = z.object({
  autoDownload: z.enum(['true', 'false']).optional(),
  saveThumbnails: z.enum(['true', 'false']).optional(),
  gallerySort: z.enum(['recent', 'oldest']).optional(),
});

settingsRouter.put('/', async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Invalid settings', details: parsed.error.flatten() });
    const entries = Object.entries(parsed.data).filter(([, v]) => v !== undefined) as [string, string][];
    for (const [key, value] of entries) {
      await prisma.appSettings.upsert({
        where: { key },
        update: { value },
        create: { key, value },
      });
    }
    const rows = await prisma.appSettings.findMany();
    const map: Record<string, string> = { ...defaults };
    for (const r of rows) map[r.key] = r.value;
    res.json(map);
  } catch (e) { next(e); }
});
