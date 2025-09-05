// Debug script to check garrison synchronization between game state and database
// Run this to identify why Game Editor changes aren't persisting

const io = require('socket.io-client');

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-admin-password';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

console.log('🔍 Debugging Garrison Synchronization...');
console.log(`📡 Connecting to: ${SERVER_URL}`);

const socket = io(SERVER_URL);

socket.on('connect', () => {
  console.log('✅ Connected to server');
  
  // First, authenticate as admin
  console.log('🔐 Authenticating as admin...');
  socket.emit('admin:login', { password: ADMIN_PASSWORD });
});

socket.on('admin:loginSuccess', () => {
  console.log('✅ Admin authentication successful');
  
  // Get current game state
  socket.emit('admin:getGameState');
});

socket.on('admin:gameState', (gameState) => {
  console.log(`📊 Current game state - Turn: ${gameState.turn}`);
  console.log(`👥 Total tribes: ${gameState.tribes.length}`);
  
  // Check each tribe's garrison data
  gameState.tribes.forEach(tribe => {
    console.log(`\n🏘️ Tribe: ${tribe.tribeName} (${tribe.playerName})`);
    console.log(`   ID: ${tribe.id}`);
    console.log(`   isAI: ${tribe.isAI || false}`);
    
    if (tribe.garrisons) {
      const garrisonCount = Object.keys(tribe.garrisons).length;
      console.log(`   🏰 Garrisons: ${garrisonCount}`);
      
      Object.entries(tribe.garrisons).forEach(([location, garrison]) => {
        console.log(`     📍 ${location}: ${garrison.troops} troops, ${garrison.weapons} weapons, ${garrison.chiefs?.length || 0} chiefs`);
        
        // Check for potential coordinate format issues
        if (!location.includes('.')) {
          console.log(`     ⚠️ WARNING: Location format may be invalid: ${location}`);
        }
        
        // Check for negative values
        if (garrison.troops < 0 || garrison.weapons < 0) {
          console.log(`     🚨 ERROR: Negative values detected!`);
        }
      });
    } else {
      console.log(`   ❌ NO GARRISON DATA`);
    }
    
    // Check global resources
    console.log(`   💰 Resources: ${tribe.globalResources?.food || 0} food, ${tribe.globalResources?.scrap || 0} scrap, ${tribe.globalResources?.morale || 0} morale`);
    
    // Check last turn results for starvation/desertion
    if (tribe.lastTurnResults && tribe.lastTurnResults.length > 0) {
      const starvationResults = tribe.lastTurnResults.filter(result => 
        result.result && (
          result.result.includes('STARVATION') || 
          result.result.includes('desertion') || 
          result.result.includes('troops lost')
        )
      );
      
      if (starvationResults.length > 0) {
        console.log(`   💀 Starvation/Desertion events:`);
        starvationResults.forEach(result => {
          console.log(`     - ${result.result}`);
        });
      }
    }
  });
  
  console.log('\n🔍 Analysis complete. Look for:');
  console.log('   - Tribes with negative troop counts');
  console.log('   - Invalid coordinate formats');
  console.log('   - Starvation events without troop reduction');
  console.log('   - Missing garrison data');
  
  console.log('\n💡 If you see issues:');
  console.log('   1. Check server logs for garrison update errors');
  console.log('   2. Use Game Editor to manually fix troop counts');
  console.log('   3. Consider running a database garrison sync');
  
  socket.disconnect();
  process.exit(0);
});

socket.on('admin:loginFailed', (error) => {
  console.error('❌ Admin authentication failed:', error);
  process.exit(1);
});

socket.on('connect_error', (error) => {
  console.error('❌ Connection failed:', error.message);
  process.exit(1);
});

socket.on('disconnect', () => {
  console.log('📡 Disconnected from server');
});

// Timeout after 30 seconds
setTimeout(() => {
  console.log('⏰ Debug timed out after 30 seconds');
  process.exit(1);
}, 30000);
