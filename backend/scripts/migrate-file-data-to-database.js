#!/usr/bin/env node

/**
 * Data Migration Script: File Storage to Database
 * 
 * Migrates newsletter, turn deadline, and login announcements from file storage to database
 * 
 * Usage:
 *   node scripts/migrate-file-data-to-database.js [--dry-run] [--force]
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

async function main() {
  const args = process.argv.slice(2);
  const isDryRun = args.includes('--dry-run');
  const isForce = args.includes('--force');

  console.log('🔄 File Data to Database Migration Script');
  console.log('=========================================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
  console.log('');

  try {
    // Step 1: Check database connection
    console.log('1. Checking database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Step 2: Get current game state
    console.log('2. Getting current game state...');
    const gameState = await prisma.gameState.findFirst();
    if (!gameState) {
      console.log('❌ No GameState record found in database');
      process.exit(1);
    }
    console.log('✅ GameState record found');

    // Step 3: Check for existing file data
    console.log('3. Checking for existing file data...');
    const dataDir = path.join(__dirname, '../../data');
    
    // Newsletter data
    let newsletterData = null;
    const newsletterFile = path.join(dataDir, 'newsletters.json');
    if (fs.existsSync(newsletterFile)) {
      try {
        const fileData = fs.readFileSync(newsletterFile, 'utf-8');
        newsletterData = JSON.parse(fileData);
        console.log(`📰 Found newsletter data: ${newsletterData.newsletters?.length || 0} newsletters`);
      } catch (error) {
        console.log(`⚠️ Error reading newsletter file: ${error.message}`);
      }
    } else {
      console.log('📰 No newsletter file found');
    }

    // Turn deadline data
    let turnDeadlineData = null;
    const deadlineFile = path.join(dataDir, 'turn-deadline.json');
    if (fs.existsSync(deadlineFile)) {
      try {
        const fileData = fs.readFileSync(deadlineFile, 'utf-8');
        const data = JSON.parse(fileData);
        turnDeadlineData = data.turnDeadline;
        console.log(`⏰ Found turn deadline data: ${turnDeadlineData ? 'Yes' : 'No'}`);
      } catch (error) {
        console.log(`⚠️ Error reading turn deadline file: ${error.message}`);
      }
    } else {
      console.log('⏰ No turn deadline file found');
    }

    // Login announcement data (old system)
    let loginAnnouncementData = null;
    const announcementFile = path.join(dataDir, 'login-announcement.json');
    if (fs.existsSync(announcementFile)) {
      try {
        const fileData = fs.readFileSync(announcementFile, 'utf-8');
        loginAnnouncementData = JSON.parse(fileData);
        console.log(`📢 Found login announcement data: ${loginAnnouncementData.enabled ? 'Enabled' : 'Disabled'}`);
      } catch (error) {
        console.log(`⚠️ Error reading login announcement file: ${error.message}`);
      }
    } else {
      console.log('📢 No login announcement file found');
    }

    // Step 4: Check current database state
    console.log('4. Checking current database state...');
    const hasNewsletterInDb = gameState.newsletter && Object.keys(gameState.newsletter).length > 0;
    const hasTurnDeadlineInDb = gameState.turnDeadline && Object.keys(gameState.turnDeadline).length > 0;
    
    console.log(`📰 Database newsletter: ${hasNewsletterInDb ? 'Has data' : 'Empty/null'}`);
    console.log(`⏰ Database turn deadline: ${hasTurnDeadlineInDb ? 'Has data' : 'Empty/null'}`);

    // Step 5: Determine what needs migration
    console.log('5. Planning migration...');
    const migrations = [];
    
    if (newsletterData && !hasNewsletterInDb) {
      migrations.push(`Newsletter: ${newsletterData.newsletters?.length || 0} newsletters`);
    }
    
    if (turnDeadlineData && !hasTurnDeadlineInDb) {
      migrations.push(`Turn deadline: ${JSON.stringify(turnDeadlineData)}`);
    }

    if (migrations.length === 0) {
      console.log('✅ No migration needed - database already has data or no file data found');
      return;
    }

    console.log(`📋 Will migrate: ${migrations.join(', ')}`);

    // Step 6: Perform migration
    if (isDryRun) {
      console.log('');
      console.log('🔍 DRY RUN - Would perform the following actions:');
      migrations.forEach((migration, i) => {
        console.log(`  ${i + 1}. Migrate ${migration}`);
      });
    } else {
      console.log('');
      console.log('🚀 Performing migration...');
      
      const updateData = {};
      
      if (newsletterData && !hasNewsletterInDb) {
        updateData.newsletter = newsletterData;
        console.log(`📰 Migrating newsletter data...`);
      }
      
      if (turnDeadlineData && !hasTurnDeadlineInDb) {
        updateData.turnDeadline = turnDeadlineData;
        console.log(`⏰ Migrating turn deadline data...`);
      }
      
      if (Object.keys(updateData).length > 0) {
        await prisma.gameState.update({
          where: { id: gameState.id },
          data: updateData
        });
        
        console.log(`✅ Successfully migrated ${Object.keys(updateData).length} data types to database`);
        console.log('ℹ️ File backups preserved for safety');
      }
    }

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error('❌ Unexpected error:', error);
  process.exit(1);
});
