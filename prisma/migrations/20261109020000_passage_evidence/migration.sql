-- Existing records predate this qualification contract and remain null.
ALTER TABLE "attendance_records" ADD COLUMN "passage_evidence_id" VARCHAR(128);
CREATE UNIQUE INDEX "attendance_records_passage_evidence_id_key" ON "attendance_records"("passage_evidence_id");
