import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildDashboardController } from '../controllers/dashboard.controller';
import { employeeSummaryParamsSchema } from '../validation/dashboard.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';
import { requireRole } from '../middlewares/authorize-role.middleware';

export async function dashboardRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildDashboardController(opts.container);
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');
  const requireViewer = [requireAdmin, requireRole('viewer')];

  fastify.get('/dashboard/live', { preHandler: requireViewer }, controller.live);
  fastify.get(
    '/dashboard/employees/:employeeId/summary',
    { schema: employeeSummaryParamsSchema, preHandler: requireViewer },
    controller.employeeSummary
  );
  fastify.get(
    '/dashboard/employees/:employeeId/timeline',
    { schema: employeeSummaryParamsSchema, preHandler: requireViewer },
    controller.employeeTimeline
  );
}
