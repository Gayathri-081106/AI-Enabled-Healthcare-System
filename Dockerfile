# Multi-stage production Dockerfile for MediConnect AI Healthcare System
FROM node:20-alpine AS builder

WORKDIR /app

# Install client dependencies and build React app
COPY client/package*.json ./client/
RUN cd client && npm ci

COPY client/ ./client/
RUN cd client && npm run build

# Install server production dependencies
COPY server/package*.json ./server/
RUN cd server && npm ci --only=production

# Final runtime image
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=5000

# Copy root metadata
COPY package*.json ./
COPY database/ ./database/

# Copy server application and node_modules
COPY --from=builder /app/server ./server
COPY server/ ./server/

# Copy compiled frontend distribution to serve from Express
COPY --from=builder /app/client/dist ./client/dist

# Ensure storage directories exist with appropriate permissions
RUN mkdir -p /app/server/uploads/medical_reports

EXPOSE 5000

CMD ["node", "server/server.js"]
