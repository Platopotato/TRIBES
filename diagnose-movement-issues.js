// Diagnostic script to identify movement and alliance issues
// Run with: node diagnose-movement-issues.js

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function diagnose() {
  console.log('🔍 DIAGNOSING MOVEMENT AND ALLIANCE ISSUES\n');

  const dbGameState = await prisma.gameState.findFirst({
    include: {
      tribes: {
        include: {
          garrisons: true,
        },
      },
      hexes: true,
    },
  });

  if (!dbGameState) {
    console.log('❌ No game state found');
    return;
  }

  // Find the player's tribe (assuming it's "The Scorched Earth")
  const playerTribe = dbGameState.tribes.find(t => t.tribeName === 'The Scorched Earth');
  if (!playerTribe) {
    console.log('❌ Could not find The Scorched Earth tribe');
    return;
  }

  console.log(`📍 PLAYER TRIBE: ${playerTribe.tribeName} (ID: ${playerTribe.id})`);
  console.log(`   Home location: ${playerTribe.location}`);
  console.log(`   Garrison count: ${playerTribe.garrisons.length}`);

  // Check if player has garrison at home location
  const homeGarrison = playerTribe.garrisons.find(g => {
    const hexKey = `${String(g.hexQ + 50).padStart(3, '0')}.${String(g.hexR + 50).padStart(3, '0')}`;
    return hexKey === playerTribe.location;
  });

  if (homeGarrison) {
    console.log(`   ✅ Has garrison at home: ${homeGarrison.troops} troops, ${homeGarrison.weapons} weapons`);
  } else {
    console.log(`   ❌ NO GARRISON AT HOME LOCATION!`);
    console.log(`   Garrison locations:`);
    playerTribe.garrisons.forEach(g => {
      const hexKey = `${String(g.hexQ + 50).padStart(3, '0')}.${String(g.hexR + 50).padStart(3, '0')}`;
      console.log(`      - ${hexKey}: ${g.troops} troops, ${g.weapons} weapons`);
    });
  }

  // Find Amazons tribe
  const amazonsTribe = dbGameState.tribes.find(t => t.tribeName.includes('Amazon'));
  if (!amazonsTribe) {
    console.log('\n❌ Could not find Amazons tribe');
  } else {
    console.log(`\n🤝 AMAZONS TRIBE: ${amazonsTribe.tribeName} (ID: ${amazonsTribe.id})`);
    
    // Check diplomacy status
    const playerDiplomacy = JSON.parse(playerTribe.diplomacy || '{}');
    const amazonsDiplomacy = JSON.parse(amazonsTribe.diplomacy || '{}');
    
    console.log(`   Player → Amazons: ${playerDiplomacy[amazonsTribe.id]?.status || 'NONE'}`);
    console.log(`   Amazons → Player: ${amazonsDiplomacy[playerTribe.id]?.status || 'NONE'}`);
    
    const isAllied = playerDiplomacy[amazonsTribe.id]?.status === 'Alliance' || 
                     amazonsDiplomacy[playerTribe.id]?.status === 'Alliance';
    console.log(`   Are they allied? ${isAllied ? '✅ YES' : '❌ NO'}`);
  }

  // Check for outposts near player's home (057.044)
  console.log('\n🏰 OUTPOSTS NEAR 057.044:');
  const playerQ = 57 - 50;
  const playerR = 44 - 50;
  
  // Check hexes in a 3-hex radius
  for (let dq = -3; dq <= 3; dq++) {
    for (let dr = -3; dr <= 3; dr++) {
      const q = playerQ + dq;
      const r = playerR + dr;
      const hex = dbGameState.hexes.find(h => h.q === q && h.r === r);
      
      if (hex && (hex.poiType === 'Outpost' || hex.poiFortified)) {
        const hexKey = `${String(q + 50).padStart(3, '0')}.${String(r + 50).padStart(3, '0')}`;
        console.log(`\n   📍 ${hexKey}:`);
        console.log(`      POI Type: ${hex.poiType}`);
        console.log(`      Fortified: ${hex.poiFortified || false}`);
        console.log(`      POI ID: ${hex.poiId}`);
        console.log(`      Outpost Owner: ${hex.poiOutpostOwner || 'NONE'}`);
        
        if (hex.poiOutpostOwner) {
          const ownerTribe = dbGameState.tribes.find(t => t.id === hex.poiOutpostOwner);
          if (ownerTribe) {
            console.log(`      Owner Tribe: ${ownerTribe.tribeName}`);
            
            // Check if player is allied with owner
            const ownerDiplomacy = JSON.parse(ownerTribe.diplomacy || '{}');
            const isAlliedWithOwner = playerDiplomacy[ownerTribe.id]?.status === 'Alliance' || 
                                     ownerDiplomacy[playerTribe.id]?.status === 'Alliance';
            console.log(`      Player allied with owner? ${isAlliedWithOwner ? '✅ YES' : '❌ NO'}`);
          } else {
            console.log(`      ⚠️ Owner tribe not found! (ID: ${hex.poiOutpostOwner})`);
          }
        }
      }
    }
  }

  // Check for garrisons at player's hexes
  console.log('\n🏕️ GARRISONS AT PLAYER HEXES:');
  playerTribe.garrisons.forEach(g => {
    const hexKey = `${String(g.hexQ + 50).padStart(3, '0')}.${String(g.hexR + 50).padStart(3, '0')}`;
    console.log(`\n   📍 ${hexKey}:`);
    console.log(`      Player garrison: ${g.troops} troops, ${g.weapons} weapons`);
    
    // Check if other tribes have garrisons here
    dbGameState.tribes.forEach(t => {
      if (t.id === playerTribe.id) return;
      const otherGarrison = t.garrisons.find(og => og.hexQ === g.hexQ && og.hexR === g.hexR);
      if (otherGarrison) {
        console.log(`      ${t.tribeName} garrison: ${otherGarrison.troops} troops, ${otherGarrison.weapons} weapons`);
        
        // Check diplomacy
        const otherDiplomacy = JSON.parse(t.diplomacy || '{}');
        const isAlliedWithOther = playerDiplomacy[t.id]?.status === 'Alliance' || 
                                 otherDiplomacy[playerTribe.id]?.status === 'Alliance';
        console.log(`         Allied? ${isAlliedWithOther ? '✅ YES' : '❌ NO'}`);
      }
    });
  });

  await prisma.$disconnect();
}

diagnose().catch(console.error);

