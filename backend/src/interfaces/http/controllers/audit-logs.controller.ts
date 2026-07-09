import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';

interface AuditLogsQuery {
  actorAdminId?: string;
  entityType?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function buildAuditLogsController(container: Container) {
  return {
    async query(request: FastifyRequest, reply: FastifyReply) {
      const { actorAdminId, entityType, from, to, page = 1, pageSize = 50 } = request.query as AuditLogsQuery;
      const result = await container.admin.queryAuditLogs.query({
        actorAdminId,
        entityType,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        page,
        pageSize,
      });
      reply.send({ data: result.items, meta: { page, pageSize, total: result.total } });
    },
  };
}
