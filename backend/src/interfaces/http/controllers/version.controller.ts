import { FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';
import { Platform } from '../../../domain/entities/app-version';
import { DomainError } from '../../../domain/errors/domain-error';

interface LatestQuery {
  platform: Platform;
}
interface PublishBody {
  platform: Platform;
  version: string;
  downloadUrl: string;
  checksumSha256: string;
  releaseNotes?: string;
  isMandatory?: boolean;
}
interface ListQuery {
  platform?: Platform;
}

export function buildVersionController(container: Container) {
  return {
    async latest(request: FastifyRequest, reply: FastifyReply) {
      const { platform } = request.query as LatestQuery;
      const version = await container.admin.manageAppVersions.getLatest(platform);
      if (!version) {
        throw DomainError.notFound('No published version for this platform yet');
      }
      reply.send({ data: version });
    },

    async publish(request: FastifyRequest, reply: FastifyReply) {
      const body = request.body as PublishBody;
      const published = await container.admin.manageAppVersions.publish({
        platform: body.platform,
        version: body.version,
        downloadUrl: body.downloadUrl,
        checksumSha256: body.checksumSha256,
        releaseNotes: body.releaseNotes ?? null,
        isMandatory: body.isMandatory ?? false,
      });
      reply.status(201).send({ data: published });
    },

    async list(request: FastifyRequest, reply: FastifyReply) {
      const { platform } = request.query as ListQuery;
      const versions = await container.admin.manageAppVersions.list(platform);
      reply.send({ data: versions });
    },
  };
}
