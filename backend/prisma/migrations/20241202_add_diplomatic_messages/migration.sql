-- CreateTable: Add diplomaticMessages column to GameState
-- This is a safe, non-breaking migration that adds a nullable JSON column

-- Add the new diplomaticMessages column as nullable JSON
ALTER TABLE "game_states" ADD COLUMN "diplomaticMessages" JSON;

-- No data migration needed since column is nullable
-- Existing records will have NULL for this field, which is handled gracefully by the application
