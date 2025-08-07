import fs from 'fs';

// Load the backup file
const backupPath = './radix-tribes-enhanced-backup-2025-08-01-09-29-23.json';
const fixedBackupPath = './radix-tribes-enhanced-backup-2025-08-01-09-29-23-FIXED.json';

console.log('🔧 Fixing backup file:', backupPath);

try {
  const backupData = JSON.parse(fs.readFileSync(backupPath, 'utf-8'));
  
  console.log('📊 Original backup info:');
  console.log('- Tribes count:', backupData.gameState.tribes?.length || 0);
  console.log('- Users count:', backupData.users.length);
  
  // Get user IDs
  const userIds = new Set(backupData.users.map(u => u.id));
  
  // Filter out tribes with missing player IDs
  const originalTribes = backupData.gameState.tribes;
  const validTribes = originalTribes.filter(tribe => {
    if (tribe.playerId && !userIds.has(tribe.playerId)) {
      console.log(`🗑️ Removing tribe: ${tribe.tribeName} (${tribe.id}) - missing user ${tribe.playerId}`);
      return false;
    }
    return true;
  });
  
  // Create fixed backup
  const fixedBackup = {
    ...backupData,
    gameState: {
      ...backupData.gameState,
      tribes: validTribes
    }
  };
  
  console.log('📊 Fixed backup info:');
  console.log('- Tribes count:', fixedBackup.gameState.tribes.length);
  console.log('- Removed tribes:', originalTribes.length - validTribes.length);
  
  // Save fixed backup
  fs.writeFileSync(fixedBackupPath, JSON.stringify(fixedBackup, null, 2));
  console.log('✅ Fixed backup saved to:', fixedBackupPath);
  
} catch (error) {
  console.error('❌ Error fixing backup file:', error);
}
