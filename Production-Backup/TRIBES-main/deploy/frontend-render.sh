#!/bin/bash

# Frontend deployment script for Render.com
# This script should be used as the build command for the frontend static site

set -e

echo "Starting frontend build process..."

# Install shared dependencies and build
echo "Building shared package..."
cd shared
npm install --only=production
npm run build
cd ..

# Install frontend dependencies
echo "Installing frontend dependencies..."
cd frontend
npm install --only=production

# Build frontend
echo "Building frontend..."
npm run build

echo "Frontend build completed successfully!"
echo "Static files are in ./frontend/dist"
