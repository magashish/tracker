export const employeeLoginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password', 'deviceUuid', 'hostname', 'os', 'agentVersion'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
      deviceUuid: { type: 'string', format: 'uuid' },
      hostname: { type: 'string', minLength: 1, maxLength: 255 },
      os: { type: 'string', enum: ['windows', 'linux'] },
      osVersion: { type: 'string', maxLength: 100 },
      agentVersion: { type: 'string', maxLength: 50 },
    },
  },
} as const;

export const adminLoginSchema = {
  body: {
    type: 'object',
    required: ['email', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      password: { type: 'string', minLength: 8 },
    },
  },
} as const;

export const refreshTokenSchema = {
  body: {
    type: 'object',
    required: ['refreshToken'],
    properties: {
      refreshToken: { type: 'string', minLength: 10 },
    },
  },
} as const;
