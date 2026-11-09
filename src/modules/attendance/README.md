# Attendance Management

The attendance service accepts **already qualified physical passage events**. A gate-open
authorization alone is not proof of passage. Qualification and authentication of upstream
sources must be enforced by the surrounding system before events reach this module.

- `domain/`: event and record types plus payload equality for idempotency.
- `application/`: a focused repository port and use case service.
- `infrastructure/`: Prisma adapter for authoritative central PostgreSQL.
- `presentation/`: Zod-validated HTTP routes and JSON responses.

`eventId` is unique in PostgreSQL. Repeating the same ID and payload returns the original
record; reusing an ID with different content returns 409. Database errors return 503, allowing
upstream retry with the same stable ID. No local outbox, QR logic, turnstile integration,
payroll export, or automated retry queue is implemented here.
