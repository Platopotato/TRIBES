import * as fs from 'fs';
import * as path from 'path';
import { FullBackupState } from '../../../shared/dist/index.js';
import { DatabaseService } from './DatabaseService.js';

export class AutoBackupService {
  private backupInterval: NodeJS.Timeout | null = null;
  private backupDirectory: string;
  private intervalMinutes: number;
  private maxBackups: number;

  constructor(
    private databaseService: DatabaseService,
    intervalMinutes: number = 30,
    maxBackups: number = 48 // Keep 24 hours worth of backups
  ) {
    this.intervalMinutes = intervalMinutes;
    this.maxBackups = maxBackups;
    this.backupDirectory = path.join(process.cwd(), 'backups');
    
    // Ensure backup directory exists
    if (!fs.existsSync(this.backupDirectory)) {
      fs.mkdirSync(this.backupDirectory, { recursive: true });
      console.log(`📁 Created backup directory: ${this.backupDirectory}`);
    }
  }

  start(): void {
    if (this.backupInterval) {
      console.log('⚠️ Auto-backup already running');
      return;
    }

    console.log(`🔄 Starting auto-backup service (every ${this.intervalMinutes} minutes)`);
    
    // Create initial backup
    this.createBackup();
    
    // Set up interval
    this.backupInterval = setInterval(() => {
      this.createBackup();
    }, this.intervalMinutes * 60 * 1000);

    console.log(`✅ Auto-backup service started`);
  }

  stop(): void {
    if (this.backupInterval) {
      clearInterval(this.backupInterval);
      this.backupInterval = null;
      console.log(`🛑 Auto-backup service stopped`);
    }
  }

  async createBackup(): Promise<string | null> {
    try {
      console.log(`💾 Creating automatic backup...`);
      
      const gameState = await this.databaseService.getGameState();
      const allUsers = await this.databaseService.getUsers();

      if (!gameState || !allUsers) {
        console.error('❌ Failed to get game state or users for backup');
        return null;
      }

      // Create password hash map (excluding admin for security)
      const userPasswords: { [userId: string]: string } = {};
      allUsers.forEach((user: any) => {
        if (user.username !== 'Admin' && user.passwordHash) {
          userPasswords[user.id] = user.passwordHash;
        }
      });

      const backupData: FullBackupState = {
        gameState,
        users: allUsers,
        userPasswords
      };

      // Generate filename with timestamp
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `auto-backup-${timestamp}.json`;
      const filepath = path.join(this.backupDirectory, filename);

      // Save backup
      fs.writeFileSync(filepath, JSON.stringify(backupData, null, 2));

      console.log(`✅ Auto-backup created: ${filename}`);
      console.log(`   - ${gameState.tribes.length} tribes`);
      console.log(`   - ${allUsers.length} users`);
      console.log(`   - ${Object.keys(userPasswords).length} password hashes`);
      console.log(`   - ${gameState.ticker?.messages?.length || 0} ticker messages`);
      console.log(`   - ${gameState.loginAnnouncements?.announcements?.length || 0} login announcements`);

      // Cleanup old backups
      this.cleanupOldBackups();

      return filename;
    } catch (error) {
      console.error('❌ Error creating auto-backup:', error);
      return null;
    }
  }

  getBackupList(): Array<{ filename: string; timestamp: Date; size: number }> {
    try {
      const files = fs.readdirSync(this.backupDirectory)
        .filter(file => file.startsWith('auto-backup-') && file.endsWith('.json'))
        .map(file => {
          const filepath = path.join(this.backupDirectory, file);
          const stats = fs.statSync(filepath);
          return {
            filename: file,
            timestamp: stats.mtime,
            size: stats.size
          };
        })
        .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime()); // Newest first

      return files;
    } catch (error) {
      console.error('❌ Error getting backup list:', error);
      return [];
    }
  }

  getBackupData(filename: string): FullBackupState | null {
    try {
      const filepath = path.join(this.backupDirectory, filename);
      if (!fs.existsSync(filepath)) {
        console.error(`❌ Backup file not found: ${filename}`);
        return null;
      }

      const data = fs.readFileSync(filepath, 'utf-8');
      return JSON.parse(data) as FullBackupState;
    } catch (error) {
      console.error(`❌ Error reading backup file ${filename}:`, error);
      return null;
    }
  }

  deleteBackup(filename: string): boolean {
    try {
      const filepath = path.join(this.backupDirectory, filename);
      if (fs.existsSync(filepath)) {
        fs.unlinkSync(filepath);
        console.log(`🗑️ Deleted backup: ${filename}`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`❌ Error deleting backup ${filename}:`, error);
      return false;
    }
  }

  private cleanupOldBackups(): void {
    try {
      const backups = this.getBackupList();
      
      if (backups.length > this.maxBackups) {
        const toDelete = backups.slice(this.maxBackups);
        console.log(`🧹 Cleaning up ${toDelete.length} old backups (keeping ${this.maxBackups} most recent)`);
        
        toDelete.forEach(backup => {
          this.deleteBackup(backup.filename);
        });
      }
    } catch (error) {
      console.error('❌ Error during backup cleanup:', error);
    }
  }

  getStatus(): {
    isRunning: boolean;
    intervalMinutes: number;
    maxBackups: number;
    backupCount: number;
    lastBackup: Date | null;
    nextBackup: Date | null;
  } {
    const backups = this.getBackupList();
    const lastBackup = backups.length > 0 ? backups[0].timestamp : null;
    const nextBackup = lastBackup && this.backupInterval 
      ? new Date(lastBackup.getTime() + (this.intervalMinutes * 60 * 1000))
      : null;

    return {
      isRunning: this.backupInterval !== null,
      intervalMinutes: this.intervalMinutes,
      maxBackups: this.maxBackups,
      backupCount: backups.length,
      lastBackup,
      nextBackup
    };
  }
}
