-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "AttendanceDirection" AS ENUM ('ENTRY', 'EXIT');

-- CreateEnum
CREATE TYPE "Factory" AS ENUM ('BINH_DUONG', 'LONG_AN');

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" UUID NOT NULL,
    "event_id" VARCHAR(128) NOT NULL,
    "employee_id" VARCHAR(128) NOT NULL,
    "factory" "Factory" NOT NULL,
    "gate_id" VARCHAR(128) NOT NULL,
    "direction" "AttendanceDirection" NOT NULL,
    "occurred_at" TIMESTAMPTZ(3) NOT NULL,
    "recorded_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_event_id_key" ON "attendance_records"("event_id");

-- CreateIndex
CREATE INDEX "attendance_records_employee_id_occurred_at_idx" ON "attendance_records"("employee_id", "occurred_at" DESC);

