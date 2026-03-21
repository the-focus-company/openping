FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json ./
RUN npm install --production=false

COPY tsconfig.json ./
COPY src/ src/

RUN npx tsc

# --- Production stage ---
FROM node:22-alpine

WORKDIR /app

RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

COPY package.json ./
RUN npm install --production && npm cache clean --force

COPY --from=builder /app/dist dist/

USER appuser

EXPOSE 8001

HEALTHCHECK --interval=15s --timeout=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:8001/health || exit 1

CMD ["node", "dist/index.js"]
