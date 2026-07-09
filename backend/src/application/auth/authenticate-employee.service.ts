import { DomainError } from '../../domain/errors/domain-error';
import { EmployeeRepository } from '../ports/employee-repository.port';
import { DeviceRepository } from '../ports/device-repository.port';
import { RefreshTokenRepository } from '../ports/refresh-token-repository.port';
import { PasswordHasher, TokenService } from '../ports/token.port';
import { DeviceOs } from '../../domain/entities/device';

const REFRESH_TOKEN_TTL_DAYS = 30;

export interface AuthenticateEmployeeInput {
  email: string;
  password: string;
  deviceUuid: string;
  hostname: string;
  os: DeviceOs;
  osVersion?: string;
  agentVersion: string;
}

export interface AuthenticateEmployeeResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  employee: { id: string; fullName: string; email: string };
  device: { id: string; status: string };
}

const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;

export class AuthenticateEmployeeService {
  constructor(
    private readonly employees: EmployeeRepository,
    private readonly devices: DeviceRepository,
    private readonly refreshTokens: RefreshTokenRepository,
    private readonly passwordHasher: PasswordHasher,
    private readonly tokenService: TokenService
  ) {}

  async execute(input: AuthenticateEmployeeInput): Promise<AuthenticateEmployeeResult> {
    const employee = await this.employees.findByEmail(input.email);
    if (!employee) {
      throw DomainError.unauthorized('Invalid email or password');
    }
    if (employee.status !== 'active') {
      throw DomainError.forbidden('Employee account is not active');
    }

    const passwordOk = await this.passwordHasher.verify(employee.passwordHash, input.password);
    if (!passwordOk) {
      throw DomainError.unauthorized('Invalid email or password');
    }

    const device = await this.devices.upsertRegistration({
      employeeId: employee.id,
      deviceUuid: input.deviceUuid,
      hostname: input.hostname,
      os: input.os,
      osVersion: input.osVersion,
      agentVersion: input.agentVersion,
    });

    if (device.status === 'revoked') {
      throw DomainError.forbidden('This device has been revoked. Contact your administrator.');
    }

    const accessToken = this.tokenService.signAccessToken({
      sub: employee.id,
      principalType: 'employee',
      deviceId: device.id,
    });

    const rawRefreshToken = this.tokenService.generateRefreshToken();
    const tokenHash = this.tokenService.hashRefreshToken(rawRefreshToken);
    const expiresAt = new Date(Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

    await this.refreshTokens.create({
      principalType: 'employee',
      principalId: employee.id,
      deviceId: device.id,
      tokenHash,
      expiresAt,
    });

    return {
      accessToken,
      refreshToken: rawRefreshToken,
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      employee: { id: employee.id, fullName: employee.fullName, email: employee.email },
      device: { id: device.id, status: device.status },
    };
  }
}
