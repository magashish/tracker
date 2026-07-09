export interface EffectiveConfig {
  heartbeatIntervalSeconds: number;
  screenshotIntervalSeconds: number;
  screenshotQuality: number;
  idleThresholdSeconds: number;
  apiUrl: string;
}

export interface ConfigurationOverride extends EffectiveConfig {
  id: string;
  scopeEmployeeId: string | null;
  scopeDeviceId: string | null;
  updatedAt: Date;
  updatedByAdminId: string | null;
}
