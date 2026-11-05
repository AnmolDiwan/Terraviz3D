# Stage 1: Build & Dependencies (Debian-based for native glibc onnxruntime support)
FROM node:22-slim AS builder

WORKDIR /app

# Install build dependencies if needed
COPY package*.json ./
RUN npm install --omit=dev --no-audit

# Stage 2: Production Minimal Runtime
FROM node:22-slim

WORKDIR /app

# Create non-root user for security (pre-existing 'node' in node images)
USER node

COPY --chown=node:node --from=builder /app/node_modules ./node_modules
COPY --chown=node:node package*.json ./
COPY --chown=node:node src/ ./src/
COPY --chown=node:node public/ ./public/

ENV NODE_ENV=production
ENV PORT=4000

EXPOSE 4000

# Container healthcheck using Node built-in fetch
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD node -e "fetch('http://localhost:4000/health').then(r => r.ok ? process.exit(0) : process.exit(1)).catch(() => process.exit(1))"

CMD ["node", "src/server.js"]
