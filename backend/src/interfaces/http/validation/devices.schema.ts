export const registerDeviceSchema = {
  body: {
    type: 'object',
    required: ['deviceUuid', 'hostname', 'os', 'agentVersion'],
    properties: {
      deviceUuid: { type: 'string', format: 'uuid' },
      hostname: { type: 'string', minLength: 1, maxLength: 255 },
      os: { type: 'string', enum: ['windows', 'linux'] },
      osVersion: { type: 'string', maxLength: 100 },
      agentVersion: { type: 'string', maxLength: 50 },
    },
  },
} as const;

export const deviceParamsSchema = {
  params: {
    type: 'object',
    required: ['deviceId'],
    properties: { deviceId: { type: 'string', format: 'uuid' } },
  },
} as const;
