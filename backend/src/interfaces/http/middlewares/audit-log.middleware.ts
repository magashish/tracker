import { FastifyRequest } from 'fastify';
import { AuditLogRepository } from '../../../application/ports/audit-log-repository.port';

export function recordAuditLog(auditLogs: AuditLogRepository) {
  return async (
    request: FastifyRequest,
    action: string,
    entityType: string,
    entityId: string | null,
    metadata: Record<string, unknown> = {}
  ): Promise<void> => {
    await auditLogs.record({
      actorAdminId: request.principal?.principalType === 'admin' ? request.principal.sub : null,
      action,
      entityType,
      entityId,
      metadata,
      ipAddress: request.ip,
    });
  };
}
