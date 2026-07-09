import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { Container } from '../../../container';
import { DomainError } from '../../../domain/errors/domain-error';

const MAX_SCREENSHOT_BYTES = 8 * 1024 * 1024; // 8MB, generous ceiling for a compressed JPEG

interface StorageQuery {
  key: string;
  token: string;
  expiresAt: string;
}

function verifyQuery(
  container: Container,
  purpose: 'upload' | 'view',
  query: StorageQuery
): void {
  const expiresAt = Number(query.expiresAt);
  if (!query.key || !query.token || !Number.isFinite(expiresAt)) {
    throw DomainError.validation('Missing or invalid signed URL parameters');
  }
  const valid = container.signedStorageUrls.verify(query.key, purpose, expiresAt, query.token);
  if (!valid) {
    throw DomainError.unauthorized('Signed URL is invalid or has expired');
  }
}

// These endpoints stand in for what would be direct-to-S3 presigned PUT/GET
// requests: no JWT is required here because the signed key+token+expiry in
// the query string *is* the credential, scoped to exactly one object.
export async function storageRoutes(fastify: FastifyInstance, opts: { container: Container }) {
  const { container } = opts;

  fastify.addContentTypeParser(
    'image/jpeg',
    { parseAs: 'buffer', bodyLimit: MAX_SCREENSHOT_BYTES },
    (_req, body, done) => done(null, body)
  );

  fastify.put(
    '/storage/upload',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['key', 'token', 'expiresAt'],
          properties: { key: { type: 'string' }, token: { type: 'string' }, expiresAt: { type: 'string' } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as StorageQuery;
      verifyQuery(container, 'upload', query);
      const body = request.body as Buffer;
      if (!Buffer.isBuffer(body) || body.length === 0) {
        throw DomainError.validation('Request body must be a non-empty image/jpeg payload');
      }
      await container.localScreenshotStorage.writeFile(query.key, body);
      reply.status(204).send();
    }
  );

  fastify.get(
    '/storage/view',
    {
      schema: {
        querystring: {
          type: 'object',
          required: ['key', 'token', 'expiresAt'],
          properties: { key: { type: 'string' }, token: { type: 'string' }, expiresAt: { type: 'string' } },
        },
      },
    },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const query = request.query as StorageQuery;
      verifyQuery(container, 'view', query);
      try {
        const data = await container.localScreenshotStorage.readFile(query.key);
        reply.header('Content-Type', 'image/jpeg').header('Cache-Control', 'private, max-age=30').send(data);
      } catch (err) {
        const nodeErr = err as NodeJS.ErrnoException;
        if (nodeErr.code === 'ENOENT') {
          throw DomainError.notFound('Screenshot file not found');
        }
        throw err;
      }
    }
  );
}
