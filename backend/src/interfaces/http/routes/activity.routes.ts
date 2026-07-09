import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildActivityController } from '../controllers/activity.controller';
import {
  heartbeatSchema,
  activityBatchSchema,
  sessionStartSchema,
  sessionEndSchema,
} from '../validation/activity.schema';
import { activityQuerySchema } from '../validation/dashboard.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';

export async function activityRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildActivityController(opts.container);
  const requireEmployee = requireAuth(opts.container.tokenService, 'employee');
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');

  fastify.post('/sessions/start', { schema: sessionStartSchema, preHandler: requireEmployee }, controller.startSession);
  fastify.post(
    '/sessions/:sessionId/heartbeat',
    { schema: heartbeatSchema, preHandler: requireEmployee },
    controller.heartbeat
  );
  fastify.post('/sessions/:sessionId/end', { schema: sessionEndSchema, preHandler: requireEmployee }, controller.endSession);

  fastify.post('/activity/batch', { schema: activityBatchSchema, preHandler: requireEmployee }, controller.activityBatch);
  fastify.get('/activity', { schema: activityQuerySchema, preHandler: requireAdmin }, controller.queryActivity);
}
