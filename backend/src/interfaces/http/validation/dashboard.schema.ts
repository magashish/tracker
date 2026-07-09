export const employeeSummaryParamsSchema = {
  params: {
    type: 'object',
    required: ['employeeId'],
    properties: { employeeId: { type: 'string', format: 'uuid' } },
  },
  querystring: {
    type: 'object',
    properties: { date: { type: 'string', format: 'date' } },
  },
} as const;

export const activityQuerySchema = {
  querystring: {
    type: 'object',
    required: ['employeeId', 'from', 'to'],
    properties: {
      employeeId: { type: 'string', format: 'uuid' },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 500, default: 200 },
    },
  },
} as const;

export const auditLogsQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      actorAdminId: { type: 'string', format: 'uuid' },
      entityType: { type: 'string' },
      from: { type: 'string', format: 'date-time' },
      to: { type: 'string', format: 'date-time' },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    },
  },
} as const;
