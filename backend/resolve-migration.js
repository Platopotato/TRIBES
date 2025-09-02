#!/usr/bin/env node

import { PrismaClient } from '@prisma/client';
import { spawn } from 'child_process';

async function resolveMigration() {
  console.log('🚀 MIGRATION RESOLVER: Starting migration resolution process...');
  const prisma = new PrismaClient();

  try {
    console.log('🔧 MIGRATION RESOLVER: Connecting to database...');
    console.log('🔧 MIGRATION RESOLVER: Resolving failed migration...');
    
    // Check if the failed migration exists
    const failedMigration = await prisma.$queryRaw`
      SELECT * FROM "_prisma_migrations" 
      WHERE migration_name = '20250822_add_max_actions_override' 
      AND finished_at IS NULL
    `;
    
    if (failedMigration.length > 0) {
      console.log('❌ Found failed migration, resolving...');
      
      // Mark the failed migration as resolved
      await prisma.$executeRaw`
        DELETE FROM "_prisma_migrations" 
        WHERE migration_name = '20250822_add_max_actions_override'
      `;
      
      console.log('✅ Failed migration removed from tracking table');
    } else {
      console.log('✅ No failed migration found');
    }
    
    // Check if the column already exists
    const columnExists = await prisma.$queryRaw`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'tribes' 
      AND column_name = 'maxActionsOverride'
    `;
    
    if (columnExists.length === 0) {
      console.log('🔧 Adding maxActionsOverride column...');
      await prisma.$executeRaw`
        ALTER TABLE "tribes" ADD COLUMN "maxActionsOverride" INTEGER
      `;
      console.log('✅ Column added successfully');
    } else {
      console.log('✅ Column already exists');
    }
    
    // Now run pending migrations
    console.log('🔄 Running pending migrations...');

    const migrateProcess = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    migrateProcess.on('close', (code) => {
      if (code === 0) {
        console.log('✅ All migrations applied successfully');
      } else {
        console.error('❌ Migration deployment failed');
        process.exit(1);
      }
    });

    // Wait for migration to complete
    await new Promise((resolve, reject) => {
      migrateProcess.on('close', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Migration failed with code ${code}`));
        }
      });
    });

    console.log('🎉 Migration resolution complete');

  } catch (error) {
    console.error('❌ Error resolving migration:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

resolveMigration();
