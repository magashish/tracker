import { ConfigurationRepository } from '../ports/configuration-repository.port';
import { EffectiveConfig } from '../../domain/entities/configuration';

export class ManageConfigurationService {
  constructor(private readonly configuration: ConfigurationRepository) {}

  getGlobal(): Promise<EffectiveConfig> {
    return this.configuration.getGlobal();
  }

  updateGlobal(config: Partial<EffectiveConfig>, adminId: string): Promise<EffectiveConfig> {
    return this.configuration.updateGlobal(config, adminId);
  }

  updateEmployeeOverride(
    employeeId: string,
    config: Partial<EffectiveConfig> | null,
    adminId: string
  ): Promise<EffectiveConfig | null> {
    return this.configuration.updateEmployeeOverride(employeeId, config, adminId);
  }

  updateDeviceOverride(
    deviceId: string,
    config: Partial<EffectiveConfig> | null,
    adminId: string
  ): Promise<EffectiveConfig | null> {
    return this.configuration.updateDeviceOverride(deviceId, config, adminId);
  }
}
