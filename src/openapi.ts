export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TMC-AACS Attendance Management API',
    version: '0.1.0',
    description:
      'Assignment M2 starter API for the Attendance Management module.',
  },
  paths: {
    '/health': {
      get: {
        summary: 'Check API process health',
        responses: {
          '200': {
            description: 'API is running',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['status'],
                  properties: { status: { type: 'string', example: 'ok' } },
                },
              },
            },
          },
        },
      },
    },
  },
};
