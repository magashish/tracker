import { FastifyInstance } from 'fastify';
import { Container } from '../../../container';
import { buildScreenshotsController } from '../controllers/screenshots.controller';
import {
  uploadUrlSchema,
  screenshotParamsSchema,
  listScreenshotsQuerySchema,
  blurScreenshotSchema,
} from '../validation/screenshots.schema';
import { requireAuth } from '../middlewares/authenticate.middleware';
import { requireRole } from '../middlewares/authorize-role.middleware';

export async function screenshotsRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const controller = buildScreenshotsController(opts.container);
  const requireEmployee = requireAuth(opts.container.tokenService, 'employee');
  const requireAdmin = requireAuth(opts.container.tokenService, 'admin');

  fastify.post(
    '/screenshots/upload-url',
    { schema: uploadUrlSchema, preHandler: requireEmployee },
    controller.createUploadUrl
  );
  fastify.post(
    '/screenshots/:screenshotId/confirm',
    { schema: screenshotParamsSchema, preHandler: requireEmployee },
    controller.confirm
  );

  fastify.get(
    '/screenshots',
    { schema: listScreenshotsQuerySchema, preHandler: [requireAdmin, requireRole('viewer')] },
    controller.list
  );
  fastify.get(
    '/screenshots/:screenshotId',
    { schema: screenshotParamsSchema, preHandler: [requireAdmin, requireRole('viewer')] },
    controller.getOne
  );
  fastify.patch(
    '/screenshots/:screenshotId/blur',
    { schema: blurScreenshotSchema, preHandler: [requireAdmin, requireRole('manager')] },
    controller.blur
  );
}
