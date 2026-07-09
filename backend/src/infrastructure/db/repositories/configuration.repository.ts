import { Pool } from 'pg';
import { ConfigurationRepository } from '../../../application/ports/configuration-repository.port';
import { EffectiveConfig } from '../../../domain/entities/configuration';

interface ConfigRow {
  heartbeat_interval_seconds: number;
  screenshot_interval_seconds: number;
  screenshot_quality: number;
  idle_threshold_seconds: number;
  api_url: string;
}

function toEffectiveConfig(row: ConfigRow): EffectiveConfig {
  return {
    heartbeatIntervalSeconds: row.heartbeat_interval_seconds,
    screenshotIntervalSeconds: row.screenshot_interval_seconds,
    screenshotQuality: row.screenshot_quality,
    idleThresholdSeconds: row.idle_threshold_seconds,
    apiUrl: row.api_url,
  };
}

const DEFAULT_CONFIG: EffectiveConfig = {
  heartbeatIntervalSeconds: 30,
  screenshotIntervalSeconds: 600,
  screenshotQuality: 70,
  idleThresholdSeconds: 300,
  apiUrl: 'https://api.tracker.example.com',
};

export class PostgresConfigurationRepository implements ConfigurationRepository {
  constructor(private readonly pool: Pool) {}

  async getEffectiveConfig(employeeId: string, deviceId: string): Promise<EffectiveConfig> {
    // Device override > employee override > global default > hardcoded fallback.
    // Three explicit priority-ordered lookups rather than one UNION query,
    // since UNION ALL + LIMIT 1 does not guarantee which branch wins.
    const cols =
      'heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url';

    const device = await this.pool.query<ConfigRow>(
      `SELECT ${cols} FROM configurations WHERE scope_device_id = $1`,
      [deviceId]
    );
    if (device.rows[0]) return toEffectiveConfig(device.rows[0]);

    const employee = await this.pool.query<ConfigRow>(
      `SELECT ${cols} FROM configurations WHERE scope_employee_id = $1`,
      [employeeId]
    );
    if (employee.rows[0]) return toEffectiveConfig(employee.rows[0]);

    const global = await this.pool.query<ConfigRow>(
      `SELECT ${cols} FROM configurations WHERE scope_employee_id IS NULL AND scope_device_id IS NULL`
    );
    return global.rows[0] ? toEffectiveConfig(global.rows[0]) : DEFAULT_CONFIG;
  }

  async getGlobal(): Promise<EffectiveConfig> {
    const cols =
      'heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url';
    const { rows } = await this.pool.query<ConfigRow>(
      `SELECT ${cols} FROM configurations WHERE scope_employee_id IS NULL AND scope_device_id IS NULL`
    );
    return rows[0] ? toEffectiveConfig(rows[0]) : DEFAULT_CONFIG;
  }

  async updateGlobal(config: Partial<EffectiveConfig>, updatedByAdminId: string): Promise<EffectiveConfig> {
    const { rows } = await this.pool.query<ConfigRow>(
      `INSERT INTO configurations (heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url, updated_by_admin_id)
       VALUES (
         COALESCE($1, 30), COALESCE($2, 600), COALESCE($3, 70), COALESCE($4, 300), COALESCE($5, 'https://api.tracker.example.com'), $6
       )
       ON CONFLICT ((true)) WHERE scope_employee_id IS NULL AND scope_device_id IS NULL
       DO UPDATE SET
         heartbeat_interval_seconds = COALESCE($1, configurations.heartbeat_interval_seconds),
         screenshot_interval_seconds = COALESCE($2, configurations.screenshot_interval_seconds),
         screenshot_quality = COALESCE($3, configurations.screenshot_quality),
         idle_threshold_seconds = COALESCE($4, configurations.idle_threshold_seconds),
         api_url = COALESCE($5, configurations.api_url),
         updated_by_admin_id = $6,
         updated_at = now()
       RETURNING heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url`,
      [
        config.heartbeatIntervalSeconds ?? null,
        config.screenshotIntervalSeconds ?? null,
        config.screenshotQuality ?? null,
        config.idleThresholdSeconds ?? null,
        config.apiUrl ?? null,
        updatedByAdminId,
      ]
    );
    return toEffectiveConfig(rows[0]!);
  }

  async updateEmployeeOverride(
    employeeId: string,
    config: Partial<EffectiveConfig> | null,
    updatedByAdminId: string
  ): Promise<EffectiveConfig | null> {
    if (config === null) {
      await this.pool.query('DELETE FROM configurations WHERE scope_employee_id = $1', [employeeId]);
      return null;
    }
    const { rows } = await this.pool.query<ConfigRow>(
      `INSERT INTO configurations (scope_employee_id, heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url, updated_by_admin_id)
       VALUES ($1, COALESCE($2, 30), COALESCE($3, 600), COALESCE($4, 70), COALESCE($5, 300), COALESCE($6, 'https://api.tracker.example.com'), $7)
       ON CONFLICT (scope_employee_id) DO UPDATE SET
         heartbeat_interval_seconds = COALESCE($2, configurations.heartbeat_interval_seconds),
         screenshot_interval_seconds = COALESCE($3, configurations.screenshot_interval_seconds),
         screenshot_quality = COALESCE($4, configurations.screenshot_quality),
         idle_threshold_seconds = COALESCE($5, configurations.idle_threshold_seconds),
         api_url = COALESCE($6, configurations.api_url),
         updated_by_admin_id = $7,
         updated_at = now()
       RETURNING heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url`,
      [
        employeeId,
        config.heartbeatIntervalSeconds ?? null,
        config.screenshotIntervalSeconds ?? null,
        config.screenshotQuality ?? null,
        config.idleThresholdSeconds ?? null,
        config.apiUrl ?? null,
        updatedByAdminId,
      ]
    );
    return toEffectiveConfig(rows[0]!);
  }

  async updateDeviceOverride(
    deviceId: string,
    config: Partial<EffectiveConfig> | null,
    updatedByAdminId: string
  ): Promise<EffectiveConfig | null> {
    if (config === null) {
      await this.pool.query('DELETE FROM configurations WHERE scope_device_id = $1', [deviceId]);
      return null;
    }
    const { rows } = await this.pool.query<ConfigRow>(
      `INSERT INTO configurations (scope_device_id, heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url, updated_by_admin_id)
       VALUES ($1, COALESCE($2, 30), COALESCE($3, 600), COALESCE($4, 70), COALESCE($5, 300), COALESCE($6, 'https://api.tracker.example.com'), $7)
       ON CONFLICT (scope_device_id) DO UPDATE SET
         heartbeat_interval_seconds = COALESCE($2, configurations.heartbeat_interval_seconds),
         screenshot_interval_seconds = COALESCE($3, configurations.screenshot_interval_seconds),
         screenshot_quality = COALESCE($4, configurations.screenshot_quality),
         idle_threshold_seconds = COALESCE($5, configurations.idle_threshold_seconds),
         api_url = COALESCE($6, configurations.api_url),
         updated_by_admin_id = $7,
         updated_at = now()
       RETURNING heartbeat_interval_seconds, screenshot_interval_seconds, screenshot_quality, idle_threshold_seconds, api_url`,
      [
        deviceId,
        config.heartbeatIntervalSeconds ?? null,
        config.screenshotIntervalSeconds ?? null,
        config.screenshotQuality ?? null,
        config.idleThresholdSeconds ?? null,
        config.apiUrl ?? null,
        updatedByAdminId,
      ]
    );
    return toEffectiveConfig(rows[0]!);
  }
}
