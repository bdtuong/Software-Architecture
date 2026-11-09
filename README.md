# TMC-AACS Attendance Management backend

Software Architecture (CO3017), Assignment M2. TMC-AACS serves factories in Binh Duong (~800 employees) and Long An (~600). This repository implements **one selected module, Attendance Management**, from the larger Pure Service-Based Architecture. Factory Edge and Central Infrastructure are deployment locations, not another architectural style.

## Scope and boundaries

Implemented: acceptance of already qualified passage events, Zod validation, central PostgreSQL persistence, idempotency by stable Event ID, employee history with time filtering and pagination, health check, and Swagger UI. The attendance record is authoritative in central PostgreSQL. A duplicate event with identical data returns the original record; a conflicting reuse returns HTTP 409. Database failures return HTTP 503 so upstream can retry with the same Event ID.

Outside this module: QR issuance, access authorization, physical turnstile integration, Factory Edge SQLite outbox, reporting, and HR/Payroll synchronization. An Allow decision does **not** prove physical passage. Event qualification and caller authentication are responsibilities of the surrounding system; **these routes currently have no built-in authentication or RBAC and must not be exposed to untrusted clients**. The module also has no retry queue, audit trail, or database connectivity health probe. Those are important system-level follow-up work, not claims of this implementation.

## Stack

Node.js 22 LTS, TypeScript, Express 5, PostgreSQL 16, Prisma 6, Zod 3, Vitest 3, Supertest 7, OpenAPI/Swagger UI, ESLint, Prettier, npm, and Docker Compose.

## Structure

- `src/app.ts`, `src/server.ts`: HTTP composition and process lifecycle.
- `src/config/env.ts`: validated runtime configuration.
- `src/modules/attendance/domain/`: event and record concepts.
- `src/modules/attendance/application/`: use case and focused repository port.
- `src/modules/attendance/infrastructure/`: Prisma persistence adapter.
- `src/modules/attendance/presentation/`: input validation and HTTP routes.
- `prisma/`: PostgreSQL schema and migration.
- `tests/integration/`: HTTP contract tests using an in-memory repository test double.
- `tests/unit/`: Prisma adapter behavior with mocked database calls.
- `docs/architecture/`: broader system boundary.

The HTTP layer only parses and serializes requests (SRP). The application service depends on a small repository contract, while Prisma remains in the infrastructure adapter (ISP/DIP). Alternative repository adapters can satisfy that contract (LSP), and policy extension points can be introduced when requirements demand them (OCP). The unique database constraint, rather than a read-before-write check, resolves concurrent retries safely.

## Setup

1. Install Node.js 22 or 24, npm, and Docker Compose.
2. Run `npm ci` and copy `.env.example` to `.env`. Adjust `PORT` and `DATABASE_URL` if needed.
3. Start PostgreSQL: `docker compose up -d postgres`.
4. Apply the schema: `npm run db:migrate` and then `npm run db:generate`.
5. Start the API: `npm run dev`. For a production-style local run, use `npm run build && npm start`.

Open `http://localhost:3000/api-docs` for the API contract. `GET /health` checks the API process only. Do not expose this service directly to the public internet; deploy behind trusted source authentication and access controls.

## API examples

Create an attendance record from a qualified passage event:

```sh
curl -X POST http://localhost:3000/api/attendance/events \
  -H 'Content-Type: application/json' \
  -d '{"eventId":"edge-001","employeeId":"E017","factory":"BINH_DUONG","gateId":"G02","direction":"ENTRY","occurredAt":"2026-11-09T07:00:00+07:00"}'
```

Responses: `201 created`, `200 duplicate`, `400 invalid input`, `409 conflicting Event ID`, or `503 persistence unavailable`. Retry a 503 with the **same** Event ID. The service does not infer arrival from a QR scan or an Allow response.

```sh
curl 'http://localhost:3000/api/attendance/history?employeeId=E017&limit=50&offset=0'
```

History is sorted by occurrence time descending, then record ID descending. Optional `from` and `to` are inclusive timestamps with time-zone offsets. The maximum `limit` is 100. Offset pagination is sufficient for the assignment but can shift while new events arrive.

## Commands

| Command                 | Purpose                             |
| ----------------------- | ----------------------------------- |
| `npm run dev`           | Start watched server                |
| `npm run build`         | Compile TypeScript                  |
| `npm start`             | Start compiled server               |
| `npm run test`          | Run automated tests                 |
| `npm run test:coverage` | Generate V8 coverage                |
| `npm run lint`          | Run ESLint                          |
| `npm run format`        | Apply Prettier                      |
| `npm run typecheck`     | Check types without emit            |
| `npm run db:migrate`    | Apply Prisma development migrations |
| `npm run db:generate`   | Generate Prisma client              |

The test suite exercises HTTP behavior with a repository double and Prisma adapter behavior with mocks; it does not prove PostgreSQL migration or live database behavior. Run a real database integration test before production deployment.
