export const createEmployeeSchema = {
  body: {
    type: 'object',
    required: ['email', 'fullName', 'password'],
    properties: {
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string', minLength: 1, maxLength: 255 },
      password: { type: 'string', minLength: 8 },
      team: { type: 'string', maxLength: 100 },
    },
  },
} as const;

export const updateEmployeeSchema = {
  params: {
    type: 'object',
    required: ['employeeId'],
    properties: { employeeId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 255 },
      team: { type: 'string', maxLength: 100 },
      status: { type: 'string', enum: ['active', 'suspended', 'deactivated'] },
    },
  },
} as const;

export const listEmployeesQuerySchema = {
  querystring: {
    type: 'object',
    properties: {
      search: { type: 'string' },
      status: { type: 'string', enum: ['active', 'suspended', 'deactivated'] },
      page: { type: 'integer', minimum: 1, default: 1 },
      pageSize: { type: 'integer', minimum: 1, maximum: 200, default: 50 },
    },
  },
} as const;

export const createAdminSchema = {
  body: {
    type: 'object',
    required: ['email', 'fullName', 'password', 'roleName'],
    properties: {
      email: { type: 'string', format: 'email' },
      fullName: { type: 'string', minLength: 1, maxLength: 255 },
      password: { type: 'string', minLength: 8 },
      roleName: { type: 'string', enum: ['owner', 'admin', 'manager', 'viewer'] },
    },
  },
} as const;

export const updateAdminSchema = {
  params: {
    type: 'object',
    required: ['adminId'],
    properties: { adminId: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    properties: {
      fullName: { type: 'string', minLength: 1, maxLength: 255 },
      status: { type: 'string', enum: ['active', 'disabled'] },
      roleName: { type: 'string', enum: ['owner', 'admin', 'manager', 'viewer'] },
    },
  },
} as const;
