-- CreateEnum
CREATE TYPE "PeriodStatus" AS ENUM ('OPEN', 'FINALIZED', 'REOPEN_REQUIRED');

-- CreateTable
CREATE TABLE "attendance_periods" (
    "id" UUID NOT NULL,
    "factory" "Factory" NOT NULL,
    "month" VARCHAR(7) NOT NULL,
    "status" "PeriodStatus" NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "finalized_at" TIMESTAMPTZ(3),
    "finalized_by" VARCHAR(128),

    CONSTRAINT "attendance_periods_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attendance_periods_factory_month_key" ON "attendance_periods"("factory", "month");

