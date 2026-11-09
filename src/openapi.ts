const bearer = [{ bearerAuth: [] }];
const factory = { type: 'string', enum: ['BINH_DUONG', 'LONG_AN'] };
const direction = { type: 'string', enum: ['ENTRY', 'EXIT'] };
const timestamp = { type: 'string', format: 'date-time' };
const employeeId = {
  name: 'employeeId',
  in: 'query',
  required: true,
  schema: { type: 'string' },
};
const factoryQuery = {
  name: 'factory',
  in: 'query',
  required: true,
  schema: factory,
};
const pagination = [
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
];
const responses = {
  '400': { description: 'Invalid request' },
  '401': { description: 'Missing or invalid bearer token' },
  '403': { description: 'Role or resource scope denied' },
  '409': { description: 'Conflicting state or identifier' },
  '503': { description: 'Persistence unavailable; retry safely' },
};

export const openApiDocument = {
  openapi: '3.0.3',
  info: {
    title: 'TMC-AACS Attendance Service API',
    version: '0.3.0',
    description:
      'Attendance module from the M1 service-based architecture. Requires signed, scoped identities issued by the Identity and Access Service.',
  },
  components: {
    securitySchemes: {
      bearerAuth: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
    },
  },
  paths: {
    '/health': {
      get: {
        summary: 'API process health',
        responses: { '200': { description: 'Running' } },
      },
    },
    '/api/attendance/events': {
      post: {
        summary: 'Accept a qualified passage event (GATEWAY)',
        security: bearer,
        description:
          'The Gate Service must qualify physical passage and supply a stable Event ID and passage evidence reference. Identical retries return 200; conflicting IDs return 409.',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                additionalProperties: false,
                required: [
                  'eventId',
                  'passageEvidenceId',
                  'employeeId',
                  'factory',
                  'gateId',
                  'direction',
                  'occurredAt',
                ],
                properties: {
                  eventId: { type: 'string' },
                  passageEvidenceId: { type: 'string' },
                  employeeId: { type: 'string' },
                  factory,
                  gateId: { type: 'string' },
                  direction,
                  occurredAt: timestamp,
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Accepted and committed' },
          '200': { description: 'Identical event already accepted' },
          ...responses,
        },
      },
    },
    '/api/attendance/history': {
      get: {
        summary: 'Effective attendance history after approved corrections',
        security: bearer,
        parameters: [
          employeeId,
          { name: 'from', in: 'query', schema: timestamp },
          { name: 'to', in: 'query', schema: timestamp },
          ...pagination,
        ],
        responses: {
          '200': {
            description: 'History ordered by occurrence time, newest first',
          },
          ...responses,
        },
      },
    },
    '/api/attendance/state': {
      get: {
        summary: 'Current IN, OUT, or UNKNOWN state with review flag',
        security: bearer,
        parameters: [employeeId],
        responses: {
          '200': { description: 'Derived from effective event history' },
          ...responses,
        },
      },
    },
    '/api/attendance/corrections': {
      post: {
        summary:
          'Request ADD, REPLACE, or VOID correction (EMPLOYEE or SECURITY)',
        security: bearer,
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['kind', 'employeeId', 'factory', 'reason'],
                properties: {
                  kind: { type: 'string', enum: ['ADD', 'REPLACE', 'VOID'] },
                  employeeId: { type: 'string' },
                  factory,
                  targetRecordId: { type: 'string', format: 'uuid' },
                  direction,
                  occurredAt: timestamp,
                  reason: { type: 'string', minLength: 10 },
                },
              },
            },
          },
        },
        responses: {
          '201': { description: 'Pending correction created' },
          ...responses,
        },
      },
      get: {
        summary: 'List correction requests for an employee',
        security: bearer,
        parameters: [employeeId],
        responses: {
          '200': { description: 'Requests and review outcomes' },
          ...responses,
        },
      },
    },
    '/api/attendance/corrections/{id}/review': {
      post: {
        summary: 'Approve or reject a correction (HR)',
        security: bearer,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['approve', 'reason'],
                properties: {
                  approve: { type: 'boolean' },
                  reason: { type: 'string', minLength: 10 },
                },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Reviewed and audit event committed' },
          ...responses,
        },
      },
    },
    '/api/attendance/periods/{month}/finalize': {
      post: {
        summary: 'Finalize a past Vietnam calendar month (HR)',
        security: bearer,
        parameters: [
          {
            name: 'month',
            in: 'path',
            required: true,
            schema: { type: 'string', pattern: '^\\d{4}-(0[1-9]|1[0-2])$' },
          },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['factory'],
                properties: { factory },
              },
            },
          },
        },
        responses: {
          '200': { description: 'Finalized period and revision' },
          ...responses,
        },
      },
    },
    '/api/attendance/periods/{month}/export': {
      get: {
        summary: 'Read finalized effective attendance for Integration Service',
        security: bearer,
        parameters: [
          {
            name: 'month',
            in: 'path',
            required: true,
            schema: { type: 'string' },
          },
          factoryQuery,
          {
            name: 'limit',
            in: 'query',
            schema: { type: 'integer', minimum: 1, maximum: 500, default: 100 },
          },
          {
            name: 'offset',
            in: 'query',
            schema: { type: 'integer', minimum: 0, default: 0 },
          },
        ],
        responses: {
          '200': { description: 'Revisioned monthly data' },
          ...responses,
        },
      },
    },
    '/internal/audit-outbox/events': {
      get: {
        summary: 'Poll pending audit events (REPORTING)',
        security: bearer,
        responses: {
          '200': {
            description: 'Up to 100 pending events; deduplicate by event ID',
          },
          ...responses,
        },
      },
    },
    '/internal/audit-outbox/events/{id}/ack': {
      post: {
        summary:
          'Acknowledge audit event after durable Reporting and Audit storage',
        security: bearer,
        parameters: [
          {
            name: 'id',
            in: 'path',
            required: true,
            schema: { type: 'string', format: 'uuid' },
          },
        ],
        responses: {
          '204': { description: 'Acknowledged or already acknowledged' },
          ...responses,
        },
      },
    },
  },
};
