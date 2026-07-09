import { Pool } from 'pg';
import { AuditLogRepository } from '../../../application/ports/audit-log-repository.port';
import { AuditLog } from '../../../domain/entities/audit-log';

interface AuditLogRow {
  id: string;
  actor_admin_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  metadata: Record<string, unknown>;
  ip_address: string | null;
  created_at: Date;
}

function toAuditLog(row: AuditLogRow): AuditLog {
  return {
    id: Number(row.id),
    actorAdminId: row.actor_admin_id,
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id,
    metadata: row.metadata,
    ipAddress: row.ip_address,
    createdAt: row.created_at,
  };
}

export class PostgresAuditLogRepository implements AuditLogRepository {
  constructor(private readonly pool: Pool) {}

  async record(entry: AuditLog): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (actor_admin_id, action, entity_type, entity_id, metadata, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [entry.actorAdminId, entry.action, entry.entityType, entry.entityId, entry.metadata, entry.ipAddress]
    );
  }

  async query(params: {
    actorAdminId?: string;
    entityType?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }): Promise<{ items: AuditLog[]; total: number }> {
    const conditions: string[] = [];
    const values: unknown[] = [];

    if (params.actorAdminId) {
      values.push(params.actorAdminId);
      conditions.push(`actor_admin_id = $${values.length}`);
    }
    if (params.entityType) {
      values.push(params.entityType);
      conditions.push(`entity_type = $${values.length}`);
    }
    if (params.from) {
      values.push(params.from);
      conditions.push(`created_at >= $${values.length}`);
    }
    if (params.to) {
      values.push(params.to);
      conditions.push(`created_at < $${values.length}`);
    }
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const countResult = await this.pool.query<{ count: string }>(`SELECT COUNT(*) FROM audit_logs ${where}`, values);

    values.push(params.pageSize, (params.page - 1) * params.pageSize);
    const { rows } = await this.pool.query<AuditLogRow>(
      `SELECT * FROM audit_logs ${where} ORDER BY created_at DESC LIMIT $${values.length - 1} OFFSET $${values.length}`,
      values
    );

    return { items: rows.map(toAuditLog), total: Number(countResult.rows[0]?.count ?? 0) };
  }
}
