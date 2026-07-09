import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';
import { Employee, EmployeeStatus } from '../../../domain/entities/employee';
import { Admin, AdminStatus } from '../../../domain/entities/admin';

function toPublicEmployee(employee: Employee) {
  const { passwordHash: _passwordHash, ...publicEmployee } = employee;
  return publicEmployee;
}

function toPublicAdmin(admin: Admin) {
  const { passwordHash: _passwordHash, ...publicAdmin } = admin;
  return publicAdmin;
}

interface ListEmployeesQuery {
  search?: string;
  status?: EmployeeStatus;
  page?: number;
  pageSize?: number;
}
interface CreateEmployeeBody {
  email: string;
  fullName: string;
  password: string;
  team?: string;
}
interface EmployeeParams {
  employeeId: string;
}
interface UpdateEmployeeBody {
  fullName?: string;
  team?: string;
  status?: EmployeeStatus;
}
interface CreateAdminBody {
  email: string;
  fullName: string;
  password: string;
  roleName: string;
}
interface AdminParams {
  adminId: string;
}
interface UpdateAdminBody {
  fullName?: string;
  status?: AdminStatus;
  roleName?: string;
}

export function buildAdminController(container: Container) {
  return {
    async listEmployees(request: FastifyRequest, reply: FastifyReply) {
      const { search, status, page = 1, pageSize = 50 } = request.query as ListEmployeesQuery;
      const result = await container.admin.manageEmployees.list({ search, status, page, pageSize });
      reply.send({ data: result.items.map(toPublicEmployee), meta: { page, pageSize, total: result.total } });
    },

    async createEmployee(request: FastifyRequest, reply: FastifyReply) {
      const body = request.body as CreateEmployeeBody;
      const employee = await container.admin.manageEmployees.create(body);
      reply.status(201).send({ data: toPublicEmployee(employee) });
    },

    async updateEmployee(request: FastifyRequest, reply: FastifyReply) {
      const { employeeId } = request.params as EmployeeParams;
      const body = request.body as UpdateEmployeeBody;
      const employee = await container.admin.manageEmployees.update(employeeId, body);
      reply.send({ data: toPublicEmployee(employee) });
    },

    async listAdmins(_request: FastifyRequest, reply: FastifyReply) {
      const admins = await container.admin.manageAdmins.list();
      reply.send({ data: admins.map(toPublicAdmin) });
    },

    async createAdmin(request: FastifyRequest, reply: FastifyReply) {
      const body = request.body as CreateAdminBody;
      const admin = await container.admin.manageAdmins.create(body);
      reply.status(201).send({ data: toPublicAdmin(admin) });
    },

    async updateAdmin(request: FastifyRequest, reply: FastifyReply) {
      const { adminId } = request.params as AdminParams;
      const body = request.body as UpdateAdminBody;
      const admin = await container.admin.manageAdmins.update(adminId, body);
      reply.send({ data: toPublicAdmin(admin) });
    },

    async listRoles(_request: FastifyRequest, reply: FastifyReply) {
      const roles = await container.admin.manageAdmins.listRoles();
      reply.send({ data: roles });
    },
  };
}
