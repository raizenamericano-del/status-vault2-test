import './lib/config.js'; // ensure env loaded first
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import http from 'http';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { Server as SocketIOServer } from 'socket.io';
import { ensureDataDirs, PORT, IS_PROD, CORS_ORIGIN, DATA_DIR } from './lib/config.js';
import { logger } from './lib/logger.js';
import { prisma } from './lib/prisma.js';
import { whatsappService } from './services/whatsapp.js';
import { whatsappRouter } from './routes/whatsapp.js';
import { statusesRouter } from './routes/statuses.js';
import { downloadsRouter } from './routes/downloads.js';
import { settingsRouter } from './routes/settings.js';
import { statsRouter } from './routes/stats.js';
import { filesRouter } from './routes/files.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  ensureDataDirs();

  // Ensure DB schema exists (safe for sqlite single-user app; for production prefer prisma migrate deploy)
  await ensureDatabase();

  const app = express();
  const server = http.createServer(app);

  const allowedOrigins = CORS_ORIGIN
    ? CORS_ORIGIN.split(',').map((s) => s.trim()).filter(Boolean)
    : true;

  const io = new SocketIOServer(server, {
    cors: {
      origin: allowedOrigins,
      methods: ['GET', 'POST'],
    },
  });

  // Security
  app.set('trust proxy', 1);
  app.use(helmet({
    contentSecurityPolicy: false, // SPA + inline styles; keep other helmet protections
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  }));
  app.use(cors({
    origin: allowedOrigins,
    credentials: true,
  }));
  app.use(express.json({ limit: '1mb' }));

  // General API rate limit
  const apiLimiter = rateLimit({
    windowMs: 60_000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
  });
  app.use('/api', apiLimiter);

  // Health check
  app.get('/health', (_req, res) => {
    res.json({ ok: true, service: 'statusvault', ts: new Date().toISOString() });
  });

  // API routes
  app.use('/api/whatsapp', whatsappRouter);
  app.use('/api/statuses', statusesRouter);
  app.use('/api/downloads', downloadsRouter);
  app.use('/api/settings', settingsRouter);
  app.use('/api/stats', statsRouter);
  app.use('/api/files', filesRouter);

  // Never expose /data directly
  app.use('/data', (_req, res) => res.status(404).json({ error: 'Not found' }));

  // Serve client in production
  const clientDist = resolveClientDist();
  if (clientDist) {
    app.use(express.static(clientDist, { index: false, maxAge: IS_PROD ? '1h' : 0 }));
    app.get('*', (req, res, next) => {
      if (req.path.startsWith('/api') || req.path === '/health' || req.path.startsWith('/socket.io')) {
        return next();
      }
      res.sendFile(path.join(clientDist, 'index.html'));
    });
  } else {
    app.get('/', (_req, res) => {
      res.json({ ok: true, message: 'STATUSVAULT API running. Client build not found.' });
    });
  }

  app.use('/api', notFound);
  app.use(errorHandler);

  // Socket.IO wiring
  io.on('connection', (socket) => {
    logger.debug({ id: socket.id }, 'socket connected');
    socket.emit('wa:state', whatsappService.getState());
    socket.on('disconnect', () => logger.debug({ id: socket.id }, 'socket disconnected'));
  });

  whatsappService.on('state', (state) => {
    io.emit('wa:state', state);
  });
  whatsappService.on('status:new', (status) => {
    // serialize dates
    const payload = {
      ...status,
      timestamp: status.timestamp?.toISOString?.() ?? status.timestamp,
      createdAt: status.createdAt?.toISOString?.() ?? status.createdAt,
      updatedAt: status.updatedAt?.toISOString?.() ?? status.updatedAt,
      mediaUrl: toPublicFileUrl(status.mediaPath),
      thumbnailUrl: toPublicFileUrl(status.thumbnailPath),
    };
    io.emit('status:new', payload);
  });

  await whatsappService.loadPersistedState();
  // Auto-reconnect if we have creds
  whatsappService.autoConnectIfPossible().catch((e) => logger.warn({ e }, 'autoConnect failed'));

  server.listen(PORT, '0.0.0.0', () => {
    logger.info({ port: PORT, env: process.env.NODE_ENV, dataDir: DATA_DIR }, 'STATUSVAULT server listening');
  });

  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutting down');
    server.close(() => logger.info('HTTP server closed'));
    try { await whatsappService.disconnect(); } catch {}
    try { await prisma.$disconnect(); } catch {}
    setTimeout(() => process.exit(0), 1500).unref();
  };
  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

function toPublicFileUrl(storedPath: string | null): string | null {
  if (!storedPath) return null;
  const m = storedPath.match(/^\/data\/(media|thumbs|downloads)\/(.+)$/);
  if (m) return `/api/files/${m[1]}/${encodeURIComponent(m[2])}`;
  return null;
}

function resolveClientDist(): string | null {
  const candidates = [
    path.resolve(__dirname, '../../client/dist'),
    path.resolve(process.cwd(), 'client/dist'),
    path.resolve(process.cwd(), '../client/dist'),
    path.resolve(__dirname, '../public'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(path.join(c, 'index.html'))) return c;
  }
  return null;
}

async function ensureDatabase() {
  try {
    // For sqlite, ensure schema is applied. Prefer migrations; fall back to db push.
    const { execSync } = await import('child_process');
    const schemaPath = path.resolve(__dirname, '../prisma/schema.prisma');
    const schemaPathAlt = path.resolve(process.cwd(), 'prisma/schema.prisma');
    const resolvedSchema = fs.existsSync(schemaPath) ? schemaPath : (fs.existsSync(schemaPathAlt) ? schemaPathAlt : null);
    if (!resolvedSchema) {
      logger.warn('Prisma schema not found; skipping auto-migration');
      return;
    }
    try {
      execSync(`npx prisma migrate deploy --schema="${resolvedSchema}"`, {
        stdio: 'pipe',
        env: { ...process.env },
        cwd: path.resolve(__dirname, '..'),
      });
      logger.info('Prisma migrations applied');
    } catch (e: any) {
      logger.warn({ err: e?.stderr?.toString?.() || e?.message }, 'prisma migrate deploy failed, trying db push');
      try {
        execSync(`npx prisma db push --schema="${resolvedSchema}" --skip-generate`, {
          stdio: 'pipe',
          env: { ...process.env },
          cwd: path.resolve(__dirname, '..'),
        });
        logger.info('Prisma db push applied');
      } catch (e2: any) {
        logger.error({ err: e2?.stderr?.toString?.() || e2?.message }, 'Database schema setup failed');
      }
    }
  } catch (e) {
    logger.error({ e }, 'ensureDatabase error');
  }
}

main().catch((e) => {
  logger.fatal({ e }, 'Fatal startup error');
  process.exit(1);
});
