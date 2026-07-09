export const latestVersionQuerySchema = {
  querystring: {
    type: 'object',
    required: ['platform'],
    properties: { platform: { type: 'string', enum: ['windows', 'linux'] } },
  },
} as const;

export const publishVersionSchema = {
  body: {
    type: 'object',
    required: ['platform', 'version', 'downloadUrl', 'checksumSha256'],
    properties: {
      platform: { type: 'string', enum: ['windows', 'linux'] },
      version: { type: 'string', pattern: '^\\d+\\.\\d+\\.\\d+$' },
      downloadUrl: { type: 'string', format: 'uri' },
      checksumSha256: { type: 'string', minLength: 64, maxLength: 64 },
      releaseNotes: { type: 'string' },
      isMandatory: { type: 'boolean', default: false },
    },
  },
} as const;
