import path from 'path';
import fs from 'fs';
import { DATA_DIR } from './config.js';

export function resolveDataPath(relativeOrAbsolute: string): string | null {
  // Accept paths like /data/media/x or absolute paths under DATA_DIR
  let candidate = relativeOrAbsolute;
  if (candidate.startsWith('/data/')) {
    candidate = path.join(DATA_DIR, candidate.slice('/data/'.length));
  }
  const resolved = path.resolve(candidate);
  const dataResolved = path.resolve(DATA_DIR);
  if (!resolved.startsWith(dataResolved + path.sep) && resolved !== dataResolved) {
    return null;
  }
  return resolved;
}

export function fileExistsSafe(p: string | null): p is string {
  return !!p && fs.existsSync(p) && fs.statSync(p).isFile();
}
