# Build Stage
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Production Stage
FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts ./
COPY --from=builder /app/package*.json ./
# Install production deps + tsx for running server.ts
RUN npm install --omit=dev && npm install -g tsx
EXPOSE 3000
ENV NODE_ENV=production
CMD ["tsx", "server.ts"]
