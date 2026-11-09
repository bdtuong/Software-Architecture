# Architecture boundary

The broader TMC-AACS design uses Pure Service-Based Architecture: eight logical components
organized into six coarse-grained services. Factory Edge and Central Infrastructure are
physical deployment locations, not a second architectural style. This repository starts only
the Attendance Management module. It does not include QR issuance, authorization, turnstile
integration, or the Factory Edge SQLite transactional outbox. An upstream Allow decision is
not evidence of physical passage; qualified events will be the eventual input to attendance.
