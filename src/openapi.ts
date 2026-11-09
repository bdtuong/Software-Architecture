const recordSchema = {
  type: 'object',
  properties: {
    id: { type: 'string', format: 'uuid' },
    eventId: { type: 'string' },
    employeeId: { type: 'string' },
    factory: { type: 'string', enum: ['BINH_DUONG', 'LONG_AN'] },
    gateId: { type: 'string' },
    direction: { type: 'string', enum: ['ENTRY', 'EXIT'] },
    occurredAt: { type: 'string', format: 'date-time' },
    recordedAt: { type: 'string', format: 'date-time' },
  },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TMC-AACS Attendance Management API',
    version: '0.2.0',
    description:
      'Accepts already qualified passage events. No QR or gate authorization is performed here.',
  },
  paths: {
    '/health': {
      get: {
        summary: 'Check API process health',
        responses: { '200': { description: 'API is running' } },
      },
    },
    '/api/attendance/events': {
      post: {
        summary: 'Record a qualified attendance event',
        description:
          'A repeated event ID with identical data returns the original record. A conflicting reuse returns 409.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: [
                  'eventId',
                  'employeeId',
                  'factory',
                  'gateId',
                  'direction',
                  'occurredAt',
                ],
                additionalProperties: false,
                properties: {
                  eventId: { type: 'string', maxLength: 128 },
                  employeeId: { type: 'string', maxLength: 128 },
                  factory: { type: 'string', enum: ['BINH_DUONG', 'LONG_AN'] },
                  gateId: { type: 'string', maxLength: 128 },
                  direction: { type: 'string', enum: ['ENTRY', 'EXIT'] },
                  occurredAt: { type: 'string', format: 'date-time' },
                },
              },
            },
          },
        },
        responses: {
          '201': {
            description: 'New record created',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    status: { type: 'string' },
                    record: recordSchema,
                  },
                },
              },
            },
          },
          '200': { description: 'Identical event already recorded' },
          '400': { description: 'Invalid event' },
          '409': { description: 'Event ID already used for different data' },
          '503': {
            description:
              'Persistence unavailable; retry with the same event ID',
          },
        },
      },
    },
    '/api/attendance/history': {
      get: {
        summary: 'List an employee’s attendance history',
        parameters: [
          {
            name: 'employeeId',
            in: 'query',
            required: true,
            schema: { type: 'string' },
          },
          {
            name: 'from',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'to',
            in: 'query',
            schema: { type: 'string', format: 'date-time' },
          },
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 100, default: 50 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', minimum: 0, default: 0 },
          },
        ],
        responses: {
          '200': { description: 'History in descending event time order' },
          '400': { description: 'Invalid filter' },
          '503': { description: 'Persistence unavailable' },
        },
      },
    },
  },
};
