import { Pool } from 'pg';
import { SessionRepository } from '../../../application/ports/session-repository.port';
import { Session, SessionEndReason } from '../../../domain/entities/session';

interface SessionRow {
  id: string;
  employee_id: string;
  device_id: string;
  started_at: Date;
  ended_at: Date | null;
  end_reason: SessionEndReason | null;
  last_heartbeat_at: Date;
}

function toSession(row: SessionRow): Session {
  return {
    id: row.id,
    employeeId: row.employee_id,
    deviceId: row.device_id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    endReason: row.end_reason,
    lastHeartbeatAt: row.last_heartbeat_at,
  };
}

export class PostgresSessionRepository implements SessionRepository {
  constructor(private readonly pool: Pool) {}

  async start(employeeId: string, deviceId: string): Promise<Session> {
    const { rows } = await this.pool.query<SessionRow>(
      `INSERT INTO sessions (employee_id, device_id) VALUES ($1, $2) RETURNING *`,
      [employeeId, deviceId]
    );
    return toSession(rows[0]!);
  }

  async findById(id: string): Promise<Session | null> {
    const { rows } = await this.pool.query<SessionRow>('SELECT * FROM sessions WHERE id = $1', [id]);
    return rows[0] ? toSession(rows[0]) : null;
  }

  async recordHeartbeat(sessionId: string): Promise<void> {
    await this.pool.query('UPDATE sessions SET last_heartbeat_at = now() WHERE id = $1', [sessionId]);
  }

  async end(sessionId: string, reason: SessionEndReason): Promise<void> {
    await this.pool.query(
      'UPDATE sessions SET ended_at = now(), end_reason = $2 WHERE id = $1',
      [sessionId, reason]
    );
  }

  async findOpenByDevice(deviceId: string): Promise<Session | null> {
    const { rows } = await this.pool.query<SessionRow>(
      'SELECT * FROM sessions WHERE device_id = $1 AND ended_at IS NULL ORDER BY started_at DESC LIMIT 1',
      [deviceId]
    );
    return rows[0] ? toSession(rows[0]) : null;
  }

  async listLiveSessions(_staleAfterSeconds: number) {
    // Returns all open sessions from the last 24h; the caller classifies
    // online/offline from last_heartbeat_at using its own staleness threshold.
    const { rows } = await this.pool.query<
      SessionRow & { employee_full_name: string; hostname: string }
    >(
      `SELECT s.*, e.full_name AS employee_full_name, d.hostname
       FROM sessions s
       JOIN employees e ON e.id = s.employee_id
       JOIN devices d ON d.id = s.device_id
       WHERE s.ended_at IS NULL
         AND s.last_heartbeat_at > now() - interval '24 hours'
       ORDER BY s.last_heartbeat_at DESC`
    );
    return rows.map((row) => ({
      session: toSession(row),
      employeeId: row.employee_id,
      employeeFullName: row.employee_full_name,
      deviceId: row.device_id,
      hostname: row.hostname,
    }));
  }
}
