import path from 'path';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

const dataDirRaw = process.env.DATA_DIR || './data';
export const DATA_DIR = path.isAbsolute(dataDirRaw)
  ? dataDirRaw
  : path.resolve(process.cwd(), dataDirRaw);

export const PORT = parseInt(process.env.PORT || '3000', 10);
export const NODE_ENV = process.env.NODE_ENV || 'development';
export const IS_PROD = NODE_ENV === 'production';
export const CORS_ORIGIN = process.env.CORS_ORIGIN || '';

export const DB_PATH = path.join(DATA_DIR, 'statusvault.db');
export const AUTH_DIR = path.join(DATA_DIR, 'auth');
export const DOWNLOADS_DIR = path.join(DATA_DIR, 'downloads');
export const TEMP_DIR = path.join(DATA_DIR, 'temp');
export const MEDIA_DIR = path.join(DATA_DIR, 'media');
export const THUMBS_DIR = path.join(DATA_DIR, 'thumbs');

export function ensureDataDirs() {
  for (const dir of [DATA_DIR, AUTH_DIR, DOWNLOADS_DIR, TEMP_DIR, MEDIA_DIR, THUMBS_DIR]) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

export function getDatabaseUrl() {
  // Prisma sqlite expects file: path; ensure absolute
  return `file:${DB_PATH}`;
}

// Ensure Prisma CLI/runtime sees DATABASE_URL
process.env.DATABASE_URL = process.env.DATABASE_URL || getDatabaseUrl();
