# Radix Tribes - Multiplayer Strategy Game

A fully containerized multiplayer strategy game built with React, Node.js, Socket.IO, and PostgreSQL. Players manage tribes in a post-apocalyptic world, making strategic decisions about resources, technology, and diplomacy.

## 🚀 Features

- **Real-time Multiplayer**: Socket.IO-powered real-time gameplay
- **Persistent Game State**: PostgreSQL database with Prisma ORM
- **Containerized Architecture**: Docker support for easy deployment
- **Cloud-Ready**: Configured for Render.com deployment
- **Modular Design**: Separated frontend, backend, and shared code

## 🏗️ Architecture

```
radix-tribes/
├── frontend/          # React + Vite client
├── backend/           # Node.js + Express + Socket.IO server
├── shared/            # Shared types, constants, and utilities
├── deploy/            # Deployment scripts and configurations
└── docker-compose.yml # Container orchestration
```

### Technology Stack

- **Frontend**: React 18, TypeScript, Vite, TailwindCSS
- **Backend**: Node.js, Express, Socket.IO, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Containerization**: Docker & Docker Compose
- **Deployment**: Render.com ready

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Docker and Docker Compose (for containerized development)
- Git

### Local Development (Docker - Recommended)

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd radix-tribes
   ```

2. **Start development environment**
   ```bash
   npm run docker:dev
   ```

3. **Access the application**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:3000
   - Database: PostgreSQL on localhost:5432

### Local Development (Manual)

1. **Install dependencies**
   ```bash
   npm run install:all
   ```

2. **Set up environment variables**
   ```bash
   cp backend/.env backend/.env.local
   # Edit backend/.env.local with your database configuration
   ```

3. **Start PostgreSQL** (using Docker)
   ```bash
   docker run --name postgres -e POSTGRES_PASSWORD=postgres -e POSTGRES_DB=radix_tribes -p 5432:5432 -d postgres:15
   ```

4. **Run database migrations**
   ```bash
   npm run db:migrate
   ```

5. **Start development servers**
   ```bash
   npm run dev
   ```

## 🎮 How to Play

1. **Create an Account**: Register with a username and security question
2. **Create a Tribe**: Choose your tribe's name, icon, color, and stats
3. **Manage Resources**: Balance food, scrap, and morale
4. **Explore the World**: Send expeditions to discover new territories
5. **Research Technology**: Unlock new capabilities and advantages
6. **Diplomacy**: Form alliances or declare war with other tribes
7. **Survive and Thrive**: Make strategic decisions to ensure your tribe's survival

For detailed deployment instructions, see [DEPLOYMENT.md](./DEPLOYMENT.md).
