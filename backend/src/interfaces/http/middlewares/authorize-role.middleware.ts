import { FastifyReply, FastifyRequest } from 'fastify';
import { DomainError } from '../../../domain/errors/domain-error';

const ROLE_HIERARCHY = {
  viewer: 0,
  manager: 1,
  admin: 2,
  owner: 3,
} as const;

type RoleName = keyof typeof ROLE_HIERARCHY;

export function requireRole(minimumRole: RoleName) {
  return async (request: FastifyRequest, _reply: FastifyReply): Promise<void> => {
    const role = (request.principal?.role ?? 'viewer') as RoleName;
    const level = ROLE_HIERARCHY[role] ?? 0;
    const requiredLevel = ROLE_HIERARCHY[minimumRole];
    if (level < requiredLevel) {
      throw DomainError.forbidden(`This action requires the '${minimumRole}' role or higher`);
    }
  };
}
