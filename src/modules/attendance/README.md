# Attendance Management

This module owns authoritative attendance records, effective state, corrections, monthly
finalization, and its audit outbox in central PostgreSQL. It accepts **already qualified
physical passage events** from authenticated, factory-scoped Gateways. An Allow decision or
accepted gate command alone does not prove passage. The Gate Service must supply a stable
Event ID and unique passage-evidence reference; controller-specific verification stays at
the Factory Edge.

- `domain/`: event, correction, and period concepts plus pure interpretation rules.
- `application/`: use cases and focused repository ports.
- `infrastructure/`: Prisma adapters and central transaction boundaries.
- `presentation/`: Zod validation, JWT authorization, and HTTP routes.

Raw events remain immutable. Approved corrections affect only the effective view. The local
SQLite outbox, QR authorization, turnstile API, reporting, and HR/Payroll transfer belong to
other M1 services. See `docs/decisions/attendance-rules.md` for the selected M2 business rules.
