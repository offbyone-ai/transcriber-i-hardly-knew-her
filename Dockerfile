# Multi-stage build for Transcriber app using Bun executable

# Stage 1: Build all packages and compile to standalone executable
FROM  oven/bun:1-slim AS build
WORKDIR /app

# Copy package files for dependency installation
COPY package.json bun.lock ./
COPY client/package.json ./client/
COPY server/package.json ./server/
COPY shared/package.json ./shared/
COPY turbo.json ./

# Copy source code needed for postinstall script
# NOTE: Source is copied BEFORE bun install to support the postinstall script
# which builds shared and server packages (required for workspace dependencies).
# This changes the layer caching strategy slightly but is necessary for Coolify.
# The postinstall script runs: turbo build --filter=shared --filter=server
COPY tsconfig.json ./
COPY shared/ ./shared/
COPY server/src/ ./server/src/
COPY server/tsconfig.json ./server/tsconfig.json
COPY server/migrations/ ./server/migrations/

# Install dependencies with frozen lockfile
# Postinstall will build shared + server packages during this step
RUN echo "Installing dependencies (postinstall will build shared + server)..." && \
    bun install --frozen-lockfile && \
    echo "Dependencies installed successfully!"

# Copy remaining source code (client for final build)
COPY client/ ./client/

# Copy landing page (static HTML/CSS served at root)
COPY landing/ ./landing/

# Build argument for client API URL
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL:-http://localhost:3000}

# Build all packages and create standalone executable
# This runs: turbo build -> copy client dist to server/static -> bun compile server
RUN bun run build:single

# Create data directory with proper permissions for runtime
RUN mkdir -p /app/data && chmod 777 /app/data

# Stage 2: Alpine-based runtime with glibc compatibility
FROM frolvlad/alpine-glibc:latest

WORKDIR /app

# Create nonroot user (UID 65532)
RUN adduser -D -u 65532 nonroot

# Copy the compiled Bun executable from build stage
COPY --from=build /app/server/transcriber transcriber

# Copy database migrations directory
COPY --from=build /app/server/migrations/ migrations/

# Copy static client files (client build output)
COPY --from=build /app/server/static/ static/

# Copy landing page files (served at root)
COPY --from=build /app/landing/ landing/

# Create data directory with proper ownership
RUN mkdir -p /app/data && chown -R nonroot:nonroot /app/data

# Switch to nonroot user
USER nonroot

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

# Run the transcriber executable directly
CMD ["./transcriber"]