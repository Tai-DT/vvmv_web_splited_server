-- Add a dedicated column for the "Mã lý do đề nghị BP" field.
ALTER TABLE "follow_up_cds_info"
ADD COLUMN "release_before_permit_code" TEXT;
