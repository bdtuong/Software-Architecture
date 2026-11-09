-- CreateEnum
CREATE TYPE "CorrectionKind" AS ENUM ('ADD', 'REPLACE', 'VOID');

-- CreateEnum
CREATE TYPE "CorrectionStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "attendance_corrections" (
    "id" UUID NOT NULL,
    "kind" "CorrectionKind" NOT NULL,
    "status" "CorrectionStatus" NOT NULL DEFAULT 'PENDING',
    "employee_id" VARCHAR(128) NOT NULL,
    "factory" "Factory" NOT NULL,
    "target_record_id" UUID,
    "direction" "AttendanceDirection",
    "occurred_at" TIMESTAMPTZ(3),
    "reason" VARCHAR(1000) NOT NULL,
    "requested_by" VARCHAR(128) NOT NULL,
    "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" VARCHAR(128),
    "reviewed_at" TIMESTAMPTZ(3),
    "review_reason" VARCHAR(1000),

    CONSTRAINT "attendance_corrections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_outbox" (
    "id" UUID NOT NULL,
    "event_type" VARCHAR(100) NOT NULL,
    "aggregate_id" VARCHAR(128) NOT NULL,
    "actor_id" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "delivered_at" TIMESTAMPTZ(3),

    CONSTRAINT "audit_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "attendance_corrections_employee_id_status_idx" ON "attendance_corrections"("employee_id", "status");

-- CreateIndex
CREATE INDEX "attendance_corrections_target_record_id_status_idx" ON "attendance_corrections"("target_record_id", "status");

-- CreateIndex
CREATE INDEX "audit_outbox_delivered_at_created_at_idx" ON "audit_outbox"("delivered_at", "created_at");

-- AddForeignKey
ALTER TABLE "attendance_corrections" ADD CONSTRAINT "attendance_corrections_target_record_id_fkey" FOREIGN KEY ("target_record_id") REFERENCES "attendance_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- At most one approved adjustment can replace or void a raw event.
CREATE UNIQUE INDEX "one_approved_correction_per_target"
ON "attendance_corrections"("target_record_id")
WHERE "status" = 'APPROVED' AND "target_record_id" IS NOT NULL;
