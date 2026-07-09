import { DeviceRepository } from '../ports/device-repository.port';
import { Device, DeviceRegistration } from '../../domain/entities/device';
import { DomainError } from '../../domain/errors/domain-error';

export class RegisterDeviceService {
  constructor(private readonly devices: DeviceRepository) {}

  async execute(registration: DeviceRegistration): Promise<Device> {
    return this.devices.upsertRegistration(registration);
  }

  async revoke(deviceId: string): Promise<void> {
    const device = await this.devices.findById(deviceId);
    if (!device) {
      throw DomainError.notFound('Device not found');
    }
    await this.devices.revoke(deviceId);
  }

  async getById(deviceId: string): Promise<Device> {
    const device = await this.devices.findById(deviceId);
    if (!device) {
      throw DomainError.notFound('Device not found');
    }
    return device;
  }

  list(params: { employeeId?: string; status?: string }): Promise<Device[]> {
    return this.devices.list(params);
  }
}
