import { Pool } from 'pg';
import { CreateScreenshotInput, ScreenshotRepository } from '../../../application/ports/screenshot-repository.port';
import { Screenshot } from '../../../domain/entities/screenshot';

interface ScreenshotRow {
  id: string;
  session_id: string;
  employee_id: string;
  device_id: string;
  storage_key: string;
  thumbnail_key: string | null;
  captured_at: Date;
  uploaded_at: Date | null;
  activity_percent: number | null;
  app_name: string | null;
  window_title: string | null;
  file_size_bytes: number | null;
  is_blurred: boolean;
}

function toScreenshot(row: ScreenshotRow): Screenshot {
  return {
    id: row.id,
    sessionId: row.session_id,
    employeeId: row.employee_id,
    deviceId: row.device_id,
    storageKey: row.storage_key,
    thumbnailKey: row.thumbnail_key,
    capturedAt: row.captured_at,
    uploadedAt: row.uploaded_at,
    activityPercent: row.activity_percent,
    appName: row.app_name,
    windowTitle: row.window_title,
    fileSizeBytes: row.file_size_bytes,
    isBlurred: row.is_blurred,
  };
}

export class PostgresScreenshotRepository implements ScreenshotRepository {
  constructor(private readonly pool: Pool) {}

  async create(input: CreateScreenshotInput): Promise<Screenshot> {
    const { rows } = await this.pool.query<ScreenshotRow>(
      `INSERT INTO screenshots (id, session_id, employee_id, device_id, storage_key, captured_at, activity_percent, app_name, window_title, file_size_bytes)
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        input.sessionId,
        input.employeeId,
        input.deviceId,
        input.storageKey,
        input.capturedAt,
        input.activityPercent ?? null,
        input.appName ?? null,
        input.windowTitle ?? null,
        input.fileSizeBytes ?? null,
      ]
    );
    return toScreenshot(rows[0]!);
  }

  async findById(id: string): Promise<Screenshot | null> {
    const { rows } = await this.pool.query<ScreenshotRow>('SELECT * FROM screenshots WHERE id = $1', [id]);
    return rows[0] ? toScreenshot(rows[0]) : null;
  }

  async confirmUploaded(id: string): Promise<void> {
    await this.pool.query('UPDATE screenshots SET uploaded_at = now() WHERE id = $1', [id]);
  }

  async setBlurred(id: string, blurred: boolean): Promise<void> {
    await this.pool.query('UPDATE screenshots SET is_blurred = $2 WHERE id = $1', [id, blurred]);
  }

  async query(params: {
    employeeId?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }): Promise<{ items: Screenshot[]; total: number }> {
    const conditions: string[] = ['uploaded_at IS NOT NULL'];
    const values: unknown[] = [];

    if (params.employeeId) {
      values.push(params.employeeId);
      conditions.push(`employee_id = $${values.length}`);
    }
    if (params.from) {
      values.push(params.from);
      conditions.push(`captured_at >= $${values.length}`);
    }
    if (params.to) {
      values.push(params.to);
      conditions.push(`captured_at < $${values.length}`);
    }
    const where = `WHERE ${conditions.join(' AND ')}`;

    const countResult = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*) FROM screenshots ${where}`,
      values
    );

    values.push(params.pageSize, (params.page - 1) * params.pageSize);
    const { rows } = await this.pool.query<ScreenshotRow>(
      `SELECT * FROM screenshots ${where} ORDER BY captured_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return { items: rows.map(toScreenshot), total: Number(countResult.rows[0]?.count ?? 0) };
  }

  async findOlderThan(cutoff: Date, limit: number): Promise<Screenshot[]> {
    const { rows } = await this.pool.query<ScreenshotRow>(
      'SELECT * FROM screenshots WHERE captured_at < $1 ORDER BY captured_at ASC LIMIT $2',
      [cutoff, limit]
    );
    return rows.map(toScreenshot);
  }

  async deleteById(id: string): Promise<void> {
    await this.pool.query('DELETE FROM screenshots WHERE id = $1', [id]);
  }
}
