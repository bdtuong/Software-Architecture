# TMC-AACS Attendance Management backend

Backend starter for Software Architecture (CO3017), Assignment M2. The broader TMC QR Code-Based Attendance and Access Control System serves factories in Binh Duong (~800 employees) and Long An (~600). This repository implements **only the selected Attendance Management module** of its Pure Service-Based Architecture. Factory Edge and Central Infrastructure describe deployment, not an additional architectural style.

## Implemented scope

The starter includes a strict TypeScript Express server, environment validation, `GET /health`, Swagger UI, PostgreSQL Compose configuration, a minimal Prisma datasource, and a health integration test. No attendance records, domain rules, database tables, or attendance API routes exist yet.

Planned for later work: accept already qualified attendance events, validate them, persist check-in/check-out transactions, deduplicate by stable event ID, retrieve history, and handle database failures and retries. QR generation, access authorization, turnstile hardware, and the Factory Edge SQLite outbox belong elsewhere. An Allow decision alone does not prove physical passage. Central PostgreSQL will own authoritative attendance records.

## Stack

Node.js 22 LTS, TypeScript, Express, PostgreSQL 16, Prisma, Zod, Vitest, Supertest, OpenAPI/Swagger UI, ESLint, Prettier, npm, and Docker Compose.

## Structure

- `src/app.ts`: HTTP composition and health route.
- `src/server.ts`: process entry point.
- `src/config/env.ts`: validated runtime configuration.
- `src/openapi.ts`: current OpenAPI document.
- `src/modules/attendance/`: selected module boundary and future implementation home.
- `prisma/schema.prisma`: central PostgreSQL datasource, with no premature domain models.
- `tests/integration/`: HTTP contract test.
- `docs/architecture/`: broader system boundary.

## Setup

1. Install Node.js 22 or another supported LTS in the declared engine range, npm, and Docker Compose.
2. Run `npm ci`.
3. Copy `.env.example` to `.env`; adjust `DATABASE_URL` and `PORT` as needed. `NODE_ENV` accepts `development`, `test`, or `production`. `DATABASE_URL` must be a PostgreSQL URL.
4. Run `docker compose up -d postgres` for local PostgreSQL.
5. Run `npm run db:generate` and `npm run dev`.

Open `http://localhost:3000/health` for health and `http://localhost:3000/api-docs` for Swagger UI. The health endpoint checks the API process only; it does not test database connectivity.

## Commands

| Command                 | Purpose                                                 |
| ----------------------- | ------------------------------------------------------- |
| `npm run dev`           | Start watched development server                        |
| `npm run build`         | Compile to `dist/`                                      |
| `npm start`             | Run compiled server                                     |
| `npm run test`          | Run tests once                                          |
| `npm run test:coverage` | Run tests with V8 coverage                              |
| `npm run lint`          | Run ESLint                                              |
| `npm run format`        | Format repository files                                 |
| `npm run typecheck`     | Check TypeScript without emit                           |
| `npm run db:generate`   | Generate Prisma client                                  |
| `npm run db:migrate`    | Apply development migrations when models are introduced |

There are no Prisma migrations yet because the domain model has not been designed. `db:migrate` becomes useful with the first attendance schema change. Run `npm run test`, `npm run typecheck`, `npm run lint`, and `npm run build` before committing.

## Design approach

The HTTP adapter, configuration, application use cases, and persistence adapters will each have focused responsibilities (SRP). Future validation and processing policies can be extended behind small, meaningful contracts (OCP/ISP). Repository implementations must honor those contracts (LSP). Use cases will receive repositories through simple constructors or composition rather than import Prisma directly (DIP). These abstractions will be introduced with their first real use case; empty interfaces and fake implementations are intentionally absent.
