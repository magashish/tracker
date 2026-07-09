import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
import { AccessTokenPayload, TokenService } from '../../application/ports/token.port';
import { DomainError } from '../../domain/errors/domain-error';

const ACCESS_TOKEN_TTL = '15m';

// HS256 with a shared secret for now; swap to RS256 with a private/public
// keypair (JWT_ACCESS_PRIVATE_KEY / JWT_ACCESS_PUBLIC_KEY) once a second
// service needs to verify tokens without holding the signing secret.
export class JwtTokenService implements TokenService {
  constructor(private readonly secret: string) {}

  signAccessToken(payload: AccessTokenPayload): string {
    return jwt.sign(payload, this.secret, { expiresIn: ACCESS_TOKEN_TTL, algorithm: 'HS256' });
  }

  verifyAccessToken(token: string): AccessTokenPayload {
    try {
      const decoded = jwt.verify(token, this.secret, { algorithms: ['HS256'] });
      return decoded as unknown as AccessTokenPayload;
    } catch {
      throw DomainError.unauthorized('Invalid or expired access token');
    }
  }

  generateRefreshToken(): string {
    return randomBytes(32).toString('hex');
  }

  hashRefreshToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }
}
