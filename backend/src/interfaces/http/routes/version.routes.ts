import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildVersionController } from '../controllers/version.controller';
import { latestVersionQuerySchema, publishVersionSchema } from '../validation/version.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';
import { requireRole } from '../middlewares/authorize-role.middleware';

export async function versionRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildVersionController(opts.container);
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');

  fastify.get('/version/latest', { schema: latestVersionQuerySchema }, controller.latest);
  fastify.post(
    '/version',
    { schema: publishVersionSchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.publish
  );
  fastify.get('/version', { preHandler: [requireAdmin, requireRole('viewer')] }, controller.list);
}
