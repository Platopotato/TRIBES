import { PrismaClient } from '@prisma/client';

async function checkStartingLocations() {
  const prisma = new PrismaClient();
  
  try {
    console.log('🔍 Checking starting locations...');
    
    // Get the current game state
    const gameState = await prisma.gameState.findFirst({
      orderBy: { createdAt: 'desc' }
    });
    
    if (!gameState) {
      console.log('❌ No game state found');
      return;
    }
    
    console.log(`📊 Game State ID: ${gameState.id}`);
    console.log(`🎯 Current Turn: ${gameState.turn}`);
    
    // Parse starting locations
    const startingLocations = Array.isArray(gameState.startingLocations) 
      ? gameState.startingLocations 
      : JSON.parse(gameState.startingLocations || '[]');
    
    console.log(`\n🗺️ Starting Locations (${startingLocations.length}):`);
    startingLocations.forEach((loc, i) => {
      console.log(`  ${i + 1}. ${loc}`);
    });
    
    // Get all tribes
    const tribes = await prisma.tribe.findMany({
      where: { gameStateId: gameState.id }
    });
    
    console.log(`\n🏛️ Current Tribes (${tribes.length}):`);
    const occupiedLocations = new Set();
    
    tribes.forEach((tribe, i) => {
      console.log(`  ${i + 1}. ${tribe.tribeName} at ${tribe.location} (${tribe.isAI ? 'AI' : 'Player'})`);
      occupiedLocations.add(tribe.location);
    });
    
    // Check availability
    const availableLocations = startingLocations.filter(loc => !occupiedLocations.has(loc));
    
    console.log(`\n✅ Available Starting Locations (${availableLocations.length}):`);
    if (availableLocations.length > 0) {
      availableLocations.forEach((loc, i) => {
        console.log(`  ${i + 1}. ${loc}`);
      });
    } else {
      console.log('  ❌ NO AVAILABLE LOCATIONS');
    }
    
    console.log(`\n📈 Summary:`);
    console.log(`  Total starting locations: ${startingLocations.length}`);
    console.log(`  Occupied locations: ${occupiedLocations.size}`);
    console.log(`  Available locations: ${availableLocations.length}`);
    
    if (availableLocations.length === 0) {
      console.log(`\n🚨 ISSUE: All starting locations are occupied!`);
      console.log(`   This explains the "No starting positions available" error.`);
      console.log(`   Solutions:`);
      console.log(`   1. Add more starting locations via admin panel`);
      console.log(`   2. Remove some AI tribes to free up locations`);
      console.log(`   3. Generate a new map with more starting locations`);
    } else {
      console.log(`\n✅ New tribes can be created!`);
    }
    
  } catch (error) {
    console.error('❌ Error checking starting locations:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkStartingLocations();
