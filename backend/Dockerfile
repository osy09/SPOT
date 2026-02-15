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

# Expose port
EXPOSE 4000

# For Turso, schema/data migration should be executed externally with Turso CLI.
CMD ["sh", "-c", "if [ \"$PRISMA_BOOTSTRAP_ON_START\" = \"true\" ]; then npx prisma migrate deploy && npx prisma db seed; fi; node src/index.js"]
