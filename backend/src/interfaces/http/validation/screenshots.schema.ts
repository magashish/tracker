export const uploadUrlSchema = {
  body: {
    type: 'object',
    required: ['sessionId', 'capturedAt'],
    properties: {
      sessionId: { type: 'string', format: 'uuid' },
      capturedAt: { type: 'string', format: 'date-time' },
      activityPercent: { type: 'integer', minimum: 0, maximum: 100 },
      appName: { type: 'string', maxLength: 255 },
      windowTitle: { type: 'string', maxLength: 500 },
      fileSizeBytes: { type: 'integer', minimum: 0 },
    },
  },
} as const;

export const screenshotParamsSchema = {
  params: {
    type: 'object',
    required: ['screenshotId'],
    properties: { screenshotId: { type: 'string', format: 'uuid' } },
  },
} as const;

export const listScreenshotsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      employeeId: { type: 'string', format: 'uuid' },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    },
  },
} as const;

export const blurScreenshotSchema = {
  params: {
    type: 'object',
    required: ['screenshotId'],
    properties: { screenshotId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['blurred'],
    properties: { blurred: { type: 'boolean' } },
  },
} as const;
