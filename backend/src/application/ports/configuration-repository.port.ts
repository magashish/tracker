import { EffectiveConfig } from '../../domain/entities/configuration';

export interface ConfigurationRepository {
  getEffectiveConfig(employeeId: string, deviceId: string): Promise<EffectiveConfig>;
  getGlobal(): Promise<EffectiveConfig>;
  updateGlobal(config: Partial<EffectiveConfig>, updatedByAdminId: string): Promise<EffectiveConfig>;
  updateEmployeeOverride(
    employeeId: string,
    config: Partial<EffectiveConfig> | null,
    updatedByAdminId: string
  ): Promise<EffectiveConfig | null>;
  updateDeviceOverride(
    deviceId: string,
    config: Partial<EffectiveConfig> | null,
    updatedByAdminId: string
  ): Promise<EffectiveConfig | null>;
}
