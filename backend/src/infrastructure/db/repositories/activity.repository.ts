import { Pool } from 'pg';
import { ActivityRepository } from '../../../application/ports/activity-repository.port';
import { ActivitySample } from '../../../domain/entities/activity';

interface ActivityRow {
  id: string;
  session_id: string;
  employee_id: string;
  device_id: string;
  window_start: Date;
  window_end: Date;
  app_name: string;
  window_title: string | null;
  active_seconds: number;
  idle_seconds: number;
}

function toActivity(row: ActivityRow): ActivitySample {
  return {
    id: Number(row.id),
    sessionId: row.session_id,
    employeeId: row.employee_id,
    deviceId: row.device_id,
    windowStart: row.window_start,
    windowEnd: row.window_end,
    appName: row.app_name,
    windowTitle: row.window_title,
    activeSeconds: row.active_seconds,
    idleSeconds: row.idle_seconds,
  };
}

export class PostgresActivityRepository implements ActivityRepository {
  constructor(private readonly pool: Pool) {}

  async insertOne(sample: ActivitySample): Promise<void> {
    await this.pool.query(
      `INSERT INTO activity (session_id, employee_id, device_id, window_start, window_end, app_name, window_title, active_seconds, idle_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        sample.sessionId,
        sample.employeeId,
        sample.deviceId,
        sample.windowStart,
        sample.windowEnd,
        sample.appName,
        sample.windowTitle,
        sample.activeSeconds,
        sample.idleSeconds,
      ]
    );
  }

  async insertBatch(samples: ActivitySample[]): Promise<number> {
    if (samples.length === 0) return 0;

    const values: unknown[] = [];
    const rows = samples.map((s, i) => {
      const base = i * 9;
      values.push(
        s.sessionId,
        s.employeeId,
        s.deviceId,
        s.windowStart,
        s.windowEnd,
        s.appName,
        s.windowTitle,
        s.activeSeconds,
        s.idleSeconds
      );
      return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7}, $${base + 8}, $${base + 9})`;
    });

    const result = await this.pool.query(
      `INSERT INTO activity (session_id, employee_id, device_id, window_start, window_end, app_name, window_title, active_seconds, idle_seconds)
       VALUES ${rows.join(', ')}`,
      values
    );
    return result.rowCount ?? 0;
  }

  async query(params: {
    employeeId: string;
    from: Date;
    to: Date;
    cursor?: string;
    limit: number;
  }): Promise<{ items: ActivitySample[]; nextCursor: string | null }> {
    const cursorId = params.cursor ? Number(params.cursor) : null;
    const { rows } = await this.pool.query<ActivityRow>(
      `SELECT * FROM activity
       WHERE employee_id = $1 AND window_start >= $2 AND window_start < $3
         AND ($4::bigint IS NULL OR id > $4)
       ORDER BY id ASC
       LIMIT $5`,
      [params.employeeId, params.from, params.to, cursorId, params.limit]
    );
    const items = rows.map(toActivity);
    const last = items[items.length - 1];
    const nextCursor = items.length === params.limit && last ? String(last.id) : null;
    return { items, nextCursor };
  }
}
