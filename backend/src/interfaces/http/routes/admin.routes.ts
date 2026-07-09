import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildAdminController } from '../controllers/admin.controller';
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  listEmployeesQuerySchema,
  createAdminSchema,
  updateAdminSchema,
} from '../validation/admin.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';
import { requireRole } from '../middlewares/authorize-role.middleware';

export async function adminRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildAdminController(opts.container);
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');

  fastify.get(
    '/admin/employees',
    { schema: listEmployeesQuerySchema, preHandler: [requireAdmin, requireRole('viewer')] },
    controller.listEmployees
  );
  fastify.post(
    '/admin/employees',
    { schema: createEmployeeSchema, preHandler: [requireAdmin, requireRole('manager')] },
    controller.createEmployee
  );
  fastify.patch(
    '/admin/employees/:employeeId',
    { schema: updateEmployeeSchema, preHandler: [requireAdmin, requireRole('manager')] },
    controller.updateEmployee
  );

  fastify.get('/admin/admins', { preHandler: [requireAdmin, requireRole('admin')] }, controller.listAdmins);
  fastify.post(
    '/admin/admins',
    { schema: createAdminSchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.createAdmin
  );
  fastify.patch(
    '/admin/admins/:adminId',
    { schema: updateAdminSchema, preHandler: [requireAdmin, requireRole('admin')] },
    controller.updateAdmin
  );

  fastify.get('/admin/roles', { preHandler: [requireAdmin, requireRole('viewer')] }, controller.listRoles);
}
