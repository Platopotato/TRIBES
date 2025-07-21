import express from 'express';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

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
app.use((req, res, next) => {
  console.log(`📡 ${req.method} ${req.path} - ${req.ip}`);
  next();
});

// Root endpoint
app.get('/', (req, res) => {
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
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize services
const gameService = new GameService();
const authService = new AuthService();
const socketHandler = new SocketHandler(io, gameService, authService);

// Initialize game state
await gameService.initialize();

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await gameService.disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
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
server.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
