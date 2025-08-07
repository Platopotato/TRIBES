import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GameState,
  User,
  Tribe,
  generateMapData,
  SECURITY_QUESTIONS
} from '../../../shared/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseService {
  private prisma: PrismaClient | null = null;
  private useDatabase: boolean = false;
  private dataDir: string;
  private dataFile: string;

  constructor() {
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.dataFile = path.join(this.dataDir, 'game-data.json');
  }

  async initialize(): Promise<void> {
    try {
      // Try to connect to database
      console.log('🔄 Attempting to connect to database...');
      console.log('🔍 DATABASE_URL exists:', !!process.env.DATABASE_URL);
      console.log('🔍 DATABASE_URL starts with:', process.env.DATABASE_URL?.substring(0, 20) + '...');

      this.prisma = new PrismaClient();
      await this.prisma.$connect();
      this.useDatabase = true;
      console.log('✅ Connected to PostgreSQL database');

      // Test a simple query
      console.log('🔄 Testing database connection with simple query...');
      const testResult = await this.prisma.$queryRaw`SELECT 1 as test`;
      console.log('✅ Database query test successful:', testResult);

      // Ensure we have a game state
      console.log('🔄 Ensuring game state exists...');
      await this.ensureGameState();
      console.log('✅ Game state initialization complete');
    } catch (error) {
      console.error('❌ Database initialization failed with error:');
      console.error('Error type:', (error as any)?.constructor?.name);
      console.error('Error message:', (error as any)?.message);
      console.error('Full error:', error);
      console.warn('🗂️ Falling back to file storage');

      this.useDatabase = false;
      this.prisma = null;

      // Ensure data directory exists for file storage
      if (!fs.existsSync(this.dataDir)) {
        fs.mkdirSync(this.dataDir, { recursive: true });
      }
    }

    // Sync admin password with environment variable
    await this.syncAdminPasswordWithEnv();
  }

  async disconnect(): Promise<void> {
    if (this.prisma) {
      await this.prisma.$disconnect();
    }
  }

  private mockHash(data: string): string {
    return `hashed_${data}_salted_v1`;
  }

  private getDefaultMapSettings() {
    return {
      biases: {
        Plains: 1,
        Desert: 1,
        Mountains: 1,
        Forest: 1,
        Ruins: 0.8,
        Wasteland: 1,
        Water: 1,
        Radiation: 0.5,
        Crater: 0.7,
        Swamp: 0.9
      }
    };
  }

  private getDefaultGameState(): GameState {
    const mapSeed = Date.now();
    const mapSettings = this.getDefaultMapSettings();
    const { map, startingLocations } = generateMapData(40, mapSeed, mapSettings);

    return {
      mapData: map,
      tribes: [],
      turn: 1,
      startingLocations,
      chiefRequests: [],
      assetRequests: [],
      journeys: [],
      diplomaticProposals: [],
      history: [],
      mapSeed,
      mapSettings,
    };
  }

  private getAdminPassword(): string {
    // Check for environment variable first, fall back to hardcoded for safety
    const envPassword = process.env.ADMIN_PASSWORD;
    if (envPassword) {
      console.log('🔒 Using admin password from environment variable');
      return envPassword;
    } else {
      console.log('⚠️ Using hardcoded admin password - set ADMIN_PASSWORD environment variable for security');
      return 'snoopy';
    }
  }

  private async ensureGameState(): Promise<void> {
    if (this.useDatabase && this.prisma) {
      try {
        console.log('🔄 Checking for existing game state...');
        // Check if we have any game state
        const gameStateCount = await this.prisma.gameState.count();
        console.log(`📊 Found ${gameStateCount} game state(s) in database`);

        if (gameStateCount === 0) {
          console.log('🔄 No game state found, creating default state...');
          // Create default game state
          const defaultState = this.getDefaultGameState();
          await this.createGameState(defaultState);
          console.log('✅ Default game state created');

          // Create default admin user
          console.log('🔄 Creating default admin user...');
          const adminPassword = this.getAdminPassword();
          await this.createUser({
            id: 'user-admin',
            username: 'Admin',
            passwordHash: this.mockHash(adminPassword),
            role: 'admin',
            securityQuestion: SECURITY_QUESTIONS[0],
            securityAnswerHash: this.mockHash(adminPassword)
          });
          console.log('✅ Default admin user created');
        } else {
          console.log('✅ Existing game state found, skipping initialization');
        }
      } catch (error) {
        console.error('❌ Error in ensureGameState:', error);
        throw error; // Re-throw to trigger fallback
      }
    }
  }

  // Game State methods
  async getGameState(): Promise<GameState | null> {
    if (this.useDatabase && this.prisma) {
      const gameState = await this.prisma.gameState.findFirst({
        include: {
          hexes: true,
          tribes: {
            include: {
              garrisons: true
            }
          },
          chiefRequests: true,
          assetRequests: true,
          journeys: true,
          diplomaticProposals: true,
          turnHistory: true
        }
      });

      if (!gameState) return null;

      // Convert database format back to GameState format
      return this.convertDbGameStateToGameState(gameState);
    } else {
      // File-based fallback
      return this.getGameStateFromFile();
    }
  }

  async updateGameState(gameState: GameState): Promise<void> {
    if (this.useDatabase && this.prisma) {
      // Update database
      await this.updateGameStateInDb(gameState);
    } else {
      // File-based fallback
      this.saveGameStateToFile(gameState);
    }
  }

  async createGameState(gameState: GameState): Promise<void> {
    if (this.useDatabase && this.prisma) {
      await this.prisma.gameState.create({
        data: {
          turn: gameState.turn,
          mapSeed: gameState.mapSeed ? BigInt(gameState.mapSeed) : null,
          mapSettings: gameState.mapSettings as any,
          startingLocations: gameState.startingLocations as any,
          hexes: {
            create: gameState.mapData.map(hex => ({
              q: hex.q,
              r: hex.r,
              terrain: hex.terrain,
              poiType: hex.poi?.type || null,
              poiId: hex.poi?.id || null,
              poiDifficulty: hex.poi?.difficulty || null,
              poiRarity: hex.poi?.rarity || null
            }))
          }
        }
      });
    } else {
      this.saveGameStateToFile(gameState);
    }
  }

  // User methods
  async getUsers(): Promise<User[]> {
    if (this.useDatabase && this.prisma) {
      const users = await this.prisma.user.findMany();
      return users.map(user => ({
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role as 'player' | 'admin',
        securityQuestion: user.securityQuestion,
        securityAnswerHash: user.securityAnswerHash
      }));
    } else {
      return this.getUsersFromFile();
    }
  }

  async createUser(user: User): Promise<void> {
    if (this.useDatabase && this.prisma) {
      await this.prisma.user.create({
        data: {
          id: user.id,
          username: user.username,
          passwordHash: user.passwordHash,
          role: user.role,
          securityQuestion: user.securityQuestion,
          securityAnswerHash: user.securityAnswerHash
        }
      });
    } else {
      const users = this.getUsersFromFile();
      users.push(user);
      this.saveUsersToFile(users);
    }
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    if (this.useDatabase && this.prisma) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updates
      });
    } else {
      const users = this.getUsersFromFile();
      const userIndex = users.findIndex(u => u.id === userId);
      if (userIndex !== -1) {
        users[userIndex] = { ...users[userIndex], ...updates };
        this.saveUsersToFile(users);
      }
    }
  }

  async removeUser(userId: string): Promise<boolean> {
    try {
      if (this.useDatabase && this.prisma) {
        await this.prisma.user.delete({
          where: { id: userId }
        });
      } else {
        const users = this.getUsersFromFile();
        const filteredUsers = users.filter(u => u.id !== userId);
        this.saveUsersToFile(filteredUsers);
      }
      return true;
    } catch (error) {
      console.error('❌ Error removing user from database:', error);
      return false;
    }
  }

  async loadBackupUsers(users: User[]): Promise<void> {
    if (this.useDatabase && this.prisma) {
      // For database: clear all users except admin and insert backup users
      await this.prisma.user.deleteMany({
        where: {
          username: { not: 'Admin' }
        }
      });

      for (const user of users.filter(u => u.username !== 'Admin')) {
        await this.prisma.user.create({
          data: {
            id: user.id,
            username: user.username,
            passwordHash: user.passwordHash,
            role: user.role,
            securityQuestion: user.securityQuestion,
            securityAnswerHash: user.securityAnswerHash
          }
        });
      }
    } else {
      // For file storage: replace all users with backup users
      this.saveUsersToFile(users);
    }
  }

  async updateAdminPassword(newPassword: string): Promise<boolean> {
    try {
      console.log('🔒 Updating admin password...');
      const hashedPassword = this.mockHash(newPassword);

      if (this.useDatabase && this.prisma) {
        await this.prisma.user.update({
          where: { username: 'Admin' },
          data: {
            passwordHash: hashedPassword,
            securityAnswerHash: hashedPassword // Also update security answer
          }
        });
      } else {
        // For file storage
        const users = this.getUsersFromFile();
        const adminUser = users.find(u => u.username === 'Admin');
        if (adminUser) {
          adminUser.passwordHash = hashedPassword;
          adminUser.securityAnswerHash = hashedPassword;
          this.saveUsersToFile(users);
        }
      }

      console.log('✅ Admin password updated successfully');
      return true;
    } catch (error) {
      console.error('❌ Error updating admin password:', error);
      return false;
    }
  }

  // Public method for debugging
  public hashPassword(password: string): string {
    return this.mockHash(password);
  }

  async syncAdminPasswordWithEnv(): Promise<boolean> {
    try {
      const envPassword = this.getAdminPassword();
      console.log(`🔄 Syncing admin password with environment (using: ${envPassword})`);

      // Get current admin user
      const adminUser = await this.findUserByUsername('Admin');
      if (!adminUser) {
        console.log('❌ No admin user found to sync');
        return false;
      }

      const expectedHash = this.mockHash(envPassword);
      if (adminUser.passwordHash === expectedHash) {
        console.log('✅ Admin password already synced with environment');
        return true;
      }

      console.log(`🔄 Admin password hash mismatch, updating database to match environment`);
      console.log(`🔍 Current hash: ${adminUser.passwordHash}`);
      console.log(`🔍 Expected hash: ${expectedHash}`);

      const success = await this.updateAdminPassword(envPassword);
      if (success) {
        console.log('✅ Admin password synced with environment successfully');
      } else {
        console.log('❌ Failed to sync admin password with environment');
      }

      return success;
    } catch (error) {
      console.error('❌ Error syncing admin password with environment:', error);
      return false;
    }
  }

  async findUserByUsername(username: string): Promise<User | null> {
    if (this.useDatabase && this.prisma) {
      const user = await this.prisma.user.findUnique({
        where: { username }
      });

      if (!user) return null;

      return {
        id: user.id,
        username: user.username,
        passwordHash: user.passwordHash,
        role: user.role as 'player' | 'admin',
        securityQuestion: user.securityQuestion,
        securityAnswerHash: user.securityAnswerHash
      };
    } else {
      const users = this.getUsersFromFile();
      return users.find(u => u.username.toLowerCase() === username.toLowerCase()) || null;
    }
  }

  // File-based fallback methods
  private getGameStateFromFile(): GameState | null {
    if (fs.existsSync(this.dataFile)) {
      try {
        const rawData = fs.readFileSync(this.dataFile, 'utf-8');
        const data = JSON.parse(rawData);
        return data.gameState;
      } catch (error) {
        console.error('Error loading game state from file:', error);
        return this.getDefaultGameState();
      }
    } else {
      const defaultState = this.getDefaultGameState();
      this.saveGameStateToFile(defaultState);
      return defaultState;
    }
  }

  private saveGameStateToFile(gameState: GameState): void {
    try {
      const users = this.getUsersFromFile();
      const data = { gameState, users };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save game state to file:", err);
    }
  }

  private getUsersFromFile(): User[] {
    if (fs.existsSync(this.dataFile)) {
      try {
        const rawData = fs.readFileSync(this.dataFile, 'utf-8');
        const data = JSON.parse(rawData);
        return data.users || [];
      } catch (error) {
        console.error('Error loading users from file:', error);
        return this.getDefaultUsers();
      }
    } else {
      return this.getDefaultUsers();
    }
  }

  private saveUsersToFile(users: User[]): void {
    try {
      const gameState = this.getGameStateFromFile();
      const data = { gameState, users };
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
    } catch (err) {
      console.error("Failed to save users to file:", err);
    }
  }

  private getDefaultUsers(): User[] {
    const adminPassword = this.getAdminPassword();
    return [
      {
        id: 'user-admin',
        username: 'Admin',
        passwordHash: this.mockHash(adminPassword),
        role: 'admin',
        securityQuestion: SECURITY_QUESTIONS[0],
        securityAnswerHash: this.mockHash(adminPassword)
      }
    ];
  }

  // Helper methods for database conversion
  private convertDbGameStateToGameState(dbGameState: any): GameState {
    // This is a simplified conversion - in a real implementation,
    // you'd need to properly convert all the nested structures
    return {
      mapData: dbGameState.hexes.map((hex: any) => ({
        q: hex.q,
        r: hex.r,
        terrain: hex.terrain,
        poi: hex.poiType ? {
          id: hex.poiId,
          type: hex.poiType,
          difficulty: hex.poiDifficulty,
          rarity: hex.poiRarity
        } : undefined
      })),
      tribes: dbGameState.tribes.map((tribe: any) => ({
        id: tribe.id,
        playerId: tribe.playerId,
        isAI: tribe.isAI,
        aiType: tribe.aiType,
        playerName: tribe.playerName,
        tribeName: tribe.tribeName,
        icon: tribe.icon,
        color: tribe.color,
        stats: tribe.stats,
        location: tribe.location,
        globalResources: tribe.globalResources,
        turnSubmitted: tribe.turnSubmitted,
        actions: tribe.actions,
        lastTurnResults: tribe.lastTurnResults,
        exploredHexes: tribe.exploredHexes,
        rationLevel: tribe.rationLevel,
        completedTechs: tribe.completedTechs,
        assets: tribe.assets,
        currentResearch: tribe.currentResearch,
        journeyResponses: tribe.journeyResponses,
        garrisons: tribe.garrisons.reduce((acc: any, garrison: any) => {
          const hexKey = `${garrison.hexQ.toString().padStart(3, '0')}.${garrison.hexR.toString().padStart(3, '0')}`;
          acc[hexKey] = {
            troops: garrison.troops,
            weapons: garrison.weapons,
            chiefs: garrison.chiefs
          };
          return acc;
        }, {}),
        diplomacy: {} // This would need to be populated from DiplomaticRelation table
      })),
      turn: dbGameState.turn,
      startingLocations: dbGameState.startingLocations,
      chiefRequests: dbGameState.chiefRequests,
      assetRequests: dbGameState.assetRequests,
      journeys: dbGameState.journeys,
      diplomaticProposals: dbGameState.diplomaticProposals,
      history: dbGameState.turnHistory.map((th: any) => ({
        turn: th.turn,
        tribeRecords: th.tribeRecords
      })),
      mapSeed: dbGameState.mapSeed ? Number(dbGameState.mapSeed) : undefined,
      mapSettings: dbGameState.mapSettings
    };
  }

