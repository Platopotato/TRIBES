-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "securityQuestion" TEXT NOT NULL,
    "securityAnswerHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "game_states" (
    "id" TEXT NOT NULL,
    "turn" INTEGER NOT NULL DEFAULT 1,
    "mapSeed" BIGINT,
    "mapSettings" JSONB,
    "startingLocations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "game_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hexes" (
    "id" TEXT NOT NULL,
    "q" INTEGER NOT NULL,
    "r" INTEGER NOT NULL,
    "terrain" TEXT NOT NULL,
    "poiType" TEXT,
    "poiId" TEXT,
    "poiDifficulty" INTEGER,
    "poiRarity" TEXT,
    "gameStateId" TEXT NOT NULL,

    CONSTRAINT "hexes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tribes" (
    "id" TEXT NOT NULL,
    "playerId" TEXT,
    "isAI" BOOLEAN NOT NULL DEFAULT false,
    "aiType" TEXT,
    "playerName" TEXT NOT NULL,
    "tribeName" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "stats" JSONB NOT NULL,
    "location" TEXT NOT NULL,
    "globalResources" JSONB NOT NULL,
    "turnSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "actions" JSONB NOT NULL,
    "lastTurnResults" JSONB NOT NULL,
    "exploredHexes" JSONB NOT NULL,
    "rationLevel" TEXT NOT NULL,
    "completedTechs" JSONB NOT NULL,
    "assets" JSONB NOT NULL,
    "currentResearch" JSONB,
    "journeyResponses" JSONB NOT NULL,
    "gameStateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tribes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "garrisons" (
    "id" TEXT NOT NULL,
    "hexQ" INTEGER NOT NULL,
    "hexR" INTEGER NOT NULL,
    "troops" INTEGER NOT NULL,
    "weapons" INTEGER NOT NULL,
    "chiefs" JSONB NOT NULL,
    "tribeId" TEXT NOT NULL,
    "hexId" TEXT NOT NULL,

    CONSTRAINT "garrisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chief_requests" (
    "id" TEXT NOT NULL,
    "tribeId" TEXT NOT NULL,
    "chiefName" TEXT NOT NULL,
    "radixAddressSnippet" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gameStateId" TEXT NOT NULL,

    CONSTRAINT "chief_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asset_requests" (
    "id" TEXT NOT NULL,
    "tribeId" TEXT NOT NULL,
    "assetName" TEXT NOT NULL,
    "radixAddressSnippet" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "gameStateId" TEXT NOT NULL,

    CONSTRAINT "asset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journeys" (
    "id" TEXT NOT NULL,
    "ownerTribeId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "origin" TEXT NOT NULL,
    "destination" TEXT NOT NULL,
    "path" JSONB NOT NULL,
    "currentLocation" TEXT NOT NULL,
    "force" JSONB NOT NULL,
    "payload" JSONB NOT NULL,
    "arrivalTurn" INTEGER NOT NULL,
    "responseDeadline" INTEGER,
    "scavengeType" TEXT,
    "tradeOffer" JSONB,
    "status" TEXT NOT NULL,
    "gameStateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journeys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diplomatic_proposals" (
    "id" TEXT NOT NULL,
    "fromTribeId" TEXT NOT NULL,
    "toTribeId" TEXT NOT NULL,
    "statusChangeTo" TEXT NOT NULL,
    "expiresOnTurn" INTEGER NOT NULL,
    "fromTribeName" TEXT NOT NULL,
    "reparations" JSONB,
    "gameStateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diplomatic_proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diplomatic_relations" (
    "id" TEXT NOT NULL,
    "fromTribeId" TEXT NOT NULL,
    "toTribeId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "truceUntilTurn" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "diplomatic_relations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "turn_history" (
    "id" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "tribeRecords" JSONB NOT NULL,
    "gameStateId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "turn_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "hexes_gameStateId_q_r_key" ON "hexes"("gameStateId", "q", "r");

-- CreateIndex
CREATE UNIQUE INDEX "garrisons_tribeId_hexId_key" ON "garrisons"("tribeId", "hexId");

-- CreateIndex
CREATE UNIQUE INDEX "diplomatic_relations_fromTribeId_toTribeId_key" ON "diplomatic_relations"("fromTribeId", "toTribeId");

-- CreateIndex
CREATE UNIQUE INDEX "turn_history_gameStateId_turn_key" ON "turn_history"("gameStateId", "turn");

-- AddForeignKey
ALTER TABLE "hexes" ADD CONSTRAINT "hexes_gameStateId_fkey" FOREIGN KEY ("gameStateId") REFERENCES "game_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribes" ADD CONSTRAINT "tribes_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tribes" ADD CONSTRAINT "tribes_gameStateId_fkey" FOREIGN KEY ("gameStateId") REFERENCES "game_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garrisons" ADD CONSTRAINT "garrisons_tribeId_fkey" FOREIGN KEY ("tribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "garrisons" ADD CONSTRAINT "garrisons_hexId_fkey" FOREIGN KEY ("hexId") REFERENCES "hexes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chief_requests" ADD CONSTRAINT "chief_requests_tribeId_fkey" FOREIGN KEY ("tribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chief_requests" ADD CONSTRAINT "chief_requests_gameStateId_fkey" FOREIGN KEY ("gameStateId") REFERENCES "game_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_tribeId_fkey" FOREIGN KEY ("tribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asset_requests" ADD CONSTRAINT "asset_requests_gameStateId_fkey" FOREIGN KEY ("gameStateId") REFERENCES "game_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_ownerTribeId_fkey" FOREIGN KEY ("ownerTribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journeys" ADD CONSTRAINT "journeys_gameStateId_fkey" FOREIGN KEY ("gameStateId") REFERENCES "game_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomatic_proposals" ADD CONSTRAINT "diplomatic_proposals_fromTribeId_fkey" FOREIGN KEY ("fromTribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomatic_proposals" ADD CONSTRAINT "diplomatic_proposals_toTribeId_fkey" FOREIGN KEY ("toTribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomatic_proposals" ADD CONSTRAINT "diplomatic_proposals_gameStateId_fkey" FOREIGN KEY ("gameStateId") REFERENCES "game_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomatic_relations" ADD CONSTRAINT "diplomatic_relations_fromTribeId_fkey" FOREIGN KEY ("fromTribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diplomatic_relations" ADD CONSTRAINT "diplomatic_relations_toTribeId_fkey" FOREIGN KEY ("toTribeId") REFERENCES "tribes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turn_history" ADD CONSTRAINT "turn_history_gameStateId_fkey" FOREIGN KEY ("gameStateId") REFERENCES "game_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;
