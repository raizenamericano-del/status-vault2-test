import pino from 'pino';
import { IS_PROD } from './config.js';

export const logger = pino({
  level: process.env.LOG_LEVEL || (IS_PROD ? 'info' : 'debug'),
  redact: {
    paths: ['req.headers.authorization', 'creds', '*.creds', 'account'],
    remove: true,
  },
});
