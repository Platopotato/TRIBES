import fs from 'fs';
import path from 'path';

export interface LoginAnnouncement {
  enabled: boolean;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  lastUpdated: string;
}

export class AnnouncementService {
  private static readonly ANNOUNCEMENT_FILE = path.join(process.cwd(), 'data', 'login-announcement.json');

  static async getLoginAnnouncement(): Promise<LoginAnnouncement | null> {
    try {
      // Check if file exists
      if (!fs.existsSync(this.ANNOUNCEMENT_FILE)) {
        console.log('📢 No login announcement file found');
        return null;
      }

      // Read and parse the file
      const fileContent = fs.readFileSync(this.ANNOUNCEMENT_FILE, 'utf-8');
      const announcement: LoginAnnouncement = JSON.parse(fileContent);

      // Return null if disabled
      if (!announcement.enabled) {
        console.log('📢 Login announcement is disabled');
        return null;
      }

      console.log('📢 Login announcement loaded successfully');
      return announcement;
    } catch (error) {
      console.error('❌ Error reading login announcement:', error);
      return null;
    }
  }

  static async updateLoginAnnouncement(announcement: Partial<LoginAnnouncement>): Promise<boolean> {
    try {
      // Ensure data directory exists
      const dataDir = path.dirname(this.ANNOUNCEMENT_FILE);
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }

      // Get current announcement or create default
      let current: LoginAnnouncement;
      try {
        const existing = await this.getLoginAnnouncement();
        current = existing || {
          enabled: false,
          title: '',
          message: '',
          type: 'info',
          lastUpdated: new Date().toISOString()
        };
      } catch {
        current = {
          enabled: false,
          title: '',
          message: '',
          type: 'info',
          lastUpdated: new Date().toISOString()
        };
      }

      // Merge with updates
      const updated: LoginAnnouncement = {
        ...current,
        ...announcement,
        lastUpdated: new Date().toISOString()
      };

      // Write to file
      fs.writeFileSync(this.ANNOUNCEMENT_FILE, JSON.stringify(updated, null, 2));
      console.log('📢 Login announcement updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating login announcement:', error);
      return false;
    }
  }
}
