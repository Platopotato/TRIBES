# Backend Environment Variables for Render.com

When setting up the backend service on Render.com, configure these environment variables:

## Required Environment Variables

### NODE_ENV
- **Value**: `production`
- **Description**: Sets the Node.js environment

### PORT
- **Value**: `10000` (Render's default)
- **Description**: Port the server will listen on

### DATABASE_URL
- **Value**: Use Render's database connection string
- **Description**: PostgreSQL connection string
- **Format**: `postgresql://username:password@host:port/database`

### FRONTEND_URL
- **Value**: `https://your-frontend-service.onrender.com`
- **Description**: URL of the frontend service for CORS configuration

## Optional Environment Variables

### DATA_DIR
- **Value**: `./data`
- **Description**: Directory for file-based fallback storage

## Database Setup

1. Create a PostgreSQL database service on Render
2. Copy the internal connection string to DATABASE_URL
3. The backend will automatically run migrations on startup

## Build Command
```bash
cd shared && npm install --only=production && npm run build && cd ../backend && npm install --only=production && npm run build && npx prisma generate
```

## Start Command
```bash
cd backend && npx prisma migrate deploy && npm start
```
