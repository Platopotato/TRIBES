#!/usr/bin/env node

/**
 * Safe Migration Script for Diplomatic Messages
 * 
 * This script safely migrates diplomatic messages from file storage to database
 * without breaking the existing system. It can be run multiple times safely.
 * 
 * Usage:
 *   node scripts/migrate-diplomatic-messages.js [--dry-run] [--force]
 * 
 * Options:
 *   --dry-run: Show what would be migrated without making changes
 *   --force: Skip confirmation prompts (for automated deployment)
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

  console.log('🔧 Diplomatic Messages Migration Script');
  console.log('=====================================');
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE MIGRATION'}`);
  console.log('');

  try {
    // Step 1: Check database connection
    console.log('1. Checking database connection...');
    await prisma.$connect();
    console.log('✅ Database connected successfully');

    // Step 2: Check if GameState table has diplomaticMessages column
    console.log('2. Checking database schema...');
    const gameState = await prisma.gameState.findFirst();
    if (!gameState) {
      console.log('❌ No GameState record found in database');
      process.exit(1);
    }
    console.log('✅ GameState table accessible');

    // Step 3: Check for existing diplomatic messages file
    console.log('3. Checking for diplomatic messages file...');
    const dataDir = path.join(__dirname, '../../data');
    const messagesFile = path.join(dataDir, 'diplomatic-messages.json');
    
    let fileMessages = [];
    if (fs.existsSync(messagesFile)) {
      try {
        const fileData = fs.readFileSync(messagesFile, 'utf-8');
        fileMessages = JSON.parse(fileData);
        console.log(`✅ Found ${fileMessages.length} messages in file storage`);
      } catch (error) {
        console.log(`⚠️ Error reading messages file: ${error.message}`);
      }
    } else {
      console.log('ℹ️ No diplomatic messages file found');
    }

    // Step 4: Check current database state
    console.log('4. Checking current database state...');
    const currentDbMessages = gameState.diplomaticMessages || [];
    console.log(`ℹ️ Database currently has ${Array.isArray(currentDbMessages) ? currentDbMessages.length : 0} messages`);

    // Step 5: Determine migration strategy
    console.log('5. Planning migration...');
    let migrationNeeded = false;
    let migrationPlan = '';

    if (fileMessages.length > 0 && currentDbMessages.length === 0) {
      migrationNeeded = true;
      migrationPlan = `Migrate ${fileMessages.length} messages from file to database`;
    } else if (fileMessages.length > 0 && currentDbMessages.length > 0) {
      migrationPlan = `Both file (${fileMessages.length}) and database (${currentDbMessages.length}) have messages - manual review needed`;
    } else if (fileMessages.length === 0 && currentDbMessages.length > 0) {
      migrationPlan = `Database already has ${currentDbMessages.length} messages - no migration needed`;
    } else {
      migrationPlan = 'No messages found in either location - no migration needed';
    }

    console.log(`📋 Migration plan: ${migrationPlan}`);

    if (!migrationNeeded) {
      console.log('✅ No migration required');
      return;
    }

    // Step 6: Confirm migration (unless force mode)
    if (!isDryRun && !isForce) {
      console.log('');
      console.log('⚠️ This will update the database with diplomatic messages from file storage.');
      console.log('Continue? (y/N)');
      
      // In a real script, you'd use readline here
      // For now, we'll assume --force is used in production
      console.log('❌ Interactive confirmation not available. Use --force flag for automated migration.');
      return;
    }

    // Step 7: Perform migration
    if (isDryRun) {
      console.log('');
      console.log('🔍 DRY RUN - Would perform the following actions:');
      console.log(`- Update GameState.diplomaticMessages with ${fileMessages.length} messages`);
      console.log('- Keep file backup intact');
      console.log('');
      console.log('Sample messages to migrate:');
      fileMessages.slice(0, 3).forEach((msg, i) => {
        console.log(`  ${i + 1}. ${msg.type} from ${msg.fromTribeName} to tribe ${msg.toTribeId}`);
      });
      if (fileMessages.length > 3) {
        console.log(`  ... and ${fileMessages.length - 3} more`);
      }
    } else {
      console.log('');
      console.log('🚀 Performing migration...');
      
      await prisma.gameState.update({
        where: { id: gameState.id },
        data: { diplomaticMessages: fileMessages }
      });
      
      console.log(`✅ Successfully migrated ${fileMessages.length} diplomatic messages to database`);
      console.log('ℹ️ File backup preserved for safety');
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
