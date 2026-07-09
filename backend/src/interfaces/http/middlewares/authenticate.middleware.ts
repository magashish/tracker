import { FastifyReply, FastifyRequest } from 'fastify';
import { TokenService, AccessTokenPayload } from '../../../application/ports/token.port';
import { DomainError } from '../../../domain/errors/domain-error';

declare module 'fastify' {
  interface FastifyRequest {
    principal?: AccessTokenPayload;
  }
}

function extractBearerToken(request: FastifyRequest): string {
  const header = request.headers.authorization;
  if (!header?.startsWith('Bearer ')) {
    throw DomainError.unauthorized('Missing bearer token');
  }
  return header.slice('Bearer '.length);
}

export function requireAuth(tokenService: TokenService, principalType: 'employee' | 'admin') {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const token = extractBearerToken(request);
    const payload = tokenService.verifyAccessToken(token);
    if (payload.principalType !== principalType) {
      throw DomainError.forbidden(`This endpoint requires a ${principalType} token`);
    }
    request.principal = payload;
  };
}
