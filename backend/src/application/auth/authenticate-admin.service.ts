import { DomainError } from '../../domain/errors/domain-error';
import { AdminRepository } from '../ports/admin-repository.port';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { PasswordHasher, TokenService } from '../ports/token.port';

const REFRESH_TOKEN_TTL_DAYS = 7;
const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export interface AuthenticateAdminInput {
  email: string;
  password: string;
}

export interface AuthenticateAdminResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  admin: { id: string; fullName: string; email: string; role: string };
}

export class AuthenticateAdminService {
  constructor(
    private readonly admins: AdminRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService
  ) {}

  async execute(input: AuthenticateAdminInput): Promise<AuthenticateAdminResult> {
    const admin = await this.admins.findByEmail(input.email);
    if (!admin) {
      throw DomainError.unauthorized('Invalid email or password');
    }
    if (admin.status !== 'active') {
      throw DomainError.forbidden('Admin account is disabled');
    }

    const passwordOk = await this.passwordHasher.verify(admin.passwordHash, input.password);
    if (!passwordOk) {
      throw DomainError.unauthorized('Invalid email or password');
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: admin.id,
      principalType: 'admin',
      role: admin.roleName ?? 'viewer',
    });

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.refreshTokens.create({
      principalType: 'admin',
      principalId: admin.id,
      tokenHash,
      expiresAt,
    });

    await this.admins.touchLastLogin(admin.id);

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      admin: { id: admin.id, fullName: admin.fullName, email: admin.email, role: admin.roleName ?? 'viewer' },
    };
  }
}
