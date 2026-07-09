export const heartbeatSchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: { sessionId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['capturedAt', 'idleSeconds', 'systemUptimeSeconds', 'activeApp'],
    properties: {
      capturedAt: { type: 'string', format: 'date-time' },
      idleSeconds: { type: 'integer', minimum: 0 },
      systemUptimeSeconds: { type: 'integer', minimum: 0 },
      activeApp: { type: 'string', maxLength: 255 },
      activeWindowTitle: { type: 'string', maxLength: 500, nullable: true },
    },
  },
} as const;

export const activityBatchSchema = {
  body: {
    type: 'object',
    required: ['samples'],
    properties: {
      samples: {
        type: 'array',
        maxItems: 500,
        items: {
          type: 'object',
          required: ['sessionId', 'windowStart', 'windowEnd', 'appName', 'activeSeconds', 'idleSeconds'],
          properties: {
            sessionId: { type: 'string', format: 'uuid' },
            windowStart: { type: 'string', format: 'date-time' },
            windowEnd: { type: 'string', format: 'date-time' },
            appName: { type: 'string', maxLength: 255 },
            windowTitle: { type: 'string', maxLength: 500, nullable: true },
            activeSeconds: { type: 'integer', minimum: 0 },
            idleSeconds: { type: 'integer', minimum: 0 },
          },
        },
      },
    },
  },
} as const;

export const sessionStartSchema = {
  body: {
    type: 'object',
    required: ['deviceId'],
    properties: { deviceId: { type: 'string', format: 'uuid' } },
  },
} as const;

export const sessionEndSchema = {
  params: {
    type: 'object',
    required: ['sessionId'],
    properties: { sessionId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      reason: { type: 'string', enum: ['logout', 'idle_timeout', 'device_offline', 'app_closed'] },
    },
  },
} as const;
