export type DomainErrorCode =
  | 'VALIDATION_ERROR'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

const STATUS_BY_CODE: Record<DomainErrorCode, number> = {
  VALIDATION_ERROR: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

export class DomainError extends Error {
  readonly code: DomainErrorCode;
  readonly statusCode: number;
  readonly details?: unknown;

  constructor(code: DomainErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'DomainError';
    this.code = code;
    this.statusCode = STATUS_BY_CODE[code];
    this.details = details;
  }

  static validation(message: string, details?: unknown): DomainError {
    return new DomainError('VALIDATION_ERROR', message, details);
  }

  static unauthorized(message = 'Unauthorized'): DomainError {
    return new DomainError('UNAUTHORIZED', message);
  }

  static forbidden(message = 'Forbidden'): DomainError {
    return new DomainError('FORBIDDEN', message);
  }

  static notFound(message = 'Not found'): DomainError {
    return new DomainError('NOT_FOUND', message);
  }

  static conflict(message: string): DomainError {
    return new DomainError('CONFLICT', message);
  }
}
