# TMC-AACS Attendance Service

Software Architecture (CO3017), Assignment M2. This repository implements **Attendance Management**, one logical component in the six-service Pure Service-Based Architecture chosen by Group 11 in M1. TMC has factories in Binh Duong (~800 employees) and Long An (~600). Factory Edge and Central Infrastructure are deployment locations, not a different architecture style.

The business rules chosen to close M1's open questions are documented in [attendance decisions](docs/decisions/attendance-rules.md). They are explicit M2 assumptions pending real TMC stakeholder validation.

## Implemented capabilities

- Accept already qualified physical-passage events from signed, factory-scoped Gateway identities. Require stable Event ID and unique passage-evidence reference.
- Commit authoritative entry/exit records, period status, and audit outbox messages atomically in central PostgreSQL. Identical retries are idempotent; conflicting reuse returns `409`.
- Retrieve effective employee history and derive `IN`, `OUT`, or `UNKNOWN` state. Approved corrections adjust the effective view while raw records remain immutable. Consecutive equal directions are flagged for review.
- Accept ADD, REPLACE, and VOID correction requests from employees or authorized security guards. HR reviews within factory scope; requesters cannot review their own requests. A month cannot be finalized while relevant corrections are pending.
- Finalize completed factory months and export revisioned data to Integration Service. Late events or newly approved corrections reopen finalized periods for reconciliation.
- Expose a durable audit outbox polling and acknowledgment contract for Reporting and Audit Service.

## Boundaries and limitations

Gate Service must qualify physical passage; an Allow decision or accepted turnstile command does not prove passage. The actual turnstile evidence format is unknown, so Attendance Service validates and stores a unique evidence reference but cannot verify hardware evidence itself. Gate Service also owns the factory-local SQLite outbox, delivery retry/backoff, and access behavior during WAN outages. Identity and Access Service owns QR and token issuance. Reporting and Audit Service owns searchable logs and reports. Integration Service owns the HR/Payroll API and external reconciliation. Those services are **not** implemented here.

Production deployment additionally needs trusted token issuance and rotation, TLS, a privacy and retention policy, PostgreSQL high availability and backups, operational monitoring, and a performance test against the M1 peak workload. This repository's Docker Compose uses a single local PostgreSQL instance. The multi-stage API image retains runtime dependencies only; Prisma CLI and test tools stay in the build stage. Effective-history calculation currently loads one employee's records, and monthly export loads one factory's records before slicing; this is suitable for the assignment but needs database-side pagination or a read model for long-running production datasets.

## Stack and structure

Node.js 22/24 LTS, TypeScript strict mode, Express 5, PostgreSQL 16, Prisma 6, Zod 4, jose 5, Vitest 5, Supertest 7, OpenAPI/Swagger UI, ESLint, Prettier, npm, and Docker Compose.

- `src/modules/attendance/domain/`: event, correction, and period rules.
- `src/modules/attendance/application/`: use cases and focused repository contracts.
- `src/modules/attendance/infrastructure/`: Prisma adapters for PostgreSQL.
- `src/modules/attendance/presentation/`: validation, authorization, and HTTP routes.
- `src/config/`: environment and JWT verification.
- `prisma/migrations/`: authoritative schema changes and unique constraints.
- `tests/integration/`: HTTP tests plus an optional isolated PostgreSQL integration test.
- `docs/architecture/`, `docs/decisions/`: M1 boundary and M2 decisions.

This separation gives HTTP handling, business decisions, and persistence distinct responsibilities (SRP). Application services depend on small repository contracts (ISP/DIP). Prisma adapters honor those contracts (LSP), and new validation or persistence policies can be added without changing unrelated components (OCP). Construction uses simple composition in `src/server.ts`.

## Local setup

