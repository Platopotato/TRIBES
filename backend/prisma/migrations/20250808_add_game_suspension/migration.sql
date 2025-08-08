-- Add game suspension fields to game_states table
ALTER TABLE "game_states" ADD COLUMN "suspended" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "game_states" ADD COLUMN "suspensionMessage" TEXT;
