#!/usr/bin/env node

/**
 * EMERGENCY TURN ADVANCE SCRIPT
 * 
 * This script manually advances the turn when the game is stuck in infinite processing.
 * Use this ONLY when turn processing is completely hung and timeout protection failed.
 * 
 * Usage:
 *   node scripts/emergency-turn-advance.js [--force]
 */

import { PrismaClient } from '@prisma/client';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isForce = args.includes('--force');

  console.log('🚨 EMERGENCY TURN ADVANCE SCRIPT');
  console.log('================================');
  console.log('⚠️ WARNING: This manually advances the turn when processing is stuck!');
  console.log('');

  try {
    // Step 1: Connect to database
    console.log('1. Connecting to database...');
    await prisma.$connect();
    console.log('✅ Database connected');

    // Step 2: Get current game state
    console.log('2. Getting current game state...');
    const gameState = await prisma.gameState.findFirst();
    if (!gameState) {
      console.log('❌ No GameState record found');
      process.exit(1);
    }
    
    console.log(`📊 Current turn: ${gameState.turn}`);
    console.log(`📊 Tribes count: ${gameState.tribes?.length || 0}`);

    // Step 3: Check if confirmation needed
    if (!isForce) {
      console.log('');
      console.log('⚠️ EMERGENCY TURN ADVANCE');
      console.log('This will:');
      console.log('- Advance turn from', gameState.turn, 'to', gameState.turn + 1);
      console.log('- Reset all tribe turn states');
      console.log('- Clear all pending actions');
      console.log('- Apply basic upkeep');
      console.log('');
      console.log('❌ This action cannot be undone!');
      console.log('');
      console.log('Use --force flag to proceed without confirmation');
      process.exit(0);
    }

    // Step 4: Create emergency turn advance
    console.log('3. Creating emergency turn advance...');
    
    const tribes = gameState.tribes as any[] || [];
    const updatedTribes = tribes.map(tribe => ({
      ...tribe,
      // Reset turn state
      actions: [],
      turnSubmitted: false,
      lastTurnResults: [{
        id: `emergency-advance-${Date.now()}`,
        actionType: 'Upkeep',
        actionData: {},
        result: '🚨 Emergency turn advance applied due to processing timeout. Game has been unstuck.'
      }],
      // Apply basic upkeep
      globalResources: {
        ...tribe.globalResources,
        food: Math.max(0, (tribe.globalResources?.food || 0) - Math.max(1, Math.floor((tribe.globalResources?.troops || 0) / 10)))
      }
    }));

    // Step 5: Update database
    console.log('4. Updating database...');
    await prisma.gameState.update({
      where: { id: gameState.id },
      data: {
        turn: gameState.turn + 1,
        tribes: updatedTribes
      }
    });

    console.log('✅ Emergency turn advance completed!');
    console.log(`📊 Turn advanced: ${gameState.turn} → ${gameState.turn + 1}`);
    console.log(`📊 ${updatedTribes.length} tribes reset for next turn`);
    console.log('');
    console.log('🎯 Game should now be unstuck. Players can refresh and continue playing.');

  } catch (error) {
    console.error('❌ Emergency turn advance failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
