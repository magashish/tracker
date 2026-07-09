import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';
import { DomainError } from '../../../domain/errors/domain-error';
import { SessionEndReason } from '../../../domain/entities/session';

interface StartSessionBody {
  deviceId: string;
}
interface SessionParams {
  sessionId: string;
}
interface EndSessionBody {
  reason?: SessionEndReason;
}
interface HeartbeatBody {
  capturedAt: string;
  idleSeconds: number;
  systemUptimeSeconds: number;
  activeApp: string;
  activeWindowTitle?: string | null;
}
interface ActivityBatchBody {
  samples: Array<{
    sessionId: string;
    windowStart: string;
    windowEnd: string;
    appName: string;
    windowTitle?: string | null;
    activeSeconds: number;
    idleSeconds: number;
  }>;
}
interface ActivityQuery {
  employeeId: string;
  from: string;
  to: string;
  cursor?: string;
  limit?: number;
}

export function buildActivityController(container: Container) {
  return {
    async startSession(request: FastifyRequest, reply: FastifyReply) {
      const employeeId = request.principal!.sub;
      const { deviceId } = request.body as StartSessionBody;
      const session = await container.tracking.sessionLifecycle.start(employeeId, deviceId);
      reply.send({ data: { sessionId: session.id, startedAt: session.startedAt } });
    },

    async endSession(request: FastifyRequest, reply: FastifyReply) {
      const employeeId = request.principal!.sub;
      const { sessionId } = request.params as SessionParams;
      const { reason = 'logout' } = request.body as EndSessionBody;
      await container.tracking.sessionLifecycle.end(sessionId, employeeId, reason);
      reply.send({ data: { ended: true } });
    },

    async heartbeat(request: FastifyRequest, reply: FastifyReply) {
      const principal = request.principal!;
      if (!principal.deviceId) {
        throw DomainError.forbidden('Missing device context on token');
      }
      const { sessionId } = request.params as SessionParams;
      const body = request.body as HeartbeatBody;
      const result = await container.tracking.recordHeartbeat.execute({
        sessionId,
        employeeId: principal.sub,
        deviceId: principal.deviceId,
        capturedAt: new Date(body.capturedAt),
        idleSeconds: body.idleSeconds,
        systemUptimeSeconds: body.systemUptimeSeconds,
        activeApp: body.activeApp,
        activeWindowTitle: body.activeWindowTitle ?? null,
      });
      reply.send({ data: result });
    },

    async activityBatch(request: FastifyRequest, reply: FastifyReply) {
      const principal = request.principal!;
      if (!principal.deviceId) {
        throw DomainError.forbidden('Missing device context on token');
      }
      const { samples } = request.body as ActivityBatchBody;
      const result = await container.tracking.recordActivityBatch.execute({
        employeeId: principal.sub,
        deviceId: principal.deviceId,
        samples: samples.map((s) => ({
          ...s,
          windowStart: new Date(s.windowStart),
          windowEnd: new Date(s.windowEnd),
          windowTitle: s.windowTitle ?? null,
        })),
      });
      reply.send({ data: result });
    },

    async queryActivity(request: FastifyRequest, reply: FastifyReply) {
      const { employeeId, from, to, cursor, limit } = request.query as ActivityQuery;
      const result = await container.tracking.queryActivity.execute({
        employeeId,
        from: new Date(from),
        to: new Date(to),
        cursor,
        limit: limit ?? 200,
      });
      reply.send({ data: result.items, meta: { nextCursor: result.nextCursor } });
    },
  };
}
