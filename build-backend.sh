#!/bin/bash

# Backend build script for Render.com
set -e

echo "🔧 Building Radix Tribes Test Backend..."
echo "📍 Current directory: $(pwd)"
echo "📂 Directory contents:"
ls -la

# Build shared package first
echo "📦 Building shared package..."
cd shared
npm install
npm run build
cd ..

# Build backend
echo "🚀 Building backend..."
cd backend
npm install
npm run build

echo "✅ Backend build completed successfully!"
echo "📁 Built files are in backend/dist/"
ls -la backend/dist/ || echo "⚠️ dist directory not found"

# Backend build script for Render.com
set -e

echo "🔧 Building Radix Tribes Test Backend..."

# Build shared package first
echo "📦 Building shared package..."
cd shared
npm install
npm run build
cd ..

# Build backend
echo "🚀 Building backend..."
cd backend
npm install
npm run build

echo "✅ Backend build completed successfully!"
echo "📁 Built files are in backend/dist/"
ls -la backend/dist/ || echo "⚠️ dist directory not found"
