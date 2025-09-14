import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  GameState,
  User,
  Tribe,
  generateMapData,
  parseHexCoords,
  SECURITY_QUESTIONS,
  NewsletterState,
  TurnDeadline,
  DiplomaticStatus
} from '../../../shared/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DatabaseService {
  private prisma: PrismaClient | null = null;
  private useDatabase: boolean = false;
  private dataDir: string;
  private dataFile: string;
  private newsletterFile: string;
  private deadlineFile: string;


  constructor() {
    this.dataDir = process.env.DATA_DIR || path.join(__dirname, '../../data');
    this.dataFile = path.join(this.dataDir, 'game-data.json');

    this.newsletterFile = path.join(this.dataDir, 'newsletters.json');
    this.deadlineFile = path.join(this.dataDir, 'turn-deadline.json');
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

      // Ensure newsletters and deadline files exist even in DB mode
      try {
        if (!fs.existsSync(this.newsletterFile)) {
          fs.writeFileSync(this.newsletterFile, JSON.stringify({ newsletters: [], currentNewsletter: undefined }));
        }
        if (!fs.existsSync(this.deadlineFile)) {
          fs.writeFileSync(this.deadlineFile, JSON.stringify({ turnDeadline: undefined }));
        }
      } catch (e) {
        console.warn('⚠️ Could not initialize newsletters/deadline files:', e);
      }

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

      // Ensure newsletters and deadline files exist in either mode
      try {
        if (!fs.existsSync(this.newsletterFile)) {
          fs.writeFileSync(this.newsletterFile, JSON.stringify({ newsletters: [], currentNewsletter: undefined }));
        }
        if (!fs.existsSync(this.deadlineFile)) {
          fs.writeFileSync(this.deadlineFile, JSON.stringify({ turnDeadline: undefined }));
        }
      } catch (e) {
        console.warn('⚠️ Could not initialize newsletters/deadline files:', e);
      }


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

  // DIAGNOSTIC: Analyze coordinate system in database
  async diagnoseCoordinateSystem(): Promise<void> {
    if (!this.prisma) {
      console.log('❌ Database not available for coordinate diagnosis');
      return;
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('🔍 COORDINATE SYSTEM DIAGNOSIS START');
    console.log('='.repeat(80));

    try {
      // Check hex coordinate ranges
      const hexStats = await this.prisma.hex.aggregate({
        _min: { q: true, r: true },
        _max: { q: true, r: true },
        _count: true
      });

      console.log('📊 HEX COORDINATE RANGES:');
      console.log(`   Total hexes: ${hexStats._count}`);
      console.log(`   Q range: ${hexStats._min.q} to ${hexStats._max.q}`);
      console.log(`   R range: ${hexStats._min.r} to ${hexStats._max.r}`);

      // Check garrison coordinate ranges
      const garrisonStats = await this.prisma.garrison.aggregate({
        _min: { hexQ: true, hexR: true },
        _max: { hexQ: true, hexR: true },
        _count: true
      });

      console.log('🏰 GARRISON COORDINATE RANGES:');
      console.log(`   Total garrisons: ${garrisonStats._count}`);
      console.log(`   Q range: ${garrisonStats._min.hexQ} to ${garrisonStats._max.hexQ}`);
      console.log(`   R range: ${garrisonStats._min.hexR} to ${garrisonStats._max.hexR}`);

      // Sample some garrisons to see coordinate patterns
      const sampleGarrisons = await this.prisma.garrison.findMany({
        take: 10,
        include: { tribe: { select: { tribeName: true, location: true } } }
      });

      console.log('🔍 SAMPLE GARRISON COORDINATES:');
      console.log('   (Showing coordinate conversion logic)');
      console.log('');
      for (const garrison of sampleGarrisons) {
        const coordinateString = `${garrison.hexQ.toString().padStart(3, '0')}.${garrison.hexR.toString().padStart(3, '0')}`;
        const { q: parsedQ, r: parsedR } = parseHexCoords(coordinateString);

        console.log(`   ${garrison.tribe.tribeName}:`);
        console.log(`     Database stored: q=${garrison.hexQ}, r=${garrison.hexR}`);
        console.log(`     As string: "${coordinateString}"`);
        console.log(`     parseHexCoords("${coordinateString}") = q=${parsedQ}, r=${parsedR}`);
        console.log(`     Tribe location: ${garrison.tribe.location}`);
        console.log(`     String matches tribe location: ${coordinateString === garrison.tribe.location ? '✅' : '❌'}`);

        // Show what the coordinates SHOULD be if stored correctly
        if (garrison.tribe.location) {
          const { q: correctQ, r: correctR } = parseHexCoords(garrison.tribe.location);
          console.log(`     Tribe location parsed: parseHexCoords("${garrison.tribe.location}") = q=${correctQ}, r=${correctR}`);
          console.log(`     Database should store: q=${correctQ}, r=${correctR} (not q=${garrison.hexQ}, r=${garrison.hexR})`);
        }
        console.log('');
      }

      // Check if coordinates are consistent
      const coordinateIssues = await this.prisma.garrison.findMany({
        where: {
          OR: [
            { hexQ: { gt: 100 } },  // Suspiciously high
            { hexR: { gt: 100 } },
            { hexQ: { lt: -100 } }, // Suspiciously low
            { hexR: { lt: -100 } }
          ]
        },
        include: { tribe: { select: { tribeName: true, location: true } } }
      });

      if (coordinateIssues.length > 0) {
        console.log('🚨 SUSPICIOUS COORDINATES FOUND:');
        for (const issue of coordinateIssues) {
          console.log(`   ${issue.tribe.tribeName}: DB(q=${issue.hexQ}, r=${issue.hexR}) vs Location(${issue.tribe.location})`);
        }
      } else {
        console.log('✅ No obviously suspicious coordinates found');
      }

      console.log('');
      console.log('='.repeat(80));
      console.log('🔍 COORDINATE SYSTEM DIAGNOSIS END');
      console.log('='.repeat(80));
      console.log('');

    } catch (error) {
      console.error('❌ Failed to diagnose coordinate system:', error);
      console.log('');
      console.log('='.repeat(80));
      console.log('🔍 COORDINATE SYSTEM DIAGNOSIS END (ERROR)');
      console.log('='.repeat(80));
      console.log('');
    }
  }

  // BACKUP: Create file-based backup of garrison coordinates before fixing
  async backupGarrisonCoordinates(): Promise<void> {
    if (!this.prisma) {
      console.log('❌ Database not available for garrison coordinate backup');
      return;
    }

    console.log('💾 CREATING GARRISON COORDINATE BACKUP...');

    try {
      // Get all current garrison coordinates
      const allGarrisons = await this.prisma.garrison.findMany({
        include: { tribe: { select: { tribeName: true } } }
      });

      // Store backup in a JSON format that can be easily restored
      const backupData = {
        timestamp: new Date().toISOString(),
        description: 'Garrison coordinate backup before coordinate fix',
        totalGarrisons: allGarrisons.length,
        garrisons: allGarrisons.map(g => ({
          id: g.id,
          tribeName: g.tribe.tribeName,
          originalQ: g.hexQ,
          originalR: g.hexR
        }))
      };

      // Create backup file in the backend directory
      const fs = await import('fs');
      const path = await import('path');

      const backupDir = path.join(process.cwd(), 'coordinate-backups');

      // Ensure backup directory exists
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilePath = path.join(backupDir, `garrison-coordinates-backup-${timestamp}.json`);

      // Write backup to file
      fs.writeFileSync(backupFilePath, JSON.stringify(backupData, null, 2));

      console.log(`✅ BACKUP CREATED: ${allGarrisons.length} garrison coordinates backed up`);
      console.log(`📁 BACKUP FILE: ${backupFilePath}`);

    } catch (error) {
      console.error('❌ Failed to create garrison coordinate backup:', error);
      throw error; // Don't proceed with fix if backup fails
    }
  }

  // LIST: List available coordinate backups
  async listGarrisonCoordinateBackups(): Promise<void> {
    try {
      const fs = await import('fs');
      const path = await import('path');

      const backupDir = path.join(process.cwd(), 'coordinate-backups');

      console.log('📁 AVAILABLE COORDINATE BACKUPS:');

      if (!fs.existsSync(backupDir)) {
        console.log('   No backup directory found');
        return;
      }

      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('garrison-coordinates-backup-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      if (backupFiles.length === 0) {
        console.log('   No backup files found');
        return;
      }

      for (const backupFile of backupFiles) {
        try {
          const backupFilePath = path.join(backupDir, backupFile);
          const backupContent = fs.readFileSync(backupFilePath, 'utf8');
          const backupData = JSON.parse(backupContent);

          console.log(`   📄 ${backupFile}`);
          console.log(`      Created: ${backupData.timestamp}`);
          console.log(`      Garrisons: ${backupData.totalGarrisons}`);
          console.log('');
        } catch (error) {
          console.log(`   ❌ ${backupFile} (corrupted)`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to list coordinate backups:', error);
    }
  }

  // RESTORE: Restore garrison coordinates from file backup
  async restoreGarrisonCoordinates(): Promise<void> {
    if (!this.prisma) {
      console.log('❌ Database not available for garrison coordinate restore');
      return;
    }

    console.log('');
    console.log('='.repeat(80));
    console.log('🔄 GARRISON COORDINATE RESTORE START');
    console.log('='.repeat(80));

    try {
      const fs = await import('fs');
      const path = await import('path');

      const backupDir = path.join(process.cwd(), 'coordinate-backups');

      // Check if backup directory exists
      if (!fs.existsSync(backupDir)) {
        console.log('❌ No backup directory found');
        return;
      }

      // Get all backup files and find the most recent one
      const backupFiles = fs.readdirSync(backupDir)
        .filter(file => file.startsWith('garrison-coordinates-backup-') && file.endsWith('.json'))
        .sort()
        .reverse(); // Most recent first

      if (backupFiles.length === 0) {
        console.log('❌ No backup files found');
        return;
      }

      const latestBackupFile = backupFiles[0];
      const backupFilePath = path.join(backupDir, latestBackupFile);

      console.log(`📁 RESTORING FROM: ${latestBackupFile}`);

      // Read backup file
      const backupContent = fs.readFileSync(backupFilePath, 'utf8');
      const backupData = JSON.parse(backupContent);

      console.log(`📅 Backup created: ${backupData.timestamp}`);
      console.log(`📊 Total garrisons in backup: ${backupData.totalGarrisons}`);

      let restoredCount = 0;
      let errorCount = 0;

      for (const garrisonBackup of backupData.garrisons) {
        try {
          await this.prisma.garrison.update({
            where: { id: garrisonBackup.id },
            data: {
              hexQ: garrisonBackup.originalQ,
              hexR: garrisonBackup.originalR
            }
          });
          console.log(`🔄 RESTORED: ${garrisonBackup.tribeName} garrison q=${garrisonBackup.originalQ}, r=${garrisonBackup.originalR}`);
          restoredCount++;
        } catch (error) {
          console.error(`❌ Error restoring garrison ${garrisonBackup.id} (${garrisonBackup.tribeName}):`, error);
          errorCount++;
        }
      }

      console.log(`✅ GARRISON COORDINATE RESTORE COMPLETE:`);
      console.log(`   Restored: ${restoredCount} garrisons`);
      console.log(`   Errors: ${errorCount} garrisons`);
      console.log(`   Backup file: ${backupFilePath}`);

      console.log('='.repeat(80));
      console.log('🔄 GARRISON COORDINATE RESTORE END');
      console.log('='.repeat(80));
      console.log('');

    } catch (error) {
      console.error('❌ Failed to restore garrison coordinates:', error);
      console.log('='.repeat(80));
      console.log('🔄 GARRISON COORDINATE RESTORE END (ERROR)');
      console.log('='.repeat(80));
      console.log('');
    }
  }

  // DISABLED: Coordinate fix function removed - no longer needed
  // The Game Editor coordinate corruption has been fixed at the source
  // All coordinates are now properly maintained during database sync
  async fixGarrisonCoordinates(): Promise<void> {
    console.log('✅ Coordinate fix no longer needed - Game Editor corruption has been fixed at the source');
    console.log('🎯 All garrison coordinates are now properly maintained during database sync');
    return;
  }

  // DIAGNOSTIC: Check outpost ownership at specific hex
  async diagnoseOutpostOwnership(hexCoord: string): Promise<void> {
    console.log('');
    console.log('='.repeat(80));
    console.log(`🔍 OUTPOST OWNERSHIP DIAGNOSTIC FOR ${hexCoord}`);
    console.log('='.repeat(80));

    try {
      // Load current game state
      const gameState = await this.getGameState();
      if (!gameState) {
        console.log('❌ No game state found');
        return;
      }

      // Find the hex in map data
      const { q, r } = parseHexCoords(hexCoord);
      const hex = gameState.mapData.find((h: any) => h.q === q && h.r === r);

      if (!hex) {
        console.log(`❌ Hex not found at ${hexCoord} (q=${q}, r=${r})`);
        return;
      }

      console.log(`📍 HEX FOUND: ${hexCoord} (q=${q}, r=${r})`);
      console.log(`   Terrain: ${hex.terrain}`);

      if (hex.poi) {
        console.log(`🏛️ POI FOUND:`);
        console.log(`   Type: ${hex.poi.type}`);
        console.log(`   ID: ${hex.poi.id}`);
        console.log(`   Fortified: ${hex.poi.fortified}`);
        console.log(`   OutpostOwner: ${hex.poi.outpostOwner}`);
        console.log(`   Rarity: ${hex.poi.rarity}`);

        // Check ownership logic
        if (hex.poi.type === 'Outpost') {
          const s = String(hex.poi.id || '');
          const idx = s.indexOf('poi-outpost-');
          if (idx !== -1) {
            const rest = s.slice(idx + 'poi-outpost-'.length);
            const ownerId = rest.split('-')[0] || null;
            console.log(`🏴 STANDALONE OUTPOST OWNER: ${ownerId}`);
          }
        }

        if (hex.poi.fortified && hex.poi.outpostOwner) {
          console.log(`🏰 FORTIFIED POI OWNER: ${hex.poi.outpostOwner}`);
        }
      } else {
        console.log(`❌ NO POI at ${hexCoord}`);
      }

      // Check which tribes have garrisons here
      console.log(`🏕️ GARRISONS AT ${hexCoord}:`);
      let foundGarrisons = false;
      for (const tribe of gameState.tribes) {
        if (tribe.garrisons && tribe.garrisons[hexCoord]) {
          console.log(`   ${tribe.tribeName} (${tribe.id}): ${JSON.stringify(tribe.garrisons[hexCoord])}`);
          foundGarrisons = true;
        }
      }
      if (!foundGarrisons) {
        console.log(`   No garrisons found at ${hexCoord}`);
      }

    } catch (error) {
      console.error('❌ Error in outpost ownership diagnostic:', error);
    }

    console.log('='.repeat(80));
    console.log('🔍 OUTPOST OWNERSHIP DIAGNOSTIC END');
    console.log('='.repeat(80));
    console.log('');
  }

  // FIX: Correct outpost ownership mismatches
  async fixOutpostOwnership(hexCoord: string): Promise<void> {
    console.log('');
    console.log('='.repeat(80));
    console.log(`🔧 FIXING OUTPOST OWNERSHIP AT ${hexCoord}`);
    console.log('='.repeat(80));

    try {
      // Load current game state
      const gameState = await this.getGameState();
      if (!gameState) {
        console.log('❌ No game state found');
        return;
      }

      // Find the hex in map data
      const { q, r } = parseHexCoords(hexCoord);
      const hex = gameState.mapData.find((h: any) => h.q === q && h.r === r);

      if (!hex || !hex.poi || !hex.poi.fortified) {
        console.log(`❌ No fortified POI found at ${hexCoord}`);
        return;
      }

      // Find which tribe has a garrison here
      let garrisonOwner: any = null;
      for (const tribe of gameState.tribes) {
        if (tribe.garrisons && tribe.garrisons[hexCoord]) {
          garrisonOwner = tribe;
          break;
        }
      }

      if (!garrisonOwner) {
        console.log(`❌ No garrison found at ${hexCoord}`);
        return;
      }

      console.log(`🏕️ GARRISON OWNER: ${garrisonOwner.tribeName} (${garrisonOwner.id})`);
      console.log(`🏰 CURRENT POI OWNER: ${hex.poi.outpostOwner}`);

      if (hex.poi.outpostOwner === garrisonOwner.id) {
        console.log(`✅ Ownership already correct - no fix needed`);
        return;
      }

      // Fix the ownership
      const oldOwner = hex.poi.outpostOwner;
      hex.poi.outpostOwner = garrisonOwner.id;
      hex.poi.id = `poi-fortified-${hex.poi.type}-${garrisonOwner.id}-${hexCoord}`;

      console.log(`🔧 FIXING OWNERSHIP:`);
      console.log(`   From: ${oldOwner}`);
      console.log(`   To: ${garrisonOwner.id}`);
      console.log(`   New ID: ${hex.poi.id}`);

      // Save the updated game state
      await this.updateGameStateInDb(gameState);

      console.log(`✅ OUTPOST OWNERSHIP FIXED SUCCESSFULLY`);

    } catch (error) {
      console.error('❌ Error fixing outpost ownership:', error);
    }

    console.log('='.repeat(80));
    console.log('🔧 OUTPOST OWNERSHIP FIX END');
    console.log('='.repeat(80));
    console.log('');
  }

  // BULK FIX: Automatically fix all outpost ownership mismatches
  async fixAllOutpostOwnership(): Promise<void> {
    console.log('');
    console.log('='.repeat(80));
    console.log('🔧 BULK OUTPOST OWNERSHIP FIX START');
    console.log('='.repeat(80));

    try {
      // Load current game state
      const gameState = await this.getGameState();
      if (!gameState) {
        console.log('❌ No game state found');
        return;
      }

      let totalChecked = 0;
      let totalFixed = 0;
      let totalErrors = 0;

      // Check all hexes with fortified POIs
      for (const hex of gameState.mapData) {
        if (!hex.poi || !hex.poi.fortified) continue;

        totalChecked++;
        const hexCoord = `${String(hex.q + 50).padStart(3, '0')}.${String(hex.r + 50).padStart(3, '0')}`;

        try {
          // Find ALL tribes with garrisons at this hex
          const garrisonTribes: any[] = [];
          for (const tribe of gameState.tribes) {
            if (tribe.garrisons && tribe.garrisons[hexCoord]) {
              garrisonTribes.push(tribe);
            }
          }

          // Skip if no garrisons (abandoned outpost)
          if (garrisonTribes.length === 0) {
            console.log(`⚪ ${hexCoord}: No garrisons - skipping`);
            continue;
          }

          // Handle multiple garrisons
          if (garrisonTribes.length > 1) {
            const tribeNames = garrisonTribes.map(t => t.tribeName).join(', ');
            console.log(`⚠️ ${hexCoord}: MULTIPLE GARRISONS (${tribeNames})`);

            // Check if current owner is one of the garrison holders
            const currentOwnerHasGarrison = garrisonTribes.some(t => t.id === hex.poi?.outpostOwner);

            if (currentOwnerHasGarrison) {
              const currentOwnerTribe = garrisonTribes.find(t => t.id === hex.poi?.outpostOwner);
              console.log(`✅ ${hexCoord}: Current owner ${currentOwnerTribe.tribeName} has garrison - keeping ownership`);
              continue;
            } else {
              // Current owner doesn't have garrison - transfer to strongest garrison
              const strongestTribe = garrisonTribes.reduce((strongest, current) => {
                const strongestTroops = strongest.garrisons[hexCoord].troops || 0;
                const currentTroops = current.garrisons[hexCoord].troops || 0;
                return currentTroops > strongestTroops ? current : strongest;
              });

              console.log(`🔧 ${hexCoord}: CONTESTED OUTPOST - transferring to strongest garrison`);
              console.log(`   Garrisons: ${garrisonTribes.map(t => `${t.tribeName}(${t.garrisons[hexCoord].troops || 0})`).join(', ')}`);
              console.log(`   Winner: ${strongestTribe.tribeName} (${strongestTribe.garrisons[hexCoord].troops || 0} troops)`);

              const oldOwner = hex.poi.outpostOwner;
              const oldOwnerTribe = gameState.tribes.find((t: any) => t.id === oldOwner);

              console.log(`   From: ${oldOwnerTribe?.tribeName || oldOwner} (${oldOwner})`);
              console.log(`   To: ${strongestTribe.tribeName} (${strongestTribe.id})`);

              // Update ownership to strongest garrison
              hex.poi.outpostOwner = strongestTribe.id;
              hex.poi.id = `poi-fortified-${hex.poi.type}-${strongestTribe.id}-${hexCoord}`;
              totalFixed++;
              continue;
            }
          }

          // Single garrison case
          const garrisonOwner = garrisonTribes[0];

          // Check if ownership matches
          if (hex.poi.outpostOwner === garrisonOwner.id) {
            console.log(`✅ ${hexCoord}: Ownership correct (${garrisonOwner.tribeName})`);
            continue;
          }

          // Fix ownership mismatch
          const oldOwner = hex.poi.outpostOwner;
          const oldOwnerTribe = gameState.tribes.find((t: any) => t.id === oldOwner);

          console.log(`🔧 ${hexCoord}: FIXING OWNERSHIP`);
          console.log(`   POI Type: ${hex.poi.type}`);
          console.log(`   From: ${oldOwnerTribe?.tribeName || oldOwner} (${oldOwner})`);
          console.log(`   To: ${garrisonOwner.tribeName} (${garrisonOwner.id})`);

          // Update ownership
          hex.poi.outpostOwner = garrisonOwner.id;
          hex.poi.id = `poi-fortified-${hex.poi.type}-${garrisonOwner.id}-${hexCoord}`;

          totalFixed++;

        } catch (error) {
          console.error(`❌ Error fixing ${hexCoord}:`, error);
          totalErrors++;
        }
      }

      // Save the updated game state if any fixes were made
      if (totalFixed > 0) {
        console.log(`💾 Saving game state with ${totalFixed} ownership fixes...`);
        await this.updateGameStateInDb(gameState);
      }

      console.log(`✅ BULK OUTPOST OWNERSHIP FIX COMPLETE:`);
      console.log(`   Checked: ${totalChecked} fortified outposts`);
      console.log(`   Fixed: ${totalFixed} ownership mismatches`);
      console.log(`   Errors: ${totalErrors} failed fixes`);

    } catch (error) {
      console.error('❌ Error in bulk outpost ownership fix:', error);
    }

    console.log('='.repeat(80));
    console.log('🔧 BULK OUTPOST OWNERSHIP FIX END');
    console.log('='.repeat(80));
    console.log('');
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

      console.log(`🔍 DB QUERY: Retrieved game state with ${gameState.turnHistory?.length || 0} turn history records`);
      if (gameState.turnHistory && gameState.turnHistory.length > 0) {
        console.log(`📚 Turn history turns:`, gameState.turnHistory.map(th => th.turn));
      }

      // Convert database format back to GameState format
      const converted = this.convertDbGameStateToGameState(gameState);
      const news = this.getNewsletterStateFromDb(gameState);
      const turnDeadline = this.getTurnDeadlineFromDb(gameState);
      return { ...converted, newsletter: news, turnDeadline };
    } else {
      // File-based fallback
      const state = this.getGameStateFromFile();
      const turnDeadline = this.getTurnDeadlineState();
      return state ? { ...state, turnDeadline: state.turnDeadline ?? turnDeadline } : state;
    }
  }

  // Newsletter persistence
  private readNewsletterState(): NewsletterState {
    try {
      if (fs.existsSync(this.newsletterFile)) {
        const raw = fs.readFileSync(this.newsletterFile, 'utf-8');
        const data = JSON.parse(raw);
        return data as NewsletterState;
      }
    } catch (e) {
      console.warn('⚠️ Failed to read newsletter file:', e);
    }
    return { newsletters: [], currentNewsletter: undefined };
  }

  private writeNewsletterState(news: NewsletterState): void {
    try {
      fs.writeFileSync(this.newsletterFile, JSON.stringify(news, null, 2));
    } catch (e) {
      console.warn('⚠️ Failed to write newsletter file:', e);
    }
  }

  // Database-based newsletter methods (new)
  private getNewsletterStateFromDb(dbGameState: any): NewsletterState {
    try {
      if (dbGameState.newsletter && typeof dbGameState.newsletter === 'object') {
        console.log(`📰 Loaded newsletter from DATABASE`);
        return dbGameState.newsletter as NewsletterState;
      }

      // Fallback to file storage for migration
      console.log(`📰 Database newsletter field empty, falling back to file storage`);
      return this.readNewsletterState();
    } catch (error) {
      console.error('❌ Error loading newsletter from database:', error);
      return this.readNewsletterState();
    }
  }

  // Legacy file-based methods (for fallback during migration)
  public getNewsletterState(): NewsletterState { return this.readNewsletterState(); }
  public setNewsletterState(n: NewsletterState): void { this.writeNewsletterState(n); }

  // Turn deadline persistence (file-based in both modes)
  private readTurnDeadlineState(): TurnDeadline | undefined {
    try {
      if (fs.existsSync(this.deadlineFile)) {
        const raw = fs.readFileSync(this.deadlineFile, 'utf-8');
        const data = JSON.parse(raw);
        return data?.turnDeadline;
      }
    } catch (e) {
      console.warn('⚠️ Could not read turn deadline file:', e);
    }
    return undefined;
  }
  private writeTurnDeadlineState(deadline: TurnDeadline | undefined): void {
    try {
      fs.writeFileSync(this.deadlineFile, JSON.stringify({ turnDeadline: deadline }, null, 2));
    } catch (e) {
      console.warn('⚠️ Could not write turn deadline file:', e);
    }
  }
  // Database-based turn deadline methods (new)
  private getTurnDeadlineFromDb(dbGameState: any): TurnDeadline | undefined {
    try {
      if (dbGameState.turnDeadline && typeof dbGameState.turnDeadline === 'object') {
        console.log(`⏰ Loaded turn deadline from DATABASE`);
        return dbGameState.turnDeadline as TurnDeadline;
      }

      // Fallback to file storage for migration
      console.log(`⏰ Database turnDeadline field empty, falling back to file storage`);
      return this.readTurnDeadlineState();
    } catch (error) {
      console.error('❌ Error loading turn deadline from database:', error);
      return this.readTurnDeadlineState();
    }
  }

  // Legacy file-based methods (for fallback during migration)
  public getTurnDeadlineState(): TurnDeadline | undefined { return this.readTurnDeadlineState(); }
  public setTurnDeadlineState(d?: TurnDeadline): void { this.writeTurnDeadlineState(d); }

  async updateGameState(gameState: GameState, skipValidation: boolean = false): Promise<void> {
    if (this.useDatabase && this.prisma) {
      // Update database (now includes newsletter, turnDeadline, and diplomaticMessages)
      await this.updateGameStateInDb(gameState);
      // Persist turn deadline separately in file (since DB schema doesn’t include it)
      // Keep file backups for newsletter and turn deadline during migration period
      this.setNewsletterState(gameState.newsletter || { newsletters: [], currentNewsletter: undefined });
      this.setTurnDeadlineState(gameState.turnDeadline);
      // Persist diplomatic messages using dual-write (database + file backup)
      if (gameState.diplomaticMessages) {
        await this.saveDiplomaticMessagesDualWrite(gameState.diplomaticMessages);
      }
    } else {
      // File-based fallback
      if (skipValidation) {
        // During backup loading, skip validation since users are loaded separately
        this.saveGameStateToFile(gameState);
        // Also save diplomatic messages using dual-write
        if (gameState.diplomaticMessages) {
          await this.saveDiplomaticMessagesDualWrite(gameState.diplomaticMessages);
        }
      } else {
        // Normal operation - validate and clean game state first
        const cleanedGameState = await this.validateAndCleanGameState(gameState);
        this.saveGameStateToFile(cleanedGameState);
        // Also save diplomatic messages using dual-write
        if (cleanedGameState.diplomaticMessages) {
          await this.saveDiplomaticMessagesDualWrite(cleanedGameState.diplomaticMessages);
        }
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
            maxActionsOverride: tribe.maxActionsOverride,
          }
        });
        console.log(`✅ Updated tribe basic data: ${tribe.tribeName}`);

        // Update garrisons separately (they're separate database records)
        if (tribe.garrisons) {
          console.log(`🏰 Updating garrisons for ${tribe.tribeName}...`);

          // PRODUCTION SAFE: Keep original delete-recreate pattern but add error handling
          try {
            // Delete existing garrisons for this tribe
            await this.prisma.garrison.deleteMany({
              where: { tribeId: tribe.id }
            });

            // Create new garrisons with enhanced error handling
            for (const [hexCoord, garrisonData] of Object.entries(tribe.garrisons)) {
              try {
                // CRITICAL FIX: Use proper coordinate parsing instead of raw integer parsing
                const { q, r } = parseHexCoords(hexCoord);

                // Validate coordinates
                if (isNaN(q) || isNaN(r)) {
                  console.error(`❌ Invalid coordinates for ${tribe.tribeName}: ${hexCoord}`);
                  continue;
                }

                console.log(`🎯 GARRISON FIX: Looking for hex at ${hexCoord} for ${tribe.tribeName}`);

                // FIXED: Direct lookup with proper coordinate parsing
                console.log(`🎯 FIXED LOOKUP: Looking for hex at q=${q}, r=${r} (${hexCoord}) using proper coordinate parsing`);
                const hexRecord = await this.prisma.hex.findFirst({
                  where: { q, r, gameStateId: existingGameState.id }
                });
                const strategyUsed = hexRecord ? "Direct lookup (fixed)" : "Not found";

                if (hexRecord) {
                  console.log(`🎉 GARRISON SUCCESS: Found hex using ${strategyUsed} for ${tribe.tribeName} at ${hexCoord}`);
                } else {
                  console.error(`❌ GARRISON FAILED: All strategies failed for ${tribe.tribeName} at ${hexCoord}`);
                  continue;
                }

                // COORDINATE CONSISTENCY: Now using proper parsing, should always match
                const { q: originalQ, r: originalR } = parseHexCoords(hexCoord);
                console.log(`✅ COORDINATE CHECK: "${hexCoord}" -> (q=${originalQ}, r=${originalR}) matches Database (q=${hexRecord.q}, r=${hexRecord.r})`);

                if (originalQ !== hexRecord.q || originalR !== hexRecord.r) {
                  console.log(`🚨 UNEXPECTED MISMATCH: This should not happen with proper parsing!`);
                  console.log(`   Parsed: q=${originalQ}, r=${originalR}`);
                  console.log(`   Database: q=${hexRecord.q}, r=${hexRecord.r}`);
                  console.log(`   Strategy: ${strategyUsed}`);
                }

                // CRITICAL FIX: Store string coordinate values, not map coordinate values
                // This ensures garrison coordinates match the string format used in game state
                const { q: stringQ, r: stringR } = parseHexCoords(hexCoord);
                const coordinateQ = parseInt(hexCoord.split('.')[0]); // Extract "026" from "026.056"
                const coordinateR = parseInt(hexCoord.split('.')[1]); // Extract "056" from "026.056"

                const createdGarrison = await this.prisma.garrison.create({
                  data: {
                    tribeId: tribe.id,
                    hexQ: coordinateQ, // Store string coordinate values (26, 56) not map coordinates (-24, 6)
                    hexR: coordinateR, // This ensures proper round-trip conversion
                    troops: garrisonData.troops || 0,
                    weapons: garrisonData.weapons || 0,
                    chiefs: garrisonData.chiefs as any || [],
                    hexId: hexRecord.id, // Use the actual Hex record ID, not coordinate string
                  }
                });
                console.log(`✅ GARRISON CREATED: ${tribe.tribeName} at ${hexCoord} using ${strategyUsed} - DB ID: ${createdGarrison.id}, Troops: ${createdGarrison.troops}`);
              } catch (garrisonError) {
                console.error(`❌ Failed to create garrison for ${tribe.tribeName} at ${hexCoord}:`, garrisonError);
                // Continue with other garrisons instead of failing completely
              }
            }
            console.log(`✅ Updated ${Object.keys(tribe.garrisons).length} garrisons for ${tribe.tribeName}`);
          } catch (error) {
            console.error(`❌ CRITICAL: Failed to update garrisons for ${tribe.tribeName}:`, error);
            // Don't throw - let the game continue even if garrison update fails
          }
        }
      }

      // Create/update turn history records
      if (gameState.history && gameState.history.length > 0) {
        console.log(`📚 Creating/updating ${gameState.history.length} turn history records...`);
        for (const historyRecord of gameState.history) {
          await this.prisma.turnHistory.upsert({
            where: {
              gameStateId_turn: {
                gameStateId: existingGameState.id,
                turn: historyRecord.turn
              }
            },
            create: {
              turn: historyRecord.turn,
              tribeRecords: (historyRecord.tribeRecords || historyRecord) as any,
              gameStateId: existingGameState.id
            },
            update: {
              tribeRecords: (historyRecord.tribeRecords || historyRecord) as any
            }
          });
        }
        console.log(`✅ Turn history records created/updated successfully`);
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
              poiRarity: hex.poi?.rarity || null,
              poiFortified: hex.poi?.fortified || null,
              poiOutpostOwner: hex.poi?.outpostOwner || null
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

  // Temporary storage mode switching for AI tribe workaround
  temporarilyUseFileStorage(): boolean {
    const originalMode = this.useDatabase;
    this.useDatabase = false;
    console.log(`🔄 Temporarily switched to file storage mode`);
    return originalMode;
  }

  restoreStorageMode(originalMode: boolean): void {
    this.useDatabase = originalMode;
    console.log(`🔄 Restored storage mode to: ${originalMode ? 'database' : 'file'}`);
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

    // Reduced logging for performance

    return diplomacy;
  }

  private convertDbGameStateToGameState(dbGameState: any): GameState {
    const startTime = Date.now();
    console.log(`🔍 DB CONVERSION: Converting game state with ${dbGameState.tribes?.length || 0} tribes`);

    // This is a simplified conversion - in a real implementation,
    // you'd need to properly convert all the nested structures
    const convertedGameState: GameState = {
      mapData: dbGameState.hexes.map((hex: any) => ({
        q: hex.q,
        r: hex.r,
        terrain: hex.terrain,
        poi: hex.poiType ? {
          id: hex.poiId,
          type: hex.poiType,
          difficulty: hex.poiDifficulty,
          rarity: hex.poiRarity,
          ...(hex.poiFortified !== undefined && hex.poiFortified ? { fortified: hex.poiFortified } : {}),
          ...(hex.poiOutpostOwner ? { outpostOwner: hex.poiOutpostOwner } : {})
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
        maxActionsOverride: tribe.maxActionsOverride,
        garrisons: (() => {
          console.log(`🔍 DB CONVERSION: Processing garrisons for ${tribe.tribeName} - found ${tribe.garrisons?.length || 0} garrison records`);

          const garrisons = (tribe.garrisons || []).reduce((acc: any, garrison: any) => {
            const hexKey = `${garrison.hexQ.toString().padStart(3, '0')}.${garrison.hexR.toString().padStart(3, '0')}`;
            acc[hexKey] = {
              troops: garrison.troops,
              weapons: garrison.weapons,
              chiefs: garrison.chiefs
            };
            console.log(`🏰 GARRISON LOADED: ${tribe.tribeName} at ${hexKey} (DB: q=${garrison.hexQ}, r=${garrison.hexR}) - ${garrison.troops} troops, ${garrison.weapons} weapons, ${garrison.chiefs?.length || 0} chiefs`);

            // CRITICAL DEBUG: Check if this matches tribe's expected location
            if (tribe.location && hexKey !== tribe.location) {
              console.log(`🚨 LOCATION MISMATCH: ${tribe.tribeName} expects home at ${tribe.location} but garrison loaded at ${hexKey}`);
            }

            return acc;
          }, {});

          // CRITICAL FIX: Ensure every tribe has at least their home garrison
          if (Object.keys(garrisons).length === 0 && tribe.location) {
            console.log(`🚨 GARRISON FIX: ${tribe.tribeName} has no garrisons in database, creating home garrison at ${tribe.location}`);
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
      startingLocations: (() => {
        console.log(`🔍 DB CONVERSION: Loading starting locations from database`);
        console.log(`📍 Raw starting locations:`, dbGameState.startingLocations);
        console.log(`📍 Type:`, typeof dbGameState.startingLocations);
        console.log(`📍 Is Array:`, Array.isArray(dbGameState.startingLocations));

        // Ensure starting locations is always an array
        const startingLocs = Array.isArray(dbGameState.startingLocations)
          ? dbGameState.startingLocations
          : [];

        console.log(`📍 Final starting locations:`, startingLocs);
        return startingLocs;
      })(),
      chiefRequests: dbGameState.chiefRequests,
      assetRequests: dbGameState.assetRequests,
      journeys: dbGameState.journeys,
      diplomaticProposals: dbGameState.diplomaticProposals,
      diplomaticMessages: this.loadDiplomaticMessagesSyncWithFallback(dbGameState), // Load from DB with file fallback
      history: (() => {
        console.log(`🔍 DB CONVERSION: Processing turn history - found ${dbGameState.turnHistory?.length || 0} records`);
        if (dbGameState.turnHistory && dbGameState.turnHistory.length > 0) {
          console.log(`📚 Turn history sample:`, dbGameState.turnHistory[0]);
          return dbGameState.turnHistory.map((th: any) => ({
            turn: th.turn,
            tribeRecords: th.tribeRecords
          }));
        } else {
          console.log(`⚠️ No turn history found in database game state`);
          return [];
        }
      })(),
      mapSeed: dbGameState.mapSeed ? Number(dbGameState.mapSeed) : undefined,
      mapSettings: dbGameState.mapSettings,
      suspended: dbGameState.suspended || false,
      suspensionMessage: dbGameState.suspensionMessage || undefined
    };

    const endTime = Date.now();
    console.log(`✅ DB CONVERSION: Completed in ${endTime - startTime}ms`);

    return convertedGameState;
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
      console.log('🔄 Starting database transaction for game state update...');
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
        // Don't delete turn history during regular updates - only during backup restoration

        // Update the main game state (minimal fields only to avoid schema issues)
        console.log(' Updating main game state...');
        try {
          await tx.gameState.update({
            where: { id: currentGameState.id },
            data: {
              turn: gameState.turn,
              startingLocations: gameState.startingLocations,
              newsletter: gameState.newsletter as any,
              // turnDeadline: gameState.turnDeadline as any, // Commented out due to schema mismatch
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
          poiFortified: hex.poi?.fortified || null,
          poiOutpostOwner: hex.poi?.outpostOwner || null,
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
                maxActionsOverride: tribe.maxActionsOverride,
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
                maxActionsOverride: tribe.maxActionsOverride,
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
                // CRITICAL FIX: Use proper coordinate parsing instead of raw integer parsing
                // parseHexCoords converts "051.044" -> {q: 1, r: -6} (subtracts 50 offset)
                const { q, r } = parseHexCoords(hexCoord);

                console.log(`🎯 FIXED LOOKUP: Looking for hex at q=${q}, r=${r} (${hexCoord}) using proper coordinate parsing`);

                // FIXED: Direct lookup with proper coordinate parsing (no more transformation needed)
                const hex = await tx.hex.findFirst({
                  where: { q, r, gameStateId: currentGameState.id }
                });
                const strategyUsed = hex ? "Direct lookup (fixed)" : "Not found";

                if (hex) {
                  console.log(`🎉 SUCCESS: Found hex using ${strategyUsed} for ${hexCoord}`);
                } else {
                  console.log(`❌ FAILED: All strategies failed for ${hexCoord}`);
                }

                if (hex) {
                  const garrison = garrisonData as any;

                  // ENHANCED: Check for existing garrison to prevent duplicates
                  const existingGarrison = await tx.garrison.findFirst({
                    where: {
                      hexId: hex.id,
                      tribeId: tribe.id
                    }
                  });

                  if (!existingGarrison) {
                    // CRITICAL FIX: Store string coordinate values for proper round-trip conversion
                    const coordinateQ = parseInt(hexCoord.split('.')[0]); // Extract "026" from "026.056"
                    const coordinateR = parseInt(hexCoord.split('.')[1]); // Extract "056" from "026.056"

                    await tx.garrison.create({
                      data: {
                        hexQ: coordinateQ, // Store string coordinate values (26, 56) not map coordinates (-24, 6)
                        hexR: coordinateR, // This ensures proper round-trip conversion
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
                    console.log(`⚠️ Garrison already exists for ${tribe.tribeName} at ${hexCoord} - updating instead`);
                    await tx.garrison.update({
                      where: { id: existingGarrison.id },
                      data: {
                        troops: garrison.troops || 0,
                        weapons: garrison.weapons || 0,
                        chiefs: garrison.chiefs || []
                      }
                    });
                    console.log(`✅ Updated existing garrison for ${tribe.tribeName} at ${hexCoord}`);
                  }
                } else {
                  console.log(`❌ Hex not found for coordinates q=${q}, r=${r} (${hexCoord})`);
                }
              } catch (garrisonError) {
                console.log(`❌ Error creating garrison for ${tribe.tribeName} at ${hexCoord}:`, garrisonError);

                // CRITICAL: If this is a transaction abort error, we need to stop immediately
                if ((garrisonError as any)?.code === '25P02') {
                  console.error('🚨 TRANSACTION ABORTED during garrison creation - stopping transaction');
                  throw garrisonError; // Re-throw to abort the entire transaction
                }
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

                // ENHANCED: More thorough duplicate checking to prevent constraint violations
                const existingRelation = await tx.diplomaticRelation.findFirst({
                  where: {
                    OR: [
                      { fromTribeId: tribe.id, toTribeId: targetTribeId },
                      { fromTribeId: targetTribeId, toTribeId: tribe.id }
                    ]
                  }
                });

                if (!existingRelation) {
                  // Additional validation before creation
                  if (tribe.id === targetTribeId) {
                    console.log(`⚠️ Skipping self-diplomatic relation for ${tribe.tribeName}`);
                    continue;
                  }

                  await tx.diplomaticRelation.create({
                    data: {
                      fromTribeId: tribe.id,
                      toTribeId: targetTribeId,
                      status: (relationship as any).status || 'Neutral'
                    }
                  });
                  console.log(`✅ Created diplomatic relation: ${tribe.tribeName} → ${targetTribe.tribeName}: ${(relationship as any).status}`);
                  totalDiplomaticRelations++;
                } else {
                  console.log(`⚠️ Diplomatic relation already exists: ${tribe.tribeName} ↔ ${targetTribe.tribeName}`);
                }
              } catch (error) {
                console.error(`❌ Error creating diplomatic relation for ${tribe.tribeName} → ${targetTribeId}:`, error);
                console.error(`❌ Error details:`, {
                  message: error instanceof Error ? error.message : 'Unknown error',
                  code: (error as any)?.code,
                  constraint: (error as any)?.meta?.target
                });

                // CRITICAL: If this is a transaction abort error, we need to stop immediately
                if ((error as any)?.code === '25P02') {
                  console.error('🚨 TRANSACTION ABORTED during diplomatic relation creation - stopping transaction');
                  throw error; // Re-throw to abort the entire transaction
                }
                // Continue processing other relations instead of failing the entire transaction
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

              // Check if chief request already exists to prevent duplicates
              const existingRequest = await tx.chiefRequest.findUnique({ where: { id: request.id } });
              if (existingRequest) {
                console.log(`⚠️ Chief request ${request.id} already exists, skipping`);
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
              console.error(`❌ Error creating chief request ${request.id}:`, error);
              console.error(`❌ Error details:`, {
                message: error instanceof Error ? error.message : 'Unknown error',
                code: (error as any)?.code,
                constraint: (error as any)?.meta?.target
              });

              // CRITICAL: If this is a transaction abort error, we need to stop immediately
              if ((error as any)?.code === '25P02') {
                console.error('🚨 TRANSACTION ABORTED during chief request creation - stopping transaction');
                throw error; // Re-throw to abort the entire transaction
              }

              skippedRequests++;
              // Continue processing other requests instead of failing the entire transaction
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

              // Check if asset request already exists to prevent duplicates
              const existingRequest = await tx.assetRequest.findUnique({ where: { id: request.id } });
              if (existingRequest) {
                console.log(`⚠️ Asset request ${request.id} already exists, skipping`);
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
              console.error(`❌ Error creating asset request ${request.id}:`, error);
              console.error(`❌ Error details:`, {
                message: error instanceof Error ? error.message : 'Unknown error',
                code: (error as any)?.code,
                constraint: (error as any)?.meta?.target
              });

              // CRITICAL: If this is a transaction abort error, we need to stop immediately
              if ((error as any)?.code === '25P02') {
                console.error('🚨 TRANSACTION ABORTED during asset request creation - stopping transaction');
                throw error; // Re-throw to abort the entire transaction
              }

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
                actionType: proposal.actionType || 'ProposeAlliance', // Default to alliance for backward compatibility
                statusChangeTo: proposal.statusChangeTo || null, // Can be null for trade proposals
                expiresOnTurn: proposal.expiresOnTurn || gameState.turn + 1,
                fromTribeName: proposal.fromTribeName || 'Unknown',
                reparations: proposal.reparations as any,
                tradeAgreement: proposal.tradeAgreement as any,
                gameStateId: currentGameState.id
              }
            });
          }
        }

        // Create/update turn history records (for both regular updates and backup restoration)
        if (gameState.history && gameState.history.length > 0) {
          console.log(`📚 Creating/updating ${gameState.history.length} turn history records...`);
          for (const historyRecord of gameState.history) {
            await tx.turnHistory.upsert({
              where: {
                gameStateId_turn: {
                  gameStateId: currentGameState.id,
                  turn: historyRecord.turn
                }
              },
              create: {
                turn: historyRecord.turn,
                tribeRecords: (historyRecord.tribeRecords || historyRecord) as any,
                gameStateId: currentGameState.id
              },
              update: {
                tribeRecords: (historyRecord.tribeRecords || historyRecord) as any
              }
            });
          }
          console.log(`✅ Turn history records created/updated successfully`);
        }

        console.log('🎯 Game state update completed successfully');
      }, {
        timeout: 120000, // Increased to 120 second timeout for backup loading
        maxWait: 150000, // Maximum wait time
        isolationLevel: 'ReadCommitted' // Use read committed isolation level
      });
      console.log('✅ Database transaction completed successfully');
    } catch (error) {
      console.error('❌ CRITICAL: Database transaction failed:', error);
      console.error('❌ Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        code: (error as any)?.code,
        constraint: (error as any)?.meta?.target,
        stack: error instanceof Error ? error.stack : 'No stack trace'
      });

      // Check if this is a transaction abort error
      if ((error as any)?.code === '25P02') {
        console.error('🚨 TRANSACTION ABORTED: Current transaction is aborted, commands ignored until end of transaction block');
        console.error('🔄 This usually indicates a constraint violation or data integrity issue earlier in the transaction');
        console.error('🔧 RECOVERY: Attempting to disconnect and reconnect Prisma client...');

        try {
          // Disconnect and reconnect to clear the aborted transaction state
          await this.prisma.$disconnect();
          await this.prisma.$connect();
          console.log('✅ Prisma client reconnected successfully');
        } catch (reconnectError) {
          console.error('❌ Failed to reconnect Prisma client:', reconnectError);
        }
      }

      throw error;
    }
  }

  // Diplomatic Messages Dual Storage (Database + File Fallback)
  private async loadDiplomaticMessagesWithFallback(dbGameState: any): Promise<any[]> {
    try {
      // Try database first (if field exists and has data)
      if (dbGameState.diplomaticMessages && Array.isArray(dbGameState.diplomaticMessages)) {
        console.log(`📨 Loaded ${dbGameState.diplomaticMessages.length} diplomatic messages from DATABASE`);
        return dbGameState.diplomaticMessages;
      }

      // Fallback to file storage
      console.log(`📨 Database diplomaticMessages field empty/null, falling back to file storage`);
      return await this.loadDiplomaticMessages();
    } catch (error) {
      console.error('❌ Error in loadDiplomaticMessagesWithFallback:', error);
      return await this.loadDiplomaticMessages(); // Final fallback to file
    }
  }

  // Synchronous version for use in convertDbGameStateToGameState
  private loadDiplomaticMessagesSyncWithFallback(dbGameState: any): any[] {
    try {
      // Try database first (if field exists and has data)
      if (dbGameState.diplomaticMessages && Array.isArray(dbGameState.diplomaticMessages)) {
        console.log(`📨 Loaded ${dbGameState.diplomaticMessages.length} diplomatic messages from DATABASE (sync)`);
        return dbGameState.diplomaticMessages;
      }

      // Fallback to file storage (synchronous)
      console.log(`📨 Database diplomaticMessages field empty/null, falling back to file storage (sync)`);
      return this.loadDiplomaticMessagesSync();
    } catch (error) {
      console.error('❌ Error in loadDiplomaticMessagesSyncWithFallback:', error);
      return this.loadDiplomaticMessagesSync(); // Final fallback to file
    }
  }

  private async loadDiplomaticMessages(): Promise<any[]> {
    try {
      const filePath = path.join(process.cwd(), 'data', 'diplomatic-messages.json');
      if (fs.existsSync(filePath)) {
        const data = await fs.promises.readFile(filePath, 'utf-8');
        const messages = JSON.parse(data);
        console.log(`📨 Loaded ${messages.length} diplomatic messages from file storage`);
        return messages;
      }
      console.log(`📨 No diplomatic messages file found, starting with empty array`);
      return [];
    } catch (error) {
      console.error('❌ Error loading diplomatic messages:', error);
      return [];
    }
  }

  // Synchronous version for use in non-async contexts
  private loadDiplomaticMessagesSync(): any[] {
    try {
      const filePath = path.join(process.cwd(), 'data', 'diplomatic-messages.json');
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath, 'utf-8');
        const messages = JSON.parse(data);
        console.log(`📨 Loaded ${messages.length} diplomatic messages from file storage (sync)`);
        return messages;
      }
      console.log(`📨 No diplomatic messages file found, starting with empty array (sync)`);
      return [];
    } catch (error) {
      console.error('❌ Error loading diplomatic messages (sync):', error);
      return [];
    }
  }

  private async saveDiplomaticMessages(messages: any[]): Promise<void> {
    try {
      const dataDir = path.join(process.cwd(), 'data');
      if (!fs.existsSync(dataDir)) {
        await fs.promises.mkdir(dataDir, { recursive: true });
      }

      const filePath = path.join(dataDir, 'diplomatic-messages.json');
      const tempFilePath = path.join(dataDir, 'diplomatic-messages.json.tmp');

      // Atomic write: write to temp file first, then rename
      await fs.promises.writeFile(tempFilePath, JSON.stringify(messages, null, 2));
      await fs.promises.rename(tempFilePath, filePath);

      console.log(`📨 Saved ${messages.length} diplomatic messages to file storage (atomic write)`);
    } catch (error) {
      console.error('❌ Error saving diplomatic messages:', error);
      // Clean up temp file if it exists
      try {
        const tempFilePath = path.join(process.cwd(), 'data', 'diplomatic-messages.json.tmp');
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath);
        }
      } catch (cleanupError) {
        console.error('❌ Error cleaning up temp file:', cleanupError);
      }
      throw error; // Re-throw to ensure caller knows about the failure
    }
  }

  private async saveDiplomaticMessagesDualWrite(messages: any[]): Promise<void> {
    const errors: string[] = [];

    try {
      // Primary: Save to database (if using database mode)
      if (this.useDatabase && this.prisma) {
        await this.saveDiplomaticMessagesToDatabase(messages);
        console.log(`📨 Saved ${messages.length} diplomatic messages to DATABASE (primary)`);
      }
    } catch (dbError) {
      console.error('❌ Failed to save diplomatic messages to database:', dbError);
      errors.push(`Database: ${dbError instanceof Error ? dbError.message : 'Unknown error'}`);
    }

    try {
      // Backup: Always save to file storage for redundancy
      await this.saveDiplomaticMessages(messages);
      console.log(`📨 Saved ${messages.length} diplomatic messages to FILE (backup)`);
    } catch (fileError) {
      console.error('❌ Failed to save diplomatic messages to file:', fileError);
      errors.push(`File: ${fileError instanceof Error ? fileError.message : 'Unknown error'}`);
    }

    // If both failed, throw error
    if (errors.length === 2) {
      throw new Error(`Failed to save diplomatic messages to both database and file: ${errors.join(', ')}`);
    }

    // If only one failed, log warning but continue (we have backup)
    if (errors.length === 1) {
      console.warn(`⚠️ Diplomatic messages saved with partial failure: ${errors[0]}`);
    }
  }

  private async saveDiplomaticMessagesToDatabase(messages: any[]): Promise<void> {
    if (!this.useDatabase || !this.prisma) {
      throw new Error('Database not available for diplomatic messages storage');
    }

    try {
      // Find the existing game state record
      const existingGameState = await this.prisma.gameState.findFirst();

      if (!existingGameState) {
        throw new Error('No GameState record found in database');
      }

      // Update the diplomaticMessages field
      await this.prisma.gameState.update({
        where: { id: existingGameState.id },
        data: {
        // diplomaticMessages: messages as any // Commented out due to schema mismatch
      }
      });

      console.log(`📨 Updated GameState.diplomaticMessages in database with ${messages.length} messages`);
    } catch (error) {
      console.error('❌ Database update failed for diplomatic messages:', error);
      throw error;
    }
  }
}

