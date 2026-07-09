import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import swagger from '@fastify/swagger';
import { Container } from './container';
import { env } from './config/env';
import { createErrorHandler } from './interfaces/http/middlewares/error-handler.middleware';

import { authRoutes } from './interfaces/http/routes/auth.routes';
import { devicesRoutes } from './interfaces/http/routes/devices.routes';
import { activityRoutes } from './interfaces/http/routes/activity.routes';
import { screenshotsRoutes } from './interfaces/http/routes/screenshots.routes';
import { storageRoutes } from './interfaces/http/routes/storage.routes';
import { configRoutes } from './interfaces/http/routes/config.routes';
import { versionRoutes } from './interfaces/http/routes/version.routes';
import { dashboardRoutes } from './interfaces/http/routes/dashboard.routes';
import { adminRoutes } from './interfaces/http/routes/admin.routes';
import { auditLogsRoutes } from './interfaces/http/routes/audit-logs.routes';

export async function buildApp(container: Container) {
  const fastify = Fastify({ logger: container.logger, trustProxy: true });

  await fastify.register(helmet);
  await fastify.register(cors, { origin: env.CORS_ORIGIN, credentials: true });
  await fastify.register(rateLimit, {
    max: env.RATE_LIMIT_MAX,
    timeWindow: env.RATE_LIMIT_WINDOW_MS,
    redis: container.redis,
  });
  await fastify.register(swagger, {
    openapi: {
      info: { title: 'Tracker API', version: '1.0.0' },
      servers: [{ url: env.PUBLIC_API_URL }],
    },
  });

  fastify.setErrorHandler(createErrorHandler(container.logger));

  fastify.get('/health', async () => ({ status: 'ok' }));
  fastify.get('/ready', async (_request, reply) => {
    try {
      await container.pool.query('SELECT 1');
      await container.redis.ping();
      reply.send({ status: 'ready' });
    } catch (err) {
      container.logger.error({ err }, 'Readiness check failed');
      reply.status(503).send({ status: 'not_ready' });
    }
  });

  await fastify.register(
    async (api) => {
      await api.register(authRoutes, { container });
      await api.register(devicesRoutes, { container });
      await api.register(activityRoutes, { container });
      await api.register(screenshotsRoutes, { container });
      await api.register(storageRoutes, { container });
      await api.register(configRoutes, { container });
      await api.register(versionRoutes, { container });
      await api.register(dashboardRoutes, { container });
      await api.register(adminRoutes, { container });
      await api.register(auditLogsRoutes, { container });
    },
    { prefix: '/api/v1' }
  );

  return fastify;
}
