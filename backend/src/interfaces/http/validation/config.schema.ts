const configBodyProperties = {
  heartbeatIntervalSeconds: { type: 'integer', minimum: 5, maximum: 3600 },
  screenshotIntervalSeconds: { type: 'integer', minimum: 30, maximum: 86400 },
  screenshotQuality: { type: 'integer', minimum: 10, maximum: 100 },
  idleThresholdSeconds: { type: 'integer', minimum: 30, maximum: 3600 },
  apiUrl: { type: 'string', format: 'uri' },
} as const;

export const updateGlobalConfigSchema = {
  body: { type: 'object', properties: configBodyProperties },
} as const;

export const updateEmployeeConfigSchema = {
  params: {
    type: 'object',
    required: ['employeeId'],
    properties: { employeeId: { type: 'string', format: 'uuid' } },
  },
  body: { type: 'object', properties: configBodyProperties, nullable: true },
} as const;

export const updateDeviceConfigSchema = {
  params: {
    type: 'object',
    required: ['deviceId'],
    properties: { deviceId: { type: 'string', format: 'uuid' } },
  },
  body: { type: 'object', properties: configBodyProperties, nullable: true },
} as const;

export const deviceConfigParamsSchema = {
  params: {
    type: 'object',
    required: ['deviceId'],
    properties: { deviceId: { type: 'string', format: 'uuid' } },
  },
} as const;
