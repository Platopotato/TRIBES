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
              garrisons: true,
              diplomacyFrom: true,
              diplomacyTo: true
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

  async updateGameState(gameState: GameState, skipValidation: boolean = false): Promise<void> {
    if (this.useDatabase && this.prisma) {
      // Update database
      await this.updateGameStateInDb(gameState);
    } else {
      // File-based fallback
      if (skipValidation) {
        // During backup loading, skip validation since users are loaded separately
        this.saveGameStateToFile(gameState);
      } else {
        // Normal operation - validate and clean game state first
        const cleanedGameState = await this.validateAndCleanGameState(gameState);
        this.saveGameStateToFile(cleanedGameState);
      }
    }
  }

  async updateGameStateLight(gameState: GameState): Promise<void> {
    console.log('🔄 Lightweight game state update...');

    if (!this.useDatabase || !this.prisma) {
      // Fallback to regular update for file-based storage
      return this.updateGameState(gameState);
    }

    try {
      // Find the existing game state record
      const existingGameState = await this.prisma.gameState.findFirst();

      if (!existingGameState) {
        console.log('⚠️ No GameState record found, falling back to full update');
        return this.updateGameState(gameState);
      }

      // Update only the main game state fields
      await this.prisma.gameState.update({
        where: { id: existingGameState.id },
        data: {
          turn: gameState.turn,
          suspended: gameState.suspended || false,
          suspensionMessage: gameState.suspensionMessage || null,
        }
      });
      console.log(`✅ Updated main game state: turn ${gameState.turn}`);

      // Update tribes individually without recreating
      for (const tribe of gameState.tribes) {
        // Update basic tribe data
        await this.prisma.tribe.update({
          where: { id: tribe.id },
          data: {
            actions: tribe.actions as any,
            turnSubmitted: tribe.turnSubmitted,
            lastTurnResults: tribe.lastTurnResults as any,
            journeyResponses: tribe.journeyResponses as any,
            globalResources: tribe.globalResources as any,
            stats: tribe.stats as any,
            rationLevel: tribe.rationLevel,
            exploredHexes: tribe.exploredHexes,
          }
        });
        console.log(`✅ Updated tribe basic data: ${tribe.tribeName}`);

        // Update garrisons separately (they're separate database records)
        if (tribe.garrisons) {
          console.log(`🏰 Updating garrisons for ${tribe.tribeName}...`);

          // Delete existing garrisons for this tribe
          await this.prisma.garrison.deleteMany({
            where: { tribeId: tribe.id }
          });

          // Create new garrisons
          for (const [hexCoord, garrisonData] of Object.entries(tribe.garrisons)) {
            // Parse hex coordinate (format: "066.046" -> q=66, r=46)
            const [qStr, rStr] = hexCoord.split('.');
            const hexQ = parseInt(qStr, 10);
            const hexR = parseInt(rStr, 10);

            await this.prisma.garrison.create({
              data: {
                tribeId: tribe.id,
                hexQ: hexQ,
                hexR: hexR,
                troops: garrisonData.troops || 0,
                weapons: garrisonData.weapons || 0,
                chiefs: garrisonData.chiefs as any || [],
                hexId: hexCoord, // Store the original coordinate string for reference
              }
            });
          }
          console.log(`✅ Updated ${Object.keys(tribe.garrisons).length} garrisons for ${tribe.tribeName}`);
        }
      }

      console.log('✅ Lightweight game state update completed');
    } catch (error) {
      console.error('❌ Error in lightweight game state update:', error);
      throw error;
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
          suspended: gameState.suspended || false,
          suspensionMessage: gameState.suspensionMessage || null,
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

  async createAIUser(userData: { id: string; username: string; role: string }): Promise<void> {
    if (this.useDatabase && this.prisma) {
      console.log(`🤖 DATABASE: Creating AI user with ID: ${userData.id}, username: ${userData.username}`);

      try {
        const result = await this.prisma.user.upsert({
          where: { id: userData.id },
          create: {
            id: userData.id,
            username: userData.username,
            passwordHash: 'AI_NO_PASSWORD', // AI users don't need real passwords
            role: userData.role,
            securityQuestion: 'AI',
            securityAnswerHash: 'AI_NO_ANSWER'
          },
          update: {
            username: userData.username,
            role: userData.role
          }
        });

        console.log(`✅ DATABASE: AI user upserted successfully:`, {
          id: result.id,
          username: result.username,
          role: result.role
        });
      } catch (error) {
        console.error(`❌ DATABASE: Error creating AI user:`, error);
        throw error;
      }
    } else {
      console.log(`📁 FILE STORAGE: Skipping AI user creation (not needed for file storage)`);
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
        try {
          await this.prisma.user.create({
            data: {
              id: user.id,
              username: user.username,
              passwordHash: user.passwordHash,
              role: user.role,
              securityQuestion: user.securityQuestion || "What was your first pet's name?",
              securityAnswerHash: user.securityAnswerHash || user.passwordHash || "default_hash"
            }
          });
          console.log(`✅ Created user: ${user.username} (${user.id})`);
        } catch (error) {
          console.error(`❌ Failed to create user ${user.username}:`, error);
          throw error; // Re-throw to stop the backup loading process
        }
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
  private buildDiplomacyObject(dbTribe: any): Record<string, { status: string }> {
    const diplomacy: Record<string, { status: string }> = {};

    // Add relations where this tribe is the "from" tribe
    dbTribe.diplomacyFrom?.forEach((relation: any) => {
      diplomacy[relation.toTribeId] = { status: relation.status };
    });

    // Add relations where this tribe is the "to" tribe
    dbTribe.diplomacyTo?.forEach((relation: any) => {
      diplomacy[relation.fromTribeId] = { status: relation.status };
    });

    // Debug logging
    if (Object.keys(diplomacy).length > 0) {
      console.log(`🔍 Built diplomacy for ${dbTribe.tribeName}:`, Object.keys(diplomacy).length, 'relations');
    }

    return diplomacy;
  }

  private convertDbGameStateToGameState(dbGameState: any): GameState {
    console.log(`🔍 DB CONVERSION: Converting game state with ${dbGameState.tribes?.length || 0} tribes`);

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
        garrisons: (() => {
          const garrisons = tribe.garrisons.reduce((acc: any, garrison: any) => {
            const hexKey = `${garrison.hexQ.toString().padStart(3, '0')}.${garrison.hexR.toString().padStart(3, '0')}`;
            acc[hexKey] = {
              troops: garrison.troops,
              weapons: garrison.weapons,
              chiefs: garrison.chiefs
            };
            console.log(`🔍 DB CONVERSION: ${tribe.tribeName} garrison at ${hexKey}: ${garrison.troops} troops, ${garrison.weapons} weapons`);
            return acc;
          }, {});

          // CRITICAL FIX: Ensure every tribe has at least their home garrison
          if (Object.keys(garrisons).length === 0 && tribe.location) {
            console.log(`🚨 GARRISON FIX: ${tribe.tribeName} has no garrisons, creating home garrison at ${tribe.location}`);
            garrisons[tribe.location] = {
              troops: 20,
              weapons: 10,
              chiefs: []
            };
          }

          console.log(`🔍 DB CONVERSION: ${tribe.tribeName} final garrison count: ${Object.keys(garrisons).length}`);
          return garrisons;
        })(),
        diplomacy: this.buildDiplomacyObject(tribe)
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
      mapSettings: dbGameState.mapSettings,
      suspended: dbGameState.suspended || false,
      suspensionMessage: dbGameState.suspensionMessage || undefined
    };
  }

  private async validateAndCleanGameState(gameState: GameState): Promise<GameState> {
    // Get existing users to validate tribe player IDs
    const users = this.getUsersFromFile();
    const existingUserIds = new Set(users.map(u => u.id));

    // Filter out tribes with missing player IDs
    const originalTribesCount = gameState.tribes.length;
    const validTribes = gameState.tribes.filter(tribe => {
      if (tribe.playerId && !existingUserIds.has(tribe.playerId)) {
        console.log(`⚠️ Removing tribe ${tribe.tribeName} - user ${tribe.playerId} not found in file storage`);
        return false;
      }
      return true;
    });

    const removedTribesCount = originalTribesCount - validTribes.length;
    if (removedTribesCount > 0) {
      console.log(`🧹 Cleaned game state: removed ${removedTribesCount} tribes with missing user references`);
    }

    return {
      ...gameState,
      tribes: validTribes
    };
  }

  private async updateGameStateInDb(gameState: GameState): Promise<void> {
    // This is a complex operation that would need to update multiple tables
    // For backup loading, we need to completely replace the data

    if (!this.prisma) return;

    console.log('🔄 Updating game state in database...');
    console.log(`📊 Game state has ${gameState.tribes.length} tribes`);
    console.log(`📊 Tribe names: ${gameState.tribes.map(t => t.tribeName).join(', ')}`);
    console.log(`📊 AI tribes: ${gameState.tribes.filter(t => t.isAI).map(t => `${t.tribeName} (${t.aiType})`).join(', ')}`);
    console.log(`📊 Game state has ${gameState.mapData?.length || 0} map hexes`);
    console.log(`📊 Game state turn: ${gameState.turn}`);
    console.log(`📊 Database mode: ${this.useDatabase ? 'PostgreSQL' : 'File Storage'}`);
    console.log(`📊 Prisma client: ${this.prisma ? 'Available' : 'Not Available'}`);

    try {
      // Use a transaction with extended timeout for large backup loading
      await this.prisma.$transaction(async (tx) => {
        // Get the current game state ID
        const currentGameState = await tx.gameState.findFirst();
        if (!currentGameState) {
          throw new Error('No game state found to update');
        }

        // Delete existing tribes
        console.log(' Clearing existing tribes...');
        await tx.tribe.deleteMany({
          where: { gameStateId: currentGameState.id }
        });

        // Clear existing hexes
        console.log(' Clearing existing map data...');
        await tx.hex.deleteMany({
          where: { gameStateId: currentGameState.id }
        });

        // Clear all existing game state data
        console.log(' Clearing existing requests, journeys, and proposals...');
        await tx.chiefRequest.deleteMany({ where: { gameStateId: currentGameState.id } });
        await tx.assetRequest.deleteMany({ where: { gameStateId: currentGameState.id } });
        await tx.journey.deleteMany({ where: { gameStateId: currentGameState.id } });
        await tx.diplomaticProposal.deleteMany({ where: { gameStateId: currentGameState.id } });
        await tx.turnHistory.deleteMany({ where: { gameStateId: currentGameState.id } });

        // Update the main game state (minimal fields only to avoid schema issues)
        console.log(' Updating main game state...');
        try {
          await tx.gameState.update({
            where: { id: currentGameState.id },
            data: {
              turn: gameState.turn,
              startingLocations: gameState.startingLocations,
              suspended: gameState.suspended || false,
              suspensionMessage: gameState.suspensionMessage || null
            }
          });
          console.log('✅ Main game state updated successfully');
        } catch (error) {
          console.log('⚠️ GameState update failed, continuing with map data...', error);
        }

        // Create new map data (hexes) using batch inserts for performance
        console.log(`🗺️ Creating ${gameState.mapData.length} map hexes using batch inserts...`);

        // Debug: Show sample coordinates from map data
        const sampleMapCoords = gameState.mapData.slice(0, 5).map(hex => `q=${hex.q}, r=${hex.r}`);
        console.log(`🔍 Sample map coordinates from backup:`, sampleMapCoords);

        // Prepare hex data for batch insert
        const hexData = gameState.mapData.map(hex => ({
          q: hex.q,
          r: hex.r,
          terrain: hex.terrain,
          poiType: hex.poi?.type || null,
          poiId: hex.poi?.id || null,
          poiDifficulty: hex.poi?.difficulty || null,
          poiRarity: hex.poi?.rarity || null,
          gameStateId: currentGameState.id
        }));

        // Insert hexes in batches of 500 to avoid timeout
        const batchSize = 500;
        let totalCreated = 0;

        for (let i = 0; i < hexData.length; i += batchSize) {
          const batch = hexData.slice(i, i + batchSize);
          try {
            await tx.hex.createMany({
              data: batch,
              skipDuplicates: true
            });
            totalCreated += batch.length;
            console.log(`✅ Created batch ${Math.floor(i/batchSize) + 1}: ${batch.length} hexes (${totalCreated}/${hexData.length} total)`);
          } catch (error) {
            console.log(`❌ Error creating hex batch ${Math.floor(i/batchSize) + 1}:`, error);
          }
        }

        console.log(`✅ Map data creation completed: ${totalCreated} hexes created`);
        // Create new tribes (only for users that exist)
        console.log(`👥 Creating ${gameState.tribes.length} tribes...`);
        
        // Get all existing user IDs to validate foreign key constraints
        const existingUsers = await tx.user.findMany({ select: { id: true } });
        const existingUserIds = new Set(existingUsers.map(u => u.id));
        
        let createdTribes = 0;
        let skippedTribes = 0;
        
        for (const tribe of gameState.tribes) {
          // Check if the playerId exists in the database (skip this check for AI tribes)
          if (!tribe.isAI && !existingUserIds.has(tribe.playerId)) {
            console.log(`⚠️ Skipping human tribe ${tribe.tribeName} - user ${tribe.playerId} not found`);
            skippedTribes++;
            continue;
          }

          // AI tribes are allowed even if their playerId doesn't exist in users table
          if (tribe.isAI) {
            console.log(`🤖 Processing AI tribe: ${tribe.tribeName} (${tribe.aiType}) with playerId: ${tribe.playerId}`);
          }
          
          try {
            // Use upsert to handle existing tribes gracefully
            await tx.tribe.upsert({
              where: { id: tribe.id },
              create: {
                id: tribe.id,
                playerId: tribe.playerId,
                isAI: tribe.isAI || false,
                aiType: tribe.aiType || null,
                playerName: tribe.playerName,
                tribeName: tribe.tribeName,
                icon: tribe.icon,
                color: tribe.color,
                stats: tribe.stats as any,
                location: tribe.location,
                globalResources: tribe.globalResources as any,
                turnSubmitted: tribe.turnSubmitted,
                actions: tribe.actions as any,
                lastTurnResults: tribe.lastTurnResults as any,
                exploredHexes: tribe.exploredHexes as any,
                rationLevel: tribe.rationLevel,
                completedTechs: tribe.completedTechs as any,
                assets: tribe.assets as any,
                currentResearch: tribe.currentResearch as any,
                journeyResponses: tribe.journeyResponses as any,
                gameStateId: currentGameState.id
              },
              update: {
                playerId: tribe.playerId,
                isAI: tribe.isAI || false,
                aiType: tribe.aiType || null,
                playerName: tribe.playerName,
                tribeName: tribe.tribeName,
                icon: tribe.icon,
                color: tribe.color,
                stats: tribe.stats as any,
                location: tribe.location,
                globalResources: tribe.globalResources as any,
                turnSubmitted: tribe.turnSubmitted,
                actions: tribe.actions as any,
                lastTurnResults: tribe.lastTurnResults as any,
                exploredHexes: tribe.exploredHexes as any,
                rationLevel: tribe.rationLevel,
                completedTechs: tribe.completedTechs as any,
                assets: tribe.assets as any,
                currentResearch: tribe.currentResearch as any,
                journeyResponses: tribe.journeyResponses as any,
                gameStateId: currentGameState.id
              }
            });

            createdTribes++;
          } catch (error) {
            console.log(`❌ Error upserting tribe ${tribe.tribeName}:`, error);
            skippedTribes++;
          }
        }

        console.log(`✅ Created ${createdTribes} tribes, skipped ${skippedTribes} tribes`);

        // Create garrisons for all tribes (separate step after tribe creation)
        console.log(`🏰 Creating garrisons for all tribes...`);

        // Debug: Check what hex coordinates actually exist in the database
        const sampleHexes = await tx.hex.findMany({
          where: { gameStateId: currentGameState.id },
          select: { q: true, r: true },
          take: 10
        });
        console.log(`🔍 Sample hex coordinates in database:`, sampleHexes.map(h => `q=${h.q}, r=${h.r}`));

        let totalGarrisons = 0;

        for (const tribe of gameState.tribes) {
          // Skip tribes that weren't created (missing users)
          if (!existingUserIds.has(tribe.playerId)) {
            continue;
          }

          if (tribe.garrisons) {
            console.log(`🏰 Processing garrisons for ${tribe.tribeName}...`);
            let garrisonCount = 0;

            for (const [hexCoord, garrisonData] of Object.entries(tribe.garrisons)) {
              try {
                // Parse hex coordinates (format: "051.044")
                const coordParts = hexCoord.split('.');
                if (coordParts.length !== 2) {
                  console.log(`❌ Invalid hex coordinate format: ${hexCoord}`);
                  continue;
                }

                const q = parseInt(coordParts[0], 10);
                const r = parseInt(coordParts[1], 10);

                console.log(`🎯 WINNER STRATEGY: Looking for hex at q=${q}, r=${r} (${hexCoord})`);

                // WINNER: Try multiple coordinate lookup strategies with clear logging
                let hex: any = null;
                let strategyUsed = "";

                // Strategy 1: Direct lookup
                console.log(`🔍 Strategy 1: Direct lookup q=${q}, r=${r}`);
                hex = await tx.hex.findFirst({
                  where: { q, r, gameStateId: currentGameState.id }
                });
                if (hex) {
                  strategyUsed = "Direct lookup";
                  console.log(`✅ WINNER! Strategy 1 worked: Direct lookup`);
                }

                if (!hex) {
                  // Strategy 2: Try coordinate transformation (backup coords to map coords)
                  // Backup uses 30-80 range, map uses -40 to +40 range
                  // Transform: backup_q - 70 = map_q (e.g., 51 - 70 = -19)
                  const transformedQ = q - 70;
                  const transformedR = r - 40;
                  console.log(`🔍 Strategy 2: Coordinate transformation q=${q}→${transformedQ}, r=${r}→${transformedR}`);
                  hex = await tx.hex.findFirst({
                    where: { q: transformedQ, r: transformedR, gameStateId: currentGameState.id }
                  });
                  if (hex) {
                    strategyUsed = "Coordinate transformation";
                    console.log(`✅ WINNER! Strategy 2 worked: Coordinate transformation`);
                  }
                }

                if (!hex) {
                  // Strategy 3: Try different transformation
                  const altQ = q - 91; // Try different offset
                  const altR = r - 44;
                  console.log(`🔍 Strategy 3: Alternative transformation q=${q}→${altQ}, r=${r}→${altR}`);
                  hex = await tx.hex.findFirst({
                    where: { q: altQ, r: altR, gameStateId: currentGameState.id }
                  });
                  if (hex) {
                    strategyUsed = "Alternative transformation";
                    console.log(`✅ WINNER! Strategy 3 worked: Alternative transformation`);
                  }
                }

                if (hex) {
                  console.log(`🎉 SUCCESS: Found hex using ${strategyUsed} for ${hexCoord}`);
                } else {
                  console.log(`❌ FAILED: All strategies failed for ${hexCoord}`);
                }

                if (hex) {
                  const garrison = garrisonData as any;
                  await tx.garrison.create({
                    data: {
                      hexQ: q,
                      hexR: r,
                      troops: garrison.troops || 0,
                      weapons: garrison.weapons || 0,
                      chiefs: garrison.chiefs || [],
                      tribeId: tribe.id,
                      hexId: hex.id
                    }
                  });
                  console.log(`✅ Created garrison for ${tribe.tribeName} at ${hexCoord}: ${garrison.troops} troops, ${garrison.weapons} weapons`);
                  garrisonCount++;
                  totalGarrisons++;
                } else {
                  console.log(`❌ Hex not found for coordinates q=${q}, r=${r} (${hexCoord})`);
                }
              } catch (garrisonError) {
                console.log(`❌ Error creating garrison for ${tribe.tribeName} at ${hexCoord}:`, garrisonError);
              }
            }

            console.log(`🏰 Created ${garrisonCount} garrisons for ${tribe.tribeName}`);
          } else {
            console.log(`⚠️ No garrison data found for ${tribe.tribeName}`);
          }
        }

        console.log(`🏰 Total garrisons created: ${totalGarrisons}`);

        // Create diplomatic relations for all tribes
        console.log(`🤝 Creating diplomatic relations...`);
        let totalDiplomaticRelations = 0;

        for (const tribe of gameState.tribes) {
          // Skip tribes that weren't created (missing users)
          if (!existingUserIds.has(tribe.playerId)) {
            continue;
          }

          if (tribe.diplomacy) {
            console.log(`🤝 Processing diplomatic relations for ${tribe.tribeName}...`);
            console.log(`🔍 Diplomacy data:`, Object.keys(tribe.diplomacy));

            for (const [targetTribeId, relationship] of Object.entries(tribe.diplomacy)) {
              try {
                // Check if target tribe exists
                const targetTribe = await tx.tribe.findUnique({ where: { id: targetTribeId } });
                if (!targetTribe) {
                  console.log(`⚠️ Skipping diplomatic relation - target tribe not found: ${targetTribeId}`);
                  continue;
                }

                // Check if relation already exists (to avoid duplicates)
                const existingRelation = await tx.diplomaticRelation.findFirst({
                  where: {
                    OR: [
                      { fromTribeId: tribe.id, toTribeId: targetTribeId },
                      { fromTribeId: targetTribeId, toTribeId: tribe.id }
                    ]
                  }
                });

                if (!existingRelation) {
                  await tx.diplomaticRelation.create({
                    data: {
                      fromTribeId: tribe.id,
                      toTribeId: targetTribeId,
                      status: (relationship as any).status || 'Neutral'
                    }
                  });
                  console.log(`✅ Created diplomatic relation: ${tribe.tribeName} → ${targetTribe.tribeName}: ${(relationship as any).status}`);
                  totalDiplomaticRelations++;
                }
              } catch (error) {
                console.log(`❌ Error creating diplomatic relation for ${tribe.tribeName}:`, error);
              }
            }
          }
        }

        console.log(`🤝 Total diplomatic relations created: ${totalDiplomaticRelations}`);

        // Restore chief requests (only for existing tribes)
        if (gameState.chiefRequests && gameState.chiefRequests.length > 0) {
          console.log(`📋 Creating ${gameState.chiefRequests.length} chief requests...`);
          let createdRequests = 0;
          let skippedRequests = 0;

          for (const request of gameState.chiefRequests) {
            try {
              // Check if tribe exists
              const tribeExists = await tx.tribe.findUnique({ where: { id: request.tribeId } });
              if (!tribeExists) {
                console.log(`⚠️ Skipping chief request for non-existent tribe: ${request.tribeId}`);
                skippedRequests++;
                continue;
              }

              await tx.chiefRequest.create({
                data: {
                  id: request.id,
                  tribeId: request.tribeId,
                  chiefName: request.chiefName,
                  radixAddressSnippet: request.radixAddressSnippet,
                  status: request.status || 'pending',
                  gameStateId: currentGameState.id
                }
              });
              createdRequests++;
            } catch (error) {
              console.log(`❌ Error creating chief request ${request.id}:`, error);
              skippedRequests++;
            }
          }
          console.log(`✅ Created ${createdRequests} chief requests, skipped ${skippedRequests}`);
        }

        // Restore asset requests (only for existing tribes)
        if (gameState.assetRequests && gameState.assetRequests.length > 0) {
          console.log(`🎨 Creating ${gameState.assetRequests.length} asset requests...`);
          let createdRequests = 0;
          let skippedRequests = 0;

          for (const request of gameState.assetRequests) {
            try {
              // Check if tribe exists
              const tribeExists = await tx.tribe.findUnique({ where: { id: request.tribeId } });
              if (!tribeExists) {
                console.log(`⚠️ Skipping asset request for non-existent tribe: ${request.tribeId}`);
                skippedRequests++;
                continue;
              }

              await tx.assetRequest.create({
                data: {
                  id: request.id,
                  tribeId: request.tribeId,
                  assetName: request.assetName,
                  radixAddressSnippet: request.radixAddressSnippet,
                  status: request.status || 'pending',
                  gameStateId: currentGameState.id
                }
              });
              createdRequests++;
            } catch (error) {
              console.log(`❌ Error creating asset request ${request.id}:`, error);
              skippedRequests++;
            }
          }
          console.log(`✅ Created ${createdRequests} asset requests, skipped ${skippedRequests}`);
        }

        // Restore journeys
        if (gameState.journeys && gameState.journeys.length > 0) {
          console.log(`🚶 Creating ${gameState.journeys.length} journeys...`);
          for (const journey of gameState.journeys) {
            await tx.journey.create({
              data: {
                id: journey.id,
                ownerTribeId: journey.ownerTribeId,
                type: journey.type,
                origin: journey.origin || '',
                destination: journey.destination || '',
                path: journey.path as any || [],
                currentLocation: journey.currentLocation || journey.origin || '',
                force: journey.force as any || {},
                payload: journey.payload as any || {},
                arrivalTurn: journey.arrivalTurn || 0,
                responseDeadline: journey.responseDeadline || null,
                scavengeType: journey.scavengeType || null,
                tradeOffer: journey.tradeOffer as any || null,
                status: journey.status || 'en_route',
                gameStateId: currentGameState.id
              }
            });
          }
        }

        // Restore diplomatic proposals
        if (gameState.diplomaticProposals && gameState.diplomaticProposals.length > 0) {
          console.log(`🤝 Creating ${gameState.diplomaticProposals.length} diplomatic proposals...`);
          for (const proposal of gameState.diplomaticProposals) {
            await tx.diplomaticProposal.create({
              data: {
                id: proposal.id,
                fromTribeId: proposal.fromTribeId,
                toTribeId: proposal.toTribeId,
                statusChangeTo: proposal.statusChangeTo,
                expiresOnTurn: proposal.expiresOnTurn || gameState.turn + 1,
                fromTribeName: proposal.fromTribeName || 'Unknown',
                reparations: proposal.reparations as any,
                gameStateId: currentGameState.id
              }
            });
          }
        }

        // Restore turn history
        if (gameState.history && gameState.history.length > 0) {
          console.log(`📚 Creating ${gameState.history.length} turn history records...`);
          for (const historyRecord of gameState.history) {
            await tx.turnHistory.create({
              data: {
                turn: historyRecord.turn,
                tribeRecords: (historyRecord.tribeRecords || historyRecord) as any,
                gameStateId: currentGameState.id
              }
            });
          }
        }

        console.log('🎯 Complete game state restoration completed successfully');
      }, {
        timeout: 60000 // 60 second timeout for backup loading
      });
    } catch (error) {
      console.error(' Error updating game state in database:', error);
      throw error;
    }
  }
}

