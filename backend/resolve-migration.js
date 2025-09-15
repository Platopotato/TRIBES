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

    let needsResolve = false;

    if (failedMigration.length > 0) {
      console.log('❌ Found failed migration, resolving...');

      // Mark the failed migration as successfully applied
      await prisma.$executeRaw`
        UPDATE "_prisma_migrations"
        SET finished_at = NOW(),
            applied_steps_count = 1,
            logs = 'Migration resolved by migration resolver - column already exists'
        WHERE migration_name = '20250822_add_max_actions_override'
      `;

      console.log('✅ Failed migration marked as successfully applied');
      needsResolve = true;
    } else {
      console.log('✅ No failed migration found');
    }
    
    // Check if the maxActionsOverride column already exists
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
      console.log('✅ maxActionsOverride column added successfully');
    } else {
      console.log('✅ maxActionsOverride column already exists');
    }

    // Check if the originalStartingLocation column already exists
    const originalStartingLocationExists = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'tribes'
      AND column_name = 'originalStartingLocation'
    `;

    if (originalStartingLocationExists.length === 0) {
      console.log('🔧 Adding originalStartingLocation column...');
      await prisma.$executeRaw`
        ALTER TABLE "tribes" ADD COLUMN "originalStartingLocation" TEXT
      `;
      console.log('✅ originalStartingLocation column added successfully');
    } else {
      console.log('✅ originalStartingLocation column already exists');
    }

    // Check if the autoDeadlineSettings column already exists
    const autoDeadlineSettingsExists = await prisma.$queryRaw`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'game_states'
      AND column_name = 'autoDeadlineSettings'
    `;

    if (autoDeadlineSettingsExists.length === 0) {
      console.log('🔧 Adding autoDeadlineSettings column...');
      await prisma.$executeRaw`
        ALTER TABLE "game_states" ADD COLUMN "autoDeadlineSettings" JSON
      `;
      console.log('✅ autoDeadlineSettings column added successfully');
    } else {
      console.log('✅ autoDeadlineSettings column already exists');
    }
    
    // Only run Prisma resolve if we actually fixed a failed migration
    if (needsResolve) {
      console.log('🔄 Resolving migration with Prisma...');

      const resolveProcess = spawn('npx', ['prisma', 'migrate', 'resolve', '--applied', '20250822_add_max_actions_override'], {
        stdio: 'inherit',
        cwd: process.cwd()
      });

      // Wait for resolve to complete
      await new Promise((resolve, reject) => {
        resolveProcess.on('close', (code) => {
          if (code === 0) {
            console.log('✅ Migration resolved successfully');
            resolve();
          } else {
            console.error('❌ Migration resolve failed');
            reject(new Error(`Migration resolve failed with code ${code}`));
          }
        });
      });
    } else {
      console.log('✅ Migration already properly applied, skipping resolve');
    }

    // Now run pending migrations
    console.log('🔄 Running pending migrations...');

    const migrateProcess = spawn('npx', ['prisma', 'migrate', 'deploy'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Wait for migration to complete
    await new Promise((resolve, reject) => {
      migrateProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ All migrations applied successfully');
          resolve();
        } else {
          console.error('❌ Migration deployment failed');
          reject(new Error(`Migration failed with code ${code}`));
        }
      });
    });

    // Step 7: Migrate file data to database
    console.log('🔄 Migrating file data to database...');

    const fileDataMigrationProcess = spawn('node', ['scripts/migrate-file-data-to-database.js', '--force'], {
      stdio: 'inherit',
      cwd: process.cwd()
    });

    // Wait for file data migration to complete
    await new Promise((resolve, reject) => {
      fileDataMigrationProcess.on('close', (code) => {
        if (code === 0) {
          console.log('✅ File data migration completed successfully');
          resolve();
        } else {
          console.warn('⚠️ File data migration failed, but continuing (non-critical)');
          resolve(); // Don't fail the whole process for this
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
