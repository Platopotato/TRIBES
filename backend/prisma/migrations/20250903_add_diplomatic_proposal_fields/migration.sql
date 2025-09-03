-- Add actionType and tradeAgreement fields to diplomatic_proposals table
-- Make statusChangeTo optional for trade proposals

-- Add actionType column (required)
ALTER TABLE "diplomatic_proposals" ADD COLUMN "actionType" TEXT;

-- Add tradeAgreement column (optional JSON)
ALTER TABLE "diplomatic_proposals" ADD COLUMN "tradeAgreement" JSONB;

-- Make statusChangeTo optional
ALTER TABLE "diplomatic_proposals" ALTER COLUMN "statusChangeTo" DROP NOT NULL;

-- Update existing records to have actionType based on statusChangeTo
UPDATE "diplomatic_proposals" 
SET "actionType" = CASE 
    WHEN "statusChangeTo" = 'Alliance' THEN 'ProposeAlliance'
    WHEN "statusChangeTo" = 'Neutral' THEN 'SueForPeace'
    ELSE 'ProposeAlliance'
END
WHERE "actionType" IS NULL;

-- Make actionType required after updating existing records
ALTER TABLE "diplomatic_proposals" ALTER COLUMN "actionType" SET NOT NULL;
