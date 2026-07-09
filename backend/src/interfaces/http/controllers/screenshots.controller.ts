import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';

interface UploadUrlBody {
  sessionId: string;
  capturedAt: string;
  activityPercent?: number;
  appName?: string;
  windowTitle?: string;
  fileSizeBytes?: number;
}
interface ScreenshotParams {
  screenshotId: string;
}
interface ListScreenshotsQuery {
  employeeId?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}
interface BlurBody {
  blurred: boolean;
}

export function buildScreenshotsController(container: Container) {
  return {
    async createUploadUrl(request: FastifyRequest, reply: FastifyReply) {
      const principal = request.principal!;
      const body = request.body as UploadUrlBody;
      const result = await container.screenshots.createUploadUrl.execute({
        sessionId: body.sessionId,
        employeeId: principal.sub,
        deviceId: principal.deviceId!,
        capturedAt: new Date(body.capturedAt),
        activityPercent: body.activityPercent,
        appName: body.appName,
        windowTitle: body.windowTitle,
        fileSizeBytes: body.fileSizeBytes,
      });
      reply.send({ data: result });
    },

    async confirm(request: FastifyRequest, reply: FastifyReply) {
      const employeeId = request.principal!.sub;
      const { screenshotId } = request.params as ScreenshotParams;
      await container.screenshots.confirmScreenshot.execute(screenshotId, employeeId);
      reply.send({ data: { confirmed: true } });
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const { employeeId, from, to, page = 1, pageSize = 50 } = request.query as ListScreenshotsQuery;
      const result = await container.screenshots.queryScreenshots.list({
        employeeId,
        from: from ? new Date(from) : undefined,
        to: to ? new Date(to) : undefined,
        page,
        pageSize,
      });
      reply.send({ data: result.items, meta: { page, pageSize, total: result.total } });
    },

    async getOne(request: FastifyRequest, reply: FastifyReply) {
      const adminId = request.principal!.sub;
      const { screenshotId } = request.params as ScreenshotParams;
      const result = await container.screenshots.queryScreenshots.getOne(screenshotId, adminId, request.ip);
      reply.send({ data: result });
    },

    async blur(request: FastifyRequest, reply: FastifyReply) {
      const { screenshotId } = request.params as ScreenshotParams;
      const { blurred } = request.body as BlurBody;
      await container.screenshots.queryScreenshots.blur(screenshotId, blurred);
      reply.send({ data: { updated: true } });
    },
  };
}
