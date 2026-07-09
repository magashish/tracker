import { AuditLog } from '../../domain/entities/audit-log';

export interface AuditLogRepository {
  record(entry: AuditLog): Promise<void>;
  query(params: {
    actorAdminId?: string;
    entityType?: string;
    from?: Date;
    to?: Date;
    page: number;
    pageSize: number;
  }): Promise<{ items: AuditLog[]; total: number }>;
}
