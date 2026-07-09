export type DeviceOs = 'windows' | 'linux';
export type DeviceStatus = 'active' | 'revoked';

export interface Device {
  id: string;
  employeeId: string;
  deviceUuid: string;
  hostname: string;
  os: DeviceOs;
  osVersion: string | null;
  agentVersion: string;
  status: DeviceStatus;
  lastSeenAt: Date | null;
  registeredAt: Date;
}

export interface DeviceRegistration {
  employeeId: string;
  deviceUuid: string;
  hostname: string;
  os: DeviceOs;
  osVersion?: string;
  agentVersion: string;
}
