import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage,
  WASocket,
  proto,
  ConnectionState,
  BaileysEventMap,
} from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import path from 'path';
import fs from 'fs';
import fsp from 'fs/promises';
import crypto from 'crypto';
import { EventEmitter } from 'events';
import sharp from 'sharp';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import mime from 'mime-types';
import pino from 'pino';
import { prisma } from '../lib/prisma.js';
import { AUTH_DIR, DOWNLOADS_DIR, MEDIA_DIR, THUMBS_DIR, TEMP_DIR, ensureDataDirs } from '../lib/config.js';
import { logger } from '../lib/logger.js';

const ffmpegPath = typeof ffmpegStatic === 'string'
  ? ffmpegStatic
  : (ffmpegStatic as any)?.default || (ffmpegStatic as any)?.path || null;
if (ffmpegPath) {
  try { ffmpeg.setFfmpegPath(ffmpegPath); } catch { /* ignore */ }
}

export type WAConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface WAState {
  status: WAConnectionStatus;
  phoneNumber: string | null;
  pairingCode: string | null;
  lastConnectedAt: string | null;
  lastError: string | null;
}

class WhatsAppService extends EventEmitter {
  private sock: WASocket | null = null;
  private state: WAState = {
    status: 'disconnected',
    phoneNumber: null,
    pairingCode: null,
    lastConnectedAt: null,
    lastError: null,
  };
  private reconnectTimer: NodeJS.Timeout | null = null;
  private intentionalDisconnect = false;
  private pairingRequestedFor: string | null = null;
  private initPromise: Promise<{ pairingCode: string | null }> | null = null;
  private saveLock: Promise<void> = Promise.resolve();

  constructor() {
    super();
    this.setMaxListeners(50);
  }

  getState(): WAState {
    return { ...this.state };
  }

