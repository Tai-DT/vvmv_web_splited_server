-- Add status workflow fields to vendor_cost table.
-- REJECTED rows are never deleted to preserve history.
-- Only PENDING rows are deleted when vendor re-submits.

-- Step 1: Create enum type
CREATE TYPE "VendorCostStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- Step 2: Add new columns
ALTER TABLE "vendor_cost"
  ADD COLUMN "status"             "VendorCostStatus" NOT NULL DEFAULT 'PENDING',
  ADD COLUMN "rejection_reason"   TEXT,
  ADD COLUMN "reviewed_by_id"     TEXT REFERENCES "user"("id") ON DELETE SET NULL,
  ADD COLUMN "reviewed_at"        TIMESTAMPTZ;

-- Step 3: Add indexes
CREATE INDEX ON "vendor_cost" ("status");
CREATE INDEX ON "vendor_cost" ("reviewed_by_id");
CREATE INDEX ON "vendor_cost" ("fcr_id", "status");
