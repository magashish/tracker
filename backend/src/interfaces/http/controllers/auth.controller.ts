import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';
import { DeviceOs } from '../../../domain/entities/device';

interface EmployeeLoginBody {
  email: string;
  password: string;
  deviceUuid: string;
  hostname: string;
  os: DeviceOs;
  osVersion?: string;
  agentVersion: string;
}
interface AdminLoginBody {
  email: string;
  password: string;
}
interface RefreshTokenBody {
  refreshToken: string;
}

export function buildAuthController(container: Container) {
  return {
    async employeeLogin(request: FastifyRequest, reply: FastifyReply) {
      const body = request.body as EmployeeLoginBody;
      const result = await container.auth.authenticateEmployee.execute(body);
      reply.send({ data: result });
    },

    async adminLogin(request: FastifyRequest, reply: FastifyReply) {
      const body = request.body as AdminLoginBody;
      const result = await container.auth.authenticateAdmin.execute(body);
      reply.send({ data: result });
    },

    async employeeRefresh(request: FastifyRequest, reply: FastifyReply) {
      const { refreshToken } = request.body as RefreshTokenBody;
      const result = await container.auth.refreshToken.execute('employee', refreshToken);
      reply.send({ data: result });
    },

    async adminRefresh(request: FastifyRequest, reply: FastifyReply) {
      const { refreshToken } = request.body as RefreshTokenBody;
      const result = await container.auth.refreshToken.execute('admin', refreshToken);
      reply.send({ data: result });
    },

    async employeeLogout(request: FastifyRequest, reply: FastifyReply) {
      const { refreshToken } = request.body as RefreshTokenBody;
      await container.auth.refreshToken.logout('employee', refreshToken);
      reply.send({ data: { loggedOut: true } });
    },

    async adminLogout(request: FastifyRequest, reply: FastifyReply) {
      const { refreshToken } = request.body as RefreshTokenBody;
      await container.auth.refreshToken.logout('admin', refreshToken);
      reply.send({ data: { loggedOut: true } });
    },
  };
}