  private setState(patch: Partial<WAState>) {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.getState());
    this.persistSessionState().catch((e) => logger.warn({ e }, 'persistSessionState failed'));
  }

  private async persistSessionState() {
    // serialize writes to avoid sqlite contention
    this.saveLock = this.saveLock.then(async () => {
      const existing = await prisma.whatsAppSession.findFirst();
      const data = {
        phoneNumber: this.state.phoneNumber,
        connectionStatus: this.state.status,
        lastConnectedAt: this.state.lastConnectedAt ? new Date(this.state.lastConnectedAt) : null,
      };
      if (existing) {
        await prisma.whatsAppSession.update({ where: { id: existing.id }, data });
      } else {
        await prisma.whatsAppSession.create({ data });
      }
    }).catch(() => {});
    return this.saveLock;
  }

  async loadPersistedState() {
    try {
      const s = await prisma.whatsAppSession.findFirst();
      if (s) {
        this.state.phoneNumber = s.phoneNumber;
        this.state.lastConnectedAt = s.lastConnectedAt?.toISOString() ?? null;
        // Don't trust persisted "connected" on boot - we'll verify by reconnect attempt
        if (s.connectionStatus === 'connected' || s.connectionStatus === 'connecting' || s.connectionStatus === 'reconnecting') {
          this.state.status = 'disconnected';
        } else {
          this.state.status = s.connectionStatus as WAConnectionStatus;
        }
      }
    } catch (e) {
      logger.warn({ e }, 'Failed to load persisted WA state');
    }
  }

  async hasAuthCreds(): Promise<boolean> {
    try {
      const credsPath = path.join(AUTH_DIR, 'creds.json');
      return fs.existsSync(credsPath);
    } catch {
      return false;
    }
  }

  async autoConnectIfPossible() {
    const hasCreds = await this.hasAuthCreds();
    if (hasCreds) {
      logger.info('Found existing WhatsApp credentials, attempting reconnect');
      await this.connect(this.state.phoneNumber || undefined).catch((e) => {
        logger.error({ e }, 'Auto-connect failed');
      });
    }
  }

  async connect(phoneNumber?: string): Promise<{ pairingCode: string | null }> {
    if (this.initPromise) return this.initPromise.then(() => ({ pairingCode: this.state.pairingCode }));
    const p = this._connect(phoneNumber).finally(() => { this.initPromise = null; });
    this.initPromise = p;
    return p;
  }

  private async _connect(phoneNumber?: string): Promise<{ pairingCode: string | null }> {
    ensureDataDirs();
    this.intentionalDisconnect = false;
    this.clearReconnectTimer();

    if (this.sock) {
      try { this.sock.end(undefined); } catch {}
      this.sock = null;
    }

    if (phoneNumber) {
      this.state.phoneNumber = phoneNumber;
    }

    this.setState({ status: 'connecting', lastError: null, pairingCode: null });

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_DIR);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 0] as [number, number, number] }));

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['STATUSVAULT', 'Chrome', '1.0.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
      generateHighQualityLinkPreview: false,
      getMessage: async () => undefined,
    });

    this.sock = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update: Partial<ConnectionState>) => {
      await this.handleConnectionUpdate(update, phoneNumber);
    });

    sock.ev.on('messages.upsert', async (m) => {
      try {
        await this.handleMessagesUpsert(m);
      } catch (e) {
        logger.error({ e }, 'handleMessagesUpsert error');
      }
    });

    // Request pairing code if we have a phone number and not registered yet
    if (phoneNumber && !state.creds.registered) {
      try {
        // Normalize: digits only
        const digits = phoneNumber.replace(/[^0-9]/g, '');
        this.pairingRequestedFor = digits;
        // small delay to let socket settle
        await new Promise((r) => setTimeout(r, 2500));
        if (this.sock === sock && !state.creds.registered) {
          const code = await sock.requestPairingCode(digits);
          logger.info({ phone: `***${digits.slice(-4)}` }, 'Pairing code generated');
          this.setState({ pairingCode: code, phoneNumber: digits });
        }
      } catch (e: any) {
        logger.error({ e }, 'Failed to request pairing code');
        this.setState({ status: 'error', lastError: e?.message || 'Failed to generate pairing code' });
      }
    }

    return { pairingCode: this.state.pairingCode };
  }

  private async handleConnectionUpdate(update: Partial<ConnectionState>, requestedPhone?: string) {
    const { connection, lastDisconnect, qr } = update;

    if (qr && requestedPhone && this.sock && !this.sock.authState.creds.registered) {
      // If QR came but we want pairing code, try requesting pairing code
      if (this.pairingRequestedFor !== requestedPhone.replace(/[^0-9]/g, '')) {
        try {
          const digits = requestedPhone.replace(/[^0-9]/g, '');
          this.pairingRequestedFor = digits;
          const code = await this.sock.requestPairingCode(digits);
          this.setState({ pairingCode: code, phoneNumber: digits, status: 'connecting' });
        } catch (e: any) {
          logger.error({ e }, 'Pairing code request on QR failed');
        }
      }
    }

    if (connection === 'open') {
      this.clearReconnectTimer();
      const me = this.sock?.user;
      const phone = me?.id?.split(':')[0]?.split('@')[0] || this.state.phoneNumber;
      this.setState({
        status: 'connected',
        phoneNumber: phone || null,
        pairingCode: null,
        lastConnectedAt: new Date().toISOString(),
        lastError: null,
      });
      logger.info('WhatsApp connected');
      this.emit('connected');
    }

    if (connection === 'close') {
      const reason = (lastDisconnect?.error as Boom)?.output?.statusCode;
      const loggedOut = reason === DisconnectReason.loggedOut;
      logger.warn({ reason, loggedOut }, 'WhatsApp connection closed');

      if (this.intentionalDisconnect) {
        this.setState({ status: 'disconnected', pairingCode: null });
        return;
      }

      if (loggedOut) {
        this.setState({ status: 'disconnected', pairingCode: null, lastError: 'Logged out. Please reconnect.' });
        // clear auth on logout
        await this.clearAuthFiles().catch(() => {});
        return;
      }

      this.setState({ status: 'reconnecting', lastError: `Connection closed (${reason ?? 'unknown'})` });
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect() {
    this.clearReconnectTimer();
    this.reconnectTimer = setTimeout(() => {
      this.connect(this.state.phoneNumber || undefined).catch((e) => {
        logger.error({ e }, 'Reconnect attempt failed');
        this.setState({ status: 'error', lastError: e?.message || 'Reconnect failed' });
        this.scheduleReconnect();
      });
    }, 5000);
  }

  private clearReconnectTimer() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  async disconnect() {
    this.intentionalDisconnect = true;
    this.clearReconnectTimer();
    try {
      if (this.sock) {
        await this.sock.logout().catch(() => {});
        this.sock.end(undefined);
      }
    } catch (e) {
      logger.warn({ e }, 'Error during disconnect');
    }
    this.sock = null;
    this.setState({ status: 'disconnected', pairingCode: null });
  }

  async deleteSession() {
    await this.disconnect();
    await this.clearAuthFiles();
    await prisma.statusMedia.deleteMany({}).catch(() => {});
    await prisma.downloadHistory.deleteMany({}).catch(() => {});
    this.setState({
      status: 'disconnected',
      phoneNumber: null,
      pairingCode: null,
      lastConnectedAt: null,
      lastError: null,
    });
  }

  private async clearAuthFiles() {
    try {
      const files = await fsp.readdir(AUTH_DIR);
      await Promise.all(files.map((f) => fsp.rm(path.join(AUTH_DIR, f), { force: true, recursive: true })));
    } catch (e) {
      logger.warn({ e }, 'Failed to clear auth files');
    }
  }

  private async handleMessagesUpsert(m: BaileysEventMap['messages.upsert']) {
    const { messages, type } = m;
    for (const msg of messages) {
      try {
        const remoteJid = msg.key?.remoteJid || '';
        if (remoteJid !== 'status@broadcast') continue;
        await this.processStatusMessage(msg);
      } catch (e) {
        logger.error({ e }, 'Failed to process status message');
      }
    }
  }

  private async processStatusMessage(msg: proto.IWebMessageInfo) {
    const key = msg.key;
    const whatsappId = key?.id;
    if (!whatsappId) return;

    // dedupe
    const existing = await prisma.statusMedia.findUnique({ where: { whatsappId } });
    if (existing) return;

    const message = msg.message;
    if (!message) return;

    const imageMsg = message.imageMessage || message.ephemeralMessage?.message?.imageMessage;
    const videoMsg = message.videoMessage || message.ephemeralMessage?.message?.videoMessage;

    let mediaType: 'image' | 'video' | null = null;
    let caption: string | null = null;
    let mimetype: string | null = null;
    let mediaMessage: any = null;

    if (imageMsg) {
      mediaType = 'image';
      caption = imageMsg.caption || null;
      mimetype = imageMsg.mimetype || 'image/jpeg';
      mediaMessage = imageMsg;
    } else if (videoMsg) {
      mediaType = 'video';
      caption = videoMsg.caption || null;
      mimetype = videoMsg.mimetype || 'video/mp4';
      mediaMessage = videoMsg;
    } else {
      // text-only status or unsupported - skip for now
      return;
    }

    const participant = key?.participant || msg.participant || '';
    const contactJid = participant;
    const contactName = msg.pushName || participant?.split('@')[0] || 'Unknown';
    const ts = msg.messageTimestamp ? Number(msg.messageTimestamp) * 1000 : Date.now();
    const timestamp = new Date(ts);

    // Download media
    let mediaPath: string | null = null;
    let thumbnailPath: string | null = null;
    let fileSize: number | null = null;

    try {
      const buffer = await downloadMediaMessage(
        msg as any,
        'buffer',
        {},
        {
          logger: pino({ level: 'silent' }) as any,
          reuploadRequest: this.sock!.updateMediaMessage,
        }
      ) as Buffer;

      if (buffer && buffer.length > 0) {
        const ext = (mime.extension(mimetype || '') || (mediaType === 'image' ? 'jpg' : 'mp4')).toString();
        const safeId = whatsappId.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40) || crypto.randomBytes(8).toString('hex');
        const fileName = `${Date.now()}-${safeId}.${ext}`;
        const absPath = path.join(MEDIA_DIR, fileName);
        await fsp.writeFile(absPath, buffer);
        mediaPath = `/data/media/${fileName}`;
        fileSize = buffer.length;

        // thumbnail
        const saveThumbs = await this.getSetting('saveThumbnails', 'true');
        if (saveThumbs !== 'false') {
          thumbnailPath = await this.generateThumbnail(absPath, fileName, mediaType);
        }
      }
    } catch (e) {
      logger.warn({ e, whatsappId }, 'Failed to download status media');
      // Still store metadata record without media file - better than losing it
    }

    try {
      const record = await prisma.statusMedia.create({
        data: {
          whatsappId,
          mediaType,
          contactName,
          contactJid,
          caption,
          mediaPath,
          thumbnailPath,
          mimetype,
          fileSize,
          timestamp,
        },
      });
      this.emit('status:new', record);
      logger.info({ whatsappId, mediaType, contactName }, 'Status synced');

      // Auto-download if enabled
      const autoDl = await this.getSetting('autoDownload', 'false');
      if (autoDl === 'true' && mediaPath) {
        await this.autoDownloadRecord(record.id, mediaPath, contactName, timestamp, mediaType, mimetype).catch((e) => logger.warn({ e }, 'auto-download failed'));
      }
    } catch (e: any) {
      // Unique constraint = dedupe race
      if (e?.code !== 'P2002') {
        logger.error({ e }, 'Failed to save status record');
      }
    }
  }

  private async generateThumbnail(absMediaPath: string, fileName: string, mediaType: 'image' | 'video'): Promise<string | null> {
    try {
      const thumbName = `${path.parse(fileName).name}.jpg`;
      const thumbAbs = path.join(THUMBS_DIR, thumbName);
      if (mediaType === 'image') {
        await sharp(absMediaPath)
          .rotate()
          .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
          .jpeg({ quality: 72 })
          .toFile(thumbAbs);
      } else {
        // video thumbnail via ffmpeg
        await this.extractVideoThumbnail(absMediaPath, thumbAbs);
      }
      return `/data/thumbs/${thumbName}`;
    } catch (e) {
      logger.warn({ e, fileName }, 'Thumbnail generation failed');
      return null;
    }
  }

  private extractVideoThumbnail(videoPath: string, outPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; reject(new Error('ffmpeg thumbnail timeout')); }
      }, 15000);
      ffmpeg(videoPath)
        .on('end', () => { if (!settled) { settled = true; clearTimeout(timer); resolve(); } })
        .on('error', (err) => { if (!settled) { settled = true; clearTimeout(timer); reject(err); } })
        .screenshots({
          timestamps: ['00:00:00.500'],
          filename: path.basename(outPath),
          folder: path.dirname(outPath),
          size: '480x?',
        });
    });
  }

  private async getSetting(key: string, fallback: string): Promise<string> {
    try {
      const row = await prisma.appSettings.findUnique({ where: { key } });
      return row?.value ?? fallback;
    } catch {
      return fallback;
    }
  }

  private async autoDownloadRecord(statusMediaId: string, storedMediaPath: string, contactName: string | null, timestamp: Date, mediaType: string, mimetype: string | null) {
    const absMedia = storedMediaPath.startsWith('/data/')
      ? path.join(path.resolve(AUTH_DIR, '..'), storedMediaPath.slice('/data/'.length))
      : storedMediaPath;
    if (!fs.existsSync(absMedia)) return;
    const ext = path.extname(absMedia) || (mediaType === 'image' ? '.jpg' : '.mp4');
    const safeBase = (contactName || 'status').replace(/[^a-zA-Z0-9-_ ]/g, '').trim().replace(/\s+/g, '_').slice(0, 40) || 'status';
    const ts = timestamp.toISOString().replace(/[:.]/g, '-');
    const fileName = `auto_${safeBase}_${ts}${ext}`;
    const destAbs = path.join(DOWNLOADS_DIR, fileName);
    await fsp.copyFile(absMedia, destAbs);
    const stat = await fsp.stat(destAbs);
    const fileFormat = (mime.extension(mimetype || '') || ext.replace('.', '')).toString().toLowerCase();
    await prisma.downloadHistory.create({
      data: {
        statusMediaId,
        fileName,
        filePath: `/data/downloads/${fileName}`,
        fileSize: stat.size,
        fileFormat,
      },
    });
  }

  async getConnectionHealth() {
    return {
      ...this.getState(),
      hasAuth: await this.hasAuthCreds(),
      socketActive: !!this.sock,
    };
  }
}

export const whatsappService = new WhatsAppService();
