# Base Dockerfile for G-Stack tools
# Multi-stage build for optimized production images

FROM node:20-alpine AS base
WORKDIR /app
RUN apk add --no-cache git sqlite

# Build stage
FROM base AS builder
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production
WORKDIR /app
RUN apk add --no-cache git sqlite sqlite-libs
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/package*.json ./

# Create non-root user
RUN addgroup -g 1001 -S gstack && \
    adduser -S -u 1001 -G gstack gstack
USER gstack

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8080/health/live', (r) => { process.exit(r.statusCode === 200 ? 0 : 1) })" || exit 1

EXPOSE 8080
CMD ["node", "dist/index.js"]
