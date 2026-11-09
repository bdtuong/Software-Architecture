# Architecture boundary

Group 11's M1 design uses Pure Service-Based Architecture: eight logical components in six
coarse-grained services. Factory Edge and Central Infrastructure are deployment locations,
not a second architecture style. This repository implements only Attendance Management,
the central component of Attendance Service.

```text
Factory Edge Gate Service
  qualified passage + stable Event ID + evidence reference
                |
                v
JWT scope -> HTTP/Zod -> Attendance use cases -> repository ports -> Prisma -> PostgreSQL
                                |                                |
                                +-- corrections and periods      +-- audit outbox
                                                                       |
                                                       Reporting and Audit Service

Integration Service <- finalized revisioned attendance export
```

The Gate Service owns QR scan coordination, turnstile integration, passage qualification,
and factory-local SQLite outbox delivery. Identity and Access Service owns QR credentials,
access decisions, and trusted identity issuance. Attendance Service owns central records,
effective state, corrections, and period finalization. Reporting and Audit Service consumes
audit messages and owns searchable logs. Integration Service owns HR/Payroll transmission
and reconciliation. No other service is implemented here.

A central event insert, period invalidation, and audit outbox write use one PostgreSQL
transaction. The unique Event ID prevents duplicate effects under concurrent retry. An
identical retry returns the original record, while conflicting content returns 409. A
separate partial unique index prevents two approved corrections from replacing or voiding
the same raw record. The audit outbox poll/ack API supports at-least-once transfer; the
consumer must deduplicate by message ID.

For the local assignment runtime, one PostgreSQL container is used. The M1 production
allocation calls for protected central commits with a synchronous standby, backups, and
health-aware routing. Those deployment properties are not provided by Docker Compose.
