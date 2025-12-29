# Multi-stage build for Transcriber app using Bun executable
# Stage 1: Build all packages and compile to standalone executable
FROM oven/bun:1.3.4-slim AS build
WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY turbo.json ./
# Install dependencies with frozen lockfile
RUN bun install --frozen-lockfile

# Copy source code
COPY . .

# Build argument for client API URL
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL:-http://localhost:3000}

# Build all packages and create standalone executable
# This runs: turbo build -> copy client dist to server/static -> bun compile server
RUN bun run build:single

# Stage 2: Minimal runtime image with glibc
FROM chainguard/glibc-dynamic:latest

WORKDIR /app

# Copy the compiled Bun executable from build stage
COPY --from=build /app/server/transcriber transcriber

# Copy static client files (client build output)
COPY --from=build /app/server/static/ static/

# Copy auth database schema/migrations if they exist
# Note: SQLite database file (auth.db) will be created at runtime via volume
COPY --from=build --chown=nonroot:nonroot /app/server/src/auth.ts ./src/auth.ts 2>/dev/null || true

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Create directory for SQLite database with proper permissions
USER root
RUN mkdir -p /app/data && chown -R nonroot:nonroot /app/data
USER nonroot

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/usr/bin/wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]

# Run the standalone executable
CMD ["./transcriber"]
