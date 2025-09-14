-- Migration: Add originalStartingLocation field to tribes table
-- This field tracks the original starting location for home permanence in the virgin hex system

ALTER TABLE "tribes" ADD COLUMN "originalStartingLocation" TEXT;

-- Add comment to document the field
COMMENT ON COLUMN "tribes"."originalStartingLocation" IS 'HOME PERMANENCE: Track original starting location for virgin hex system';
