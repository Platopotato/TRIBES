// Debug script to inspect starting locations and tribe locations
// Run this to identify the exact starting location selection bug

import { io } from 'socket.io-client';

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'your-admin-password';
const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';

console.log('🔍 Debugging Starting Location Selection...');
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
  
  // Analyze starting locations
  console.log(`\n🗺️ STARTING LOCATIONS ANALYSIS:`);
  console.log(`   Total starting locations: ${gameState.startingLocations?.length || 0}`);
  console.log(`   Starting locations:`, gameState.startingLocations);
  console.log(`   Type:`, typeof gameState.startingLocations);
  console.log(`   Is Array:`, Array.isArray(gameState.startingLocations));
  
  // Analyze current tribes and their locations
  console.log(`\n🏘️ CURRENT TRIBES AND LOCATIONS:`);
  console.log(`   Total tribes: ${gameState.tribes.length}`);
  
  const occupiedLocations = new Set();
  gameState.tribes.forEach((tribe, index) => {
    console.log(`   ${index + 1}. ${tribe.tribeName} (${tribe.playerName}) at ${tribe.location}`);
    occupiedLocations.add(tribe.location);
  });
  
  console.log(`\n🚫 OCCUPIED LOCATIONS SET:`);
  console.log(`   Occupied:`, Array.from(occupiedLocations));
  
  // Check each starting location
  console.log(`\n🔍 STARTING LOCATION AVAILABILITY CHECK:`);
  if (gameState.startingLocations && Array.isArray(gameState.startingLocations)) {
    gameState.startingLocations.forEach((location, index) => {
      const isOccupied = occupiedLocations.has(location);
      const status = isOccupied ? '❌ OCCUPIED' : '✅ AVAILABLE';
      console.log(`   ${index + 1}. ${location} - ${status}`);
      
      if (isOccupied) {
        const occupyingTribe = gameState.tribes.find(t => t.location === location);
        console.log(`      Occupied by: ${occupyingTribe?.tribeName || 'Unknown'}`);
      }
    });
    
    // Find first available
    const firstAvailable = gameState.startingLocations.find(loc => !occupiedLocations.has(loc));
    console.log(`\n✅ FIRST AVAILABLE LOCATION: ${firstAvailable || 'NONE AVAILABLE'}`);
    
    if (!firstAvailable) {
      console.log(`🚨 CRITICAL: All starting locations are occupied!`);
      console.log(`   This explains why new tribes spawn on occupied locations`);
    }
  } else {
    console.log(`🚨 CRITICAL: Starting locations is not a valid array!`);
  }
  
  // Check for coordinate format issues
  console.log(`\n🔍 COORDINATE FORMAT ANALYSIS:`);
  const allLocations = [
    ...gameState.startingLocations || [],
    ...gameState.tribes.map(t => t.location)
  ];
  
  const formatCounts = {};
  allLocations.forEach(loc => {
    if (typeof loc === 'string') {
      if (loc.match(/^\d{3}\.\d{3}$/)) {
        formatCounts['NNN.NNN'] = (formatCounts['NNN.NNN'] || 0) + 1;
      } else if (loc.match(/^\d+,\d+$/)) {
        formatCounts['N,N'] = (formatCounts['N,N'] || 0) + 1;
      } else {
        formatCounts['OTHER'] = (formatCounts['OTHER'] || 0) + 1;
      }
    } else {
      formatCounts['NON_STRING'] = (formatCounts['NON_STRING'] || 0) + 1;
    }
  });
  
  console.log(`   Coordinate formats found:`, formatCounts);
  
  console.log('\n🎯 DIAGNOSIS COMPLETE');
  console.log('   Check the analysis above to identify the starting location bug');
  
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
