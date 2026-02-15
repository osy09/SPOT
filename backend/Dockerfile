FROM node:20-bookworm-slim

WORKDIR /app

# Required for YouTube audio extraction/transcoding
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg yt-dlp \
  && rm -rf /var/lib/apt/lists/*

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
