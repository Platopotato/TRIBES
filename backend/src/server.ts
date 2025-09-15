import express, { Request, Response, NextFunction } from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Migration resolution for production
async function resolveMigrationIssues() {
  console.log('🔧 SERVER STARTUP: Running migration resolution... (redeploy)');
  console.log('🔧 Environment:', process.env.NODE_ENV);

  try {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    console.log('🔧 SERVER STARTUP: Prisma client created successfully');

    // Test database connection first
    await prisma.$queryRaw`SELECT 1 as test`;
    console.log('✅ SERVER STARTUP: Database connection verified');

    // Check for failed migration and clean it up
    try {
      const failedMigration = await prisma.$queryRaw`
        SELECT * FROM "_prisma_migrations"
        WHERE migration_name = '20250822_add_max_actions_override'
        AND finished_at IS NULL
      `;

      if (Array.isArray(failedMigration) && failedMigration.length > 0) {
        console.log('❌ SERVER STARTUP: Found failed migration, removing...');

        // Remove failed migration
        await prisma.$executeRaw`
          DELETE FROM "_prisma_migrations"
          WHERE migration_name = '20250822_add_max_actions_override'
        `;

        console.log('✅ SERVER STARTUP: Failed migration removed');
      } else {
        console.log('✅ SERVER STARTUP: No failed migrations found');
      }
    } catch (migrationError: any) {
      console.log('⚠️ SERVER STARTUP: Could not check migration table:', migrationError?.message || migrationError);
    }

    // Add column if missing - this is critical for app functionality
    try {
      const columnExists = await prisma.$queryRaw`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = 'tribes'
        AND column_name = 'maxActionsOverride'
      `;

      if (!Array.isArray(columnExists) || columnExists.length === 0) {
        console.log('🔧 SERVER STARTUP: Adding maxActionsOverride column...');
        console.log('🔧 SERVER STARTUP: This is CRITICAL for app database writes!');

        await prisma.$executeRaw`
          ALTER TABLE "tribes" ADD COLUMN "maxActionsOverride" INTEGER
        `;

        console.log('✅ SERVER STARTUP: Column added successfully');
        console.log('✅ SERVER STARTUP: Database writes should now work correctly');
      } else {
        console.log('✅ SERVER STARTUP: Column already exists');
      }
    } catch (columnError: any) {
      console.error('❌ SERVER STARTUP: CRITICAL - Failed to add column:', columnError?.message || columnError);
      console.error('❌ SERVER STARTUP: App database writes may fail!');
    }

    // Final verification - test that we can query the column
    try {
      console.log('🔍 SERVER STARTUP: Verifying database schema...');
      const testQuery = await prisma.$queryRaw`
        SELECT "maxActionsOverride" FROM "tribes" LIMIT 1
      `;
      console.log('✅ SERVER STARTUP: Database schema verification successful');
    } catch (verifyError: any) {
      console.error('❌ SERVER STARTUP: Schema verification failed:', verifyError?.message || verifyError);
      console.error('❌ SERVER STARTUP: Database writes may still fail!');
    }

    await prisma.$disconnect();
    console.log('🎉 SERVER STARTUP: Migration resolution complete');
  } catch (error) {
    console.error('❌ SERVER STARTUP: Migration resolution failed:', error);
    console.error('❌ SERVER STARTUP: Error details:', error);
    // Don't exit - let the server try to start anyway
    console.log('⚠️ SERVER STARTUP: Continuing with server startup despite migration error...');
  }
}

// Import shared types and utilities
import {
  GameState,
  User,
  Tribe,
  GameAction,
  ChiefRequest,
  AssetRequest,
  DiplomaticProposal,
  generateMapData,
  processGlobalTurn,
  generateAITribe,
  generateAIActions,
  ALL_CHIEFS,
  getAsset,
  getHexesInRange,
  parseHexCoords,
  TRIBE_COLORS,
  SECURITY_QUESTIONS
} from '../../shared/dist/index.js';

