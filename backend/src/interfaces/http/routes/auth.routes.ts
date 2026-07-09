import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildAuthController } from '../controllers/auth.controller';
import { employeeLoginSchema, adminLoginSchema, refreshTokenSchema } from '../validation/auth.schema';

export async function authRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildAuthController(opts.container);

  fastify.post('/auth/employee/login', { schema: employeeLoginSchema }, controller.employeeLogin);
  fastify.post('/auth/employee/refresh', { schema: refreshTokenSchema }, controller.employeeRefresh);
  fastify.post('/auth/employee/logout', { schema: refreshTokenSchema }, controller.employeeLogout);

  fastify.post('/auth/admin/login', { schema: adminLoginSchema }, controller.adminLogin);
  fastify.post('/auth/admin/refresh', { schema: refreshTokenSchema }, controller.adminRefresh);
  fastify.post('/auth/admin/logout', { schema: refreshTokenSchema }, controller.adminLogout);
}
