import { Device, DeviceRegistration } from '../../domain/entities/device';

export interface DeviceRepository {
  findById(id: string): Promise<Device | null>;
  findByDeviceUuid(deviceUuid: string): Promise<Device | null>;
  upsertRegistration(registration: DeviceRegistration): Promise<Device>;
  touchLastSeen(id: string): Promise<void>;
  revoke(id: string): Promise<void>;
  list(params: { employeeId?: string; status?: string }): Promise<Device[]>;
}
