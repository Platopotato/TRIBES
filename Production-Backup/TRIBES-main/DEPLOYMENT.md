# Radix Tribes Deployment Guide

This guide covers deploying Radix Tribes to various platforms including local Docker and Render.com.

## Project Structure

The project is now organized as a monorepo with three main packages:

- `shared/` - Shared types, constants, and utilities
- `backend/` - Node.js/Express server with Socket.IO and Prisma
- `frontend/` - React/Vite client application

## Local Development with Docker

### Prerequisites
- Docker and Docker Compose installed
- Git repository cloned

### Development Setup
```bash
# Start all services in development mode
docker-compose -f docker-compose.dev.yml up --build

# Or start individual services
docker-compose -f docker-compose.dev.yml up postgres
docker-compose -f docker-compose.dev.yml up backend
docker-compose -f docker-compose.dev.yml up frontend
```

### Production Setup
```bash
# Start all services in production mode
docker-compose up --build
```

### Services
- **Frontend**: http://localhost:5173 (dev) or http://localhost:80 (prod)
- **Backend**: http://localhost:3000
- **Database**: PostgreSQL on localhost:5432

## Render.com Deployment

### Option 1: Blueprint Deployment (Recommended)

1. Fork this repository to your GitHub account
2. Connect your GitHub account to Render.com
3. Create a new Blueprint deployment
4. Use the `render.yaml` file in the repository root
5. Render will automatically create all services and the database

### Option 2: Manual Service Creation

#### Step 1: Create PostgreSQL Database
1. Go to Render Dashboard → New → PostgreSQL
2. Name: `radix-tribes-postgres`
3. Database Name: `radix_tribes`
4. User: `postgres`
5. Plan: Free
6. Copy the internal connection string for later use

#### Step 2: Create Backend Service
1. Go to Render Dashboard → New → Web Service
2. Connect your GitHub repository
3. Configure:
   - **Name**: `radix-tribes-backend`
   - **Environment**: Node
   - **Build Command**:
     ```bash
     cd shared && npm install --only=production && npm run build && cd ../backend && npm install --only=production && npm run build && npx prisma generate
     ```
   - **Start Command**: 
     ```bash
     cd backend && npx prisma migrate deploy && npm start
     ```
   - **Plan**: Free

4. Set Environment Variables:
   - `NODE_ENV`: `production`
   - `PORT`: `10000`
   - `DATABASE_URL`: (paste the PostgreSQL connection string)
   - `FRONTEND_URL`: `https://radix-tribes-frontend.onrender.com` (update with your actual frontend URL)

#### Step 3: Create Frontend Service
1. Go to Render Dashboard → New → Static Site
2. Connect your GitHub repository
3. Configure:
   - **Name**: `radix-tribes-frontend`
   - **Build Command**:
     ```bash
     cd shared && npm install --only=production && npm run build && cd ../frontend && npm install --only=production && npm run build
     ```
   - **Publish Directory**: `./frontend/dist`

4. Set Environment Variables:
   - `VITE_API_URL`: `https://radix-tribes-backend.onrender.com` (update with your actual backend URL)

### Environment Variables Reference

See the files in the `deploy/` directory for detailed environment variable configurations:
- `deploy/render-env-backend.md` - Backend environment variables
- `deploy/render-env-frontend.md` - Frontend environment variables

## Database Migrations

The backend automatically runs Prisma migrations on startup. For manual migration management:

```bash
# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate deploy

# Reset database (development only)
npx prisma migrate reset
```

## Troubleshooting

### Common Issues

1. **Build Failures**: Ensure all dependencies are properly installed and the shared package builds first
2. **Database Connection**: Verify the DATABASE_URL is correctly formatted and accessible
3. **CORS Issues**: Ensure FRONTEND_URL in backend matches the actual frontend URL
4. **Socket.IO Connection**: Verify VITE_API_URL in frontend points to the correct backend

### Logs

- **Render.com**: Check service logs in the Render dashboard
- **Docker**: Use `docker-compose logs [service-name]` to view logs

### Health Checks

- Backend health check: `GET /health`
- Frontend: Should serve the React application

## Scaling Considerations

For production use beyond the free tier:

1. **Database**: Upgrade to a paid PostgreSQL plan for better performance
2. **Backend**: Use a paid plan for faster builds and no sleep mode
3. **Frontend**: Consider using a CDN for better global performance
4. **Monitoring**: Add application monitoring and error tracking

## Security Notes

1. Change default passwords and secrets
2. Use environment variables for all sensitive configuration
3. Enable HTTPS (automatic on Render.com)
4. Consider rate limiting for the API endpoints
5. Implement proper authentication and authorization
