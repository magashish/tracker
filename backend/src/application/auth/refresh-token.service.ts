import { DomainError } from '../../domain/errors/domain-error';
import { RefreshTokenRepository, PrincipalType } from '../ports/refresh-token-repository.port';
import { TokenService, Clock } from '../ports/token.port';
import { EmployeeRepository } from '../ports/employee-repository.port';
import { AdminRepository } from '../ports/admin-repository.port';

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
const REFRESH_TOKEN_TTL_DAYS: Record<PrincipalType, number> = { employee: 30, admin: 7 };

export interface RefreshResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export class RefreshTokenService {
  constructor(
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly tokenService: TokenService,
    private readonly employees: EmployeeRepository,
    private readonly admins: AdminRepository,
    private readonly clock: Clock
  ) {}

  async execute(principalType: PrincipalType, rawRefreshToken: string): Promise<RefreshResult> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const record = await this.refreshTokens.findByHash(tokenHash);

    if (!record || record.principalType !== principalType) {
      throw DomainError.unauthorized('Invalid refresh token');
    }

    if (record.revokedAt) {
      // Reuse of an already-rotated/revoked token: treat as compromise, kill the whole chain.
      await this.refreshTokens.revokeAllForPrincipal(principalType, record.principalId);
      throw DomainError.unauthorized('Refresh token has been revoked; please log in again');
    }

    if (record.expiresAt.getTime() < this.clock.now().getTime()) {
      throw DomainError.unauthorized('Refresh token expired');
    }

    let payload: { role?: string; deviceId?: string | null } = {};
    if (principalType === 'admin') {
      const admin = await this.admins.findById(record.principalId);
      if (!admin || admin.status !== 'active') {
        throw DomainError.forbidden('Admin account is not active');
      }
      payload = { role: admin.roleName ?? 'viewer' };
    } else {
      const employee = await this.employees.findById(record.principalId);
      if (!employee || employee.status !== 'active') {
        throw DomainError.forbidden('Employee account is not active');
      }
      payload = { deviceId: record.deviceId ?? undefined };
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: record.principalId,
      principalType,
      ...(principalType === 'admin' ? { role: payload.role } : { deviceId: payload.deviceId ?? undefined }),
    });

    const newRawRefreshToken = this.tokenService.generateRefreshToken();
    const newTokenHash = this.tokenService.hashRefreshToken(newRawRefreshToken);
    const expiresAt = new Date(
      this.clock.now().getTime() + REFRESH_TOKEN_TTL_DAYS[principalType] * 24 * 60 * 60 * 1000
    );

    const newRecord = await this.refreshTokens.create({
      principalType,
      principalId: record.principalId,
      deviceId: record.deviceId,
      tokenHash: newTokenHash,
      expiresAt,
    });
    await this.refreshTokens.rotate(record.id, newRecord.id);

    return { accessToken, refreshToken: newRawRefreshToken, expiresIn: ACCESS_TOKEN_TTL_SECONDS };
  }

  async logout(principalType: PrincipalType, rawRefreshToken: string): Promise<void> {
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const record = await this.refreshTokens.findByHash(tokenHash);
    if (record && !record.revokedAt) {
      await this.refreshTokens.revoke(record.id);
    }
  }
}
