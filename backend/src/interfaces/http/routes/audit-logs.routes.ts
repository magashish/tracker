import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildAuditLogsController } from '../controllers/audit-logs.controller';
import { auditLogsQuerySchema } from '../validation/dashboard.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';
import { requireRole } from '../middlewares/authorize-role.middleware';

export async function auditLogsRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildAuditLogsController(opts.container);
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');

  fastify.get(
    '/audit-logs',
    { schema: auditLogsQuerySchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.query
  );
}
