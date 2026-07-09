import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildConfigController } from '../controllers/config.controller';
import {
  updateGlobalConfigSchema,
  updateEmployeeConfigSchema,
  updateDeviceConfigSchema,
  deviceConfigParamsSchema,
} from '../validation/config.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';
import { requireRole } from '../middlewares/authorize-role.middleware';

export async function configRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildConfigController(opts.container);
  const requireEmployee = requireAuth(opts.container.tokenService, 'employee');
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');

  fastify.get(
    '/config/device/:deviceId',
    { schema: deviceConfigParamsSchema, preHandler: requireEmployee },
    controller.getDeviceConfig
  );

  fastify.get('/config/global', { preHandler: [requireAdmin, requireRole('viewer')] }, controller.getGlobal);
  fastify.put(
    '/config/global',
    { schema: updateGlobalConfigSchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.updateGlobal
  );
  fastify.put(
    '/config/employee/:employeeId',
    { schema: updateEmployeeConfigSchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.updateEmployeeOverride
  );
  fastify.put(
    '/config/device/:deviceId',
    { schema: updateDeviceConfigSchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.updateDeviceOverride
  );
}
