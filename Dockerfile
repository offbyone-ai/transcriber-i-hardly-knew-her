# Multi-stage build for Transcriber app using Bun executable

# Stage 1: Build whisper.cpp for Linux x64
FROM --platform=linux/amd64 debian:bookworm-slim AS whisper-build

RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    cmake \
    git \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /whisper

# Clone and build whisper.cpp
# Disable FP16 to avoid SIMD issues, use basic CPU backend
RUN git clone --depth 1 https://github.com/ggml-org/whisper.cpp.git . && \
    cmake -B build -DCMAKE_BUILD_TYPE=Release -DGGML_FP16=OFF -DGGML_NATIVE=OFF && \
    cmake --build build --config Release -j$(nproc) && \
    cp build/bin/whisper-cli /usr/local/bin/whisper

# Download the base.en model (141MB) - good balance of speed/accuracy
RUN mkdir -p /models && \
    curl -L -o /models/ggml-base.en.bin \
    "https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-base.en.bin"

# Stage 2: Build all packages and compile to standalone executable
FROM --platform=linux/amd64 oven/bun:1.3.4-slim AS build
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

# Stage 3: Minimal runtime image with glibc
FROM --platform=linux/amd64 chainguard/glibc-dynamic:latest

WORKDIR /app

# Copy whisper.cpp binary from whisper build stage
COPY --from=whisper-build /usr/local/bin/whisper /usr/local/bin/whisper

# Copy whisper model
COPY --from=whisper-build /models/ /app/models/

# Copy the compiled Bun executable from build stage
COPY --from=build /app/server/transcriber transcriber

# Copy database migrations directory
COPY --from=build /app/server/migrations/ migrations/

# Copy static client files (client build output)
COPY --from=build /app/server/static/ static/

# Copy landing page files (served at root)
COPY --from=build /app/landing/ landing/

# Copy data directory with proper permissions
COPY --from=build --chown=nonroot:nonroot /app/data/ data/

# Set production environment
ENV NODE_ENV=production
ENV PORT=3000

# Note: SQLite database directory (/app/data) will be created by volume mount
# The nonroot user (UID 65532) already exists in chainguard/glibc-dynamic

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD ["/usr/bin/wget", "--no-verbose", "--tries=1", "--spider", "http://localhost:3000/health"]

# Run the standalone executable
CMD ["./transcriber"]
