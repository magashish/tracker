import { Pool } from 'pg';
import { DeviceRepository } from '../../../application/ports/device-repository.port';
import { Device, DeviceRegistration } from '../../../domain/entities/device';

interface DeviceRow {
  id: string;
  employee_id: string;
  device_uuid: string;
  hostname: string;
  os: Device['os'];
  os_version: string | null;
  agent_version: string;
  status: Device['status'];
  last_seen_at: Date | null;
  registered_at: Date;
}

function toDevice(row: DeviceRow): Device {
  return {
    id: row.id,
    employeeId: row.employee_id,
    deviceUuid: row.device_uuid,
    hostname: row.hostname,
    os: row.os,
    osVersion: row.os_version,
    agentVersion: row.agent_version,
    status: row.status,
    lastSeenAt: row.last_seen_at,
    registeredAt: row.registered_at,
  };
}

export class PostgresDeviceRepository implements DeviceRepository {
  constructor(private readonly pool: Pool) {}

  async findById(id: string): Promise<Device | null> {
    const { rows } = await this.pool.query<DeviceRow>('SELECT * FROM devices WHERE id = $1', [id]);
    return rows[0] ? toDevice(rows[0]) : null;
  }

  async findByDeviceUuid(deviceUuid: string): Promise<Device | null> {
    const { rows } = await this.pool.query<DeviceRow>('SELECT * FROM devices WHERE device_uuid = $1', [deviceUuid]);
    return rows[0] ? toDevice(rows[0]) : null;
  }

  async upsertRegistration(registration: DeviceRegistration): Promise<Device> {
    const { rows } = await this.pool.query<DeviceRow>(
      `INSERT INTO devices (employee_id, device_uuid, hostname, os, os_version, agent_version, last_seen_at)
       VALUES ($1, $2, $3, $4, $5, $6, now())
       ON CONFLICT (device_uuid) DO UPDATE SET
         hostname = EXCLUDED.hostname,
         os_version = EXCLUDED.os_version,
         agent_version = EXCLUDED.agent_version,
         last_seen_at = now()
       RETURNING *`,
      [
        registration.employeeId,
        registration.deviceUuid,
        registration.hostname,
        registration.os,
        registration.osVersion ?? null,
        registration.agentVersion,
      ]
    );
    return toDevice(rows[0]!);
  }

  async touchLastSeen(id: string): Promise<void> {
    await this.pool.query('UPDATE devices SET last_seen_at = now() WHERE id = $1', [id]);
  }

  async revoke(id: string): Promise<void> {
    await this.pool.query("UPDATE devices SET status = 'revoked' WHERE id = $1", [id]);
  }

  async list(params: { employeeId?: string; status?: string }): Promise<Device[]> {
    const conditions: string[] = [];
    const values: unknown[] = [];
    if (params.employeeId) {
      values.push(params.employeeId);
      conditions.push(`employee_id = $${values.length}`);
    }
    if (params.status) {
      values.push(params.status);
      conditions.push(`status = $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await this.pool.query<DeviceRow>(
      `SELECT * FROM devices ${where} ORDER BY registered_at DESC`,
      values
    );
    return rows.map(toDevice);
  }
}
