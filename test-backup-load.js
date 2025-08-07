import fs from 'fs';
import path from 'path';

// Load the backup file
const backupPath = './radix-tribes-enhanced-backup-2025-08-01-09-29-23.json';
console.log('🔍 Loading backup file:', backupPath);

try {
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  
  console.log('📊 Backup file structure:');
  console.log('- Has gameState:', !!backupData.gameState);
  console.log('- Has users:', !!backupData.users);
  console.log('- Has userPasswords:', !!backupData.userPasswords);
  
  if (backupData.gameState) {
    console.log('🎮 Game state info:');
    console.log('- Turn:', backupData.gameState.turn);
    console.log('- Tribes count:', backupData.gameState.tribes?.length || 0);
    console.log('- Map data count:', backupData.gameState.mapData?.length || 0);
  }
  
  if (backupData.users) {
    console.log('👥 Users info:');
    console.log('- Users count:', backupData.users.length);
    console.log('- User IDs:', backupData.users.map(u => u.id).slice(0, 5));
  }
  
  if (backupData.gameState?.tribes) {
    console.log('🏛️ Tribes info:');
    const tribes = backupData.gameState.tribes;
    console.log('- First 3 tribe player IDs:', tribes.slice(0, 3).map(t => t.playerId));
    
    // Check if all tribe playerIds exist in users
    const userIds = new Set(backupData.users.map(u => u.id));
    const missingPlayerIds = tribes.filter(t => t.playerId && !userIds.has(t.playerId));
    
    if (missingPlayerIds.length > 0) {
      console.log(`⚠️ Found ${missingPlayerIds.length} tribes with missing player IDs:`);
      missingPlayerIds.forEach(tribe => {
        console.log(`  - Tribe ${tribe.tribeName} (${tribe.id}) has playerId ${tribe.playerId} which is not in users`);
      });

      console.log('\n🔧 Missing user IDs:');
      const missingUserIds = [...new Set(missingPlayerIds.map(t => t.playerId))];
      missingUserIds.forEach(userId => {
        console.log(`  - ${userId}`);
      });
    } else {
      console.log('✅ All tribe player IDs exist in users');
    }
  }
  
} catch (error) {
  console.error('❌ Error loading backup file:', error);
}
