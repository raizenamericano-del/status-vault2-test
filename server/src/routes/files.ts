import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import mime from 'mime-types';
import { DATA_DIR } from '../lib/config.js';
import { resolveDataPath, fileExistsSafe } from '../lib/paths.js';

export const filesRouter = Router();

const ALLOWED = new Set(['media', 'thumbs', 'downloads']);

filesRouter.get('/:kind/:name', (req, res) => {
  const { kind, name } = req.params;
  if (!ALLOWED.has(kind)) return res.status(404).json({ error: 'Not found' });

  // name may be encoded; prevent path separators
  const safeName = path.basename(name);
  if (safeName !== name || name.includes('..') || name.includes('/') || name.includes('\\')) {
    return res.status(400).json({ error: 'Invalid file name' });
  }

  const abs = path.resolve(DATA_DIR, kind, safeName);
  const dataResolved = path.resolve(DATA_DIR);
  if (!abs.startsWith(dataResolved + path.sep)) {
    return res.status(400).json({ error: 'Invalid path' });
  }
  if (!fileExistsSafe(abs)) return res.status(404).json({ error: 'File not found' });

  const contentType = mime.lookup(abs) || 'application/octet-stream';
  res.setHeader('Content-Type', contentType);
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Cache media/thumbs aggressively, downloads moderately
  if (kind === 'media' || kind === 'thumbs') {
    res.setHeader('Cache-Control', 'private, max-age=86400, immutable');
  } else {
    res.setHeader('Cache-Control', 'private, max-age=60');
  }

  if (req.query.download === '1') {
    res.setHeader('Content-Disposition', `attachment; filename="${safeName.replace(/"/g, '')}"`);
  }

  fs.createReadStream(abs).pipe(res);
});
