import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../../domain/errors/domain-error';
import { Logger } from '../../../infrastructure/logging/logger';

export function createErrorHandler(logger: Logger) {
  return function errorHandler(error: FastifyError | DomainError | Error, request: FastifyRequest, reply: FastifyReply) {
    if (error instanceof DomainError) {
      reply.status(error.statusCode).send({
        error: { code: error.code, message: error.message, details: error.details },
      });
      return;
    }

    if ('validation' in error && error.validation) {
      reply.status(400).send({
        error: { code: 'VALIDATION_ERROR', message: error.message, details: error.validation },
      });
      return;
    }

    const fastifyError = error as FastifyError;
    if (fastifyError.statusCode === 429) {
      reply.status(429).send({ error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
      return;
    }

    logger.error({ err: error, url: request.url, method: request.method }, 'Unhandled error');
    reply.status(500).send({ error: { code: 'INTERNAL_ERROR', message: 'Internal server error' } });
  };
}