// Import services
import { GameService } from './services/GameService.js';
import { AuthService } from './services/AuthService.js';
import { SocketHandler } from './services/SocketHandler.js';
import { AutoBackupService } from './services/AutoBackupService.js';
import { AnnouncementService } from './services/AnnouncementService.js';
import { TickerPriority } from '../../shared/dist/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- SERVER SETUP ---
const app = express();
const server = http.createServer(app);
const io = new SocketIOServer(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  console.log(`📡 ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Root endpoint
app.get('/', (req: Request, res: Response) => {
  res.json({
    message: 'Radix Tribes Backend API',
    status: 'running',
    timestamp: new Date().toISOString(),
    endpoints: {
      health: '/health',
      socketio: '/socket.io/'
    }
  });
});

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Login announcement endpoints (now database-based)
app.get('/api/login-announcement', async (req: Request, res: Response) => {
  try {
    const gameState = await gameService.getGameState();
    if (!gameState || !gameState.loginAnnouncements || !gameState.loginAnnouncements.isEnabled) {
      res.json({ announcement: null });
      return;
    }

    // Find the most recent active announcement
    const activeAnnouncements = gameState.loginAnnouncements.announcements
      .filter(a => a.isActive)
      .sort((a, b) => b.createdAt - a.createdAt);

    if (activeAnnouncements.length === 0) {
      res.json({ announcement: null });
      return;
    }

    // Convert to old format for compatibility
    const announcement = activeAnnouncements[0];
    const legacyFormat = {
      enabled: true,
      title: announcement.title,
      message: announcement.message,
      type: announcement.priority === 'urgent' ? 'error' :
            announcement.priority === 'important' ? 'warning' : 'info',
      lastUpdated: new Date(announcement.createdAt).toISOString()
    };

    res.json({ announcement: legacyFormat });
  } catch (error) {
    console.error('❌ Error fetching login announcement:', error);
    res.json({ announcement: null });
  }
});

app.post('/api/login-announcement', async (req: Request, res: Response) => {
  try {
    const { enabled, title, message, type } = req.body;
    const gameState = await gameService.getGameState();

    if (!gameState) {
      res.status(500).json({ success: false, message: 'Game state not found' });
      return;
    }

    // Initialize login announcements if not present
    if (!gameState.loginAnnouncements) {
      gameState.loginAnnouncements = { announcements: [], isEnabled: true };
    }

    // Update enabled state
    gameState.loginAnnouncements.isEnabled = enabled ?? true;

    if (enabled && title && message) {
      // Deactivate all existing announcements
      gameState.loginAnnouncements.announcements.forEach(a => a.isActive = false);

      // Add new announcement
      const newAnnouncement = {
        id: `announcement-${Date.now()}`,
        title: title.trim(),
        message: message.trim(),
        priority: (type === 'error' ? 'urgent' :
                  type === 'warning' ? 'important' : 'normal') as TickerPriority,
        isActive: true,
        createdAt: Date.now()
      };

      gameState.loginAnnouncements.announcements.push(newAnnouncement);
    }

    await gameService.updateGameState(gameState);
    res.json({ success: true, message: 'Announcement updated successfully' });
  } catch (error) {
    console.error('❌ Error updating login announcement:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});

// Initialize services
const gameService = new GameService();
const authService = new AuthService();
const autoBackupService = new AutoBackupService(gameService.database, 30, 48); // 30 min intervals, keep 48 backups
const socketHandler = new SocketHandler(io, gameService, authService, autoBackupService);

// Initialize game state
await gameService.initialize();

// Start auto-backup service
autoBackupService.start();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  autoBackupService.stop();
  await gameService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  autoBackupService.stop();
  await gameService.disconnect();
  process.exit(0);
});

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`🔌 Socket.IO User connected: ${socket.id}`);
  socketHandler.handleConnection(socket);

  socket.on('disconnect', (reason) => {
    console.log(`🔌 Socket.IO User disconnected: ${socket.id}, reason: ${reason}`);
  });
});

// --- START SERVER ---
const PORT = process.env.PORT || 3000;

// Resolve migration issues before starting server
resolveMigrationIssues().then(() => {
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
}).catch((error) => {
  console.error('❌ Failed to resolve migrations, starting server anyway:', error);
  server.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
    console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  });
});
