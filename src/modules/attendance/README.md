# Attendance Management boundary

This module will own authoritative attendance records in central PostgreSQL. Its future
application use cases will accept already qualified events, validate their shape, enforce
idempotency by stable event ID, and expose attendance history. HTTP presentation and Prisma
persistence will be separate adapters around those use cases. No attendance business logic,
contracts, routes, or tables are introduced in this initialization.
