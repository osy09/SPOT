FROM node:20-alpine

WORKDIR /app

# Required for YouTube audio extraction/transcoding
RUN apk add --no-cache ffmpeg yt-dlp

# Copy package files
COPY package*.json ./

# Install all dependencies (including devDependencies for prisma CLI)
RUN npm ci

# Copy prisma schema
COPY prisma ./prisma

# Generate Prisma Client
RUN npx prisma generate

# Copy source code
COPY src ./src

# Create data directory for SQLite
RUN mkdir -p /app/data

# Expose port
EXPOSE 4000

# Run migrations, seed, and start server
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node src/index.js"]
