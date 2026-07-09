export type Principal =
  | { principalType: 'employee'; id: string; deviceId: string }
  | { principalType: 'admin'; id: string; role: string };

export interface AccessTokenPayload {
  sub: string;
  principalType: 'employee' | 'admin';
  deviceId?: string;
  role?: string;
}

export interface TokenService {
  signAccessToken(payload: AccessTokenPayload): string;
  verifyAccessToken(token: string): AccessTokenPayload;
  generateRefreshToken(): string;
  hashRefreshToken(rawToken: string): string;
}

export interface PasswordHasher {
  hash(plainText: string): Promise<string>;
  verify(hash: string, plainText: string): Promise<boolean>;
}

export interface Clock {
  now(): Date;
}
