#!/bin/bash

# Frontend build script for Render.com
set -e

echo "🔧 Building Radix Tribes Test Frontend..."

# Build shared package first
echo "📦 Building shared package..."
cd shared
npm install
npm run build
cd ..

# Build frontend
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build

echo "✅ Frontend build completed successfully!"
echo "📁 Built files are in frontend/dist/"
ls -la frontend/dist/ || echo "⚠️ dist directory not found"

# Frontend build script for Render.com
set -e

echo "🔧 Building Radix Tribes Test Frontend..."

# Build shared package first
echo "📦 Building shared package..."
cd shared
npm install
npm run build
cd ..

# Build frontend
echo "🎨 Building frontend..."
cd frontend
npm install
npm run build

echo "✅ Frontend build completed successfully!"
echo "📁 Built files are in frontend/dist/"
ls -la frontend/dist/ || echo "⚠️ dist directory not found"
