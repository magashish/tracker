import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildDevicesController } from '../controllers/devices.controller';
import { registerDeviceSchema, deviceParamsSchema } from '../validation/devices.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';
import { requireRole } from '../middlewares/authorize-role.middleware';

export async function devicesRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildDevicesController(opts.container);
  const requireEmployee = requireAuth(opts.container.tokenService, 'employee');
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');

  fastify.post(
    '/devices/register',
    { schema: registerDeviceSchema, preHandler: requireEmployee },
    controller.register
  );

  fastify.get(
    '/devices/:deviceId',
    { schema: deviceParamsSchema, preHandler: requireEmployee },
    controller.getOne
  );

  fastify.get('/devices', { preHandler: [requireAdmin, requireRole('viewer')] }, controller.list);

  fastify.patch(
    '/devices/:deviceId/revoke',
    { schema: deviceParamsSchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.revoke
  );
}
