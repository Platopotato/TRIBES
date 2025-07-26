# Backend Dockerfile
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY backend/package*.json ./backend/
COPY shared/package*.json ./shared/

# Install dependencies
RUN cd backend && npm install --only=production
RUN cd shared && npm install --only=production

# Copy source code
COPY shared/ ./shared/
COPY backend/ ./backend/

# Build shared package
RUN cd shared && npm run build

# Build backend
RUN cd backend && npm run build

# Generate Prisma client
RUN cd backend && npx prisma generate

# Expose port
EXPOSE 3000

# Set working directory to backend
WORKDIR /app/backend

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start the application
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