1. Install Node.js 22 or 24, npm, and Docker Desktop/Compose.
2. Run `npm ci` and copy `.env.example` to `.env`. Replace `JWT_SECRET` with a random secret of at least 32 characters. Local startup loads `.env` when present.
3. Run `docker compose up -d postgres` and `npm run db:migrate`.
4. Run `npm run dev`. Swagger UI is at `http://localhost:3000/api-docs`; `GET /health` checks the API process, not database readiness.

For local demonstration, `npm run dev:token -- GATEWAY gateway-bd BINH_DUONG` creates a 15-minute test token. Other examples: `npm run dev:token -- EMPLOYEE E017`, `npm run dev:token -- HR hr-1 BINH_DUONG`, and `npm run dev:token -- SUPERVISOR boss-1 BINH_DUONG E017,E018`. The development token command refuses to run with `NODE_ENV=production`. In deployment, Identity and Access Service must issue HS256 tokens with issuer `tmc-identity-service`, audience `tmc-attendance-service`, subject, role, factory/employee scopes, issue time, and expiration. Keep the signing secret outside source control.

## API

All attendance and internal routes require `Authorization: Bearer <token>`; Swagger UI documents parameters and responses.

| Route                                                   | Role                                           | Purpose                                                |
| ------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------------------ |
| `POST /api/attendance/events`                           | GATEWAY, matching factory                      | Accept qualified event                                 |
| `GET /api/attendance/history?employeeId=...`            | employee self, assigned supervisor, factory HR | Effective history with `from`, `to`, `limit`, `offset` |
| `GET /api/attendance/state?employeeId=...`              | same read roles                                | Current state and review flag                          |
| `POST /api/attendance/corrections`                      | employee self, factory security                | Request ADD, REPLACE, or VOID                          |
| `GET /api/attendance/corrections?employeeId=...`        | employee self, assigned supervisor, factory HR | Correction status                                      |
| `POST /api/attendance/corrections/:id/review`           | factory HR                                     | Approve or reject                                      |
| `POST /api/attendance/periods/:month/finalize`          | factory HR                                     | Finalize completed `YYYY-MM`                           |
| `GET /api/attendance/periods/:month/export?factory=...` | factory INTEGRATION                            | Export finalized revision                              |
| `GET /internal/audit-outbox/events`                     | REPORTING                                      | Poll pending audit events                              |
| `POST /internal/audit-outbox/events/:id/ack`            | REPORTING                                      | Acknowledge after durable consumption                  |

Example event body:

```json
{
  "eventId": "edge-event-001",
  "passageEvidenceId": "controller-passage-001",
  "employeeId": "E017",
  "factory": "BINH_DUONG",
  "gateId": "G02",
  "direction": "ENTRY",
  "occurredAt": "2026-11-09T07:00:00+07:00"
}
```

A `201` means the central database transaction committed. `200` means an identical event was already accepted. Retry `503` with the same Event ID and evidence reference. The audit poll contract is at-least-once: Reporting and Audit Service must deduplicate by outbox message ID and acknowledge only after durable storage.

## Commands and verification

| Command                                                    | Purpose                                   |
| ---------------------------------------------------------- | ----------------------------------------- |
| `npm run dev` / `npm run build && npm start`               | Development / compiled server             |
| `npm run test` / `npm run test:coverage`                   | Tests / V8 coverage                       |
| `npm run lint` / `npm run format` / `npm run typecheck`    | Code quality                              |
| `npm run db:migrate` / `npm run db:generate`               | Apply migrations / generate Prisma client |
| `npm run dev:token -- ROLE SUBJECT FACTORIES EMPLOYEE_IDS` | Local demonstration token                 |

HTTP and unit tests run with `npm run test`. Live database tests run only when `TEST_DATABASE_URL` points to a database named `tmc_attendance_test`. For local verification, create that separate database, apply migrations to it with `DATABASE_URL=<test-url> npx prisma migrate deploy`, then run `TEST_DATABASE_URL=<test-url> npm run test`. Do not point test credentials at a development or production database.
