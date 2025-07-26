#!/bin/bash

# Backend deployment script for Render.com
# This script should be used as the build command for the backend service

set -e

echo "Starting backend build process..."

# Install shared dependencies and build
echo "Building shared package..."
cd shared
npm install --only=production
npm run build
cd ..

# Install backend dependencies
echo "Installing backend dependencies..."
cd backend
npm install --only=production

# Generate Prisma client
echo "Generating Prisma client..."
npx prisma generate

# Build backend
echo "Building backend..."
npm run build

echo "Backend build completed successfully!"

# The start command should be:
# cd backend && npx prisma migrate deploy && npm start
