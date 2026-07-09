import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';
import { EffectiveConfig } from '../../../domain/entities/configuration';

interface DeviceParams {
  deviceId: string;
}
interface EmployeeParams {
  employeeId: string;
}

export function buildConfigController(container: Container) {
  return {
    async getDeviceConfig(request: FastifyRequest, reply: FastifyReply) {
      const { deviceId } = request.params as DeviceParams;
      const config = await container.config.getDeviceConfig.execute(deviceId);
      reply.send({ data: config });
    },

    async getGlobal(_request: FastifyRequest, reply: FastifyReply) {
      const config = await container.config.manageConfiguration.getGlobal();
      reply.send({ data: config });
    },

    async updateGlobal(request: FastifyRequest, reply: FastifyReply) {
      const adminId = request.principal!.sub;
      const body = request.body as Partial<EffectiveConfig>;
      const config = await container.config.manageConfiguration.updateGlobal(body, adminId);
      reply.send({ data: config });
    },

    async updateEmployeeOverride(request: FastifyRequest, reply: FastifyReply) {
      const adminId = request.principal!.sub;
      const { employeeId } = request.params as EmployeeParams;
      const body = request.body as Partial<EffectiveConfig> | null;
      const config = await container.config.manageConfiguration.updateEmployeeOverride(employeeId, body, adminId);
      reply.send({ data: config });
    },

    async updateDeviceOverride(request: FastifyRequest, reply: FastifyReply) {
      const adminId = request.principal!.sub;
      const { deviceId } = request.params as DeviceParams;
      const body = request.body as Partial<EffectiveConfig> | null;
      const config = await container.config.manageConfiguration.updateDeviceOverride(deviceId, body, adminId);
      reply.send({ data: config });
    },
  };
}
