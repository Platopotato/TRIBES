-- AlterTable - Add maxActionsOverride column if it doesn't exist
DO $$ 
BEGIN 
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'tribes' 
        AND column_name = 'maxActionsOverride'
    ) THEN
        ALTER TABLE "tribes" ADD COLUMN "maxActionsOverride" INTEGER;
    END IF;
END $$;
