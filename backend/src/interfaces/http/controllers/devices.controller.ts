import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';
import { DeviceOs } from '../../../domain/entities/device';

interface RegisterDeviceBody {
  deviceUuid: string;
  hostname: string;
  os: DeviceOs;
  osVersion?: string;
  agentVersion: string;
}
interface DeviceParams {
  deviceId: string;
}
interface ListDevicesQuery {
  employeeId?: string;
  status?: string;
}

export function buildDevicesController(container: Container) {
  return {
    async register(request: FastifyRequest, reply: FastifyReply) {
      const employeeId = request.principal!.sub;
      const body = request.body as RegisterDeviceBody;
      const device = await container.devices.registerDevice.execute({ employeeId, ...body });
      reply.send({ data: device });
    },

    async getOne(request: FastifyRequest, reply: FastifyReply) {
      const { deviceId } = request.params as DeviceParams;
      const device = await container.devices.registerDevice.getById(deviceId);
      reply.send({ data: device });
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const query = request.query as ListDevicesQuery;
      const devices = await container.devices.registerDevice.list(query);
      reply.send({ data: devices });
    },

    async revoke(request: FastifyRequest, reply: FastifyReply) {
      const { deviceId } = request.params as DeviceParams;
      await container.devices.registerDevice.revoke(deviceId);
      reply.send({ data: { revoked: true } });
    },
  };
}
