import pino from 'pino';
import { env } from '../../config/env';

export function createLogger() {
  return pino({
    level: env.LOG_LEVEL,
    transport:
      env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
        : undefined,
    redact: ['req.headers.authorization', 'password', '*.password', '*.passwordHash'],
  });
}

export type Logger = ReturnType<typeof createLogger>;
