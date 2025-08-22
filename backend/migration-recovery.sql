-- Migration Recovery Script for Production Database
-- This script resolves the failed migration state and applies the maxActionsOverride column

-- Step 1: Mark the failed migration as resolved
DELETE FROM "_prisma_migrations" WHERE migration_name = '20250822_add_max_actions_override';

-- Step 2: Add the missing column if it doesn't exist
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

-- Step 3: Mark the migration as successfully applied
INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
VALUES (
    gen_random_uuid(),
    'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
    NOW(),
    '20250822_add_max_actions_override',
    '',
    NULL,
    NOW(),
    1
);
