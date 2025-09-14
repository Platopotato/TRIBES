const fs = require('fs');
const path = require('path');

// Import the DatabaseService
const { DatabaseService } = require('./dist/services/DatabaseService.js');

async function restoreFromBackup() {
  console.log('🚨 EMERGENCY DATABASE RESTORATION');
  console.log('='.repeat(80));
  
  try {
    // Find the most recent backup
    const backupDir = path.join(__dirname, 'backups');
    const backupFiles = fs.readdirSync(backupDir)
      .filter(file => file.startsWith('auto-backup-') && file.endsWith('.json'))
      .sort()
      .reverse(); // Most recent first

    if (backupFiles.length === 0) {
      console.log('❌ No backup files found');
      return;
    }

    const latestBackup = backupFiles[0];
    const backupPath = path.join(backupDir, latestBackup);
    
    console.log(`📁 Restoring from: ${latestBackup}`);
    
    // Read backup data
    const backupContent = fs.readFileSync(backupPath, 'utf8');
    const backupData = JSON.parse(backupContent);
    
    console.log(`📊 Backup contains:`);
    console.log(`   - ${backupData.gameState.tribes.length} tribes`);
    console.log(`   - ${backupData.users.length} users`);
    console.log(`   - ${backupData.gameState.mapData?.length || 0} map hexes`);
    
    // Count garrisons in backup
    let totalGarrisons = 0;
    backupData.gameState.tribes.forEach(tribe => {
      if (tribe.garrisons) {
        totalGarrisons += Object.keys(tribe.garrisons).length;
      }
    });
    console.log(`   - ${totalGarrisons} garrisons`);
    
    // Initialize database service
    const dbService = new DatabaseService();
    await dbService.initialize();
    
    console.log('🔄 Restoring game state...');
    
    // Restore the game state (this should restore all garrisons)
    await dbService.updateGameState(backupData.gameState, true); // skipValidation = true
    
    console.log('🔄 Restoring users...');
    
    // Restore users
    if (backupData.users) {
      await dbService.loadBackupUsers(backupData.users);
    }
    
    console.log('✅ DATABASE RESTORATION COMPLETE');
    console.log(`   Restored ${backupData.gameState.tribes.length} tribes with ${totalGarrisons} garrisons`);
    console.log(`   Restored ${backupData.users.length} users`);
    
    await dbService.disconnect();
    
  } catch (error) {
    console.error('❌ RESTORATION FAILED:', error);
    process.exit(1);
  }
}

// Run the restoration
restoreFromBackup().then(() => {
  console.log('🎉 Restoration completed successfully');
  process.exit(0);
}).catch(error => {
  console.error('💥 Restoration script failed:', error);
  process.exit(1);
});
