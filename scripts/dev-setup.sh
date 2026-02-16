#!/bin/bash

# DBS Development Setup Script

set -e

echo "🚀 DBS Development Setup"
echo "========================"
echo ""

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 20+ first."
    exit 1
fi

echo "✅ Node.js $(node -v) detected"
echo ""

# Backend setup
echo "📦 Setting up backend..."
cd backend

if [ ! -f ".env" ]; then
    echo "📝 Creating .env from example..."
    cp ../.env.example .env
    echo "⚠️  Please edit backend/.env with your Google OAuth credentials"
else
    echo "✅ .env already exists"
fi

echo "📥 Installing backend dependencies..."
npm install

echo "🗄️  Running database migrations..."
npx prisma migrate dev --name init

echo "🔧 Generating Prisma Client..."
npx prisma generate

echo "✅ Backend setup complete!"
echo ""

# Frontend setup
cd ../frontend
echo "📦 Setting up frontend..."

echo "📥 Installing frontend dependencies..."
npm install

echo "✅ Frontend setup complete!"
echo ""

cd ..

echo "✨ Setup complete!"
echo ""
echo "To start development:"
echo "  Terminal 1: cd backend && npm run dev"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "📖 Read DEVELOPMENT.md for more information"
