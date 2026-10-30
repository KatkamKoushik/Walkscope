# Multi-stage Dockerfile for WalkWise Geospatial Gateway
FROM node:20-alpine AS builder

WORKDIR /app

# Copy root package manifests and package-lock
COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/
COPY packages/mobile/package.json ./packages/mobile/

# Clean install dependencies
RUN npm ci

# Copy source trees
COPY packages/core ./packages/core
COPY packages/server ./packages/server

# Build core and server
RUN npm run build:server

# Production image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production

COPY package.json package-lock.json ./
COPY packages/core/package.json ./packages/core/
COPY packages/server/package.json ./packages/server/

# Install production dependencies only
RUN npm ci --omit=dev

# Copy compiled code from builder
COPY --from=builder /app/packages/core ./packages/core
COPY --from=builder /app/packages/server/dist ./packages/server/dist

EXPOSE 3000

USER node

CMD ["node", "packages/server/dist/index.js"]

