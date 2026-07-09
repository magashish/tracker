import { ConfigurationRepository } from '../ports/configuration-repository.port';
import { DeviceRepository } from '../ports/device-repository.port';
import { EffectiveConfig } from '../../domain/entities/configuration';
import { DomainError } from '../../domain/errors/domain-error';

export class GetDeviceConfigService {
  constructor(
    private readonly configuration: ConfigurationRepository,
    private readonly devices: DeviceRepository
  ) {}

  async execute(deviceId: string): Promise<EffectiveConfig> {
    const device = await this.devices.findById(deviceId);
    if (!device) {
      throw DomainError.notFound('Device not found');
    }
    return this.configuration.getEffectiveConfig(device.employeeId, deviceId);
  }
}
