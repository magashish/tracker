import { AuditLogRepository } from '../ports/audit-log-repository.port';

export class QueryAuditLogsService {
  constructor(private readonly auditLogs: AuditLogRepository) {}

  query(params: { actorAdminId?: string; entityType?: string; from?: Date; to?: Date; page: number; pageSize: number }) {
    return this.auditLogs.query(params);
  }
}
