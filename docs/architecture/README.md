# Architecture boundary

The broader TMC-AACS design uses Pure Service-Based Architecture: eight logical components
organized into six coarse-grained services. Factory Edge and Central Infrastructure are
physical deployment locations, not a second architectural style. This repository implements
only the Attendance Management module. It does not include QR issuance, authorization,
turnstile integration, or the Factory Edge SQLite transactional outbox. An upstream Allow
decision is not evidence of physical passage; already qualified events are the input here.

## Attendance component view

```text
Qualified event source -> HTTP/Zod adapter -> AttendanceService -> AttendanceRepository
                                                        |                  |
                                                  idempotency check    Prisma adapter
                                                                           |
                                                                    Central PostgreSQL
```

The database has a unique index on `event_id`. The adapter attempts an insert and, on a
unique violation, retrieves the existing record. The service compares all event fields before
returning an idempotent duplicate response. This avoids a read-before-write race. Persistent
errors propagate to an HTTP 503 response; the source must retain the stable Event ID and retry.

This implementation does not secure the HTTP boundary itself. A trusted gateway or service
identity mechanism is required before exposure to untrusted networks. System-wide RBAC,
comprehensive audit logging, privacy controls, reporting, and payroll synchronization remain
future architecture work.
